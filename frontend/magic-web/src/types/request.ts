import type { SeqRecord } from "@/apis/modules/chat/types"
import type { User } from "./user"
import type { CMessage, EventType } from "./chat"
import type { IntermediateMessage } from "./chat/intermediate_message"

/**
 * 流式消息状态
 */

export const enum StreamStatus {
	/** 流式消息开始 */
	Start = 0,
	/** 流式消息中 */
	Streaming = 1,
	/** 流式消息结束 */
	End = 2,
}

/**
 * 通用响应
 */
export interface CommonResponse<D> {
	code: number
	message: string
	data: D
}

/**
 * 服务端推送消息
 */
export type WebSocketPayload =
	| {
		type: Omit<EventType, EventType.Stream>
		payload: SeqRecord<CMessage>
	}
	| {
		type: EventType.Stream
		payload: StreamResponseV2
	}
	| {
		type: EventType.Intermediate
		payload: RecordSummaryResultMessage
	}

/**
 * 流式消息响应
 * @deprecated 请使用 StreamResponseV2 代替
 */
export type StreamResponse = {
	target_seq_id: string
	reasoning_content: string
	status: StreamStatus
	content: string
	llm_response: string
}

/**
 * 流式消息响应V2
 */
export type StreamResponseV2 = {
	streams: {
		stream_options: {
			status: StreamStatus
		}
	} & Record<string, unknown>
	target_seq_id: string
}

/**
 * 录音总结结果消息
 */
export type RecordSummaryResultMessage = {
	type: "recording_summary_result"
	recording_summary_result: {
		workspace_id: string
		project_id: string
		topic_id: string
		organization_code: string
		success: boolean
		timestamp: number
		workspace_name: string
		project_name: string
	}
}

/**
 * 即时消息响应
 */
export type IntermediateResponse = SeqRecord<IntermediateMessage>

/**
 * 分页响应
 */
export interface PaginationResponse<D> {
	/** 数据 */
	items: D[]
	/** 是否有更多数据 */
	has_more: boolean
	/** 分页 token */
	page_token: string
}

export interface EditMessageOptions {
	/** 消息 ID */
	magic_message_id: string
	/** 消息版本 ID */
	message_version_id: string | null
}

export type SeqResponse<S = object> = {
	/** 用户唯一 ID */
	magic_id: string
	/** 消息序列 ID */
	seq_id: string
	/** 消息 ID */
	message_id: string
	/** 引用消息 ID */
	refer_message_id: string
	/** 发送者消息 ID */
	sender_message_id: string
	/** 会话 ID */
	conversation_id: string
	/** 组织编码 */
	organization_code: string
	/** 消息内容 */
	message: S
	/** 编辑消息选项 */
	edit_message_options?: EditMessageOptions
}

/**
 * 登录响应
 */
export type LoginResponse = {
	type: "user"
	user: User.UserInfo
}

/**
 * WS 连接成功响应
 */
export type WebsocketOpenResponse = {
	sid: string
	upgrades: ["websocket"]
	pingInterval: number
	pingTimeout: number
}
