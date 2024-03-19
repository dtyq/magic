import { useStyles } from "./styles"
import { useMemoizedFn, useMount } from "ahooks"
import FlexBox from "@/opensource/components/base/FlexBox"
import MagicSearch from "@/opensource/components/base/MagicSearch"
import useSearchValue from "../TopicPanel/hooks/useSearchValue"
import { useEffect, useState, useRef } from "react"
import { BotApi, ChatApi } from "@/opensource/apis"
import { UserAvailableAgentInfo } from "@/opensource/apis/modules/chat/types"
import { Flex, Spin } from "antd"
import VirtualList from "rc-virtual-list"
import { ASSISTANT_ITEM_HEIGHT } from "./config"
import { uniqBy } from "lodash-es"
import ConversationItem from "../ConversationItem"
import EmptyFallback from "@/opensource/pages/chatNew/components/ChatSubSider/components/EmptyFallback"
import { useTranslation } from "react-i18next"
import ConversationStore from "@/opensource/stores/chatNew/conversation"
import { useChatWithMember } from "@/opensource/hooks/chat/useChatWithMember"
import { MessageReceiveType } from "@/opensource/types/chat"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface PaginationState {
	list: UserAvailableAgentInfo[]
	currentPage: number
	total: number
	totalPages: number
	hasMore: boolean
	loading: boolean
	error: string | null
}

const PAGE_SIZE = Math.floor(window.innerHeight / ASSISTANT_ITEM_HEIGHT)

const Sider = ({ onSelectAgent }: { onSelectAgent: (agent: UserAvailableAgentInfo) => void }) => {
	const { styles } = useStyles()
	const { t } = useTranslation("interface")

	const { searchValue, debouncedSearchValue, onSearchValueChange } = useSearchValue()

	const [state, setState] = useState<PaginationState>({
		currentPage: 1,
		total: 0,
		totalPages: 0,
		hasMore: true,
		loading: false,
		error: null,
		list: [],
	})

	const setConversationId = useMemoizedFn((agentId: string, conversationId: string) => {
		setState((prev) => ({
			...prev,
			list: prev.list.map((item) => {
				if (item.id === agentId) {
					return {
						...item,
						conversation_id: conversationId,
					}
				}
				return item
			}),
		}))
	})

	const loadingRef = useRef(false)
	const abortControllerRef = useRef<AbortController | null>(null)
	const chatWith = useChatWithMember()

	const loadData = useMemoizedFn(async (page: number = 1, reset: boolean = false) => {
		// Prevent duplicate requests
		if (loadingRef.current || (!state.hasMore && !reset)) return

		loadingRef.current = true
		setState((prev) => ({ ...prev, loading: true, error: null }))

		// Cancel previous request if exists
		if (abortControllerRef.current) {
			abortControllerRef.current.abort()
		}

		abortControllerRef.current = new AbortController()

		try {
			const res = await ChatApi.getAssistantAvailableList({
				page,
				pageSize: PAGE_SIZE,
				keyword: debouncedSearchValue,
			})

			if (
				page === 1 &&
				reset &&
				res.list.length > 0 &&
				!ConversationStore.currentConversation
			) {
				const data = res.list[0]
				try {
					const res = await BotApi.registerAndAddFriend(data.id)
					if (res.user_id) {
						const conversation = await chatWith(
							res.user_id,
							MessageReceiveType.Ai,
							false,
						)
						if (conversation) {
							data.conversation_id = conversation.id
						}
						onSelectAgent?.(data)
					}
				} catch (error) {
					console.error(error)
				}
			}

			setState((prev) => {
				const list = uniqBy(reset ? res.list : [...prev.list, ...res.list], "id")
				const total = res.total
				const hasMore = list.length < total
				return {
					...prev,
					currentPage: page,
					total,
					hasMore,
					loading: false,
					list,
				}
			})
		} catch (err: unknown) {
			if (err instanceof Error && err.name !== "AbortError") {
				const errorMessage = err.message || "Failed to load assistant list"
				setState((prev) => ({
					...prev,
					loading: false,
					error: errorMessage,
				}))
				magicToast.error(errorMessage)
				console.error("Load assistant list error:", err)
			}
		} finally {
			loadingRef.current = false
		}
	})

	const loadNextPage = useMemoizedFn(() => {
		if (state.hasMore && !state.loading) {
			loadData(state.currentPage + 1, false)
		}
	})

	// Search effect
	useEffect(() => {
		setState((prev) => ({
			...prev,
			currentPage: 1,
			list: [],
			hasMore: true,
			total: 0,
			totalPages: 0,
		}))
		loadData(1, true)
	}, [debouncedSearchValue, loadData])

	// Initial load
	useMount(() => {
		loadData(1, true)
	})

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort()
			}
		}
	}, [])

	const onScroll = useMemoizedFn((e: React.UIEvent<HTMLElement>) => {
		const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
		if (scrollTop + clientHeight >= scrollHeight - 1) {
			loadNextPage()
		}
	})

	return (
		<div className={styles.container}>
			<div className={styles.searchContainer}>
				<MagicSearch
					className={styles.search}
					value={searchValue}
					onChange={onSearchValueChange}
				/>
			</div>

			{state.error && state.list.length === 0 && (
				<FlexBox
					vertical
					align="center"
					justify="center"
					style={{ height: ASSISTANT_ITEM_HEIGHT }}
				>
					<div className={styles.errorText}>{state.error}</div>
				</FlexBox>
			)}

			<div className={styles.list} onScroll={onScroll}>
				<VirtualList data={state.list} itemHeight={ASSISTANT_ITEM_HEIGHT} itemKey="id">
					{(item: UserAvailableAgentInfo) => {
						return (
							<ConversationItem
								data={item}
								onUpdateConversationId={setConversationId}
								onSelectAgent={onSelectAgent}
							/>
						)
					}}
				</VirtualList>

				{state.loading && state.list.length > 0 && (
					<FlexBox justify="center" style={{ padding: 16 }}>
						<Spin size="small" />
					</FlexBox>
				)}

				{!state.hasMore && state.list.length > 0 && (
					<div className={styles.noMoreContainer}>
						<span className={styles.noMoreText}>
							{t("common.noMoreData", { ns: "super" })}
						</span>
					</div>
				)}

				{state.list.length === 0 && !state.loading && !state.error && (
					<Flex
						vertical
						gap={4}
						align="center"
						justify="center"
						className={styles.emptyFallback}
					>
						<EmptyFallback />
						<div className={styles.emptyFallbackText}>
							{t("chat.subSider.emptyFallbackText")}
						</div>
					</Flex>
				)}
			</div>
		</div>
	)
}

export default Sider
