import type MagicIcon from "@/opensource/components/base/MagicIcon"
import type { ComponentProps, FC } from "react"

export const enum ConversationMessageCollectionType {
	Message = "message",
	PendingMessage = "penddingMessage",
}

export type MessageItem<T extends ConversationMessageCollectionType> = {
	type: T
	messageId: string
}

export type ExtraSectionComponentProps = Omit<ExtraSectionInfo, "Component" | "key" | "onClick"> & {
	conversationId: string | undefined
	onClose: () => void
}

export const enum ExtraSectionKey {
	Topic = "Topic",
	Folder = "Folder",
	ChatHistory = "ChatHistory",
	Setting = "Setting",
	GroupNotice = "GroupNotice",
	NewGroupNotice = "NewGroupNotice",
	RemoveMember = "RemoveMember",
}

export interface ExtraSectionInfo {
	key: ExtraSectionKey
	title: string
	icon?: ComponentProps<typeof MagicIcon>["component"]
	Component: FC<ExtraSectionComponentProps>
	onClick?: () => void
}
