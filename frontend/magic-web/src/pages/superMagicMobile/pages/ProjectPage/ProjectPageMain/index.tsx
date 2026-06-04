import { memo, useMemo, useState } from "react"
import { ChevronRight, Ellipsis, Pin, PinOff, Trash2 } from "lucide-react"
import { observer } from "mobx-react-lite"
import type { TopicListProps } from "./types"
import { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { projectStore, topicStore } from "@/pages/superMagic/stores/core"
import ProjectTopicsEmptyState from "./components/ProjectTopicsEmptyState"
import TopicItemSkeleton from "./components/TopicItemSkeleton"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import { ScrollEdgeFadeContainer } from "@/components/base-mobile/ScrollEdgeFade"
import SuperMagicService from "@/pages/superMagic/services"
import { formatRelativeTime } from "@/utils/string"
import { cn } from "@/lib/utils"
import { useMobileProjectTopicSwitch } from "@/pages/superMagicMobile/hooks/useMobileProjectTopicSwitch"
import { SwipeActionRow, type SwipeAction } from "@/components/base-mobile/SwipeActionRow"
import { MobilePinBadge } from "@/pages/superMagicMobile/components/icons/MobilePinBadge"
import { MobileResourceTypeIcon } from "@/pages/superMagicMobile/components/icons/mobile-resource-type-icon"
import { sortTopicsWithPinnedFirst } from "./hooks/topicPinSort"

type TopicWithPinnedState = Topic & {
	is_pinned?: boolean | 0 | 1
	pinned?: boolean | 0 | 1
}

function isPinnedTopic(topic: Topic) {
	const topicWithPinnedState = topic as TopicWithPinnedState
	const isPinned = topicWithPinnedState.is_pinned as boolean | 0 | 1 | undefined
	const pinned = topicWithPinnedState.pinned as boolean | 0 | 1 | undefined

	return isPinned === true || isPinned === 1 || pinned === true || pinned === 1
}

function isRunningLikeTopicStatus(status: Topic["task_status"] | string | undefined) {
	return status === "running" || status === "waiting_for_user"
}

/**
 * 单条话题行：支持左滑展示"更多"和"删除"操作按钮。
 * SwipeActionRow 负责手势逻辑与互斥展开，本组件只组装 actions 和行内容。
 */
const TopicItemComponent = memo(
	({
		item,
		setSelectedTopic,
		timeLabel,
		isSwipeOpen,
		onSwipeOpen,
		onSwipeClose,
		onMore,
		onPin,
		onDelete,
	}: {
		item: Topic
		setSelectedTopic?: (topic: Topic) => void
		timeLabel: string
		isSwipeOpen: boolean
		onSwipeOpen: () => void
		onSwipeClose: () => void
		onMore: (topic: Topic) => void
		onPin: (topic: Topic) => void
		onDelete: (topic: Topic) => void
	}) => {
		const { t } = useTranslation(["super", "interface"])
		const isTaskRunning = isRunningLikeTopicStatus(item.task_status)
		const isPinned = isPinnedTopic(item)
		const runningAriaLabel = t("accountPanel.timedTasks.running", { ns: "interface" })

		const actions: SwipeAction[] = [
			{
				id: "more",
				label: t("topicList.swipeMore", { ns: "super" }),
				icon: <Ellipsis className="size-4 text-secondary-foreground" />,
				className: "bg-secondary",
				labelClassName: "text-secondary-foreground",
				onClick: () => onMore(item),
			},
			{
				id: "pin",
				label: isPinned
					? t("topicList.swipeUnpin", { ns: "super" })
					: t("topicList.swipePin", { ns: "super" }),
				icon: isPinned ? (
					<PinOff className="size-4 text-primary-foreground" />
				) : (
					<Pin className="size-4 text-primary-foreground" />
				),
				className: "bg-primary",
				labelClassName: "text-primary-foreground",
				onClick: () => onPin(item),
			},
			{
				id: "delete",
				label: t("topicList.swipeDelete", { ns: "super" }),
				icon: <Trash2 className="size-4 text-white" />,
				className: "bg-destructive",
				labelClassName: "text-white",
				onClick: () => onDelete(item),
			},
		]

		return (
			<SwipeActionRow
				actions={actions}
				isOpen={isSwipeOpen}
				onOpen={onSwipeOpen}
				onClose={onSwipeClose}
				onRowClick={() => setSelectedTopic?.(item)}
				data-testid={`topic-item-${item.id}`}
			>
				{/* 行内容区：h-16 与 SwipeActionRow 外壳高度保持一致 */}
				<div className="flex h-16 w-full items-center gap-2 rounded-lg px-3 py-[10px]">
					{/* 项目内话题列表使用 MessageCircle（ProjectDetailScreen）；回收站话题实体为 MessageSquare。 */}
					<MobileResourceTypeIcon
						type="projectTopic"
						isRunning={isTaskRunning}
						aria-label={isTaskRunning ? runningAriaLabel : undefined}
						aria-busy={isTaskRunning}
					/>
					<div className="flex min-w-0 flex-1 flex-col items-start">
						<div className="flex h-6 w-full min-w-0 items-center gap-1">
							<p className="min-w-0 shrink truncate text-[16px] font-medium leading-6 text-foreground">
								{item.topic_name || t("topic.unnamedTopic")}
							</p>
							{isPinned ? <MobilePinBadge /> : null}
						</div>
						<p className="w-full truncate text-[12px] font-light leading-4 text-muted-foreground">
							{timeLabel}
						</p>
					</div>
					<ChevronRight className="size-4 shrink-0 text-foreground" aria-hidden />
				</div>
			</SwipeActionRow>
		)
	},
)

const ProjectPageMain = observer(function ProjectPageMain({
	className,
	onTopicMore,
	onTopicPin,
	onTopicDelete,
}: TopicListProps & {
	onTopicMore?: (topic: Topic) => void
	onTopicPin?: (topic: Topic) => void
	onTopicDelete?: (topic: Topic) => void
}) {
	const { i18n } = useTranslation("super")

	const selectedProject = projectStore.selectedProject
	const processedTopics = useMemo(
		() => sortTopicsWithPinnedFirst(topicStore.topics),
		[topicStore.topics],
	)
	const { switchToProjectTopic: onSwitchSuperMagicChat } = useMobileProjectTopicSwitch({
		projectId: selectedProject?.id,
	})

	/** 同时只允许一行处于左滑展开状态 */
	const [openItemId, setOpenItemId] = useState<string | null>(null)

	const loading = topicStore.isFetchList

	/**
	 * 话题列表时间收口到项目现有相对时间工具，避免移动端页面继续各自维护展示规则。
	 */
	const formatTopicTimeLabel = useMemoizedFn((topic: Topic) => {
		const rawTime = topic.updated_at
		if (!rawTime) return ""

		return formatRelativeTime(i18n.language)(rawTime)
	})

	/** 下拉刷新话题列表，与桌面端数据来源一致 */
	const handleRefreshTopics = useMemoizedFn(async () => {
		if (!selectedProject?.id) return
		await SuperMagicService.topic.fetchTopics({
			projectId: selectedProject.id,
		})
	})

	const handleTopicMore = useMemoizedFn((topic: Topic) => {
		onTopicMore?.(topic)
	})

	const handleTopicPin = useMemoizedFn((topic: Topic) => {
		onTopicPin?.(topic)
	})

	const handleTopicDelete = useMemoizedFn((topic: Topic) => {
		onTopicDelete?.(topic)
	})

	const isTopicsEmpty = !loading && processedTopics.length === 0
	const shouldStretchPullToRefresh = isTopicsEmpty

	/*
	 * antd-mobile PullToRefresh content height follows children only; stretch PTR + content
	 * so empty state can use flex centering inside the topics panel (between tabs and composer).
	 */
	const pullToRefreshStretchClassName =
		"[&_.adm-pull-to-refresh]:flex [&_.adm-pull-to-refresh]:h-full [&_.adm-pull-to-refresh]:min-h-0 [&_.adm-pull-to-refresh]:flex-col [&_.adm-pull-to-refresh-content]:flex [&_.adm-pull-to-refresh-content]:min-h-0 [&_.adm-pull-to-refresh-content]:flex-1 [&_.adm-pull-to-refresh-content]:flex-col"

	return (
		<ScrollEdgeFadeContainer
			fadeColor="mobile-background"
			className={cn("min-h-0 flex-1", className)}
			contentDeps={[processedTopics.length, loading, isTopicsEmpty, selectedProject?.id]}
		>
			<MagicPullToRefresh
				embedInParentScroll
				onRefresh={handleRefreshTopics}
				showSuccessMessage={false}
				containerClassName={cn(
					"relative min-h-0 w-full flex-1",
					shouldStretchPullToRefresh &&
						cn("!overflow-hidden", pullToRefreshStretchClassName),
				)}
			>
				{loading ? (
					<div className="flex w-full flex-col gap-1 pt-0">
						<TopicItemSkeleton />
						<TopicItemSkeleton />
						<TopicItemSkeleton />
						<TopicItemSkeleton />
					</div>
				) : isTopicsEmpty ? (
					<div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center px-3 text-center">
						<ProjectTopicsEmptyState />
					</div>
				) : (
					<div className="flex w-full flex-col gap-1 pt-0">
						{processedTopics.map((item) => (
							<TopicItemComponent
								key={item.id}
								item={item}
								setSelectedTopic={onSwitchSuperMagicChat}
								timeLabel={formatTopicTimeLabel(item)}
								isSwipeOpen={openItemId === item.id}
								onSwipeOpen={() => setOpenItemId(item.id)}
								onSwipeClose={() => setOpenItemId(null)}
								onMore={handleTopicMore}
								onPin={handleTopicPin}
								onDelete={handleTopicDelete}
							/>
						))}
					</div>
				)}
			</MagicPullToRefresh>
		</ScrollEdgeFadeContainer>
	)
})

ProjectPageMain.displayName = "ProjectPageMain"
export default ProjectPageMain
