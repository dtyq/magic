import { useTranslation } from "react-i18next"
import TopicListFeedback from "@/pages/superMagic/components/TopicTypeFilter/TopicListFeedback"
import usePaginatedTopics from "@/pages/superMagic/hooks/usePaginatedTopics"
import type { TopicTypeFilterValue } from "@/pages/superMagic/utils/topicTypeFilter"
import { Button } from "@/components/shadcn-ui/button"
import { observer } from "mobx-react-lite"
import { projectStore, topicStore } from "@/pages/superMagic/stores/core"
import ProjectPageMainTopicsView from "./ProjectTopicListView"
import type { TopicListProps } from "./types"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { useMobileProjectTopicSwitch } from "@/pages/superMagicMobile/hooks/useMobileProjectTopicSwitch"

/** Keeps the project page connected to global stores while the topic view stays reusable. */
const ProjectPageMain = observer(function ProjectPageMain({
	className,
	topicType = "all",
	onTopicMore,
	onTopicPin,
	onTopicDelete,
}: TopicListProps & {
	topicType?: TopicTypeFilterValue
	onTopicMore?: (topic: Topic) => void
	onTopicPin?: (topic: Topic) => void
	onTopicDelete?: (topic: Topic) => void
}) {
	const selectedProject = projectStore.selectedProject
	const { switchToProjectTopic } = useMobileProjectTopicSwitch({
		projectId: selectedProject?.id,
	})

	const { t } = useTranslation("super")
	// Keep filtered membership local; fetching must not change the selected conversation.
	const { displayTopics, isLoading, isReloading, error, reload, hasMore, loadMore } =
		usePaginatedTopics({
			projectId: selectedProject?.id || "",
			storeTopics: topicStore.topics,
			topicType,
			pageSize: 100,
		})

	return (
		<div className={`flex min-h-0 flex-col ${className || ""}`}>
			{error ? (
				<TopicListFeedback error={error} onRetry={reload} />
			) : (
				<ProjectPageMainTopicsView
					className="min-h-0 flex-1"
					key={`${selectedProject?.id}:${topicType}`}
					scrollClassName="px-3"
					projectId={selectedProject?.id}
					topics={displayTopics}
					loading={isLoading || isReloading}
					onRefresh={async () => reload()}
					emptyContent={topicType !== "all" ? <TopicListFeedback /> : undefined}
					footer={
						hasMore ? (
							<Button variant="ghost" onClick={() => void loadMore()}>
								{t("topicTypeFilter.more")}
							</Button>
						) : undefined
					}
					onSelectTopic={switchToProjectTopic}
					onTopicMore={onTopicMore}
					onTopicPin={onTopicPin}
					onTopicDelete={onTopicDelete}
				/>
			)}
		</div>
	)
})

ProjectPageMain.displayName = "ProjectPageMain"
export default ProjectPageMain
