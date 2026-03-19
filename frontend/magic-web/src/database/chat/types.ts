import Conversation from "@/models/chat/conversation"
import { KnowledgeFileCacheData } from "@/services/file/KnowledgeFile"
import { EditorDraftWithInfo } from "@/stores/chatNew/editorDraft"
import { CMessage } from "@/types/chat"
import {
	ConversationMessageSend,
	ChatFileUrlData,
	RecordSummaryConversationMessage,
} from "@/types/chat/conversation_message"
import { ConversationTopic } from "@/types/chat/topic"
import { SeqResponse } from "@/types/request"
import Dexie, { EntityTable } from "dexie"

export type ChatDb = Dexie & {
	conversation: EntityTable<ReturnType<InstanceType<typeof Conversation>["toObject"]>, "id">
	conversation_dots: EntityTable<{ conversation_id: string; count: number }, "conversation_id">
	organization_dots: EntityTable<
		{ organization_code: string; count: number },
		"organization_code"
	>
	topic_dots: EntityTable<
		{ conversation_topic_id: string; count: number },
		"conversation_topic_id"
	>
	pending_messages: EntityTable<ConversationMessageSend, "message_id">
	disband_group_unconfirm: EntityTable<
		{ conversation_id: string; confirm: boolean },
		"conversation_id"
	>
	file_urls: EntityTable<ChatFileUrlData & { file_id: string; message_id: string }, "file_id">
	record_summary_message_queue: EntityTable<
		{
			send_time: number
			message: Pick<RecordSummaryConversationMessage, "type" | "recording_summary">
			callFnName: string
		},
		"send_time"
	>
	topic_list: EntityTable<
		{ conversation_id: string; topic_list: ConversationTopic[] },
		"conversation_id"
	>
	text_avatar_cache: EntityTable<{ text: string; base64: string }, "text">
	editor_draft: EntityTable<EditorDraftWithInfo, "key">
	knowledge_file_urls: EntityTable<KnowledgeFileCacheData, "file_key">
} & Record<string, EntityTable<SeqResponse<CMessage>, "seq_id">>
