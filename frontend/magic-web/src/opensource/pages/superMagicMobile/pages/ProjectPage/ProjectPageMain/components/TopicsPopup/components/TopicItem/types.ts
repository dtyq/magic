import { Topic } from "@/opensource/pages/superMagic/pages/Workspace/types"

export interface TopicItemProps {
	topic: Topic
	onClose: () => void
	onOpenActionsPopup: (topic: Topic) => void
}
