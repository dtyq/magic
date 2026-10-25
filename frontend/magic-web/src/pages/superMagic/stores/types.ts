import type { DownloadProgressState } from "./download-progress"
import type { SeqRecord } from "@/apis/modules/chat/types"
import type {
	ConversationMessageSend,
	ConversationQueryMessage,
	SuperMagicNode,
} from "@/types/chat/conversation_message"
import type { SeqResponse } from "@/types/request"

// ─── 基础别名 ────────────────────────────────────────────────

export type SuperMagicStoreTopicId = string

// ─── 原始消息相关 ────────────────────────────────────────────

export type RawSuperMagicMessageNode = SuperMagicNode
export type RawSuperMagicIMMessage = ConversationQueryMessage
export type RawSuperMagicMessageSequence = SeqResponse<ConversationQueryMessage>
export type RawSuperMagicMessageEnvelope = SeqRecord<ConversationQueryMessage>

export interface PendingUserMessageEnvelope {
	message: ConversationMessageSend["message"]
	conversation_id: string
}

export type HttpToolProjectionPolicy = "preserve_live" | "historical_terminal"

/**
 * HTTP 消息列表本身无法表达 Assistant 是否已完成本次消息级流。
 * 调用方必须根据请求来源明确选择：普通进度快照保留非终态流，
 * 已由 WS/完整恢复确认的 canonical 消息则统一进入 Final 结算。
 */
export type HttpAssistantSnapshotPolicy = "progress_snapshot" | "canonical_final"

/** Final settlement can finish transport while the visible row still catches up. */
export type AssistantRenderPhase = "reasoning_content" | "content" | "tool" | "idle" | "interrupted"

export type LifecycleEventPolicy = "silent" | "live"

export type CanonicalCommitTrigger = "websocket" | "recovery" | "polling" | "history"

/**
 * Canonical 写入来源与生命周期事件来源是两个独立维度。
 * HTTP authoritative-tail 只有明确由 WebSocket 通知触发时才属于实时生命周期。
 */
export interface CanonicalCommitContext {
	source: "im" | "http"
	lifecycleEventPolicy: LifecycleEventPolicy
	trigger?: CanonicalCommitTrigger
}

export interface InitializeMessagesOptions {
	mode?: "replace" | "merge" | "replace_tail"
	/** HTTP Assistant 的消息级 Final 准入策略；历史持久消息默认按 canonical Final 处理。 */
	assistantSnapshotPolicy?: HttpAssistantSnapshotPolicy
	/** 历史 HTTP 快照必须让普通 Tool 进入终态；live 增量则保留 waiting/running。 */
	toolProjectionPolicy?: HttpToolProjectionPolicy
	/** 冷历史只建立事件基线；实时权威尾部需要广播本次新到达的 canonical 消息。 */
	eventPolicy?: "silent_hydration" | "live_arrival"
	/** task.completed 等生命周期投影必须显式区分 WS 实时确认与历史/恢复/轮询。 */
	canonicalCommitContext?: CanonicalCommitContext
	/** HTTP 返回的完整 IM 状态观察集；可包含不参与本次 membership 替换的消息。 */
	statusMessages?: RawSuperMagicMessageEnvelope[]
	/** `replace_tail` 保留该 SuperMessage 及其之前的本地前缀，并权威替换其后的 membership。 */
	anchorSuperMessageId?: string
	/** HTTP 请求期间新产生的流不属于请求开始时的权威覆盖范围，提交时必须保留。 */
	preserveStreamSuperMessageIds?: string[]
	syncGeneration?: number
}

export interface ReconcileAuthoritativeMessagesInput {
	/** 成功 HTTP 查询实际返回的全部 envelope，按 app_message_id 归属 IM 状态。 */
	statusItems: RawSuperMagicMessageEnvelope[]
	/** 本次 HTTP 写入要采用的 membership 快照；允许按 SuperMessage 锚点截断。 */
	membershipItems: RawSuperMagicMessageEnvelope[]
	writeOptions:
		| InitializeMessagesOptions
		| { mode: "incremental"; assistantSnapshotPolicy?: HttpAssistantSnapshotPolicy }
}

export interface ServerMessagesConfirmedPayload {
	chat_topic_id: string
	app_message_ids: string[]
}

export interface SuperMagicStoreCollaborators {
	/** Retrieves local user messages that still need to be re-inserted into the main list on refresh recovery. */
	getRestorableUserMessages(chat_topic_id?: string): Array<{
		app_message_id: string
		created_at?: number
		anchor_message_id?: string
		anchor_seq_id?: string
		pending_message: PendingUserMessageEnvelope
	}>
	/** Queries whether a main message still has an optimistic sidecar status attached. */
	getMessageOptimisticStatus(chat_topic_id?: string, app_message_id?: string): string | undefined
}

export interface SuperMagicStoreCallbackRegistrar {
	registerOnServerMessagesConfirmed(
		callback: (payload: ServerMessagesConfirmedPayload) => void,
	): () => void
}

export interface SharedMessageItem {
	message_id?: string
	type?: string
	raw_content?: {
		rich_text?: Record<string, unknown>
		super_magic_message?: Record<string, unknown>
	}
	[key: string]: unknown
}

/** Store canonical nodes include live raw nodes and the heterogeneous share payload. */
export type SuperMagicStoreMessageNode = RawSuperMagicMessageNode | SharedMessageItem

// ─── 消息项 ──────────────────────────────────────────────────

export interface MessageItem {
	app_message_id: string
	/** 本地流式卡的序号只用于展示；真实 IM/HTTP 消息接管后才参与服务端水位。 */
	is_stream_placeholder: boolean
	/** 首次出现时的前一条可见消息身份；后续同步只更新内容，不改变展示位置。 */
	display_after_message_id?: string
	/** Store/UI 统一查询身份；User=app_message_id，Assistant/Tool 历史消息回退 app_message_id。 */
	super_message_id: string
	/** 消息相关联Id */
	correlation_id: string
	/** 父消息相关联Id */
	parent_correlation_id: string
	debug: RawSuperMagicMessageNode
	/** 事件 */
	event: string
	/** 引用消息关联id（用于超麦的"从此处创建新话题，复制对话列表"） */
	refer_message_id: string
	/** 消息归属 */
	role: "assistant" | "user" | "tool"
	/** 发送时间 */
	send_time: number
	/** 唯一id */
	seq_id: string
	/** IM 的消息状态（消息是否已读） */
	/** @deprecated 兼容字段；仅表示 IM 状态，不能作为 SuperMessage 执行状态使用。 */
	status: string
	/** IM message envelope 的状态；负责撤回/可见性语义。 */
	imStatus: string
	/** SuperMessage node 的状态；Assistant/Tool 执行与流生命周期语义。 */
	superStatus?: string
	/** IM 的话题id */
	topic_id: string
	/** 消息类型 */
	type: string

	[key: string]: unknown
}

// ─── Token 用量 ──────────────────────────────────────────────

export interface TokenUsageDetail {
	cached_tokens: number
	cache_write_tokens: number
}

export interface ContextInputBreakdown {
	source: "text_estimate"
	system_tokens: number
	tool_definition_tokens: number
	skill_tokens: number
	mcp_tokens: number
	conversation_tokens: number
	tool_result_tokens: number
	contains_non_text_content: boolean
	partial_attribution: boolean
}

export interface TokenUsage {
	input_breakdown?: ContextInputBreakdown
	input_tokens: number
	output_tokens: number
	total_tokens: number
	max_context_tokens?: number
	compaction_threshold_tokens?: number
	model_id: string
	input_tokens_details: TokenUsageDetail
	request_id: string
}

// ─── 流式渲染 ────────────────────────────────────────────────

export type MessageRole = "user" | "assistant" | "tool"

export interface FunctionCall {
	name: string
	label?: string
	arguments: string
}

export interface ToolCall {
	id: string
	type: string
	index: number
	function: FunctionCall
	tool?: ToolResponseState
}

export interface StreamMessage {
	role: MessageRole
	content: string | null
	reasoning_content: string | null
	tool_calls?: ToolCall[]
}

/** 单条 Assistant 流的视觉推进速度；消息身份与 canonical 完成状态不受其影响。 */
export type StreamRenderPace = "live" | "settling" | "catchup"

export interface StreamState {
	/** Topic 内稳定的 Assistant 逻辑消息身份。 */
	super_message_id: string
	/** 协议关联字段，只作为元数据与事件/恢复路由使用。 */
	correlation_id: string
	/** Agent 任务身份，不参与消息去重。 */
	task_id: string
	stage: "reasoning_content" | "content" | "tool" | "done"
	reasoning_content: string
	content: string
	currentToolIndex: number
	tool_calls: ToolCall[]
	isFinalMessageReceived: boolean
	/** 当前逻辑消息的视觉推进速度，避免 Topic 级策略泄漏到后继 SuperMessage。 */
	renderPace: StreamRenderPace
	/** Final/finish_reason 到达后开始温和结算的单调时钟时间。 */
	settlingStartedAt: number | null
	/** 检测到后继消息压力后才创建的快速追赶截止时间。 */
	finalCatchupDeadlineAt: number | null
	/** 快速追赶至少保留的可见帧数，防止调度停顿后单帧写入整段正文。 */
	catchupMinimumFramesRemaining: number
	/** 连续恢复次数；每次收到新数据后归零，用于 HTTP 恢复指数退避。 */
	recoveryAttempts: number
	finalMessage?: StreamMessage
}

export type StreamRecoveryTriggerReason =
	| "stream_watchdog"
	| "tool_response"
	| "persistent_message"
	| "checkpoint_rollback"
	| "topic_terminal"
	| "topic_activation"
	| "network_recovered"

export interface CheckpointRollbackRecoveryContext {
	eventId: string
	action: "start" | "undo" | "commit" | "rollback"
}

export interface StreamRecoveryRequestPayload {
	topicId: string
	correlationId: string
	reason?: StreamRecoveryTriggerReason
	requiredSeqId?: string
	anchorAppMessageId?: string
	anchorSeqId?: string
	/** 检查点广播上下文；eventId 不能提升为 requiredSeqId。 */
	checkpointRollback?: CheckpointRollbackRecoveryContext
}

export interface StreamRecoveryState {
	status: "waiting" | "recovering" | "failed"
	reason?: "recovery_failed"
	attempts: number
	startedAt: number
	elapsedMs: number
}

export interface StreamRecoveryFailurePayload extends StreamRecoveryState {
	topicId: string
	correlationId: string
	status: "failed"
	reason: "recovery_failed"
}

export interface ToolStreamStepResult {
	progressed: boolean
	done: boolean
}

export interface ToolStreamMessageState {
	tool_calls?: ToolCall[] | null
	currentToolIndex?: number
	[key: string]: unknown
}

export interface ToolResponseState {
	downloadProgress?: DownloadProgressState
	action?: string
	attachments?: null | Array<any>
	detail?: {
		data: any
		type: string
	}
	id?: string
	name?: string
	remark?: string
	status?: string
	[key: string]: unknown
}

/**
 * Message 级 Tool Response 恢复 sidecar。它描述“是否需要继续找真实 role=tool”，
 * 不是服务端消息，也不能替代 toolResponseMap 的 canonical 状态。
 */
export type ToolResponseRecoveryPhase =
	| "awaiting_response"
	| "execution_settled_pending_response"
	| "scheduled"
	| "in_flight"
	| "dormant"

export interface ToolResponseRecoveryState {
	topicId: string
	ownerSuperMessageId: string
	ownerAppMessageId: string
	toolId: string
	anchorSeqId: string
	phase: ToolResponseRecoveryPhase
	attempt: number
	nextRetryAt: number | null
	lastTrigger?: StreamRecoveryTriggerReason
}

export interface TopicMetaContentEntry {
	/** 当前流式渲染所在位置（表示文本下标） */
	index: number
	/** 当前文本块完整内容 */
	content: string
	/** 思考中内容 */
	reasoning_content: string
	/** 工具流式内容 */
	tool_calls: Record<string, any>[]
	/** 流式处理状态（-1:未开始流式、0开始流式、1思考中、2正文流式、3工具流式、4结束流式） */
	status: number
}

export interface StreamSnapshot {
	reasoning_content: string
	content: string
	tool_calls: ToolCall[]
}

export type TopicSyncState = "idle" | "syncing"

export type TopicRenderPolicy = "live" | "catchup" | "instant"

/** 权威同步完成后如何恢复 UI 投影；前台恢复使用一次性无动画投影。 */
export type TopicSyncRenderStrategy = "auto" | "foreground-instant"

export interface TopicMeta {
	/** 当前是否正在处于流式开启中 */
	isStream: boolean
	/** 当前是否正在流式交互中 */
	isStreamLoading: boolean
	/** 当前话题流式运行时定时器 */
	timer: ReturnType<typeof window.setTimeout> | null
	/** 当前唯一渲染 timer 所属的 SuperMessage ID，用于识别真正的后继压力。 */
	activeRenderSuperMessageId: string | null
	/** 当前话题等待流式恢复的 watchdog 定时器 */
	recoveryTimer: ReturnType<typeof window.setTimeout> | null
	/** recoveryTimer 当前关联的流式 correlationId */
	recoveryCorrelationId: string | null
	/** 当前流式文本数据映射（Record<当前流式卡片关联id - correlationId，当前流式文本内容>） */
	content: Map<string, StreamState>
	/** 不可见期间已完成的流式快照（用于切回后回放打字机） */
	streamSnapshots: Map<string, StreamSnapshot>
	/** 已由最终消息或服务端快照确认完成的流，晚到 chunk 不得重新启动动画 */
	finalizedCorrelationIds: Set<string>
	/** 最近一次成为可见话题的时间，用于区分短暂切换和长时间离开 */
	lastActiveAt: number | null
	/** 最近一次离开可见态的时间 */
	inactiveAt: number | null
	/** 最近一次离开可见态的单调时钟时间，用于排除系统时间跳变 */
	inactiveMonotonicAt: number | null
	/** 最近一次成功完成服务端权威同步的时间 */
	lastSyncedAt: number | null
	/** 最近一次权威同步确认的最大消息序列号 */
	lastSyncedSeqId: string
	/** 当前话题最新一次全量同步代次；旧代次响应不得写回 */
	syncGeneration: number
	/** 当前话题是否正在进行权威同步 */
	syncState: TopicSyncState
	/** 已发送但尚未观察到对应 Agent 流的本地执行次数；用于防止旧 finished 状态抢先开启终态同步。 */
	pendingExecutionCount: number
	/** 最近一次本地执行开始时间，用于让永久丢失首个 chunk 的发送最终回到恢复轮询。 */
	pendingExecutionStartedAt: number | null
	/** 当前话题恢复时采用的渲染策略 */
	renderPolicy: TopicRenderPolicy
}
