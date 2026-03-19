import { useMemoizedFn } from "ahooks"
import FlexBox from "@/components/base/FlexBox"
import MagicSearch from "@/components/base/MagicSearch"
import { useEffect, useState, useRef, forwardRef, memo } from "react"
import { ChatApi } from "@/apis"
import { UserAvailableAgentInfo } from "@/apis/modules/chat/types"
import { Spin } from "antd"
import VirtualList from "rc-virtual-list"
import { uniqBy } from "lodash-es"
import { useTranslation } from "react-i18next"
import { useStyles } from "./styles"
import useSearchValue from "../../../../TopicPanel/hooks/useSearchValue"
import MagicAvatar from "@/components/base/MagicAvatar"
import { SpinLoading } from "antd-mobile"
import SmartTooltip from "@/components/other/SmartTooltip"
import magicToast from "@/components/base/MagicToaster/utils"

interface PaginationState {
	list: UserAvailableAgentInfo[]
	currentPage: number
	total: number
	totalPages: number
	hasMore: boolean
	loading: boolean
	error: string | null
}

const PAGE_SIZE = 20

const AgentList = ({
	onSwitchAgent,
	isFetching,
	setIsFetching,
	switching,
	setSwitching,
	agent,
	style,
}: {
	onSwitchAgent: (agent: UserAvailableAgentInfo) => void
	isFetching: boolean
	setIsFetching: (isFetching: boolean) => void
	switching: boolean
	setSwitching: (switching: boolean) => void
	agent?: UserAvailableAgentInfo
	style?: React.CSSProperties
}) => {
	const { styles } = useStyles()
	const { t } = useTranslation("super")

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

	const loadingRef = useRef(false)
	const abortControllerRef = useRef<AbortController | null>(null)

	// Process list to mark first item of each category
	const processListWithCategoryFlags = useMemoizedFn((list: UserAvailableAgentInfo[]) => {
		const processedList = [...list]
		let hasSeenOfficial = false
		let hasSeenPersonal = false

		return processedList.map((item) => {
			let isFirstInCategory = false

			if (item.is_office && !hasSeenOfficial) {
				hasSeenOfficial = true
				isFirstInCategory = true
			} else if (!item.is_office && !hasSeenPersonal) {
				hasSeenPersonal = true
				isFirstInCategory = true
			}

			return {
				...item,
				isFirstInCategory,
			}
		})
	})

	const loadData = useMemoizedFn(async (page: number = 1, reset: boolean = false) => {
		setIsFetching(true)
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

			if (page === 1 && reset && res.list.length > 0 && !agent) {
				onSwitchAgent(res.list[0])
			}

			setState((prev) => {
				const rawList = uniqBy(reset ? res.list : [...prev.list, ...res.list], "id")
				const list = processListWithCategoryFlags(rawList)
				const total = res.total
				const hasMore = rawList.length < total
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
			setIsFetching(false)
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
		<div className={styles.container} style={style}>
			<div className={styles.searchContainer}>
				<MagicSearch
					className={styles.search}
					value={searchValue}
					onChange={onSearchValueChange}
				/>
			</div>

			{state.error && state.list.length === 0 && (
				<FlexBox vertical align="center" justify="center" style={{ height: 40 }}>
					<div className={styles.errorText}>{state.error}</div>
				</FlexBox>
			)}

			<div className={styles.list} onScroll={onScroll}>
				<VirtualList data={state.list} itemHeight={40} itemKey="id">
					{(item: UserAvailableAgentInfo & { isFirstInCategory?: boolean }) => {
						return (
							<FlexBox
								align="center"
								gap={4}
								className={styles.agentItem}
								data-is-office={item.is_office}
								data-is-first-in-category={item.isFirstInCategory}
								data-label={
									item.is_office
										? t("assistant.officialAgents")
										: t("assistant.personalAgents")
								}
								onClick={() => {
									onSwitchAgent(item)
								}}
							>
								<MagicAvatar src={item.agent_avatar} size={24} />
								<SmartTooltip className={styles.agentName}>
									{item.agent_name}
								</SmartTooltip>
								{switching && item.id === agent?.id && (
									<SpinLoading style={{ height: 16, width: 16 }} />
								)}
							</FlexBox>
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
			</div>
		</div>
	)
}

export default memo(AgentList)
