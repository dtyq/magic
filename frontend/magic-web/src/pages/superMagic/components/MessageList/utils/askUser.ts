import {
	AskUserInteractionType,
	type AskUserAnswerContent,
	type AskUserAnswerValue,
	type AskUserContent,
	type AskUserNode,
	type AskUserQuestionItem,
} from "@/types/chat/conversation_message"
import { userStore } from "@/models/user"
import {
	ASK_USER_CARD_STATUS,
	ASK_USER_CONFIRM_VALUE,
	ASK_USER_INTERACTION_TYPE,
	ASK_USER_NODE_STATUS,
	ASK_USER_OTHER_OPTION,
	ASK_USER_RESPONSE_STATUS,
	ASK_USER_TOOL,
	type AskUserCardStatusValue,
	type AskUserResponseStatusValue,
} from "./askUserConstants"
import { SuperMagicMessageType, type SuperMagicMessageItem } from "../type"

export type AskUserCardStatus = AskUserCardStatusValue
export type AskUserResponseStatus = AskUserResponseStatusValue
export type AskUserPendingAction = "submit" | "skip" | null
export type AskUserLocale = "zh_CN" | "en_US"

function normalizeStringValue(value: unknown) {
	return typeof value === "string" ? value : ""
}

function normalizeStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	return value.filter((item): item is string => typeof item === "string")
}

function normalizeAskUserAnswerValue(value: unknown): AskUserAnswerValue | null {
	if (typeof value === "string") return value
	if (!Array.isArray(value)) return null
	return value.filter((item): item is string => typeof item === "string")
}

function getDebugNode(
	item: Record<string, unknown> | null | undefined,
): Record<string, unknown> | undefined {
	const debugNode = item?.debug
	if (!debugNode || typeof debugNode !== "object") return undefined
	return debugNode as Record<string, unknown>
}

function hasAskUserTool(node: Record<string, unknown> | null | undefined) {
	const tool = node?.tool as Record<string, unknown> | undefined
	return tool?.name === ASK_USER_TOOL.name
}

function getAskUserSourceNode(
	item: Record<string, unknown> | null | undefined,
): Record<string, unknown> | undefined {
	if (!item || typeof item !== "object") return undefined

	const debugNode = getDebugNode(item)
	const generalAgentCard = item.general_agent_card as Record<string, unknown> | undefined
	const candidates = [debugNode, generalAgentCard, item]
	return candidates.find((node) => hasAskUserTool(node))
}

/** 问卷「其他」选项：与选项文案匹配，用于展示胶囊输入框并校验自定义内容 */
export function isAskUserOtherOption(option: unknown) {
	if (typeof option !== "string") return false
	const label = option.trim()
	if (!label) return false
	if (label.toLowerCase() === ASK_USER_OTHER_OPTION.english) return true
	return ASK_USER_OTHER_OPTION.chineseVariants.includes(
		label as (typeof ASK_USER_OTHER_OPTION.chineseVariants)[number],
	)
}

export interface AskUserQuestionData {
	/** 子问题唯一 ID（用于答案映射与前端状态索引） */
	subId: string
	/** 子问题题干文案 */
	question: string
	/** 交互类型：确认/输入/单选/多选 */
	interactionType: AskUserInteractionType
	/** 可选项列表（input 场景可为空） */
	options: string[]
	/** 输入占位文案 */
	placeholder: string
	/** 多选最少选择数量 */
	minSelect: number
	/** 多选最多选择数量，null 表示不限制 */
	maxSelect: number | null
	/** 默认答案（超时或自动处理时使用） */
	defaultValue: AskUserAnswerValue | null
}

/**
 * AskUser 卡片统一数据模型。
 * 用于渲染问答卡片、交互提交以及状态展示。
 */
export interface AskUserCardData {
	/** 后端任务 ID（提交 tool_reply 时必需） */
	taskId?: string
	/** 问卷/问题组 ID（用于关联消息与回执） */
	questionId: string
	/** 子问题列表 */
	questions: AskUserQuestionData[]
	/** 过期时间（Unix 秒级时间戳） */
	expiresAt: number
	/** 当前卡片状态（pending/answered/skipped/timeout/cancelled） */
	status: AskUserCardStatus
	/** 已有答案（未回答时为 null） */
	answer: AskUserAnswerContent | null
}

export interface AskUserActionDetail {
	task_id: string
	question_id: string
	response_status: AskUserResponseStatus
	answer: string
}

export interface AskUserAutoAction {
	responseStatus: AskUserResponseStatus
	answer?: string
}

interface AskUserToolDetailData {
	question_id?: string
	expires_at?: number
	status?: string
	questions?: AskUserQuestionItem[]
	answers?: AskUserAnswerContent
}

function getSuperAgentDynamicParams(extra: unknown) {
	const superAgent = (extra as Record<string, unknown> | undefined)?.super_agent as
		| Record<string, unknown>
		| undefined
	return superAgent?.dynamic_params
}

function getAskUserToolReply(item: Record<string, unknown> | null | undefined) {
	if (!item || typeof item !== "object") return undefined

	const debugNode = getDebugNode(item)
	const richText = item.rich_text as Record<string, unknown> | undefined
	const rawRichText = item.raw_content as { rich_text?: Record<string, unknown> } | undefined

	const dynamicParams =
		getSuperAgentDynamicParams(debugNode?.extra) ||
		getSuperAgentDynamicParams(richText?.extra) ||
		getSuperAgentDynamicParams(rawRichText?.rich_text?.extra)

	const toolReply = (dynamicParams as Record<string, unknown> | undefined)?.tool_reply as
		| Record<string, unknown>
		| undefined

	if (toolReply?.name !== ASK_USER_TOOL.name) return undefined
	return toolReply
}

function parseAskUserToolReplyDetail(item: Record<string, unknown> | null | undefined) {
	const detail = getAskUserToolReply(item)?.detail
	if (typeof detail !== "string" || !detail) return null

	try {
		const parsedDetail = JSON.parse(detail) as AskUserActionDetail
		if (!parsedDetail || typeof parsedDetail !== "object") return null
		return parsedDetail
	} catch {
		return null
	}
}

function normalizeAskUserStatus(status: unknown): AskUserCardStatus | undefined {
	if (typeof status !== "string") return undefined
	if (status === ASK_USER_CARD_STATUS.answered) return ASK_USER_CARD_STATUS.answered
	if (status === ASK_USER_CARD_STATUS.skipped) return ASK_USER_CARD_STATUS.skipped
	if (status === ASK_USER_CARD_STATUS.timeout) return ASK_USER_CARD_STATUS.timeout
	if (status === ASK_USER_CARD_STATUS.cancelled) return ASK_USER_CARD_STATUS.cancelled
	if (status === ASK_USER_CARD_STATUS.pending) return ASK_USER_CARD_STATUS.pending
	if (status === ASK_USER_NODE_STATUS.waitingForUser) return ASK_USER_CARD_STATUS.pending
	if (status === ASK_USER_NODE_STATUS.running) return ASK_USER_CARD_STATUS.pending
	return undefined
}

function normalizeAskUserMinSelect(minSelect: number | null | undefined) {
	if (typeof minSelect !== "number" || Number.isNaN(minSelect) || minSelect <= 0) return 1
	return Math.floor(minSelect)
}

function normalizeAskUserMaxSelect(maxSelect: number | null | undefined) {
	if (typeof maxSelect !== "number" || Number.isNaN(maxSelect) || maxSelect <= 0) return null
	return Math.floor(maxSelect)
}

export function resolveAskUserLocaleFromAction(action: string | undefined): AskUserLocale {
	return /[\u4e00-\u9fff]/.test(action || "") ? "zh_CN" : "en_US"
}

export function buildAskUserSocketPayload({
	questionId,
	answer,
}: {
	questionId: string
	answer?: string
}) {
	const organizationCode =
		typeof userStore.user.organizationCode === "string"
			? userStore.user.organizationCode.trim()
			: ""

	return {
		question_id: questionId,
		...(typeof answer === "string" ? { answer } : {}),
		...(organizationCode
			? {
					organization_code: organizationCode,
				}
			: {}),
	}
}

export function buildAskUserToolReplyDetail({
	taskId,
	questionId,
	responseStatus,
	answer = "",
}: {
	taskId?: string
	questionId: string
	responseStatus: AskUserResponseStatus
	answer?: string
}): AskUserActionDetail | null {
	const resolvedTaskId = typeof taskId === "string" ? taskId.trim() : ""
	const resolvedQuestionId = typeof questionId === "string" ? questionId : ""
	if (!resolvedTaskId) return null

	return {
		task_id: resolvedTaskId,
		question_id: resolvedQuestionId,
		response_status: responseStatus,
		answer,
	}
}

interface AskUserMessageSnapshot {
	item: SuperMagicMessageItem
	content: AskUserContent | null
	status: AskUserCardStatus
}

const EMPTY_ASK_USER_CONTENT: AskUserContent = {
	question_id: "",
	questions: [],
	expires_at: 0,
	status: ASK_USER_CARD_STATUS.pending,
}

function isAskUserToolCallMessage(item: Record<string, unknown> | null | undefined) {
	const node = getAskUserSourceNode(item)
	const tool = node?.tool as Record<string, unknown> | undefined
	const toolName = typeof tool?.name === "string" ? tool.name : ""
	const event = typeof node?.event === "string" ? node.event : ""
	const type = typeof node?.type === "string" ? node.type : ""

	if (type !== SuperMagicMessageType.ToolCall || toolName !== ASK_USER_TOOL.name) return false
	if (!event) return true
	return event === ASK_USER_TOOL.beforeToolCallEvent || event === ASK_USER_TOOL.afterToolCallEvent
}

function getAskUserToolDetailData(
	item: Record<string, unknown> | null | undefined,
): AskUserToolDetailData | null {
	const sourceNode = getAskUserSourceNode(item)
	const tool = sourceNode?.tool as Record<string, unknown> | undefined
	const detail = tool?.detail as Record<string, unknown> | undefined
	const data = detail?.data
	if (!data || typeof data !== "object") return null
	return data as AskUserToolDetailData
}

export function isAskUserMessage(item: unknown): item is SuperMagicMessageItem {
	if (!item || typeof item !== "object") return false

	const messageItem = item as Record<string, unknown>
	return isAskUserToolCallMessage(messageItem)
}

/**
 * AskUser 回执消息（tool_reply）只用于驱动卡片状态，不应作为独立用户对话气泡展示。
 */
export function isAskUserToolReplyMessage(item: unknown): boolean {
	if (!item || typeof item !== "object") return false

	return Boolean(getAskUserToolReply(item as Record<string, unknown>))
}

export function parseAskUserContent(content: unknown): AskUserContent | null {
	if (typeof content !== "string" || !content) return null

	try {
		const parsedContent = JSON.parse(content) as AskUserContent
		if (!parsedContent?.question_id || !Array.isArray(parsedContent?.questions)) return null
		return parsedContent
	} catch {
		return null
	}
}

export function parseAskUserAnswerContent(content: unknown): AskUserAnswerContent | null {
	if (typeof content !== "string" || !content) return null

	try {
		const parsedContent = JSON.parse(content) as AskUserAnswerContent
		if (!parsedContent || typeof parsedContent !== "object" || Array.isArray(parsedContent)) {
			return null
		}
		return parsedContent
	} catch {
		return null
	}
}

export function getAskUserCorrelationId(item: Record<string, unknown> | null | undefined) {
	const toolReplyDetail = parseAskUserToolReplyDetail(item)
	const sourceNode = getAskUserSourceNode(item)
	const correlationId =
		typeof sourceNode?.correlation_id === "string" ? sourceNode.correlation_id : ""
	const detailData = getAskUserToolDetailData(sourceNode)
	const content =
		typeof sourceNode?.content === "string"
			? sourceNode.content
			: typeof item?.content === "string"
				? item.content
				: ""
	const detailQuestionId = normalizeStringValue(detailData?.question_id)

	return (
		normalizeStringValue(toolReplyDetail?.question_id) ||
		detailQuestionId ||
		parseAskUserContent(content)?.question_id ||
		correlationId ||
		""
	)
}

function resolveAskUserMessageStatus(item: SuperMagicMessageItem): AskUserCardStatus {
	const toolReplyDetail = parseAskUserToolReplyDetail(item as Record<string, unknown>)
	const node = getAskUserNode(item)
	const detailData = getAskUserToolDetailData(node as Record<string, unknown> | undefined)
	const toolStatus = (node as Record<string, unknown> | undefined)?.tool as
		| { status?: string }
		| undefined
	const parsedContentStatus = parseAskUserContent(node?.content)?.status

	// 优先级：detail.data.status > node.status > tool.status > content.status
	return (
		normalizeAskUserStatus(toolReplyDetail?.response_status) ||
		normalizeAskUserStatus(detailData?.status) ||
		normalizeAskUserStatus(node?.status) ||
		normalizeAskUserStatus(toolStatus?.status) ||
		normalizeAskUserStatus(parsedContentStatus) ||
		ASK_USER_CARD_STATUS.pending
	)
}

function toAskUserSnapshot(item: SuperMagicMessageItem): AskUserMessageSnapshot {
	return {
		item,
		content: resolveAskUserMessageContent(item),
		status: resolveAskUserMessageStatus(item),
	}
}

function normalizeAskUserQuestion(question: AskUserQuestionItem): AskUserQuestionData {
	const minSelect = normalizeAskUserMinSelect(question.min_select)
	const maxSelect = normalizeAskUserMaxSelect(question.max_select)

	return {
		subId: normalizeStringValue(question.sub_id),
		question: normalizeStringValue(question.question),
		interactionType: question.interaction_type,
		options: normalizeStringArray(question.options),
		placeholder: normalizeStringValue(question.placeholder),
		minSelect,
		maxSelect,
		defaultValue: normalizeAskUserAnswerValue(question.default_value),
	}
}

function resolveAskUserMessageContent(item: SuperMagicMessageItem): AskUserContent {
	const node = getAskUserNode(item) as Record<string, unknown> | undefined
	const detailData = getAskUserToolDetailData(node)
	const parsedContent = parseAskUserContent(node?.content)
	const questionId =
		normalizeStringValue(detailData?.question_id) ||
		parsedContent?.question_id ||
		getAskUserCorrelationId(item)

	return {
		question_id: questionId || "",
		questions: (detailData?.questions ||
			parsedContent?.questions ||
			[]) as AskUserQuestionItem[],
		expires_at:
			typeof detailData?.expires_at === "number"
				? detailData.expires_at
				: (parsedContent?.expires_at ?? 0),
		status:
			detailData?.status === ASK_USER_CARD_STATUS.timeout ||
			parsedContent?.status === ASK_USER_CARD_STATUS.timeout
				? ASK_USER_CARD_STATUS.timeout
				: ASK_USER_CARD_STATUS.pending,
	}
}

function resolveAskUserAnswer(item: SuperMagicMessageItem): AskUserAnswerContent | null {
	const toolReplyDetail = parseAskUserToolReplyDetail(item as Record<string, unknown>)
	const node = getAskUserNode(item) as Record<string, unknown> | undefined
	const detailData = getAskUserToolDetailData(node)
	const toolReplyAnswer = parseAskUserAnswerContent(toolReplyDetail?.answer)
	if (toolReplyAnswer) return toolReplyAnswer
	if (detailData?.answers && typeof detailData.answers === "object") return detailData.answers
	return parseAskUserAnswerContent((node as AskUserNode | undefined)?.content)
}

export function aggregateAskUserMessages(messages: SuperMagicMessageItem[]): SuperMagicMessageItem {
	const snapshots = messages.map(toAskUserSnapshot)
	const pendingSnapshot = snapshots.find(
		(snapshot) => snapshot.status === ASK_USER_CARD_STATUS.pending,
	)
	const timeoutSnapshot = snapshots.findLast(
		(snapshot) => snapshot.status === ASK_USER_CARD_STATUS.timeout,
	)
	const cancelledSnapshot = snapshots.findLast(
		(snapshot) => snapshot.status === ASK_USER_CARD_STATUS.cancelled,
	)
	const answeredSnapshot = snapshots.findLast(
		(snapshot) => snapshot.status === ASK_USER_CARD_STATUS.answered,
	)
	const skippedSnapshot = snapshots.findLast(
		(snapshot) => snapshot.status === ASK_USER_CARD_STATUS.skipped,
	)
	const finalSnapshot =
		answeredSnapshot ||
		skippedSnapshot ||
		timeoutSnapshot ||
		cancelledSnapshot ||
		pendingSnapshot ||
		snapshots[0]
	const baseSnapshot =
		pendingSnapshot ||
		timeoutSnapshot ||
		snapshots.find((snapshot) => snapshot.content) ||
		finalSnapshot
	const finalNode = getAskUserNode(finalSnapshot?.item)
	const content =
		baseSnapshot?.content ||
		resolveAskUserMessageContent(baseSnapshot?.item || finalSnapshot?.item) ||
		EMPTY_ASK_USER_CONTENT
	const status = finalSnapshot?.status || ASK_USER_CARD_STATUS.pending
	const answer =
		status === ASK_USER_CARD_STATUS.answered || status === ASK_USER_CARD_STATUS.timeout
			? resolveAskUserAnswer(finalSnapshot?.item)
			: null
	const correlationId = getAskUserCorrelationId(baseSnapshot?.item || finalSnapshot?.item || {})
	const appMessageId =
		baseSnapshot?.item?.app_message_id || finalSnapshot?.item?.app_message_id || correlationId
	const taskId =
		(baseSnapshot?.item?.task_id as string | undefined) ||
		(finalSnapshot?.item?.task_id as string | undefined) ||
		(finalNode?.task_id as string | undefined) ||
		""

	return {
		...(baseSnapshot?.item || finalSnapshot?.item),
		type: SuperMagicMessageType.ToolCall,
		app_message_id: appMessageId,
		correlation_id: correlationId,
		content: content.questions
			.map((question) => normalizeStringValue(question?.question))
			.filter(Boolean)
			.join("\n"),
		askUser: {
			taskId,
			questionId: content.question_id || correlationId,
			questions: (content.questions || []).map(normalizeAskUserQuestion),
			expiresAt: content.expires_at,
			status,
			answer,
		} satisfies AskUserCardData,
	} as SuperMagicMessageItem
}

export function formatAskUserAnswer({
	interactionType,
	selectedOptions,
	value,
}: {
	interactionType: AskUserInteractionType
	selectedOptions?: string[]
	value?: string
}): AskUserAnswerValue {
	if (interactionType === ASK_USER_INTERACTION_TYPE.multiSelect) {
		return selectedOptions || []
	}

	return value || ""
}

export function formatAskUserAnswerForDisplay(value?: AskUserAnswerValue | null) {
	if (Array.isArray(value)) return value.join("、")
	return value || ""
}

export function isAskUserAnswerValid({
	interactionType,
	selectedOptions,
	value,
	minSelect,
	maxSelect,
}: {
	interactionType: AskUserInteractionType
	selectedOptions?: string[]
	value?: string
	minSelect?: number
	maxSelect?: number | null
}) {
	if (interactionType === ASK_USER_INTERACTION_TYPE.confirm)
		return value === ASK_USER_CONFIRM_VALUE.yes || value === ASK_USER_CONFIRM_VALUE.no
	if (interactionType === ASK_USER_INTERACTION_TYPE.input) return Boolean(value?.trim())
	if (interactionType === ASK_USER_INTERACTION_TYPE.select) return Boolean(value)
	if (interactionType !== ASK_USER_INTERACTION_TYPE.multiSelect) return false

	const selectionCount = selectedOptions?.length || 0
	const resolvedMinSelect = normalizeAskUserMinSelect(minSelect)
	const resolvedMaxSelect = normalizeAskUserMaxSelect(maxSelect)
	if (selectionCount < resolvedMinSelect) return false
	if (typeof resolvedMaxSelect === "number" && selectionCount > resolvedMaxSelect) return false

	return selectionCount > 0
}

export function resolveAskUserAutoAction(askUser: AskUserCardData): AskUserAutoAction {
	if (askUser.questions.length === 0) return { responseStatus: ASK_USER_RESPONSE_STATUS.skipped }

	const answers: AskUserAnswerContent = {}

	for (const question of askUser.questions) {
		const answerValue = resolveAskUserDefaultAnswerValue(question)
		if (answerValue === null) return { responseStatus: ASK_USER_RESPONSE_STATUS.skipped }
		answers[question.subId] = answerValue
	}

	return {
		responseStatus: ASK_USER_RESPONSE_STATUS.answered,
		answer: JSON.stringify(answers),
	}
}

function resolveAskUserDefaultAnswerValue(
	question: AskUserQuestionData,
): AskUserAnswerValue | null {
	if (question.interactionType === ASK_USER_INTERACTION_TYPE.multiSelect) {
		const selectedOptions = normalizeMultiSelectValue(question.defaultValue)
		if (
			!isAskUserAnswerValid({
				interactionType: question.interactionType,
				selectedOptions,
				minSelect: question.minSelect,
				maxSelect: question.maxSelect,
			})
		) {
			return null
		}

		return formatAskUserAnswer({
			interactionType: question.interactionType,
			selectedOptions,
		})
	}

	const defaultValue =
		typeof question.defaultValue === "string" ? question.defaultValue.trim() : ""
	if (
		!isAskUserAnswerValid({
			interactionType: question.interactionType,
			value: defaultValue,
		})
	) {
		return null
	}

	return formatAskUserAnswer({
		interactionType: question.interactionType,
		value: defaultValue,
	})
}

function normalizeMultiSelectValue(value: AskUserAnswerValue | null | undefined) {
	if (Array.isArray(value)) return value.filter(Boolean)
	if (typeof value !== "string") return []

	const trimmedValue = value.trim()
	if (!trimmedValue) return []

	try {
		const parsedValue = JSON.parse(trimmedValue) as unknown
		if (Array.isArray(parsedValue)) {
			return parsedValue.filter(
				(item): item is string => typeof item === "string" && Boolean(item),
			)
		}
	} catch {
		// noop
	}

	return trimmedValue
		.split(",")
		.map((option) => option.trim())
		.filter(Boolean)
}

export function getAskUserErrorTextKey(reason?: string) {
	if (reason === "already_processed") return "askUser.status.alreadyProcessed"
	if (reason === "processing_in_progress") return "askUser.status.processingInProgress"
	if (reason === "processing_failed") return "askUser.status.processingFailed"
	if (reason === "task_not_found") return "askUser.status.taskNotFound"
	return "askUser.status.alreadyProcessed"
}

export function getAskUserNode(item: SuperMagicMessageItem): AskUserNode | undefined {
	if (!item || typeof item !== "object") return undefined

	const sourceNode = getAskUserSourceNode(item as Record<string, unknown>)
	if (hasAskUserTool(sourceNode)) return sourceNode as AskUserNode
	return undefined
}
