/** Store 事件的事实来源，用于区分同一状态变化由哪条输入链路确认。 */
export type SuperMagicEventSource = "stream" | "im" | "http" | "shared" | "local" | "recovery"

/** 六类 Store 事件共享的顺序、版本与实体定位信息。 */
export interface SuperMagicEventMeta {
	/** 当前 Store 实例内严格递增的事件序号，用于还原不同事件之间的发布顺序。 */
	/** 该值由 emitter 在发布时计算，不等同于服务端消息 seq_id。 */
	sequence: number
	/** 当前实体的语义修订号，用于识别同一消息、流代次或工具调用的后续变化。 */
	/** 该值由 transition ledger 按实体 key 递增计算，不直接映射服务端字段。 */
	revision: number
	/** 事件完成对应 Store 状态写入的本地时间戳，单位为毫秒。 */
	/** 该值在 canonical mutation 完成后由 Store 使用 Date.now() 计算。 */
	occurredAt: number
	/** 触发当前状态变化的输入来源。 */
	/** 该值由 stream、IM、HTTP、分享回放、本地写入或恢复路径映射。 */
	source: SuperMagicEventSource
	/** 事件所属的 SuperMagic 话题 ID。 */
	topicId: string
	/** Business SuperMagic Topic ID from protocol topic_id; omitted when the message lacks it. */
	superMagicTopicId?: string
	/** 事件关联的流或 Assistant 逻辑消息 correlation_id。 */
	correlationId?: string
	/** 事件关联的服务端消息 app_message_id。 */
	appMessageId?: string
	/** 事件关联的服务端消息 seq_id。 */
	messageSeqId?: string
	/** 同一 topic + correlation 下的流代次，从 1 开始。 */
	/** 该值由 Store 根据首次 chunk、i=0 重启等边界计算，不来自服务端直接字段。 */
	streamGeneration?: number
	/** 事件关联的规范工具调用 ID；只允许映射自非空 tool.id。 */
	toolCallId?: string
}

/** 提供给订阅方的紧凑消息引用，避免复制完整 message/debug/attachments。 */
export interface SuperMagicEventMessageRef {
	/** Store 内用于归并同一逻辑卡片的稳定 SuperMessage ID。 */
	/** Assistant 使用 super_message_id；User/Tool 按 app_message_id 归属。 */
	logicalMessageId: string
	/** 服务端消息 ID；流占位消息尚未被 Final 替换时可能为空。 */
	appMessageId?: string
	/** Assistant 流和最终消息之间的关联 ID。 */
	correlationId?: string
	/** 当前已接受的服务端消息序列号。 */
	seqId?: string
	/** 消息发送方角色。 */
	role: "assistant" | "user" | "tool"
	/** 消息的协议类型，例如 super_magic_message。 */
	type: string
	/** IM envelope 状态；负责撤回与消息可见性。 */
	imStatus: string
	/** SuperMessage node 状态；负责 Assistant/Tool 执行与流生命周期。 */
	superStatus?: string
	/** 消息携带的业务通知事件。 */
	event?: string
	/** 通知对应的用户工具调用 ID，用于恢复原问题的交互。 */
	toolCallId?: string
	/** @deprecated 兼容字段；等同 imStatus，不能作为执行状态使用。 */
	status: string
	/** canonical 消息携带的 send_time 数值。 */
	/** 该值直接映射消息卡 send_time；协议可能使用秒、毫秒、微秒或纳秒，消费方需按场景归一化。 */
	sendTime: number
}

/** 流式工具调用的一次增量片段；不包含累计 arguments 快照。 */
export interface SuperMagicToolCallDelta {
	/** 工具调用在当前 Assistant tool_calls 数组中的规范索引。 */
	index: number
	/** 规范工具调用 ID；仅在 chunk 已提供非空 tool.id 时出现。 */
	id?: string
	/** 工具函数名；仅在当前 chunk 新增或修订该字段时出现。 */
	name?: string
	/** 本次 chunk 新增的 arguments 字符串片段。 */
	argumentsDelta?: string
	/** 接受本次片段后该工具 arguments 的累计字符数。 */
	/** 该值由 Store 使用已接受的 canonical arguments 长度计算。 */
	argumentsLength: number
}
