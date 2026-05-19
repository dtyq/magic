/**
 * HTML iframe 扩展能力的消息协议与配置类型。
 *
 * 这些类型定义了主站（parent）与 iframe 之间通过 postMessage
 * 交换的文件系统（FS）和语言模型（LLM）请求/响应报文结构，
 * 以及 HTML 应用的可选配置格式（app.json）。
 */

// ─── 消息类型常量 ────────────────────────────────────────────────────────────

export const FS_MESSAGE_TYPES = {
	READ_REQUEST: "MAGIC_FS_READ_REQUEST",
	READ_RESPONSE: "MAGIC_FS_READ_RESPONSE",
	WRITE_REQUEST: "MAGIC_FS_WRITE_REQUEST",
	WRITE_RESPONSE: "MAGIC_FS_WRITE_RESPONSE",
	WRITE_BLOB_REQUEST: "MAGIC_FS_WRITE_BLOB_REQUEST",
	WRITE_BLOB_RESPONSE: "MAGIC_FS_WRITE_BLOB_RESPONSE",
	LIST_REQUEST: "MAGIC_FS_LIST_REQUEST",
	LIST_RESPONSE: "MAGIC_FS_LIST_RESPONSE",
	WATCH_REGISTER: "MAGIC_FS_WATCH_REGISTER",
	WATCH_UNREGISTER: "MAGIC_FS_WATCH_UNREGISTER",
	FILE_CHANGED: "MAGIC_FS_FILE_CHANGED",
} as const

export type FSMessageType = (typeof FS_MESSAGE_TYPES)[keyof typeof FS_MESSAGE_TYPES]

export const LLM_MESSAGE_TYPES = {
	GET_MODELS_REQUEST: "MAGIC_LLM_GET_MODELS_REQUEST",
	GET_MODELS_RESPONSE: "MAGIC_LLM_GET_MODELS_RESPONSE",
	CHAT_REQUEST: "MAGIC_LLM_CHAT_REQUEST",
	CHAT_RESPONSE: "MAGIC_LLM_CHAT_RESPONSE",
	STREAM_REQUEST: "MAGIC_LLM_STREAM_REQUEST",
	STREAM_CHUNK: "MAGIC_LLM_STREAM_CHUNK",
	STREAM_ABORT: "MAGIC_LLM_STREAM_ABORT",
	STREAM_ERROR: "MAGIC_LLM_STREAM_ERROR",
} as const

export type LLMMessageType = (typeof LLM_MESSAGE_TYPES)[keyof typeof LLM_MESSAGE_TYPES]

// ─── FS 消息报文 ─────────────────────────────────────────────────────────────

export interface FSReadRequest {
	type: typeof FS_MESSAGE_TYPES.READ_REQUEST
	requestId: string
	path: string
}

export interface FSReadResponse {
	type: typeof FS_MESSAGE_TYPES.READ_RESPONSE
	requestId: string
	success: boolean
	content?: string
	error?: string
}

export interface FSWriteRequest {
	type: typeof FS_MESSAGE_TYPES.WRITE_REQUEST
	requestId: string
	path: string
	content: string
}

export interface FSWriteResponse {
	type: typeof FS_MESSAGE_TYPES.WRITE_RESPONSE
	requestId: string
	success: boolean
	error?: string
}

/**
 * 大文件写入请求：通过 postMessage 结构化克隆直接传输 Blob。
 * 无需 base64 编码，无需分片，跨域安全且零额外内存开销。
 * 限制：100 MB。
 */
export interface FSWriteBlobRequest {
	type: typeof FS_MESSAGE_TYPES.WRITE_BLOB_REQUEST
	requestId: string
	path: string
	/** 文件内容，直接以 Blob 形式通过 postMessage 传输 */
	blob: Blob
	/** 可选的文件名（覆盖从 path 推断的名称） */
	fileName?: string
}

export interface FSWriteBlobResponse {
	type: typeof FS_MESSAGE_TYPES.WRITE_BLOB_RESPONSE
	requestId: string
	success: boolean
	error?: string
}

export interface FSListRequest {
	type: typeof FS_MESSAGE_TYPES.LIST_REQUEST
	requestId: string
	dir?: string
}

export interface FSListResponse {
	type: typeof FS_MESSAGE_TYPES.LIST_RESPONSE
	requestId: string
	success: boolean
	files?: string[]
	error?: string
}

export interface FSWatchRegister {
	type: typeof FS_MESSAGE_TYPES.WATCH_REGISTER
	requestId: string
	path: string
}

export interface FSWatchUnregister {
	type: typeof FS_MESSAGE_TYPES.WATCH_UNREGISTER
	requestId: string
	path: string
}

export interface FSFileChanged {
	type: typeof FS_MESSAGE_TYPES.FILE_CHANGED
	path: string
	timestamp: number
}

// ─── LLM 消息报文 ────────────────────────────────────────────────────────────

export interface LLMMessage {
	role: "user" | "assistant" | "system"
	content: string
}

export interface LLMOptions {
	model?: string
	temperature?: number
	maxTokens?: number
	systemPrompt?: string
}

export interface LLMUsage {
	promptTokens: number
	completionTokens: number
	totalTokens: number
}

export interface LLMModelInfo {
	id: string
	object?: string
	owned_by?: string
}

export interface LLMGetModelsRequest {
	type: typeof LLM_MESSAGE_TYPES.GET_MODELS_REQUEST
	requestId: string
}

export interface LLMGetModelsResponse {
	type: typeof LLM_MESSAGE_TYPES.GET_MODELS_RESPONSE
	requestId: string
	success: boolean
	models?: LLMModelInfo[]
	error?: string
}

export interface LLMChatRequest {
	type: typeof LLM_MESSAGE_TYPES.CHAT_REQUEST
	requestId: string
	messages: LLMMessage[]
	options?: LLMOptions
}

export interface LLMChatResponse {
	type: typeof LLM_MESSAGE_TYPES.CHAT_RESPONSE
	requestId: string
	success: boolean
	content?: string
	model?: string
	usage?: LLMUsage
	error?: string
}

export interface LLMStreamRequest {
	type: typeof LLM_MESSAGE_TYPES.STREAM_REQUEST
	requestId: string
	messages: LLMMessage[]
	options?: LLMOptions
}

export interface LLMStreamChunk {
	type: typeof LLM_MESSAGE_TYPES.STREAM_CHUNK
	requestId: string
	delta: string
	done: boolean
	usage?: LLMUsage
}

export interface LLMStreamAbort {
	type: typeof LLM_MESSAGE_TYPES.STREAM_ABORT
	requestId: string
}

export interface LLMStreamError {
	type: typeof LLM_MESSAGE_TYPES.STREAM_ERROR
	requestId: string
	error: string
}

// ─── Agent 消息类型常量 ──────────────────────────────────────────────────────

export const AGENT_MESSAGE_TYPES = {
	GET_AGENTS_REQUEST: "MAGIC_GET_AGENTS_REQUEST",
	GET_AGENTS_RESPONSE: "MAGIC_GET_AGENTS_RESPONSE",
	CREATE_TOPIC_AND_SEND_REQUEST: "MAGIC_CREATE_TOPIC_AND_SEND_REQUEST",
	CREATE_TOPIC_AND_SEND_RESPONSE: "MAGIC_CREATE_TOPIC_AND_SEND_RESPONSE",
	SEND_MESSAGE_REQUEST: "MAGIC_SEND_MESSAGE_REQUEST",
	SEND_MESSAGE_RESPONSE: "MAGIC_SEND_MESSAGE_RESPONSE",
} as const

export type AgentMessageType = (typeof AGENT_MESSAGE_TYPES)[keyof typeof AGENT_MESSAGE_TYPES]

// ─── Agent 消息报文 ──────────────────────────────────────────────────────────

export interface AgentInfo {
	id: string
	name: string
	icon: string
	color: string
	type: "official" | "custom" | "public"
}

/**
 * Tiptap JSON 文档结构（简化版）。
 * 当 message 为此类型时，直接作为 jsonContent 发送，mention 节点已内联在文档中。
 */
export interface TiptapJSONContent {
	type: string
	attrs?: Record<string, unknown>
	content?: TiptapJSONContent[]
	text?: string
	[key: string]: unknown
}

export interface AgentGetAgentsRequest {
	type: typeof AGENT_MESSAGE_TYPES.GET_AGENTS_REQUEST
	requestId: string
}

export interface AgentGetAgentsResponse {
	type: typeof AGENT_MESSAGE_TYPES.GET_AGENTS_RESPONSE
	requestId: string
	success: boolean
	agents?: AgentInfo[]
	error?: string
}

export interface AgentCreateTopicAndSendRequest {
	type: typeof AGENT_MESSAGE_TYPES.CREATE_TOPIC_AND_SEND_REQUEST
	requestId: string
	/** 纯文本消息或完整的 tiptap JSON 文档（可包含 mention 节点） */
	message: string | TiptapJSONContent
	agentId?: string
	model?: string
}

export interface AgentCreateTopicAndSendResponse {
	type: typeof AGENT_MESSAGE_TYPES.CREATE_TOPIC_AND_SEND_RESPONSE
	requestId: string
	success: boolean
	topicId?: string
	error?: string
}

export interface AgentSendMessageRequest {
	type: typeof AGENT_MESSAGE_TYPES.SEND_MESSAGE_REQUEST
	requestId: string
	/** 纯文本消息或完整的 tiptap JSON 文档（可包含 mention 节点） */
	message: string | TiptapJSONContent
	model?: string
}

export interface AgentSendMessageResponse {
	type: typeof AGENT_MESSAGE_TYPES.SEND_MESSAGE_RESPONSE
	requestId: string
	success: boolean
	error?: string
}

// ─── HTML 应用配置（app.json，可选） ─────────────────────────────────────────

/**
 * app.json 可选配置。
 * 与 HTML 入口同级目录下，用于短路径别名等。未提供时主站
 * 使用 null，iframe FS 仅按应用根目录做路径隔离。
 */
export interface HTMLAppConfig {
	/** 应用名称，仅用于展示 */
	name?: string
	/** 应用版本 */
	version?: string
	/**
	 * 文件别名：逻辑名 -> 相对应用根目录的路径。
	 * 例如 { "users": "data/users.json" }
	 */
	files?: Record<string, string>
	/** 建议参与 watch 的文件（文档约定；主站不强制校验） */
	watch?: string[]
}

export const DEFAULT_APP_CONFIG: HTMLAppConfig = {
	files: {},
}
