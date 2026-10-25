import MobileTopicTypeFilter from "@/pages/superMagicMobile/components/TopicTypeFilter"
import TopicListFeedback from "@/pages/superMagic/components/TopicTypeFilter/TopicListFeedback"
import usePaginatedTopics from "@/pages/superMagic/hooks/usePaginatedTopics"
import { useTopicTypeFilter } from "@/pages/superMagic/hooks/useTopicTypeFilter"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Check, MessageCircle, X } from "lucide-react"
import { useTranslation } from "react-i18next"

import MagicPopup from "@/components/base-mobile/MagicPopup"
import { Button } from "@/components/shadcn-ui/button"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { getFallbackTopicModeIdentifier } from "@/services/superMagic/DefaultAgentSelectionService"
import { MobileResourceTypeIcon } from "@/pages/superMagicMobile/components/icons/mobile-resource-type-icon"
import ModeTag from "@/pages/superMagicMobile/pages/ProjectPage/ProjectPageMain/components/TopicsPopup/components/TopicItem/components/ModeTag"
import { cn } from "@/utils/cn"

interface MicroAppTopicPickerProps {
	open: boolean
	projectId: string
	topics: Topic[]
	selectedTopicId?: string
	onSelect: (topic: Topic) => void
	onClose: () => void
	/** Preview/published lists show the employee icon for each topic. */
	showModeIcon?: boolean
}

/** 微应用移动端话题选择使用独立底部列表，不引入桌面历史话题面板。 */
export default function MicroAppTopicPicker({
	open,
	projectId,
	topics: storeTopics,
	selectedTopicId,
	onSelect,
	onClose,
	showModeIcon = false,
}: MicroAppTopicPickerProps) {
	const { t } = useTranslation("super")
	const [topicType, setTopicType] = useTopicTypeFilter(projectId)
	const {
		displayTopics: topics,
		total,
		isLoading,
		error,
		reload,
		hasMore,
		loadMore,
	} = usePaginatedTopics({
		enabled: open,
		projectId,
		storeTopics,
		topicType,
		pageSize: 100,
	})

	return (
		<MagicPopup
			visible={open}
			position="bottom"
			onClose={onClose}
			hideDefaultHandle
			title={t("topic.allTopics")}
			bodyClassName="h-[64dvh] max-h-[64dvh] overflow-hidden rounded-t-[20px] border-0 bg-mobile-background p-0"
		>
			<div className="flex h-full min-h-0 flex-col">
				<header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
					<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<MessageCircle className="size-[18px]" aria-hidden />
					</div>
					<div className="min-w-0 flex-1">
						<p className="truncate text-base font-medium text-foreground">
							{t("topic.allTopics")}
						</p>
						<p className="text-xs text-muted-foreground">
							{t("microAppPage.mobileConversation.topicCount", {
								count: total,
							})}
						</p>
					</div>
					{open && (
						<MobileTopicTypeFilter
							key={projectId}
							value={topicType}
							onChange={setTopicType}
						/>
					)}
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-9"
						onClick={onClose}
						aria-label={t("common.close")}
					>
						<X className="size-[18px]" aria-hidden />
					</Button>
				</header>

				<ScrollArea
					key={`${projectId}:${topicType}`}
					className="min-h-0 flex-1"
					viewportClassName="px-3 py-2"
				>
					{error ? (
						<TopicListFeedback error={error} onRetry={reload} />
					) : isLoading ? (
						<div
							role="status"
							className="p-4 text-center text-sm text-muted-foreground"
						>
							{t("common.loading")}
						</div>
					) : topics.length === 0 ? (
						<div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
							{t("microAppPage.mobileConversation.noTopics")}
						</div>
					) : (
						<div className="flex flex-col gap-1">
							{topics.map((topic) => {
								const selected = topic.id === selectedTopicId
								const isRunning =
									topic.task_status === "running" ||
									topic.task_status === "waiting_for_user"
								return (
									<button
										key={topic.id}
										type="button"
										className={cn(
											"flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left",
											selected && "bg-primary/10",
										)}
										onClick={() => onSelect(topic)}
										data-testid={`micro-app-mobile-topic-${topic.id}`}
									>
										<MobileResourceTypeIcon
											type="projectTopic"
											isRunning={isRunning}
											iconSizeClass="size-5"
											data-testid="micro-app-mobile-topic-icon"
										/>
										{showModeIcon ? (
											<span data-testid="micro-app-mobile-topic-mode-icon">
												<ModeTag
													mode={
														topic.topic_mode ||
														getFallbackTopicModeIdentifier()
													}
													agentCode={topic.agent_code}
												/>
											</span>
										) : null}
										<div className="min-w-0 flex-1">
											<p className="truncate text-sm font-medium text-foreground">
												{topic.topic_name || t("topic.unnamedTopic")}
											</p>
										</div>
										{selected ? (
											<Check
												className="size-4 shrink-0 text-primary"
												aria-hidden
											/>
										) : null}
									</button>
								)
							})}
						</div>
					)}
					{hasMore && (
						<Button variant="ghost" className="w-full" onClick={() => void loadMore()}>
							{t("topicTypeFilter.more")}
						</Button>
					)}
				</ScrollArea>
			</div>
		</MagicPopup>
	)
}
