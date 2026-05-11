import { useMemo } from "react"
import { messagesConverter } from "@/pages/superMagic/components/MessageList/helpers"
import { superMagicStore } from "@/pages/superMagic/stores"
import {
	ASK_USER_CARD_STATUS,
	ASK_USER_INTERACTION_TYPE,
} from "@/pages/superMagic/components/MessageList/utils/askUserConstants"
import {
	type AskUserCardData,
	type AskUserQuestionData,
	getAskUserNode,
	parseAskUserAnswerContent,
	parseAskUserContent,
} from "@/pages/superMagic/components/MessageList/utils/askUser"
import type { NodeProps } from "../../types"
import { useAskUserActions } from "./useAskUserActions"
import { useAskUserCountdown } from "./useAskUserCountdown"

const askUserEmptyDetailData: Record<string, unknown> = {}

const askUserNodeStatusMap: Record<string, AskUserCardData["status"]> = {
	[ASK_USER_CARD_STATUS.answered]: ASK_USER_CARD_STATUS.answered,
	[ASK_USER_CARD_STATUS.skipped]: ASK_USER_CARD_STATUS.skipped,
	[ASK_USER_CARD_STATUS.cancelled]: ASK_USER_CARD_STATUS.cancelled,
	[ASK_USER_CARD_STATUS.timeout]: ASK_USER_CARD_STATUS.timeout,
}

function normalizeStringValue(value: unknown) {
	return typeof value === "string" ? value : ""
}

function normalizeStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	return value.filter((item): item is string => typeof item === "string")
}

function normalizeAskUserAnswerValue(value: unknown): string | string[] | null {
	if (typeof value === "string") return value
	if (!Array.isArray(value)) return null
	return value.filter((item): item is string => typeof item === "string")
}

function resolveAskUserCardStatus({
	resolvedNodeStatus,
	parsedContentStatus,
}: {
	resolvedNodeStatus: string
	parsedContentStatus?: string
}) {
	const mappedStatus = askUserNodeStatusMap[resolvedNodeStatus]
	if (mappedStatus) return mappedStatus
	if (parsedContentStatus === ASK_USER_CARD_STATUS.timeout) return ASK_USER_CARD_STATUS.timeout
	return ASK_USER_CARD_STATUS.pending
}

function normalizeMinSelect(minSelect: number | null | undefined) {
	if (typeof minSelect !== "number" || Number.isNaN(minSelect) || minSelect <= 0) return 1
	return Math.floor(minSelect)
}

function normalizeMaxSelect(maxSelect: number | null | undefined) {
	if (typeof maxSelect !== "number" || Number.isNaN(maxSelect) || maxSelect <= 0) return null
	return Math.floor(maxSelect)
}

function buildAskUserFromParsedContent({
	askUserNode,
	parsedContent,
	resolvedNodeStatus,
}: {
	askUserNode: ReturnType<typeof getAskUserNode>
	parsedContent: ReturnType<typeof parseAskUserContent> | null
	resolvedNodeStatus: string
}) {
	if (!parsedContent) {
		return {
			taskId: askUserNode?.task_id,
			questionId: "",
			questions: [],
			expiresAt: 0,
			status: resolveAskUserCardStatus({ resolvedNodeStatus }),
			answer: null,
		} satisfies AskUserCardData
	}

	return {
		taskId: askUserNode?.task_id,
		questionId: parsedContent.question_id,
		questions: (parsedContent.questions || []).map((question) => ({
			subId: normalizeStringValue(question.sub_id),
			question: normalizeStringValue(question.question),
			interactionType: question.interaction_type,
			options: normalizeStringArray(question.options),
			placeholder: normalizeStringValue(question.placeholder),
			minSelect: normalizeMinSelect(question.min_select),
			maxSelect: normalizeMaxSelect(question.max_select),
			defaultValue: normalizeAskUserAnswerValue(question.default_value),
		})),
		expiresAt: parsedContent.expires_at,
		status: resolveAskUserCardStatus({
			resolvedNodeStatus,
			parsedContentStatus: parsedContent.status,
		}),
		answer:
			resolvedNodeStatus === ASK_USER_CARD_STATUS.answered
				? parseAskUserAnswerContent(askUserNode?.content)
				: null,
	} satisfies AskUserCardData
}

function mapDetailQuestion(question: unknown) {
	const item = question as Record<string, unknown>
	return {
		subId: String(item.sub_id || ""),
		question: String(item.question || ""),
		interactionType: String(
			item.interaction_type || ASK_USER_INTERACTION_TYPE.input,
		) as AskUserQuestionData["interactionType"],
		options: normalizeStringArray(item.options),
		placeholder: String(item.placeholder || ""),
		minSelect: normalizeMinSelect(typeof item.min_select === "number" ? item.min_select : null),
		maxSelect: normalizeMaxSelect(typeof item.max_select === "number" ? item.max_select : null),
		defaultValue: normalizeAskUserAnswerValue(item.default_value),
	}
}

function applyDetailFallback({
	baseAskUser,
	resolvedNodeStatus,
	detailData,
}: {
	baseAskUser: AskUserCardData
	resolvedNodeStatus: string
	detailData: Record<string, unknown>
}) {
	const resolvedQuestionsFromDetail = Array.isArray(detailData.questions)
		? detailData.questions
		: []
	if (resolvedQuestionsFromDetail.length === 0) return baseAskUser

	const resolvedAnswerFromDetail =
		typeof detailData.answers === "object" &&
		detailData.answers &&
		!Array.isArray(detailData.answers)
			? (detailData.answers as Record<string, string | string[]>)
			: null

	const nextAskUser: AskUserCardData = {
		...baseAskUser,
		questionId:
			(typeof detailData.question_id === "string" ? detailData.question_id : "") ||
			baseAskUser.questionId,
		questions: resolvedQuestionsFromDetail.map(mapDetailQuestion),
		expiresAt:
			typeof detailData.expires_at === "number"
				? detailData.expires_at
				: baseAskUser.expiresAt,
	}

	if (resolvedNodeStatus === ASK_USER_CARD_STATUS.answered)
		nextAskUser.answer = resolvedAnswerFromDetail
	if (resolvedNodeStatus === ASK_USER_CARD_STATUS.timeout)
		nextAskUser.answer = resolvedAnswerFromDetail
	return nextAskUser
}

function getAnsweredQuestionCount({
	askUser,
	isQuestionValid,
}: {
	askUser: AskUserCardData
	isQuestionValid: (question: AskUserQuestionData) => boolean
}) {
	return askUser.questions.filter((question) => {
		if (askUser.status === ASK_USER_CARD_STATUS.pending) return isQuestionValid(question)

		const answerValue = askUser.answer?.[question.subId]
		if (Array.isArray(answerValue)) return answerValue.length > 0
		if (typeof answerValue === "string") return answerValue.trim().length > 0
		return false
	}).length
}

export function useAskUserViewModel({
	node,
	selectedTopic,
}: Pick<NodeProps, "node" | "selectedTopic">) {
	const askUserNode = getAskUserNode(node as typeof node)
	const parsedContent = parseAskUserContent(askUserNode?.content)
	const askUserTool = askUserNode?.tool as
		| { status?: string; detail?: { data?: Record<string, unknown> } }
		| undefined
	const detailData =
		(askUserTool?.detail?.data as Record<string, unknown> | undefined) || askUserEmptyDetailData
	const detailStatus = typeof detailData.status === "string" ? detailData.status : ""
	const toolStatus = typeof askUserTool?.status === "string" ? askUserTool.status : ""
	const hasDetailQuestions =
		Array.isArray(detailData.questions) && detailData.questions.length > 0
	const resolvedNodeStatus = detailStatus || askUserNode?.status || toolStatus || node?.status
	const askUserFromNode = node?.askUser as AskUserCardData | undefined
	const resolvedAskUser = useMemo(() => {
		if (askUserFromNode) return askUserFromNode
		return applyDetailFallback({
			baseAskUser: buildAskUserFromParsedContent({
				askUserNode,
				parsedContent,
				resolvedNodeStatus,
			}),
			resolvedNodeStatus,
			detailData,
		})
	}, [askUserFromNode, askUserNode, detailData, parsedContent, resolvedNodeStatus])

	const errorState = (
		superMagicStore as unknown as {
			getAskUserErrorState?: (questionId: string) => { message?: string; reason?: string }
		}
	).getAskUserErrorState?.(resolvedAskUser.questionId)
	const isPending = resolvedAskUser.status === ASK_USER_CARD_STATUS.pending
	const messageTopicId = selectedTopic?.chat_topic_id || ""
	const topicMessages = messageTopicId ? superMagicStore.messages.get(messageTopicId) || [] : []
	const displayMessages = topicMessages.length > 0 ? messagesConverter(topicMessages) : []
	const currentMessageId = typeof node?.app_message_id === "string" ? node.app_message_id : ""
	const currentAskUserIndex =
		currentMessageId && displayMessages.length > 0
			? displayMessages.findIndex((message) => message?.app_message_id === currentMessageId)
			: -1
	const hasNewerAskUserCard =
		currentAskUserIndex >= 0
			? displayMessages.some(
					(message, index) =>
						index > currentAskUserIndex &&
						Boolean((message?.askUser as AskUserCardData | undefined)?.questionId),
				)
			: false
	const hasNewerUserMessage =
		currentAskUserIndex >= 0
			? displayMessages.some(
					(message, index) =>
						index > currentAskUserIndex &&
						message?.role === "user" &&
						!(message?.askUser as AskUserCardData | undefined)?.questionId,
				)
			: false
	const isStalePendingCard =
		isPending &&
		Boolean(resolvedAskUser.questionId) &&
		(hasNewerAskUserCard || hasNewerUserMessage)
	const effectiveAskUser = isStalePendingCard
		? { ...resolvedAskUser, status: ASK_USER_CARD_STATUS.cancelled }
		: resolvedAskUser
	const resolvedErrorState = errorState
	const hasMultipleQuestions = effectiveAskUser.questions.length > 1
	const { isExpiredLocal, remainingText } = useAskUserCountdown({
		expiresAt: effectiveAskUser.expiresAt,
		isActive: effectiveAskUser.status === ASK_USER_CARD_STATUS.pending,
	})
	const shouldDisableInteraction =
		Boolean(resolvedErrorState) ||
		effectiveAskUser.status !== ASK_USER_CARD_STATUS.pending ||
		isExpiredLocal
	const shouldRender = Boolean(askUserFromNode || parsedContent || hasDetailQuestions)
	const askUserToolId =
		typeof (askUserNode?.tool as { id?: unknown } | undefined)?.id === "string"
			? ((askUserNode?.tool as { id?: string } | undefined)?.id ?? "")
			: ""
	const actions = useAskUserActions({
		askUser: effectiveAskUser,
		context: {
			conversationId:
				(typeof node?.conversation_id === "string" ? node.conversation_id : "") ||
				selectedTopic?.chat_conversation_id ||
				"",
			topicId:
				(typeof node?.topic_id === "string" ? node.topic_id : "") ||
				selectedTopic?.chat_topic_id ||
				"",
			toolCallId:
				(typeof askUserNode?.tool_call_id === "string" ? askUserNode.tool_call_id : "") ||
				askUserToolId ||
				"",
		},
		isDisabled: shouldDisableInteraction,
	})
	const answeredQuestionCount = getAnsweredQuestionCount({
		askUser: effectiveAskUser,
		isQuestionValid: actions.isQuestionValid,
	})

	return {
		answeredQuestionCount,
		askUserFromNode,
		errorState: resolvedErrorState,
		hasMultipleQuestions,
		isExpiredLocal,
		remainingText,
		resolvedAskUser: effectiveAskUser,
		shouldDisableInteraction,
		shouldRender,
		...actions,
	}
}
