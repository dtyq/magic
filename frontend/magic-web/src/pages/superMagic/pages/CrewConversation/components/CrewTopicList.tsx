import MobileTopicTypeFilter from "@/pages/superMagicMobile/components/TopicTypeFilter"
import TopicListFeedback from "@/pages/superMagic/components/TopicTypeFilter/TopicListFeedback"
import usePaginatedTopics from "@/pages/superMagic/hooks/usePaginatedTopics"
import { useTopicTypeFilter } from "@/pages/superMagic/hooks/useTopicTypeFilter"
import { Loader2, MessageSquare, Plus, X } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/utils/cn"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"

interface CrewTopicListProps {
	projectId?: string
	topics: Topic[]
	selectedTopicId?: string | null
	isCreatingTopic?: boolean
	className?: string
	showClose?: boolean
	onClose?: () => void
	onCreateTopic: () => void
	onSelectTopic: (topic: Topic) => void
}

function CrewTopicList({
	projectId,
	topics: storeTopics,
	selectedTopicId,
	isCreatingTopic = false,
	className,
	showClose = false,
	onClose,
	onCreateTopic,
	onSelectTopic,
}: CrewTopicListProps) {
	const { t } = useTranslation(["crew/market", "super"])
	const [topicType, setTopicType] = useTopicTypeFilter(projectId)
	const filtered = usePaginatedTopics({
		enabled: Boolean(projectId) && topicType !== "all",
		projectId: projectId || "",
		storeTopics,
		topicType,
		pageSize: 100,
	})
	const topics = topicType === "all" ? storeTopics : filtered.displayTopics

	return (
		<section className={cn("flex h-full min-h-0 flex-col", className)}>
			<div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
				<div className="min-w-0 text-sm font-medium text-foreground">
					{t("crew/market:crewConversation.topics")}
				</div>
				<div className="flex shrink-0 items-center gap-1">
					{projectId && (
						<MobileTopicTypeFilter value={topicType} onChange={setTopicType} />
					)}
					<Button
						type="button"
						size="icon"
						variant="ghost"
						className="size-8"
						disabled={isCreatingTopic}
						aria-label={t("crew/market:crewConversation.newConversation")}
						onClick={onCreateTopic}
					>
						{isCreatingTopic ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Plus className="size-4" />
						)}
					</Button>
					{showClose ? (
						<Button
							type="button"
							size="icon"
							variant="ghost"
							className="size-8"
							aria-label={t("crew/market:crewConversation.closeTopics")}
							onClick={onClose}
						>
							<X className="size-4" />
						</Button>
					) : null}
				</div>
			</div>
			<ScrollArea key={`${projectId}:${topicType}`} className="min-h-0 flex-1">
				<div className="flex flex-col gap-1 p-2">
					{topicType !== "all" && filtered.error ? (
						<TopicListFeedback error={filtered.error} onRetry={filtered.reload} />
					) : topicType !== "all" && filtered.isLoading ? (
						<div role="status" className="p-4 text-center text-sm">
							{t("super:common.loading")}
						</div>
					) : topics.length === 0 ? (
						<div className="px-2 py-8 text-center text-xs text-muted-foreground">
							{t("super:messageHeader.noTopics")}
						</div>
					) : (
						topics.map((topic) => {
							const isSelected = selectedTopicId === topic.id
							return (
								<button
									key={topic.id}
									type="button"
									className={cn(
										"flex min-h-10 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
										isSelected
											? "bg-accent text-accent-foreground"
											: "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
									)}
									onClick={() => onSelectTopic(topic)}
									data-testid="on-select-topic"
								>
									<MessageSquare className="size-4 shrink-0" />
									<span className="min-w-0 flex-1 truncate">
										{topic.topic_name?.trim() ||
											t("super:messageHeader.untitledTopic")}
									</span>
								</button>
							)
						})
					)}
					{topicType !== "all" && filtered.hasMore && (
						<Button variant="ghost" onClick={() => void filtered.loadMore()}>
							{t("super:topicTypeFilter.more")}
						</Button>
					)}
				</div>
			</ScrollArea>
		</section>
	)
}

export default observer(CrewTopicList)
