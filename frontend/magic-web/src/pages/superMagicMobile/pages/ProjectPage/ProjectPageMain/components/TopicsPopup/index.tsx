import TopicTypeFilter from "@/pages/superMagicMobile/components/TopicTypeFilter"
import TopicListFeedback from "@/pages/superMagic/components/TopicTypeFilter/TopicListFeedback"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { useEffect } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { InfiniteScroll } from "antd-mobile"
import { IconMessageCirclePlus } from "@tabler/icons-react"
import { Loader2 } from "lucide-react"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { projectStore, topicStore } from "@/pages/superMagic/stores/core"
import usePaginatedTopics from "@/pages/superMagic/hooks/usePaginatedTopics"
import TopicItem from "./components/TopicItem/index"
import type { TopicsPopupProps } from "./types"

function TopicsPopup({
	topicType = "all",
	onTopicTypeChange,
	open,
	onOpenChange,
	onCreateTopic,
	onOpenActionsPopup,
}: TopicsPopupProps) {
	const { t } = useTranslation("super")

	const selectedProject = projectStore.selectedProject
	const selectedTopic = topicStore.selectedTopic

	const {
		error,
		loadMoreError,
		displayTopics,
		total,
		isLoading,
		hasMore,
		loadMore,
		reload,
		reset,
	} = usePaginatedTopics({
		enabled: open,
		topicType,
		projectId: selectedProject?.id || "",
		selectedTopicId: selectedTopic?.id,
		storeTopics: topicStore.topics,
		// 话题列表 popup 用 100 条分页，不影响桌面端使用的默认 999 全量加载
		pageSize: 100,
	})

	useEffect(() => {
		if (open && selectedProject?.id) {
			reload()
		}
		if (!open) {
			reset()
		}
	}, [open, selectedProject?.id, reload, reset])

	return (
		<MagicPopup
			visible={open}
			onClose={() => onOpenChange(false)}
			position="bottom"
			bodyClassName="h-[80dvh]"
			title={t("topic.allTopics")}
		>
			<div className="flex h-full flex-col">
				<div className="flex shrink-0 flex-row-reverse items-center justify-between px-4 py-2.5">
					{onTopicTypeChange && (
						<TopicTypeFilter value={topicType} onChange={onTopicTypeChange} />
					)}
					<div className="text-start text-lg font-semibold text-foreground">
						{t("topic.allTopics")} ({total})
					</div>
				</div>

				<ScrollArea key={topicType} className="min-h-0 flex-1" viewportClassName="px-4">
					{error && <TopicListFeedback error={error} onRetry={reload} />}
					{!error && !isLoading && displayTopics.length === 0 && <TopicListFeedback />}
					{displayTopics.length === 0 && isLoading && (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
						</div>
					)}

					<div className="flex flex-col gap-0.5">
						{displayTopics.map((topic) => (
							<TopicItem
								key={topic.id}
								topic={topic}
								onClose={() => onOpenChange(false)}
								onOpenActionsPopup={(topic) =>
									onOpenActionsPopup(topic, selectedProject)
								}
							/>
						))}
					</div>

					{/* InfiniteScroll 放在列表末尾，向上滑动到底部时自动加载下一页 */}
					{/* Pause auto-loading after a page failure to avoid a retry loop; the user retries the same page manually. */}
					{loadMoreError ? (
						<TopicListFeedback error={loadMoreError} onRetry={() => void loadMore()} />
					) : (
						<InfiniteScroll hasMore={hasMore} loadMore={loadMore} />
					)}
				</ScrollArea>

				<div className="p-4">
					<button
						onClick={() => {
							onCreateTopic()
							onOpenChange(false)
						}}
						className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
						data-testid="on-create-topic"
					>
						<IconMessageCirclePlus size={16} />
						<span>{t("topic.createNewTopic")}</span>
					</button>
				</div>
			</div>
		</MagicPopup>
	)
}

export default observer(TopicsPopup)
