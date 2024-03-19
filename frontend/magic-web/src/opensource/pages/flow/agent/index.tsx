import MagicSpin from "@/opensource/components/base/MagicSpin"
import { Avatar, Flex, Input, Select, List } from "antd"
import { useMemoizedFn, useBoolean, useResetState, useSize } from "ahooks"
import { useMemo, useRef, useState } from "react"
import AgentEmptyImage from "@/opensource/assets/logos/empty-ai.svg"
import { IconSearch, IconTrash, IconEdit } from "@tabler/icons-react"
import MagicButton from "@/opensource/components/base/MagicButton"
import type { Bot } from "@/opensource/types/bot"
import { useTranslation } from "react-i18next"
import InfiniteScroll from "react-infinite-scroll-component"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import DeleteDangerModal from "@/opensource/components/business/DeleteDangerModal"
import { openModal } from "@/opensource/utils/react"
import useSWRInfinite from "swr/infinite"
import { FlowRouteType } from "@/opensource/types/flow"
import { BotApi } from "@/opensource/apis"
import VersionRecord from "./components/VersionRecord"
import AgentCard from "./components/AgentCard"
import AddOrUpdateAgent from "../../explore/components/AddOrUpdateAgent"
import { hasAdminRight, hasEditRight } from "../components/AuthControlButton/types"
import { useStyles } from "./styles"
import { useDebounceSearch } from "../hooks/useDebounceSearch"
import { RouteName } from "@/opensource/routes/constants"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface KeyProp {
	pageIndex: number
	size: number
	previousPageData: { list: Bot.BotItem[]; page: number; total: number } | null
	name: string
}

function AgentPage() {
	const { t } = useTranslation("interface")
	const { t: globalT } = useTranslation()

	const navigate = useNavigate()

	const { styles, cx } = useStyles()

	const [keyword, setKeyword] = useState("")

	const [currentBot, setCurrentBot, resetCurrentBot] = useResetState<Bot.BotItem>(
		{} as Bot.BotItem,
	)

	const [addAgentModalOpen, { setTrue: openAddAgentModal, setFalse: closeAddAgentModal }] =
		useBoolean(false)

	const [VersionModalOpen, { setTrue: openVersionModal, setFalse: closeVersionModal }] =
		useBoolean(false)

	const scrollRef = useRef(null)
	const scrollSize = useSize(scrollRef)
	const pageSize = useMemo(() => {
		if (scrollSize?.height) {
			const size = Math.floor(scrollSize.height / 60)
			return size % 2 === 0 ? size : size + 1
		}
		return 10
	}, [scrollSize?.height])

	const fetcher = useMemoizedFn(async (key) => {
		const response = await BotApi.getUserBotList(key)
		const { list, page, total } = response
		return { list, page, total }
	})

	const getKey = ({ pageIndex, previousPageData, name, size }: KeyProp) => {
		if (previousPageData && !previousPageData.list.length) return null
		return { page: pageIndex + 1, pageSize: size, keyword: name } // 请求参数
	}

	const usePaginatedData = (value: string, size: number) => {
		const name = useDebounceSearch(value, 400)
		const { data, error, mutate, setSize, isLoading } = useSWRInfinite(
			(pageIndex, previousPageData) => getKey({ pageIndex, previousPageData, name, size }),
			fetcher,
		)

		const items = data ? data.map((page) => page?.list).flat() : []
		const total = data?.[0]?.total || 0

		// 判断是否还有更多数据
		const hasMore = items.length < total

		return { items, error, mutate, setSize, hasMore, total, isLoading }
	}

	const {
		items: botList,
		hasMore,
		setSize,
		mutate,
		total,
		isLoading,
	} = usePaginatedData(keyword, pageSize)

	const loadMoreData = useMemoizedFn(() => {
		if (!hasMore) return
		setSize((size) => size + 1)
	})

	const handleClickBot = useMemoizedFn((bot, type) => {
		// 打开编辑助理弹窗
		if (type === "update") {
			openAddAgentModal()
		} else {
			openVersionModal()
		}
		setCurrentBot(bot)
	})

	const onCardClick = useMemoizedFn((id: string) => {
		if (!id) return
		navigate({
			name: RouteName.FlowDetail,
			params: {
				id,
				type: FlowRouteType.Agent,
			},
		})
	})

	const selectOptions = useMemo(
		() => [
			{
				label: t("common.all", { ns: "flow" }),
				value: "all",
			},
		],
		[t],
	)

	const emptyContent = useMemo(() => {
		return (
			<Flex vertical gap={10} align="center" justify="center" style={{ height: "100%" }}>
				<Flex className={styles.EmptyImage} align="center" justify="center" vertical>
					<Avatar src={AgentEmptyImage} size={140} />
					<div className={styles.emptyTips}>
						{botList.length === 0 ? t("agent.agentEmpty") : t("flow.searchTips")}
					</div>
				</Flex>
				<MagicButton type="primary" onClick={openAddAgentModal}>
					{t("explore.buttonText.createAssistant")}
				</MagicButton>
			</Flex>
		)
	}, [botList.length, openAddAgentModal, styles.EmptyImage, styles.emptyTips, t])

	/** 删除 */
	const deleteItem = useMemoizedFn((bot: Bot.BotItem) => {
		openModal(DeleteDangerModal, {
			content: bot.robot_name,
			needConfirm: false,
			onSubmit: async () => {
				await BotApi.deleteBot(bot.id)
				magicToast.success(globalT("common.deleteSuccess", { ns: "flow" }))
				mutate((currentData) => {
					if (!currentData) return currentData
					const updatedData = currentData?.map((page) => ({
						...page,
						list: page?.list.filter((item) => item.id !== bot.id),
					}))
					updatedData[0].total -= 1 // 更新总数
					return updatedData
				}, false)
			},
		})
	})

	const updateAgent = useMemoizedFn((bot: Bot.Detail["botEntity"]) => {
		mutate((currentData) => {
			return currentData?.map((page) => ({
				...page,
				list: page?.list.map((item) =>
					item.id === bot.id
						? {
								...item,
								robot_name: bot.robot_name,
								robot_description: bot.robot_description,
								robot_avatar: bot.robot_avatar,
							}
						: item,
				),
			}))
		}, false)
	})

	const getDropdownItems = useMemoizedFn((bot: Bot.BotItem) => {
		return (
			<>
				{hasEditRight(bot.user_operation) && (
					<MagicButton
						justify="flex-start"
						icon={<MagicIcon component={IconEdit} size={20} color="currentColor" />}
						size="large"
						type="text"
						block
						onClick={() => handleClickBot(bot, "update")}
					>
						{t("button.edit")} {t("sider.assistants")}
					</MagicButton>
				)}
				{hasAdminRight(bot.user_operation) && (
					<MagicButton
						justify="flex-start"
						icon={<MagicIcon component={IconTrash} size={20} color="currentColor" />}
						size="large"
						type="text"
						block
						danger
						onClick={() => deleteItem(bot)}
					>
						{t("chat.delete")} {t("sider.assistants")}
					</MagicButton>
				)}
			</>
		)
	})

	return (
		<Flex vertical flex={1} className={styles.container}>
			<Flex align="center" justify="space-between" className={styles.top}>
				<div className={styles.leftTitle}>{`${t("common.agent", {
					ns: "flow",
				})}（${total}）`}</div>
				<Flex align="center" gap={6}>
					<Select defaultValue="all" className={styles.select} options={selectOptions} />
					<Input
						prefix={<IconSearch size={20} color="#b0b0b2" />}
						value={keyword}
						onChange={(e) => setKeyword(e.target.value)}
						placeholder={t("common.search", { ns: "flow" })}
					/>
					<MagicButton
						type="primary"
						style={{ borderRadius: 8 }}
						onClick={() => {
							resetCurrentBot()
							openAddAgentModal()
						}}
					>
						{t("explore.buttonText.createAssistant")}
					</MagicButton>
				</Flex>
			</Flex>

			<MagicSpin
				section
				spinning={isLoading}
				wrapperClassName="flex-1 [&_.magic-spin-container]:h-full"
			>
				<div
					ref={scrollRef}
					id="scrollableDiv"
					className={cx(styles.wrapper, {
						[styles.isEmptyList]: botList.length === 0,
					})}
				>
					{!isLoading && botList.length === 0 && emptyContent}

					{botList.length > 0 && (
						<InfiniteScroll
							dataLength={botList.length}
							next={loadMoreData}
							hasMore={hasMore}
							loader={
								<Flex align="center" justify="center" className={styles.emptyTips}>
									{t("spin.loading")}
								</Flex>
							}
							endMessage={
								<Flex align="center" justify="center" className={styles.emptyTips}>
									————— {t("common.comeToTheEnd", { ns: "flow" })} —————
								</Flex>
							}
							className={styles.scrollWrapper}
							scrollableTarget="scrollableDiv"
						>
							<List
								grid={{ gutter: 8, sm: 2, md: 2, lg: 2, xl: 2, xxl: 2 }}
								dataSource={botList}
								loading={isLoading}
								renderItem={(item) => {
									const dropdownItems = getDropdownItems(item)
									return (
										<List.Item className={styles.listItem}>
											<AgentCard
												card={item}
												onCardClick={onCardClick}
												// @ts-ignore
												dropdownItems={dropdownItems}
											/>
										</List.Item>
									)
								}}
							/>
						</InfiniteScroll>
					)}
				</div>
			</MagicSpin>

			<AddOrUpdateAgent
				open={addAgentModalOpen}
				close={closeAddAgentModal}
				agent={currentBot}
				submit={updateAgent}
			/>
			<VersionRecord
				open={VersionModalOpen}
				close={closeVersionModal}
				agentId={currentBot?.id}
			/>
		</Flex>
	)
}

export default AgentPage
