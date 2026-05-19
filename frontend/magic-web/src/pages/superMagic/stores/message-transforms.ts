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
	if (!message?.type) return {} as RawSuperMagicMessageNode
	return (
		((message as unknown as Record<string, unknown>)[
			message.type
		] as RawSuperMagicMessageNode) || ({} as RawSuperMagicMessageNode)
	)
}

// ─── 消息转换 ────────────────────────────────────────────────

export function transformRawMessage(message: RawSuperMagicMessageSequence): MessageItem {
	const imMessage = message?.message || {}
	const msg = getRawMessageNode(imMessage)
	return {
		...omit(imMessage, [imMessage?.type]),
		debug: msg,
		topic_id: imMessage?.topic_id as string,
		type: imMessage?.type as string,
		app_message_id: imMessage?.app_message_id as string,
		send_time: imMessage?.send_time as number,
		status: imMessage?.status as string,
		event: msg?.event as string,
		parent_correlation_id: msg?.parent_correlation_id || "",
		correlation_id: (msg?.correlation_id || msg?.tool?.id) as string,
		role: (msg?.role || "user") as MessageItem["role"],
		seq_id: message?.seq_id as string,
		refer_message_id: message?.refer_message_id as string,
	} as MessageItem
}

// ─── 排序与过滤 ──────────────────────────────────────────────

export function sortMessages<T extends { seq_id: string; status?: string }>(
	list: Array<T>,
): Array<T> {
	const result = list.sort((a, b) => {
		return a.seq_id.localeCompare(b.seq_id)
	})

	if (result[result.length - 1]?.status !== "revoked") {
		return result.filter((item) => item.status !== "revoked")
	}

	let firstOfLastSegment = result.length - 1
	while (firstOfLastSegment > 0 && result[firstOfLastSegment - 1].status === "revoked") {
		firstOfLastSegment--
	}

	return result.filter((item, index) => item.status !== "revoked" || index >= firstOfLastSegment)
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
		previousMessage.status !== nextMessage.status ||
		previousMessage.event !== nextMessage.event ||
		previousMessage.role !== nextMessage.role ||
		previousNode?.status !== nextNode?.status ||
		previousNode?.event !== nextNode?.event ||
		previousNode?.tool?.name !== nextNode?.tool?.name ||
		previousNode?.tool?.status !== nextNode?.tool?.status
	)
}

// ─── 工具调用比较 ────────────────────────────────────────────

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
		if (a[i].id !== b[i].id) return false
		if ((a[i].function?.name || "") !== (b[i].function?.name || "")) return false
		if (!(b[i].function?.arguments || "").startsWith(a[i].function?.arguments || ""))
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

export function createStreamState(): StreamState {
	return {
		stage: "reasoning_content",
		reasoning_content: "",
		content: "",
		currentToolIndex: 0,
		tool_calls: [],
		isFinalMessageReceived: false,
	}
}

export function getDefaultTopicMeta(): TopicMeta {
	return {
		timer: null,
		isStream: false,
		isStreamLoading: false,
		content: new Map(),
		streamSnapshots: new Map(),
	}
}

// ─── V2 消息判断 ─────────────────────────────────────────────

export function isV2Message(message: any) {
	return message?.seq?.message?.type === "super_magic_message"
}
