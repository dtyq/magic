import type { Topic, ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"

export interface TopicsPopupProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onCreateTopic: () => void
	onOpenActionsPopup: (topic: Topic, project: ProjectListItem | null | undefined) => void
}
