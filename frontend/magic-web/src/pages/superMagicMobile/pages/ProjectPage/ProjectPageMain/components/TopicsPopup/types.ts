import type { TopicTypeFilterValue } from "@/pages/superMagic/utils/topicTypeFilter"
import type { Topic, ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"

export interface TopicsPopupProps {
	topicType?: TopicTypeFilterValue
	onTopicTypeChange?: (value: TopicTypeFilterValue) => void
	open: boolean
	onOpenChange: (open: boolean) => void
	onCreateTopic: () => void
	onOpenActionsPopup: (topic: Topic, project: ProjectListItem | null | undefined) => void
}
