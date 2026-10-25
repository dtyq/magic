import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import type { SendMessageByContentPayload } from "@/pages/superMagic/components/MessageEditor/types"
import {
	MentionItemType,
	type ProjectFileMentionData,
	type UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { RawMessage } from "@/types/chat/intermediate_message"
import type { ExportIssue } from "@magic/html2pptx"

export interface SuperMagicPptxExportIssuesPayload {
	issues: ExportIssue[]
	/** Whether the export completed with recoverable issues or failed entirely. */
	status?: "completed-with-issues" | "failed"
	fileId?: string
	fileName?: string
}

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
		focusAtEnd?: boolean
	}
}

/**
 * Create_New_Topic 的可选参数。
 * afterCreate 中的内容将在新话题创建并导航完成后自动插入输入框。
 */
export interface SuperMagicCreateNewTopicPayload {
	/** Mode to create the new topic in */
	topicMode?: import("@/pages/superMagic/pages/Workspace/types").TopicMode
	/** Optional topic name for the newly created topic */
	topicName?: string
	afterCreate?: {
		content: JSONContent
		extraData?: SuperMagicAddContentToChatPayload["extraData"]
		/** Send through the existing Send_Message_by_Content event after navigation */
		send?: boolean
		mentionItems?: SendMessageByContentPayload["mentionItems"]
		topicMode?: SendMessageByContentPayload["topicMode"]
		selectedModel?: SendMessageByContentPayload["selectedModel"]
		selectedImageModel?: SendMessageByContentPayload["selectedImageModel"]
		selectedVideoModel?: SendMessageByContentPayload["selectedVideoModel"]
		shouldClearEditorAfterSend?: SendMessageByContentPayload["shouldClearEditorAfterSend"]
		extra?: SendMessageByContentPayload["extra"]
	}
}

export type SuperMagicWidgetEditorCommandName =
	"setInput" | "appendInput" | "clearInput" | "getInput" | "sendMessage"

/** Carries one Widget-only editor request without exposing editor state to the host page. */
export interface SuperMagicWidgetEditorCommandPayload {
	command: SuperMagicWidgetEditorCommandName
	content?: string | JSONContent
	respond: (result?: string, error?: string) => void
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
export interface FileMentionTargetScope {
	projectId: string
	topicId: string | null
	identityKey: string
}

export interface SuperMagicAddFileToChatPayload {
	items: TiptapMentionAttributes[]
	is_new_topic: boolean
	autoFocus?: boolean
	targetScope?: FileMentionTargetScope
	/** 空 items 的同步能力查询；只读取目标编辑器，不改变草稿。 */
	checkEditable?: (editable: boolean) => void
}

/** Canvas selection media staged into MessageEditor before editor focus. */
export interface SuperMagicCanvasSelectionMentionsPayload {
	scopeKey: string
	selectionRevision: string
	/** Whether this snapshot comes from the currently active Canvas source. */
	active: boolean
	items: TiptapMentionAttributes[]
}

export interface CanvasSelectionMentionScope {
	workspaceId?: string | null
	projectId?: string | null
	topicId?: string | null
	designProjectId?: string | null
}

/**
 * Canvas selection is produced by a detail tab but consumed by the shared
 * MessageEditor. Keep the serialised key in one place so both sides agree on
 * the workspace/project/topic boundary while retaining the source canvas id.
 */
export function createCanvasSelectionMentionScopeKey(scope: CanvasSelectionMentionScope): string {
	return JSON.stringify([
		scope.workspaceId ?? "",
		scope.projectId ?? "",
		scope.topicId ?? "",
		scope.designProjectId ?? "",
	])
}

/**
 * The editor is shared by detail tabs and does not own a canvas id. It accepts
 * snapshots from the active canvas only when their workspace/project/topic
 * boundary matches the current conversation; the payload's active flag lets it
 * ignore stale deactivation events from cached sibling canvases.
 */
export function isCanvasSelectionMentionScopeInContext(
	scopeKey: string,
	scope: Pick<CanvasSelectionMentionScope, "workspaceId" | "projectId" | "topicId">,
): boolean {
	try {
		const parsed = JSON.parse(scopeKey)
		if (!Array.isArray(parsed) || parsed.length < 3) return false
		const [workspaceId, projectId, topicId] = parsed
		return (
			workspaceId === (scope.workspaceId ?? "") &&
			projectId === (scope.projectId ?? "") &&
			topicId === (scope.topicId ?? "")
		)
	} catch {
		return false
	}
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
