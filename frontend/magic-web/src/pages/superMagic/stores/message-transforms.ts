import { omit } from "lodash-es"
import type {
	MessageItem,
	RawSuperMagicIMMessage,
	RawSuperMagicMessageNode,
	RawSuperMagicMessageSequence,
	StreamState,
	ToolCall,
	TopicMeta,
} from "./types"

// ─── 消息解包 ────────────────────────────────────────────────

export function getRawMessageNode(message?: RawSuperMagicIMMessage): RawSuperMagicMessageNode {
	if (!message) return {} as RawSuperMagicMessageNode
	const rawMessage = message as unknown as Record<string, unknown>
	const typedNode = message.type
		? (rawMessage[message.type] as RawSuperMagicMessageNode | undefined)
		: undefined
	// Some HTTP snapshots carry the node under `general_agent_card` without an
	// envelope `type`; keep role and super_message_id available to all callers.
	return (typedNode ||
		(rawMessage.general_agent_card as RawSuperMagicMessageNode | undefined) ||
		{}) as RawSuperMagicMessageNode
}

// ─── 消息转换 ────────────────────────────────────────────────

export function transformRawMessage(message: RawSuperMagicMessageSequence): MessageItem {
	const imMessage = message?.message || {}
	const msg = getRawMessageNode(imMessage)
	const appMessageId = String(imMessage?.app_message_id || "")
	const superMessageId =
		msg?.role === "user" ? appMessageId : String(msg?.super_message_id || appMessageId)
	const imStatus = String(imMessage?.status || "")
	const superStatus = msg?.role === "user" ? undefined : String(msg?.status || "") || undefined
	if (appMessageId) msg.app_message_id = appMessageId
	if (superMessageId) msg.super_message_id = superMessageId
	return {
		...omit(imMessage, [imMessage?.type]),
		debug: msg,
		topic_id: imMessage?.topic_id as string,
		type: imMessage?.type as string,
		app_message_id: appMessageId,
		is_stream_placeholder: false,
		super_message_id: superMessageId,
		send_time: imMessage?.send_time as number,
		// Keep `status` as a compatibility alias for the IM envelope only. The node
		// execution state is carried independently as `superStatus`.
		status: imStatus,
		imStatus,
		superStatus,
		event: msg?.event as string,
		parent_correlation_id: msg?.parent_correlation_id || "",
		correlation_id: (msg?.correlation_id || msg?.tool?.id) as string,
		role: (msg?.role || "user") as MessageItem["role"],
		seq_id: message?.seq_id as string,
		refer_message_id: message?.refer_message_id as string,
	} as MessageItem
}

// ─── Canonical 排序 ──────────────────────────────────────────

export function sortMessages<T extends { seq_id: string; status?: string }>(
	list: Array<T>,
): Array<T> {
	const compareSeqId = (left: string, right: string) => {
		if (left === right) return 0
		const normalizedLeft = String(left || "").replace(/^0+(?=\d)/, "")
		const normalizedRight = String(right || "").replace(/^0+(?=\d)/, "")
		if (/^\d+$/.test(normalizedLeft) && /^\d+$/.test(normalizedRight)) {
			if (normalizedLeft.length !== normalizedRight.length) {
				return normalizedLeft.length - normalizedRight.length
			}
		}
		return normalizedLeft.localeCompare(normalizedRight)
	}
	return list
		.map((item, inputIndex) => ({ item, inputIndex }))
		.sort((left, right) => {
			const sequenceOrder = compareSeqId(left.item.seq_id, right.item.seq_id)
			return sequenceOrder || left.inputIndex - right.inputIndex
		})
		.map(({ item }) => item)
}

// ─── 大数字字符串 +1 ────────────────────────────────────────

export function addOneToBigNumberString(numStr: string): string {
	const digits = numStr.split("")
	let carry = 1

	for (let i = digits.length - 1; i >= 0 && carry; i--) {
		const current = parseInt(digits[i], 10) + carry
		digits[i] = (current % 10).toString()
		carry = Math.floor(current / 10)
	}

	if (carry) {
		digits.unshift(carry.toString())
	}

	return digits.join("")
}

// ─── 变更通知判断 ────────────────────────────────────────────

interface CrewToolMessageNode {
	status?: string
	event?: string
	tool?: { name?: string; status?: string }
}

export function shouldNotifyMessageUpdate({
	previousMessage,
	nextMessage,
	previousMessageNode,
	nextMessageNode,
}: {
	previousMessage?: MessageItem
	nextMessage: MessageItem
	previousMessageNode?: unknown
	nextMessageNode?: unknown
}) {
	if (!previousMessage) return true
	const previousNode = previousMessageNode as CrewToolMessageNode | undefined
	const nextNode = nextMessageNode as CrewToolMessageNode | undefined

	return (
		previousMessage.seq_id !== nextMessage.seq_id ||
		previousMessage.imStatus !== nextMessage.imStatus ||
		previousMessage.superStatus !== nextMessage.superStatus ||
		previousMessage.event !== nextMessage.event ||
		previousMessage.role !== nextMessage.role ||
		previousNode?.status !== nextNode?.status ||
		previousNode?.event !== nextNode?.event ||
		previousNode?.tool?.name !== nextNode?.tool?.name ||
		previousNode?.tool?.status !== nextNode?.tool?.status
	)
}

// ─── 工具调用比较 ────────────────────────────────────────────

/**
 * 压实 tool_calls 数组：剔除稀疏空洞（undefined）与后端真消息里的 null。
 *
 * 流式 chunk 用后端 `index` 作为绝对下标写入 streamState.tool_calls
 * （见 store 内 delta 处理），当 index 跳跃时会留下语义合法的空洞
 * （"该 tool 的开场 chunk 尚未到达"）。空洞只在数组离开流式域、交给
 * 假设其稠密的消费方前需要清除，因此统一在读边界调用本函数。
 */
export function compactToolCalls(list: ToolCall[] = []): ToolCall[] {
	return list.filter(Boolean)
}

export function isToolCallsEqual(a: ToolCall[] = [], b: ToolCall[] = []): boolean {
	if (a.length !== b.length) return false
	for (let i = 0; i < a.length; i++) {
		if (a[i].id !== b[i].id) return false
		if ((a[i].function?.name || "") !== (b[i].function?.name || "")) return false
		if ((a[i].function?.arguments || "") !== (b[i].function?.arguments || "")) return false
	}
	return true
}

export function isToolCallArgumentsComplete(toolCall: ToolCall): boolean {
	if (!toolCall?.function?.arguments) return false
	try {
		JSON.parse(toolCall.function.arguments)
		return true
	} catch {
		return false
	}
}

export function isToolCallsMatch(a: ToolCall[] = [], b: ToolCall[] = []): boolean {
	for (let i = 0; i < a.length; i++) {
		if (a[i]?.id !== b[i]?.id) return false
		if ((a[i]?.function?.name || "") !== (b[i]?.function?.name || "")) return false
		if (!(b[i]?.function?.arguments || "").startsWith(a[i]?.function?.arguments || ""))
			return false
	}
	return true
}

// ─── 流式速度控制 ────────────────────────────────────────────

/**
 * 根据剩余文本长度动态计算每 tick 渲染字符数。
 * 剩余越多步长越大，避免长文本长时间逐字渲染；
 * 剩余很少时放慢到 2 字符，保留打字机视觉效果。
 */
export function getCharsPerTick(remaining: number): number {
	if (remaining > 2000) return 128
	if (remaining > 1000) return 64
	if (remaining > 500) return 32
	if (remaining > 200) return 16
	if (remaining > 50) return 8
	return 2
}

/**
 * 对 slice 截断位置做代理对安全校正：如果截断点落在 surrogate pair 中间，
 * 则向前多取一个 code unit，避免把 emoji 劈成两半产生乱码。
 */
export function adjustSliceEnd(text: string, end: number): number {
	if (end <= 0 || end >= text.length) return end
	const code = text.charCodeAt(end - 1)
	// 如果最后一个 code unit 是高位代理（0xD800–0xDBFF），说明切在了代理对中间
	if (code >= 0xd800 && code <= 0xdbff) {
		return end + 1
	}
	return end
}

/**
 * 根据剩余待渲染字符数和流式阶段，动态计算每帧应推进的字符数。
 * - 实时流式（chunk 仍在到达）：保持 ~500ms 的视觉延迟，30 帧 at 60fps
 * - 追平模式（final 已收到）：加速在 ~1.5s 内追完全部内容，90 帧 at 60fps
 */
export function calculateBatchSize(remaining: number, isFinalReceived: boolean): number {
	if (remaining <= 0) return 0
	if (isFinalReceived) {
		return Math.min(Math.max(Math.ceil(remaining / 90), 8), 80)
	}
	return Math.min(Math.max(Math.ceil(remaining / 30), 3), 40)
}

// ─── 流式状态工厂 ────────────────────────────────────────────

export function createStreamState({
	superMessageId,
	correlationId,
	taskId,
}: {
	superMessageId: string
	correlationId: string
	taskId: string
}): StreamState {
	return {
		super_message_id: superMessageId,
		correlation_id: correlationId,
		task_id: taskId,
		stage: "reasoning_content",
		reasoning_content: "",
		content: "",
		currentToolIndex: 0,
		tool_calls: [],
		isFinalMessageReceived: false,
		renderPace: "live",
		settlingStartedAt: null,
		finalCatchupDeadlineAt: null,
		catchupMinimumFramesRemaining: 0,
		recoveryAttempts: 0,
	}
}

export function getDefaultTopicMeta(): TopicMeta {
	return {
		timer: null,
		activeRenderSuperMessageId: null,
		recoveryTimer: null,
		recoveryCorrelationId: null,
		isStream: false,
		isStreamLoading: false,
		content: new Map(),
		streamSnapshots: new Map(),
		finalizedCorrelationIds: new Set(),
		lastActiveAt: null,
		inactiveAt: null,
		inactiveMonotonicAt: null,
		lastSyncedAt: null,
		lastSyncedSeqId: "",
		syncGeneration: 0,
		syncState: "idle",
		pendingExecutionCount: 0,
		pendingExecutionStartedAt: null,
		renderPolicy: "live",
	}
}

// ─── V2 消息判断 ─────────────────────────────────────────────

export function isV2Message(message: any) {
	return message?.seq?.message?.type === "super_magic_message"
}

interface DisplayAnchoredMessage {
	role?: string
	app_message_id?: unknown
	super_message_id?: unknown
	display_after_message_id?: unknown
	is_stream_placeholder?: unknown
	seq_id?: unknown
}

/** 正式消息补齐后，首次可见的位置只保护用户插入，不能覆盖同一段 AI 消息的顺序。 */
export function reconcileMessageDisplayAnchors<T extends DisplayAnchoredMessage>(items: T[]): T[] {
	const indices = new Map<string, number>()
	const userCounts = [0]
	const assistantCounts = [0]
	const isConfirmed = (item: T) =>
		item.is_stream_placeholder !== true &&
		typeof item.seq_id === "string" &&
		/^\d+$/.test(item.seq_id)
	items.forEach((item, index) => {
		const identity = item.role === "user" ? item.app_message_id : item.super_message_id
		if (typeof identity === "string" && identity) indices.set(identity, index)
		userCounts.push(userCounts[index] + Number(item.role === "user"))
		assistantCounts.push(
			assistantCounts[index] + Number(item.role === "assistant" && isConfirmed(item)),
		)
	})
	let didChange = false
	const nextItems = items.map((item, index) => {
		if (item.role !== "assistant" || !isConfirmed(item)) return item
		const anchor = item.display_after_message_id
		if (typeof anchor !== "string" || !anchor) return item
		const parent = indices.get(anchor)
		if (parent === undefined || !isConfirmed(items[parent])) return item
		// U、A、B：B 绑定 U 会越过正式 A，应解除；P、U、A：A 绑定 P 则保留。
		// 紧邻前驱的标记仍保留，以保护后续 revision 到达前新插入的用户消息。
		const crossesUser = parent < index && userCounts[index] > userCounts[parent + 1]
		const crossesAssistant =
			parent < index && assistantCounts[index] > assistantCounts[parent + 1]
		if (parent < index && (crossesUser || !crossesAssistant)) return item
		didChange = true
		return { ...item, display_after_message_id: undefined }
	})
	return didChange ? nextItems : items
}

/** 只调整当前可见分支：A 已出现后插入 U，接管 A 的真实消息不能把它排到 U 之后。 */
export function positionAnchoredMessages<T extends DisplayAnchoredMessage>(messages: T[]): T[] {
	const items = reconcileMessageDisplayAnchors(messages)
	const indices = new Map<string, number>()
	items.forEach((item, index) => {
		const identity = item.role === "user" ? item.app_message_id : item.super_message_id
		if (typeof identity === "string" && identity) indices.set(identity, index)
	})
	const parents = new Map<number, number>()
	items.forEach((item, index) => {
		const anchor = item.display_after_message_id
		if (typeof anchor !== "string" || !anchor) return
		const parent = indices.get(anchor)
		if (parent !== undefined) parents.set(index, parent)
	})
	if (parents.size === 0) return items

	// 锚点缺失或依赖成环时整条依赖保留原顺序；不从其它分支恢复隐藏消息。
	const valid = new Map<number, boolean>()
	parents.forEach((_parent, index) => {
		const path = new Set<number>()
		let current = index
		while (parents.has(current) && !valid.has(current) && !path.has(current)) {
			path.add(current)
			const parent = parents.get(current)
			if (parent === undefined) break
			current = parent
		}
		const isValid =
			valid.get(current) ?? (!path.has(current) && !items[current].display_after_message_id)
		path.forEach((member) => valid.set(member, isValid))
	})
	const children = new Map<number, number[]>()
	parents.forEach((parent, index) => {
		if (!valid.get(index)) return
		const siblings = children.get(parent) || []
		siblings.push(index)
		children.set(parent, siblings)
	})
	const result: T[] = []
	items.forEach((_item, index) => {
		if (valid.get(index)) return
		const stack = [index]
		while (stack.length) {
			const next = stack.pop()
			if (next === undefined) break
			result.push(items[next])
			const siblings = children.get(next) || []
			for (let child = siblings.length - 1; child >= 0; child -= 1)
				stack.push(siblings[child])
		}
	})
	return result
}
