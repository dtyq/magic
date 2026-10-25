import { userStore } from "@/models/user"
import { platformKey } from "@/utils/storage"

export type AskUserReplyStateStatus = "sending" | "answered" | "skipped" | "timeout" | "cancelled"

export interface AskUserReplyState {
	status: AskUserReplyStateStatus
	updatedAt: number
}

const ASK_USER_REPLY_STATE_ROOT = "super_magic/ask_user_reply/v1"
const ASK_USER_REPLY_STATE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const TERMINAL_REPLY_STATUSES = new Set<AskUserReplyStateStatus>([
	"answered",
	"skipped",
	"timeout",
	"cancelled",
])

function canUseLocalStorage() {
	if (typeof window === "undefined") return false

	try {
		return Boolean(window.localStorage)
	} catch {
		// Restricted WebViews and privacy modes can throw while accessing storage.
		return false
	}
}

function getErrorText(error: unknown): string {
	if (typeof error === "string") return error
	if (!error || typeof error !== "object") return ""

	const value = error as Record<string, unknown>
	const nestedValues = [value.message, value.error, value.code, value.data]
		.map((nested) =>
			typeof nested === "string" || typeof nested === "number"
				? String(nested)
				: getErrorText(nested),
		)
		.filter(Boolean)

	return nestedValues.join(" ")
}

export function buildAskUserReplyStateKey({
	topicId,
	toolCallId,
}: {
	topicId?: string
	toolCallId?: string
}) {
	const resolvedTopicId = topicId?.trim()
	const resolvedToolCallId = toolCallId?.trim()
	const userInfo = userStore.user.userInfo
	const userId = userInfo?.magic_id || userInfo?.user_id
	const organizationCode = userInfo?.organization_code
	if (!userId || !organizationCode || !resolvedTopicId || !resolvedToolCallId) return ""

	return platformKey(
		`${ASK_USER_REPLY_STATE_ROOT}/${userId}/${organizationCode}/${resolvedTopicId}/${resolvedToolCallId}`,
	)
}

export function readAskUserReplyState(cacheKey: string): AskUserReplyState | null {
	if (!cacheKey || !canUseLocalStorage()) return null

	try {
		const raw = window.localStorage.getItem(cacheKey)
		if (!raw) return null
		const payload = JSON.parse(raw) as Partial<AskUserReplyState>
		if (
			typeof payload.updatedAt !== "number" ||
			payload.updatedAt <= Date.now() - ASK_USER_REPLY_STATE_TTL_MS ||
			!isReplyStateStatus(payload.status)
		) {
			clearAskUserReply(cacheKey)
			return null
		}
		return { status: payload.status, updatedAt: payload.updatedAt }
	} catch (error) {
		console.error(error)
		clearAskUserReply(cacheKey)
		return null
	}
}

export function claimAskUserReply(cacheKey: string): boolean {
	if (!cacheKey) return true
	if (readAskUserReplyState(cacheKey)) return false
	if (!canUseLocalStorage()) return true

	try {
		window.localStorage.setItem(
			cacheKey,
			JSON.stringify({
				status: "sending",
				updatedAt: Date.now(),
			} satisfies AskUserReplyState),
		)
		return true
	} catch (error) {
		console.error(error)
		return true
	}
}

export function markAskUserReply(cacheKey: string, status: AskUserReplyStateStatus) {
	if (!cacheKey || !canUseLocalStorage()) return

	try {
		window.localStorage.setItem(
			cacheKey,
			JSON.stringify({ status, updatedAt: Date.now() } satisfies AskUserReplyState),
		)
	} catch (error) {
		console.error(error)
	}
}

export function clearAskUserReply(cacheKey: string) {
	if (!cacheKey || !canUseLocalStorage()) return

	try {
		window.localStorage.removeItem(cacheKey)
	} catch (error) {
		console.error(error)
	}
}

export function isTerminalAskUserReplyState(state: AskUserReplyState | null | undefined) {
	return Boolean(state && TERMINAL_REPLY_STATUSES.has(state.status))
}

export function isTerminalAskUserReplyError(error: unknown) {
	const text = getErrorText(error).toLowerCase()
	return [
		"问题不存在",
		"已超时",
		"user_tool_call_not_found",
		"4100",
		"already_processed",
		"already processed",
		"question not found",
		"question expired",
		"无法再提交",
		"这个问题已经结束",
	].some((marker) => text.includes(marker))
}

function isReplyStateStatus(value: unknown): value is AskUserReplyStateStatus {
	return value === "sending" || TERMINAL_REPLY_STATUSES.has(value as AskUserReplyStateStatus)
}
