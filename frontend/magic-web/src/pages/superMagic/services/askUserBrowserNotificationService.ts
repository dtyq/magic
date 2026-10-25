import i18n from "i18next"
import { browserNotificationService } from "@/services/browserNotification"
import {
	ASK_USER_CARD_STATUS,
	ASK_USER_TOOL,
} from "@/pages/superMagic/components/MessageList/utils/askUserConstants"
import {
	extractQuestionsField,
	parseQuestionsXml,
} from "@/pages/superMagic/components/MessageList/components/Nodes/MessageNode/tool-call/tools/AskUser/parse"
import type {
	RawSuperMagicMessageNode,
	ToolCall,
	ToolResponseState,
} from "@/pages/superMagic/stores/types"

const notifiedAskUserKeys = new Set<string>()
const activeAskUserNotifications = new Map<string, Notification>()
const askUserExpireTimers = new Map<string, ReturnType<typeof window.setTimeout>>()
const pendingAskUserNotifications = new Map<
	string,
	{
		title: string
		body?: string
	}
>()
const serviceStartedAtMs = Date.now()
let visibilityListenerInitialized = false

interface NotifyAskUserV2BrowserNotificationParams {
	topicId: string
	messageNode: RawSuperMagicMessageNode | undefined
	messageSendTime?: number
}

interface ClearAskUserV2BrowserNotificationParams {
	topicId: string
	notificationKey: string
}

function getDetailQuestionLabel(questions: unknown) {
	if (!Array.isArray(questions)) return ""

	for (const question of questions) {
		const record = question as { question?: unknown; label?: unknown } | undefined
		const label = record?.question ?? record?.label
		if (typeof label === "string" && label.trim()) return label.trim()
	}

	return ""
}

function isAskUserCardTerminalStatus(status: unknown) {
	return (
		status === ASK_USER_CARD_STATUS.answered ||
		status === ASK_USER_CARD_STATUS.skipped ||
		status === ASK_USER_CARD_STATUS.timeout ||
		status === ASK_USER_CARD_STATUS.cancelled
	)
}

function getQuestionsXml(toolCall: ToolCall, tool?: ToolResponseState) {
	const rawArguments = toolCall.function?.arguments || ""
	const questionsFromArguments = extractQuestionsField(rawArguments)
	if (questionsFromArguments) return questionsFromArguments
	if (rawArguments.includes("<question")) return rawArguments

	const detailQuestions = tool?.detail?.data?.questions
	const questionsFromDetail = typeof detailQuestions === "string" ? detailQuestions : ""

	return questionsFromDetail
}

function markdownToPlainText(markdown: string) {
	return markdown
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/[*_~]+/g, "")
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/\s+/g, " ")
		.trim()
}

function getAskUserNotificationBody(toolCall: ToolCall, tool?: ToolResponseState) {
	const detailQuestionLabel = getDetailQuestionLabel(tool?.detail?.data?.questions)
	if (detailQuestionLabel) {
		return markdownToPlainText(detailQuestionLabel) || detailQuestionLabel
	}

	const questions = parseQuestionsXml(getQuestionsXml(toolCall, tool))
	const completeQuestion = questions.find(
		(question) => question.isComplete && question.label.trim(),
	)
	if (!completeQuestion) return null

	return markdownToPlainText(completeQuestion.label) || completeQuestion.label
}

function getAskUserNotificationKey(toolCall: ToolCall, tool?: ToolResponseState) {
	const detailQuestionId = tool?.detail?.data?.question_id
	const questionId = typeof detailQuestionId === "string" ? detailQuestionId : ""

	return questionId || tool?.id || toolCall.id
}

function normalizeExpiresAtToSeconds(value: unknown): number | null {
	const numericValue =
		typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
	if (!Number.isFinite(numericValue) || numericValue <= 0) return null

	if (numericValue > 1e11) return Math.floor(numericValue / 1000)
	return Math.floor(numericValue)
}

function isAskUserExpired(tool?: ToolResponseState) {
	const expiresAt = normalizeExpiresAtToSeconds(tool?.detail?.data?.expires_at)
	if (!expiresAt) return false
	return expiresAt <= Math.floor(Date.now() / 1000)
}

function getAskUserExpiresAt(tool?: ToolResponseState) {
	return normalizeExpiresAtToSeconds(tool?.detail?.data?.expires_at)
}

function normalizeMessageSendTimeToMs(value: unknown): number | null {
	const numericValue =
		typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
	if (!Number.isFinite(numericValue) || numericValue <= 0) return null

	if (numericValue < 1e11) return Math.floor(numericValue * 1000)
	if (numericValue < 1e14) return Math.floor(numericValue)
	if (numericValue < 1e17) return Math.floor(numericValue / 1000)
	return Math.floor(numericValue / 1e6)
}

function isNewMessage(messageSendTime: unknown) {
	// 流式 tool_calls 往往还没有 IM send_time；缺省视为当前实时到达，避免刷新历史误弹。
	if (messageSendTime === undefined || messageSendTime === null || messageSendTime === "") {
		return true
	}
	const sendTimeMs = normalizeMessageSendTimeToMs(messageSendTime)
	if (!sendTimeMs) return false
	return sendTimeMs >= serviceStartedAtMs - 60 * 1000
}

function buildScopedNotificationKey(topicId: string, notificationKey: string) {
	return `${topicId}:${notificationKey}`
}

function isPageNotActive() {
	if (typeof document === "undefined") return false
	return document.hidden || document.visibilityState !== "visible" || !document.hasFocus()
}

function clearAskUserNotification(notificationKey: string) {
	const expireTimer = askUserExpireTimers.get(notificationKey)
	if (expireTimer) {
		window.clearTimeout(expireTimer)
		askUserExpireTimers.delete(notificationKey)
	}

	pendingAskUserNotifications.delete(notificationKey)
	notifiedAskUserKeys.delete(notificationKey)

	const activeNotification = activeAskUserNotifications.get(notificationKey)
	if (activeNotification) {
		activeAskUserNotifications.delete(notificationKey)
		activeNotification.close()
	}
}

function scheduleAskUserExpireCleanup(notificationKey: string, expiresAt: number | null) {
	if (!expiresAt) return

	const existingTimer = askUserExpireTimers.get(notificationKey)
	if (existingTimer) window.clearTimeout(existingTimer)

	const delay = Math.max(0, expiresAt * 1000 - Date.now())
	const expireTimer = window.setTimeout(() => {
		clearAskUserNotification(notificationKey)
	}, delay)

	askUserExpireTimers.set(notificationKey, expireTimer)
}

export function clearAskUserV2BrowserNotification({
	topicId,
	notificationKey,
}: ClearAskUserV2BrowserNotificationParams) {
	if (!topicId || !notificationKey) return
	clearAskUserNotification(buildScopedNotificationKey(topicId, notificationKey))
}

const suspendedAskUserTopicIds = new Set<string>()

function getAskUserNotificationKeysForTopic(topicId: string) {
	const prefix = `${topicId}:`
	const keys = new Set<string>()
	pendingAskUserNotifications.forEach((_, key) => {
		if (key.startsWith(prefix)) keys.add(key)
	})
	activeAskUserNotifications.forEach((_, key) => {
		if (key.startsWith(prefix)) keys.add(key)
	})
	askUserExpireTimers.forEach((_, key) => {
		if (key.startsWith(prefix)) keys.add(key)
	})
	notifiedAskUserKeys.forEach((key) => {
		if (key.startsWith(prefix)) keys.add(key)
	})
	return keys
}

export function setAskUserTopicSuspended(topicId: string, suspended: boolean) {
	if (!topicId) return
	if (suspended) {
		suspendedAskUserTopicIds.add(topicId)
		getAskUserNotificationKeysForTopic(topicId).forEach((key) => {
			clearAskUserNotification(key)
		})
		return
	}
	suspendedAskUserTopicIds.delete(topicId)
}

function tryNotifyAskUser(notificationKey: string) {
	const pendingNotification = pendingAskUserNotifications.get(notificationKey)
	if (!pendingNotification) return
	if (!isPageNotActive()) return
	if (notifiedAskUserKeys.has(notificationKey)) return

	const notification = browserNotificationService.show({
		title: pendingNotification.title,
		body: pendingNotification.body,
		tag: notificationKey,
		data: {
			type: "ask-user",
			questionId: notificationKey,
		},
	})

	if (notification) {
		notification.onclose = () => {
			activeAskUserNotifications.delete(notificationKey)
		}
		notifiedAskUserKeys.add(notificationKey)
		activeAskUserNotifications.set(notificationKey, notification)
		pendingAskUserNotifications.delete(notificationKey)
	}
}

function tryNotifyAllPendingAskUsers() {
	if (!isPageNotActive()) return
	pendingAskUserNotifications.forEach((_, notificationKey) => {
		tryNotifyAskUser(notificationKey)
	})
}

function ensureVisibilityListener() {
	if (visibilityListenerInitialized || typeof document === "undefined") return
	visibilityListenerInitialized = true

	document.addEventListener("visibilitychange", tryNotifyAllPendingAskUsers)
	window.addEventListener("blur", tryNotifyAllPendingAskUsers)
}

function notifyAskUserToolCall(topicId: string, toolCall: ToolCall) {
	if (suspendedAskUserTopicIds.has(topicId)) return
	const tool = toolCall.tool
	const toolName = tool?.name || toolCall.function?.name
	if (toolName !== ASK_USER_TOOL.name) return

	const rawNotificationKey = getAskUserNotificationKey(toolCall, tool)
	if (!rawNotificationKey) return

	const notificationKey = buildScopedNotificationKey(topicId, rawNotificationKey)
	const cardStatus = tool?.detail?.data?.status
	const expiresAt = getAskUserExpiresAt(tool)
	if (isAskUserCardTerminalStatus(cardStatus) || isAskUserExpired(tool)) {
		clearAskUserNotification(notificationKey)
		return
	}
	if (notifiedAskUserKeys.has(notificationKey)) return

	const notificationBody = getAskUserNotificationBody(toolCall, tool)
	if (notificationBody === null) return

	pendingAskUserNotifications.set(notificationKey, {
		title: i18n.t("askUser.title", { ns: "super" }),
		body: notificationBody,
	})
	scheduleAskUserExpireCleanup(notificationKey, expiresAt)
	tryNotifyAskUser(notificationKey)
}

export function notifyAskUserV2BrowserNotificationFromToolCalls({
	topicId,
	toolCalls,
	messageSendTime,
}: {
	topicId: string
	toolCalls: ToolCall[] | undefined
	messageSendTime?: number
}) {
	notifyAskUserV2BrowserNotificationFromMessageNode({
		topicId,
		messageNode: { tool_calls: toolCalls } as RawSuperMagicMessageNode,
		messageSendTime,
	})
}

export function notifyAskUserV2BrowserNotificationFromMessageNode({
	topicId,
	messageNode,
	messageSendTime,
}: NotifyAskUserV2BrowserNotificationParams) {
	if (!messageNode || typeof document === "undefined") return
	if (!topicId || !isNewMessage(messageSendTime)) return
	if (!Array.isArray(messageNode.tool_calls)) return

	ensureVisibilityListener()
	messageNode.tool_calls.forEach((toolCall) => {
		notifyAskUserToolCall(topicId, toolCall as ToolCall)
	})
}
