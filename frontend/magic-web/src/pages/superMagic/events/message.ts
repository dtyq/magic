import type { JSONContent } from "@tiptap/react"
import type { SendMessageByContentPayload } from "@/pages/superMagic/components/MessageEditor/types"
import {
	MentionItemType,
	type ProjectFileMentionData,
	type UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { RawMessage } from "@/types/chat/intermediate_message"

/**
 * Message_Scroll_To_Bottom 的可选参数结构。
 * 示例：
 * pubsub.publish(PubSubEvents.Message_Scroll_To_Bottom, { time: 1000 })
 */
export interface SuperMagicMessageScrollToBottomOptions {
	behavior?: ScrollBehavior
	time?: number
}

/**
 * Message_Scroll_To_Bottom 的参数 contract。
 */
export type SuperMagicMessageScrollToBottomArgs = [options?: SuperMagicMessageScrollToBottomOptions]

/**
 * Message_Register_Programmatic_Scroll 的可选参数结构。
 * 示例：
 * pubsub.publish(PubSubEvents.Message_Register_Programmatic_Scroll, { time: 480 })
 */
export interface SuperMagicMessageRegisterProgrammaticScrollOptions {
	time?: number
}

/**
 * Message_Register_Programmatic_Scroll 的参数 contract。
 */
export type SuperMagicMessageRegisterProgrammaticScrollArgs = [
	options?: SuperMagicMessageRegisterProgrammaticScrollOptions,
]

/**
 * Add_Content_To_Chat 的标准 contract。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.Add_Content_To_Chat, {
 *   content: { type: "doc", content: [] },
 *   extraData: { hasInput: true },
 * })
 */
export interface SuperMagicAddContentToChatPayload {
	content?: JSONContent
	extraData?: {
		hasInput?: boolean
	}
}

/**
 * Create_New_Topic 的可选参数。
 * afterCreate 中的内容将在新话题创建并导航完成后自动插入输入框。
 */
export interface SuperMagicCreateNewTopicPayload {
	/** Mode to create the new topic in */
	topicMode?: import("@/pages/superMagic/pages/Workspace/types").TopicMode
	afterCreate?: {
		content: JSONContent
		extraData?: SuperMagicAddContentToChatPayload["extraData"]
	}
}

/**
 * Re_Edit_Message 的标准 payload。
 * 只声明重新编辑流程当前真正消费的字段：内容和 mentions。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.Re_Edit_Message, {
 *   content: { type: "doc", content: [] },
 *   extra: { super_agent: { mentions: [] } },
 * })
 */
export interface SuperMagicReEditMessagePayload {
	content?: JSONContent | string
	extra?: {
		super_agent?: {
			mentions?: MentionListItem[]
			[key: string]: unknown
		}
		[key: string]: unknown
	}
	[key: string]: unknown
}

/**
 * Re_Edit_Message 的参数 contract。
 */
export type SuperMagicReEditMessageArgs = [payload: SuperMagicReEditMessagePayload]

/**
 * Set_Input_Message 的参数 contract。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.Set_Input_Message, "帮我总结一下")
 * pubsub.publish(PubSubEvents.Set_Input_Message, { type: "doc", content: [...] })
 */
export type SuperMagicSetInputMessageArgs = [message: string | string[] | JSONContent]

/**
 * Set_Demo_Text_To_Input 的参数 contract。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.Set_Demo_Text_To_Input, "演示文案")
 */
export type SuperMagicSetDemoTextToInputArgs = [text: string]

/**
 * Send_Message_by_Content 的参数 contract。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.Send_Message_by_Content, {
 *   jsonContent: { type: "doc", content: [] },
 * })
 */
export type SuperMagicSendMessageByContentArgs = [payload: SendMessageByContentPayload]

/**
 * Super_Magic_New_Message_V2 中附件字段的最小消费结构。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.Super_Magic_New_Message_V2, {
 *   message: {
 *     topic_id: "topic_123",
 *     super_magic_message: {
 *       tool: {
 *         id: "tool_123",
 *         name: "generate_canvas_images",
 *         attachments: [{ filename: "magic.project.js", file_id: "file_123" }],
 *       },
 *     },
 *   },
 * })
 */
export interface SuperMagicNewMessageAttachment {
	filename?: string
	file_id?: string
	timestamp?: number
	[key: string]: unknown
}

/**
 * Super_Magic_New_Message_V2 中工具详情 data 的最小消费结构。
 */
export interface SuperMagicNewMessageToolDetailData {
	project_path?: string
	[key: string]: unknown
}

/**
 * Super_Magic_New_Message_V2 中工具详情的最小消费结构。
 */
export interface SuperMagicNewMessageToolDetail {
	type?: "design" | "image"
	data?: SuperMagicNewMessageToolDetailData
	[key: string]: unknown
}

/**
 * Super_Magic_New_Message_V2 中工具卡片的最小消费结构。
 */
export interface SuperMagicNewMessageTool {
	id?: string
	name?: string
	detail?: SuperMagicNewMessageToolDetail
	attachments?: SuperMagicNewMessageAttachment[]
	[key: string]: unknown
}

/**
 * Super_Magic_New_Message_V2 的标准 payload。
 * TODO:为了不推动现有业务订阅方一起改字段，这里暂时兼容旧字段 general_agent_card。
 */
export interface SuperMagicNewMessagePayload {
	message?: {
		topic_id?: string
		general_agent_card?: {
			tool?: SuperMagicNewMessageTool
			[key: string]: unknown
		}
		super_magic_message?: {
			tool?: SuperMagicNewMessageTool
			[key: string]: unknown
		}
		[key: string]: unknown
	}
	[key: string]: unknown
}

/**
 * Super_Magic_New_Message_V2 的参数 contract。
 */
export type SuperMagicNewMessageArgs = [payload: SuperMagicNewMessagePayload]

/**
 * Receive_RecordSummary_Audio_File 的标准 payload。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.Receive_RecordSummary_Audio_File, {
 *   type: MentionItemType.UPLOAD_FILE,
 *   data: { file_id: "file_123", file_name: "meeting.mp3" },
 * })
 */
export type SuperMagicReceiveRecordSummaryAudioFilePayload =
	| {
			type: MentionItemType.PROJECT_FILE
			data: ProjectFileMentionData
	  }
	| {
			type: MentionItemType.UPLOAD_FILE
			data: UploadFileMentionData
	  }

/**
 * Receive_RecordSummary_Audio_File 的参数 contract。
 */
export type SuperMagicReceiveRecordSummaryAudioFileArgs = [
	payload: SuperMagicReceiveRecordSummaryAudioFilePayload,
]

/**
 * Set_Content_When_Slide_Added 的标准 contract。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.Set_Content_When_Slide_Added, {
 *   content: { type: "doc", content: [] },
 * })
 */
export interface SuperMagicSetContentWhenSlideAddedPayload {
	content: JSONContent
}

/**
 * Set_Content_When_Slide_Added 的参数 contract。
 */
export type SuperMagicSetContentWhenSlideAddedArgs = [
	payload: SuperMagicSetContentWhenSlideAddedPayload,
]

/**
 * Super_Magic_Insert_Marker_To_Chat 的标准 contract。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.Super_Magic_Insert_Marker_To_Chat, { items: [attrs] })
 */
export interface SuperMagicInsertMarkerToChatPayload {
	items: TiptapMentionAttributes[]
}

/**
 * Super_Magic_Sync_Markers_To_Chat 的标准 contract。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.Super_Magic_Sync_Markers_To_Chat, { items: [attrs1, attrs2] })
 */
export interface SuperMagicSyncMarkersToChatPayload {
	items: TiptapMentionAttributes[]
}

/**
 * Add_File_To_Chat 的标准 contract。
 * 由 MessageEditor 统一消费，负责将文件 mention 插入输入框。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.Add_File_To_Chat, {
 *   items: [mentionItem],
 *   is_new_topic: false,
 *   autoFocus: true,
 * })
 */
export interface SuperMagicAddFileToChatPayload {
	items: TiptapMentionAttributes[]
	is_new_topic: boolean
	autoFocus?: boolean
}

/**
 * Send_Interrupt_Message 的参数 contract。
 * callback 可选，打断请求完成后执行（用于 Promise resolve 场景）。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.Send_Interrupt_Message)
 * pubsub.publish(PubSubEvents.Send_Interrupt_Message, resolve)
 */
export type SuperMagicSendInterruptMessageArgs = [callback?: () => void]

/**
 * Stream_Message 的参数 contract。
 * WebSocket 流式原始消息到达时发布，由 superMagicStore 消费。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.Stream_Message, seq.message)
 */
export type SuperMagicStreamMessageArgs = [message: RawMessage]
