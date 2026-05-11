import dayjs from "@/lib/dayjs"
import { SuperMagicApi } from "@/apis"
import { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
import globalTopicStore, { TopicStore } from "@/pages/superMagic/stores/core/topic"

export type TopicReadProgressReason =
	| "enter-topic"
	| "message-change"
	| "switch-topic"
	| "switch-project"
	| "switch-workspace"
	| "route-leave"
	| "page-hide"
	| "before-unload"

export interface TopicReadProgressPayload {
	topicId: string
	lastReadAt?: string
	lastReadMessageId?: string
	reason: TopicReadProgressReason
	/** 为 true 时仅跳过相对 `latestCursor` 的入站去重，仍受 `lastAckCursor` 与 `canReportReadProgress` 约束 */
	immediate?: boolean
}

export interface TopicReadProgressCursorPayload {
	lastReadAt: string
	lastReadMessageId?: string
}

interface TopicMessageCursorSource {
	send_time?: unknown
	app_message_id?: unknown
}

interface NormalizedCursor {
	topicId: string
	lastReadAt: string
	lastReadMessageId: string | null
	lastReadAtMs: number
}

interface TopicReadProgressState {
	latestCursor: NormalizedCursor | null
	lastAckCursor: NormalizedCursor | null
	lastSentCursorKey: string | null
	inFlight: boolean
}

/** 将服务端可能返回的秒/毫秒/微秒/纳秒时间戳统一归一为毫秒。 */
export function normalizeMessageSendTimeToMs(value: unknown): number | null {
	if (value === null || value === undefined) return null

	const numericValue =
		typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
	if (!Number.isFinite(numericValue) || numericValue <= 0) return null

	if (numericValue < 1e11) return Math.floor(numericValue * 1000)
	if (numericValue < 1e14) return Math.floor(numericValue)
	if (numericValue < 1e17) return Math.floor(numericValue / 1000)
	return Math.floor(numericValue / 1e6)
}

/** 统一格式化读进度时间，确保不同入口上报的时间串一致。 */
function formatReadAt(value?: string): string {
	const parsed = value ? dayjs(value) : dayjs()
	if (parsed.isValid()) return parsed.format("YYYY-MM-DD HH:mm:ss")
	return dayjs().format("YYYY-MM-DD HH:mm:ss")
}

/** 将服务端可能返回的秒/毫秒/微秒时间戳统一归一为毫秒。 */
function toCursorTimestamp(value?: string): number {
	if (!value) return 0
	const parsed = dayjs(value)
	if (!parsed.isValid()) return 0
	return parsed.valueOf()
}

/** 判断两个已读游标是否指向同一条消息。 */
function areSameCursor(previousValue: NormalizedCursor, nextValue: NormalizedCursor): boolean {
	return (
		previousValue.lastReadAtMs === nextValue.lastReadAtMs &&
		(previousValue.lastReadMessageId || "") === (nextValue.lastReadMessageId || "")
	)
}

/** 仅在游标真正前进时才允许继续发送已读进度，避免重复请求。 */
function shouldSendCursorUpdate(
	previousValue: NormalizedCursor | null,
	nextValue: NormalizedCursor,
): boolean {
	if (!previousValue) return true
	if (areSameCursor(previousValue, nextValue)) return false

	const previousMessageId = previousValue.lastReadMessageId || null
	const nextMessageId = nextValue.lastReadMessageId || null

	// 最小去重：仅在同一时刻发生 messageId 降级（value -> null）时拦截
	if (
		nextValue.lastReadAtMs === previousValue.lastReadAtMs &&
		previousMessageId &&
		!nextMessageId
	)
		return false

	return true
}

/** 只允许终态话题执行已读上报，保持与后端规则一致。 */
export function isTopicTerminalTaskStatus(status?: TaskStatus): boolean {
	if (!status) return false
	return status === TaskStatus.FINISHED || status === TaskStatus.ERROR
}

/** 将外部传入的读进度参数整理成内部统一游标结构。 */
function normalizeCursor(payload: TopicReadProgressPayload): NormalizedCursor | null {
	if (!payload.topicId) return null
	if (!payload.lastReadAt && !payload.lastReadMessageId) return null

	const normalizedReadAt = formatReadAt(payload.lastReadAt)
	return {
		topicId: payload.topicId,
		lastReadAt: normalizedReadAt,
		lastReadMessageId: payload.lastReadMessageId || null,
		lastReadAtMs: toCursorTimestamp(normalizedReadAt),
	}
}

/** 生成游标去重键，避免重复上报完全相同的已读位置。 */
function getCursorKey(cursor: NormalizedCursor): string {
	return `${cursor.topicId}|${cursor.lastReadAt}|${cursor.lastReadMessageId || ""}`
}

/** 将消息列表映射为已读上报 payload，供不同页面复用同一套读游标计算规则。 */
export function resolveReadProgressPayloadFromMessages(
	messages: TopicMessageCursorSource[],
): TopicReadProgressCursorPayload {
	if (!Array.isArray(messages) || messages.length === 0)
		return {
			lastReadAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
			lastReadMessageId: undefined,
		}

	const latestMessage = messages[messages.length - 1]
	const fallbackReadAt = dayjs().format("YYYY-MM-DD HH:mm:ss")
	const numericValue =
		typeof latestMessage?.send_time === "number"
			? latestMessage.send_time
			: typeof latestMessage?.send_time === "string"
				? Number(latestMessage.send_time)
				: NaN
	const normalizedSendTimeMs =
		Number.isFinite(numericValue) && numericValue > 0
			? numericValue < 1e11
				? Math.floor(numericValue * 1000)
				: numericValue < 1e14
					? Math.floor(numericValue)
					: numericValue < 1e17
						? Math.floor(numericValue / 1000)
						: Math.floor(numericValue / 1e6)
			: null
	const parsedReadAt =
		normalizedSendTimeMs && normalizedSendTimeMs > 0
			? dayjs(normalizedSendTimeMs).format("YYYY-MM-DD HH:mm:ss")
			: fallbackReadAt

	return {
		lastReadAt: parsedReadAt,
		lastReadMessageId:
			typeof latestMessage?.app_message_id === "string"
				? latestMessage.app_message_id
				: undefined,
	}
}

/** 将后端最新 topic 状态补丁合并回指定 store，保证 scoped store 与 UI 同步。 */
export async function syncTopicStatusPatch({
	topicStore,
	topicId,
}: {
	topicStore: TopicStore
	topicId: string
}) {
	if (!topicId) return

	const statusResponse = await SuperMagicApi.getTopicsStatus({ topic_ids: [topicId] })
	const statusItem = statusResponse.topics?.[0] || statusResponse.list?.[0]
	if (!statusItem) return

	topicStore.mergeTopic(topicId, {
		task_status: statusItem.status,
		status: statusItem.status,
		has_unread: statusItem.has_unread,
	})
}

class TopicReadProgressService {
	constructor(private readonly topicStore: TopicStore) {}

	private topicStateMap = new Map<string, TopicReadProgressState>()

	/** 记录最新已读游标，并在满足条件时触发异步 flush。 */
	markTopicReadProgress(payload: TopicReadProgressPayload) {
		const normalizedCursor = normalizeCursor(payload)
		if (!normalizedCursor) return

		const state = this.ensureTopicState(normalizedCursor.topicId)
		const skipLatestDedup = payload.immediate === true
		if (!skipLatestDedup && !shouldSendCursorUpdate(state.latestCursor, normalizedCursor))
			return
		if (!shouldSendCursorUpdate(state.lastAckCursor, normalizedCursor)) return
		state.latestCursor = normalizedCursor

		void this.flushTopicReadProgress({
			topicId: normalizedCursor.topicId,
			reason: payload.reason,
		})
	}

	/** 按话题维度主动冲刷一次已读游标。 */
	async flushTopicReadProgress({
		topicId,
		reason,
	}: {
		topicId?: string
		reason: TopicReadProgressReason
	}) {
		if (!topicId) return
		await this.executeFlush(topicId, reason)
	}

	/** 使用当前 store 的选中话题做一次全量 flush，适合页面离开等时机。 */
	async flushCurrentTopicReadProgress(reason: TopicReadProgressReason) {
		await this.flushTopicReadProgress({
			topicId: this.topicStore.selectedTopic?.id,
			reason,
		})
	}

	/** 提供给测试环境清理内部游标缓存，避免用例相互污染。 */
	resetForTest() {
		this.topicStateMap.clear()
	}

	/** 真正执行一次请求，并在成功后把已读状态回写到当前 store。 */
	private async executeFlush(topicId: string, reason: TopicReadProgressReason) {
		const state = this.ensureTopicState(topicId)
		const targetCursor = state.latestCursor
		if (!targetCursor) return
		if (state.inFlight) return
		if (!this.canReportReadProgress(topicId)) return
		if (!shouldSendCursorUpdate(state.lastAckCursor, targetCursor)) return
		const cursorKey = getCursorKey(targetCursor)
		if (state.lastSentCursorKey === cursorKey) return

		state.inFlight = true
		state.lastSentCursorKey = cursorKey

		try {
			const response = await SuperMagicApi.markTopicReadProgress(topicId, {
				last_read_at: targetCursor.lastReadAt,
				...(targetCursor.lastReadMessageId
					? {
							last_read_message_id: targetCursor.lastReadMessageId,
						}
					: {}),
			})

			state.lastAckCursor = {
				topicId,
				lastReadAt: response.last_read_at || targetCursor.lastReadAt,
				lastReadMessageId:
					response.last_read_message_id || targetCursor.lastReadMessageId || null,
				lastReadAtMs: toCursorTimestamp(response.last_read_at || targetCursor.lastReadAt),
			}

			this.topicStore.mergeTopic(topicId, {
				last_read_at: response.last_read_at ?? targetCursor.lastReadAt,
				last_read_message_id:
					response.last_read_message_id ?? targetCursor.lastReadMessageId,
				has_unread: Boolean(response.has_unread),
			})
		} catch (error) {
			console.warn(`[topicReadProgressService:${reason}] 已读进度上报失败`, error)
			if (state.lastSentCursorKey === cursorKey) state.lastSentCursorKey = null
		} finally {
			state.inFlight = false
			const latestCursor = state.latestCursor
			const hasNewCursor = Boolean(latestCursor && !areSameCursor(latestCursor, targetCursor))
			if (
				hasNewCursor &&
				latestCursor &&
				this.canReportReadProgress(topicId) &&
				shouldSendCursorUpdate(state.lastAckCursor, latestCursor)
			)
				void this.executeFlush(topicId, reason)
		}
	}

	/** 确保每个话题都拥有独立的游标与请求状态。 */
	private ensureTopicState(topicId: string): TopicReadProgressState {
		const state = this.topicStateMap.get(topicId)
		if (state) return state

		const initialState: TopicReadProgressState = {
			latestCursor: null,
			lastAckCursor: null,
			lastSentCursorKey: null,
			inFlight: false,
		}
		this.topicStateMap.set(topicId, initialState)
		return initialState
	}

	/** 仅当当前 store 中的目标话题满足终态且有未读时，才允许真正上报。 */
	private canReportReadProgress(topicId: string): boolean {
		const selectedTopic = this.topicStore.selectedTopic
		if (selectedTopic?.id === topicId)
			return (
				isTopicTerminalTaskStatus(selectedTopic.task_status) &&
				selectedTopic.has_unread === true
			)

		const targetTopic = this.topicStore.topics.find((topic) => topic.id === topicId)
		if (!targetTopic) return false

		return isTopicTerminalTaskStatus(targetTopic.task_status) && targetTopic.has_unread === true
	}
}

/** 为 scoped 页面创建专属已读 service，避免写回错误的 TopicStore。 */
export function createTopicReadProgressService(topicStore: TopicStore) {
	return new TopicReadProgressService(topicStore)
}

const topicReadProgressService = createTopicReadProgressService(globalTopicStore)

export default topicReadProgressService
