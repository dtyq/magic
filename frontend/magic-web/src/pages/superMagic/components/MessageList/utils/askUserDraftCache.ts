import { userStore } from "@/models/user"
import { platformKey } from "@/utils/storage"

export type AskUserDraftAnswerValue = string | readonly string[]
export type AskUserDraftAnswers = Record<string, AskUserDraftAnswerValue>

const ASK_USER_DRAFT_CACHE_ROOT = "super_magic/ask_user_draft/v1"
const ASK_USER_DRAFT_TTL_MS = 24 * 60 * 60 * 1000

interface AskUserDraftCachePayload {
	answers: AskUserDraftAnswers
	remark?: string
	expiresAt: number
}

function canUseLocalStorage() {
	return typeof window !== "undefined" && Boolean(window.localStorage)
}

function normalizeAnswers(value: unknown): AskUserDraftAnswers | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null

	const answers: AskUserDraftAnswers = {}
	for (const [key, answer] of Object.entries(value)) {
		if (typeof answer === "string") {
			answers[key] = answer
			continue
		}
		if (Array.isArray(answer) && answer.every((item) => typeof item === "string")) {
			answers[key] = answer
			continue
		}
		return null
	}

	return answers
}

function hasMeaningfulAnswer(answers: AskUserDraftAnswers) {
	return Object.values(answers).some((answer) => {
		if (typeof answer === "string") return answer.trim().length > 0
		return answer.some((item) => item.trim().length > 0)
	})
}

function hasMeaningfulDraft(answers: AskUserDraftAnswers, remark?: string) {
	return hasMeaningfulAnswer(answers) || Boolean(remark?.trim())
}

export function buildAskUserDraftCacheKey({
	questionId,
	topicId,
}: {
	questionId?: string
	topicId?: string
}) {
	const resolvedQuestionId = questionId?.trim()
	if (!resolvedQuestionId) return ""
	const resolvedTopicId = topicId?.trim()
	if (!resolvedTopicId) return ""
	const userInfo = userStore.user.userInfo
	const userId = userInfo?.magic_id || userInfo?.user_id
	const organizationCode = userInfo?.organization_code
	if (!userId || !organizationCode) return ""
	const scopedKey = `${ASK_USER_DRAFT_CACHE_ROOT}/${userId}/${organizationCode}/${resolvedTopicId}/${resolvedQuestionId}`
	return platformKey(scopedKey)
}

export function readAskUserDraftAnswers(cacheKey: string): AskUserDraftAnswers | null {
	if (!cacheKey || !canUseLocalStorage()) return null

	try {
		const payload = readAskUserDraftPayload(cacheKey)
		if (!payload) return null
		return payload.answers
	} catch (error) {
		console.error(error)
		clearAskUserDraftAnswers(cacheKey)
		return null
	}
}

export function readAskUserDraftRemark(cacheKey: string) {
	const payload = readAskUserDraftPayload(cacheKey)
	return typeof payload?.remark === "string" ? payload.remark : ""
}

function readAskUserDraftPayload(cacheKey: string): AskUserDraftCachePayload | null {
	if (!cacheKey || !canUseLocalStorage()) return null

	try {
		const raw = window.localStorage.getItem(cacheKey)
		if (!raw) return null

		const payload = JSON.parse(raw) as Partial<AskUserDraftCachePayload>
		const answers = normalizeAnswers(payload?.answers)
		if (!answers || typeof payload.expiresAt !== "number" || payload.expiresAt <= Date.now()) {
			clearAskUserDraftAnswers(cacheKey)
			return null
		}

		return {
			answers,
			remark: typeof payload.remark === "string" ? payload.remark : "",
			expiresAt: payload.expiresAt,
		}
	} catch (error) {
		console.error(error)
		clearAskUserDraftAnswers(cacheKey)
		return null
	}
}

export function writeAskUserDraftAnswers(
	cacheKey: string,
	answers: AskUserDraftAnswers,
	remark = "",
) {
	if (!cacheKey || !canUseLocalStorage()) return

	const normalizedAnswers = normalizeAnswers(answers)
	const normalizedRemark = typeof remark === "string" ? remark : ""
	if (!normalizedAnswers || !hasMeaningfulDraft(normalizedAnswers, normalizedRemark)) {
		clearAskUserDraftAnswers(cacheKey)
		return
	}

	try {
		const payload: AskUserDraftCachePayload = {
			answers: normalizedAnswers,
			...(normalizedRemark.trim() ? { remark: normalizedRemark } : {}),
			expiresAt: Date.now() + ASK_USER_DRAFT_TTL_MS,
		}
		window.localStorage.setItem(cacheKey, JSON.stringify(payload))
	} catch (error) {
		console.error(error)
	}
}

export function clearAskUserDraftAnswers(cacheKey: string) {
	if (!cacheKey || !canUseLocalStorage()) return

	try {
		window.localStorage.removeItem(cacheKey)
	} catch (error) {
		console.error(error)
	}
}
