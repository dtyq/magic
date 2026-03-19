import { Topic } from "@/pages/superMagic/pages/Workspace/types"

export interface TopicItemProps {
	topic: Topic
	onClose: () => void
	onOpenActionsPopup: (topic: Topic) => void
}
