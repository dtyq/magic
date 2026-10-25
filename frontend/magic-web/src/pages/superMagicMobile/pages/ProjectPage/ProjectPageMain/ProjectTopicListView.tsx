import { useState, type ReactNode } from "react"
import { ChevronRight, Ellipsis, Pin, PinOff, Trash2 } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import ProjectTopicsEmptyState from "./components/ProjectTopicsEmptyState"
import TopicItemSkeleton from "./components/TopicItemSkeleton"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import { ScrollEdgeFadeContainer } from "@/components/base-mobile/ScrollEdgeFade"
import { formatRelativeTime } from "@/utils/string"
import { cn } from "@/utils/cn"
import { SwipeActionRow, type SwipeAction } from "@/components/base-mobile/SwipeActionRow"
import { MobilePinBadge } from "@/pages/superMagicMobile/components/icons/MobilePinBadge"
import { MobileResourceTypeIcon } from "@/pages/superMagicMobile/components/icons/mobile-resource-type-icon"
import { sortTopicsWithPinnedFirst } from "./hooks/topicPinSort"

type TopicWithPinnedState = Topic & {
	is_pinned?: boolean | 0 | 1
	pinned?: boolean | 0 | 1
}

export interface ProjectTopicListViewProps {
	emptyContent?: ReactNode
	footer?: ReactNode
	className?: string
	/** Keeps page-specific horizontal spacing on the scroll port without narrowing edge fades. */
	scrollClassName?: string
	projectId?: string
	topics: Topic[]
	loading: boolean
	onRefresh: () => Promise<void>
	onSelectTopic: (topic: Topic) => void
	onTopicMore?: (topic: Topic) => void
	onTopicPin?: (topic: Topic) => void
	onTopicDelete?: (topic: Topic) => void
}

/** Normalizes legacy pin fields so scoped and global topic sources render identically. */
function isPinnedTopic(topic: Topic) {
	const pinnedTopic = topic as TopicWithPinnedState
	return (
		pinnedTopic.is_pinned === true ||
		pinnedTopic.is_pinned === 1 ||
		pinnedTopic.pinned === true ||
		pinnedTopic.pinned === 1
	)
}

/** Identifies task states that need the animated mobile topic icon. */
function isRunningLikeTopicStatus(status: Topic["task_status"] | string | undefined) {
	return status === "running" || status === "waiting_for_user"
}

/** Renders one swipeable topic row with the same actions across project and recording details. */
const TopicItem = observer(function TopicItem({
	item,
	timeLabel,
	isSwipeOpen,
	onSwipeOpen,
	onSwipeClose,
	onSelect,
	onMore,
	onPin,
	onDelete,
}: {
	item: Topic
	timeLabel: string
	isSwipeOpen: boolean
	onSwipeOpen: () => void
	onSwipeClose: () => void
	onSelect: (topic: Topic) => void
	onMore?: (topic: Topic) => void
	onPin?: (topic: Topic) => void
	onDelete?: (topic: Topic) => void
}) {
	const { t } = useTranslation(["super", "interface"])
	const isTaskRunning = isRunningLikeTopicStatus(item.task_status)
	const isPinned = isPinnedTopic(item)
	const actions: SwipeAction[] = []

	if (onMore) {
		actions.push({
			id: "more",
			label: t("topicList.swipeMore", { ns: "super" }),
			icon: <Ellipsis className="size-4 text-secondary-foreground" />,
			className: "bg-secondary",
			labelClassName: "text-secondary-foreground",
			onClick: () => onMore(item),
		})
	}
	if (onPin) {
		actions.push({
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
		})
	}
	if (onDelete) {
		actions.push({
			id: "delete",
			label: t("topicList.swipeDelete", { ns: "super" }),
			icon: <Trash2 className="size-4 text-white" />,
			className: "bg-destructive",
			labelClassName: "text-white",
			onClick: () => onDelete(item),
		})
	}

	return (
		<SwipeActionRow
			actions={actions}
			isOpen={isSwipeOpen}
			onOpen={onSwipeOpen}
			onClose={onSwipeClose}
			onRowClick={() => onSelect(item)}
			data-testid={`topic-item-${item.id}`}
		>
			<div className="flex h-16 w-full items-center gap-2 rounded-lg px-3 py-[10px]">
				<MobileResourceTypeIcon
					type="projectTopic"
					isRunning={isTaskRunning}
					aria-label={
						isTaskRunning
							? t("accountPanel.timedTasks.running", { ns: "interface" })
							: undefined
					}
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
})

/** Displays a dependency-injected mobile topic list without reading global project stores. */
export const ProjectTopicListView = observer(function ProjectTopicListView({
	className,
	scrollClassName,
	emptyContent,
	footer,
	projectId,
	topics,
	loading,
	onRefresh,
	onSelectTopic,
	onTopicMore,
	onTopicPin,
	onTopicDelete,
}: ProjectTopicListViewProps) {
	const { i18n } = useTranslation("super")
	const [openItemId, setOpenItemId] = useState<string | null>(null)
	// Sort during each observed render so in-place MobX pin updates cannot reuse stale ordering.
	const processedTopics = sortTopicsWithPinnedFirst(topics)
	const formatTopicTimeLabel = useMemoizedFn((topic: Topic) => {
		return topic.updated_at ? formatRelativeTime(i18n.language)(topic.updated_at) : ""
	})
	const isTopicsEmpty = !loading && processedTopics.length === 0
	const pullToRefreshStretchClassName =
		"[&_.adm-pull-to-refresh]:flex [&_.adm-pull-to-refresh]:h-full [&_.adm-pull-to-refresh]:min-h-0 [&_.adm-pull-to-refresh]:flex-col [&_.adm-pull-to-refresh-content]:flex [&_.adm-pull-to-refresh-content]:min-h-0 [&_.adm-pull-to-refresh-content]:flex-1 [&_.adm-pull-to-refresh-content]:flex-col"

	return (
		<ScrollEdgeFadeContainer
			fadeColor="mobile-background"
			className={cn("min-h-0 flex-1", className)}
			scrollClassName={scrollClassName}
			contentDeps={[processedTopics.length, loading, isTopicsEmpty, projectId]}
		>
			<MagicPullToRefresh
				embedInParentScroll
				onRefresh={onRefresh}
				showSuccessMessage={false}
				containerClassName={cn(
					"relative min-h-0 w-full flex-1",
					isTopicsEmpty && cn("!overflow-hidden", pullToRefreshStretchClassName),
				)}
			>
				{loading ? (
					<div
						className="flex w-full flex-col gap-1 pt-0"
						data-testid="project-topics-loading"
					>
						<TopicItemSkeleton />
						<TopicItemSkeleton />
						<TopicItemSkeleton />
						<TopicItemSkeleton />
					</div>
				) : isTopicsEmpty ? (
					<div
						className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center px-3 text-center"
						data-testid="project-topics-empty"
					>
						{emptyContent ?? <ProjectTopicsEmptyState />}
					</div>
				) : (
					<div
						className="flex w-full flex-col gap-1 pt-0"
						data-testid="project-topics-list"
					>
						{processedTopics.map((topic) => (
							<TopicItem
								key={topic.id}
								item={topic}
								timeLabel={formatTopicTimeLabel(topic)}
								isSwipeOpen={openItemId === topic.id}
								onSwipeOpen={() => setOpenItemId(topic.id)}
								onSwipeClose={() => setOpenItemId(null)}
								onSelect={onSelectTopic}
								onMore={onTopicMore}
								onPin={onTopicPin}
								onDelete={onTopicDelete}
							/>
						))}
					</div>
				)}
				{!loading && footer}
			</MagicPullToRefresh>
		</ScrollEdgeFadeContainer>
	)
})

export default ProjectTopicListView
