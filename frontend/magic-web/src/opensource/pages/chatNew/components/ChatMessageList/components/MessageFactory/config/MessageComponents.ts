import type React from "react"
import type {
	AggregateAISearchCardConversationMessage,
	AIImagesMessage,
	HDImageMessage,
	RichTextConversationMessage,
	TextConversationMessage,
	MarkdownConversationMessage,
	FileConversationMessage,
	AggregateAISearchCardConversationMessageV2,
} from "@/types/chat/conversation_message"
import { ConversationMessageType } from "@/types/chat/conversation_message"
import { StreamStatus } from "@/types/request"

interface MessageProps {
	content?: any
	reasoningContent?: any
	files?: any[]
	isSelf: boolean
	messageId: string
}

interface MessageComponent {
	isStreamingParser?: (message: any) => boolean
	isReasoningStreamingParser?: (message: any) => boolean
	reasoningContentParser?: (content: any) => string | undefined
	componentType: string
	contentParser?: (content: any) => any
	showFileComponent?: boolean
	fileParser?: (content: any, referFileId?: string) => any
	loader: () => Promise<{ default: React.ComponentType<MessageProps> }>
}

const messageComponents: Record<string, MessageComponent> = {
	[ConversationMessageType.RichText]: {
		componentType: "RichText",
		contentParser: (content: RichTextConversationMessage) =>
			JSON.parse(content.rich_text?.content ?? ""),
		fileParser: (message: RichTextConversationMessage, referFileId?: string) => {
			if (referFileId) {
				return []
			}
			return message.rich_text?.attachments
		},
		showFileComponent: true,
		loader: () => import("../components/RichText"),
	},
	[ConversationMessageType.Text]: {
		componentType: "Markdown",
		contentParser: (content: TextConversationMessage) => content.text?.content,
		reasoningContentParser: (content: TextConversationMessage) =>
			content.text?.reasoning_content,
		isStreamingParser: (message: TextConversationMessage) => {
			if (!message.text?.stream_options) return false
			return Boolean(
				message.text?.stream_options?.status !== StreamStatus.End && message.text?.content,
			)
		},
		isReasoningStreamingParser: (message: TextConversationMessage) => {
			if (!message.text?.stream_options) return false
			return (
				message.text?.stream_options?.status !== StreamStatus.End && !message.text?.content
			)
		},
		fileParser: (message: TextConversationMessage, referFileId?: string) => {
			if (referFileId) {
				return []
			}
			return message.text?.attachments
		},
		showFileComponent: true,
		loader: () => import("../components/Markdown"),
	},
	[ConversationMessageType.Markdown]: {
		componentType: "Markdown",
		contentParser: (content: MarkdownConversationMessage) => content.markdown?.content,
		reasoningContentParser: (content: MarkdownConversationMessage) =>
			content.markdown?.reasoning_content,
		isStreamingParser: (message: MarkdownConversationMessage) => {
			if (!message.markdown?.stream_options) return false
			return Boolean(
				message.markdown?.stream_options?.status !== StreamStatus.End &&
					message.markdown?.content,
			)
		},
		isReasoningStreamingParser: (message: MarkdownConversationMessage) => {
			if (!message.markdown?.stream_options) return false
			return Boolean(
				message.markdown?.stream_options?.status !== StreamStatus.End &&
					!message.markdown?.content,
			)
		},
		fileParser: (message: MarkdownConversationMessage) => message.markdown?.attachments,
		showFileComponent: true,
		loader: () => import("../components/Markdown"),
	},
	[ConversationMessageType.Files]: {
		componentType: "Files",
		showFileComponent: true,
		fileParser: (message: FileConversationMessage) => message.files?.attachments,
		loader: () => import("../components/Files"),
	},
	[ConversationMessageType.AggregateAISearchCard]: {
		componentType: "AggregateAISearchCard",
		contentParser: (content: AggregateAISearchCardConversationMessage<false>) =>
			content.aggregate_ai_search_card ?? "",
		reasoningContentParser: (content: AggregateAISearchCardConversationMessage<false>) => {
			if (content.aggregate_ai_search_card?.finish) return undefined
			return content.aggregate_ai_search_card?.reasoning_content ?? ""
		},
		isStreamingParser: (message: AggregateAISearchCardConversationMessage<false>) => {
			if (message.aggregate_ai_search_card?.finish) return false
			return message.aggregate_ai_search_card?.stream_options?.status !== StreamStatus.End
		},
		isReasoningStreamingParser: (message: AggregateAISearchCardConversationMessage<false>) => {
			if (message.aggregate_ai_search_card?.finish) return false
			return (
				message.aggregate_ai_search_card?.stream_options?.status !== StreamStatus.End &&
				!message.aggregate_ai_search_card?.llm_response
			)
		},
		showFileComponent: false,
		loader: () => import("../components/AiSearch"),
	},
	[ConversationMessageType.AggregateAISearchCardV2]: {
		componentType: "AggregateAISearchCardV2",
		contentParser: (content: AggregateAISearchCardConversationMessageV2) =>
			content.aggregate_ai_search_card_v2 ?? "",
		reasoningContentParser: (content: AggregateAISearchCardConversationMessageV2) => {
			return content.aggregate_ai_search_card_v2?.summary?.reasoning_content ?? ""
		},
		isStreamingParser: (message: AggregateAISearchCardConversationMessageV2) => {
			if (message.aggregate_ai_search_card_v2?.stream_options?.status === StreamStatus.End)
				return false
			return true
		},
		isReasoningStreamingParser: (message: AggregateAISearchCardConversationMessageV2) => {
			if (message.aggregate_ai_search_card_v2?.stream_options?.status === StreamStatus.End)
				return false
			return !message.aggregate_ai_search_card_v2?.summary?.content
		},
		showFileComponent: false,
		loader: () => import("../components/AiSearchV2"),
	},
	[ConversationMessageType.AiImage]: {
		componentType: "AiImage",
		contentParser: (content: AIImagesMessage) => content.ai_image_card,
		showFileComponent: false,
		loader: () => import("../components/AiImage"),
	},
	[ConversationMessageType.HDImage]: {
		componentType: "HDImage",
		contentParser: (content: HDImageMessage) => content.image_convert_high_card,
		showFileComponent: false,
		loader: () => import("../components/HDImage"),
	},
}

export default messageComponents
