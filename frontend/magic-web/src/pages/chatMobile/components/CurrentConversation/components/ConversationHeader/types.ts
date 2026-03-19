import { MessageReceiveType } from "@/types/chat"

export interface ConversationHeaderProps {
	receiveId?: string
	receiveType?: MessageReceiveType
	headerTitleClass?: string
	headerSubTitleClass?: string
	className?: string
}

export interface BaseHeaderProps {
	receiveId: string
	headerTitleClass?: string
	headerSubTitleClass?: string
	className?: string
}
