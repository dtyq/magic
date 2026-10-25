import questionIcon from "@/assets/logos/question.svg"
import magicToast from "@/components/base/MagicToaster/utils"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import useShareRoute from "@/pages/superMagic/hooks/useShareRoute"
import { useToolTooltip } from "@/pages/superMagic/components/MessageList/components/Nodes/ToolCall/hooks/useToolTooltip"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import type { AskUserQuestionItem } from "@/types/chat/conversation_message"
import {
	buildAskUserToolReplyDetail,
	isAskUserTaskSuspended,
	normalizeAskUserRemark,
	resolveAskUserLocaleFromAction,
	ASK_USER_RECOVERY_FAILED_EVENT,
} from "@/pages/superMagic/components/MessageList/utils/askUser"
import {
	buildAskUserDraftCacheKey,
	clearAskUserDraftAnswers,
} from "@/pages/superMagic/components/MessageList/utils/askUserDraftCache"
import {
	ASK_USER_CARD_STATUS,
	ASK_USER_RESPONSE_STATUS,
	ASK_USER_TOOL,
	type AskUserResponseStatusValue,
} from "@/pages/superMagic/components/MessageList/utils/askUserConstants"
import {
	buildAskUserReplyStateKey,
	claimAskUserReply,
	clearAskUserReply,
	isTerminalAskUserReplyError,
	markAskUserReply,
	readAskUserReplyState,
	type AskUserReplyState,
} from "@/pages/superMagic/components/MessageList/utils/askUserReplyState"
import { sendAskUserToolReply } from "@/pages/superMagic/services/askUserToolReplyService"
import { clearAskUserV2BrowserNotification } from "@/pages/superMagic/services/askUserBrowserNotificationService"
import { superMagicStore } from "@/pages/superMagic/stores"
import { IconLoader2 } from "@tabler/icons-react"
import { ChevronDown } from "lucide-react"
import { observer } from "mobx-react-lite"
import {
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
	type MouseEvent,
} from "react"
import { useTranslation } from "react-i18next"
import { AskUserForm, type AskUserAnswers } from "./AskUserForm"
import { extractQuestionsField, parseQuestionsXml, type ParsedQuestion } from "./parse"
import { useMessageViewState } from "@/pages/superMagic/components/MessageList/view-state/MessageViewStateContext"
import type { ToolCallViewModel } from "../../types"

interface AskUserToolCallProps {
	toolData?: ToolCallViewModel
	loading?: boolean
	classNames?: string
	selectedTopic?: Topic | null
	isShare?: boolean
	onSelectDetail?: (detail: unknown) => void
	onMouseEnter?: (event: MouseEvent) => void
	onMouseLeave?: (event: MouseEvent) => void
}

type AskUserDetailQuestion = {
	sub_id?: string
}

type AskUserAnswerValue = string | readonly string[]

function normalizeAskUserStatus(status: unknown) {
	if (status === ASK_USER_CARD_STATUS.answered) return ASK_USER_CARD_STATUS.answered
	if (status === ASK_USER_CARD_STATUS.skipped) return ASK_USER_CARD_STATUS.skipped
	if (status === ASK_USER_CARD_STATUS.timeout) return ASK_USER_CARD_STATUS.timeout
	if (status === ASK_USER_CARD_STATUS.cancelled) return ASK_USER_CARD_STATUS.cancelled
	return ASK_USER_CARD_STATUS.pending
}

/** 保留标记 Other 由自由输入承接，不能成为候选、默认值或已选答案。 */
function normalizeChoiceAnswer(
	value: AskUserAnswerValue | undefined,
	type: ParsedQuestion["type"],
): AskUserAnswerValue | undefined {
	if (type !== "select" && type !== "multi_select") return value
	if (Array.isArray(value)) return value.filter((item) => item.trim().toLowerCase() !== "other")
	if (typeof value !== "string") return value
	if (type === "multi_select")
		return value
			.split(",")
			.map((item) => item.trim())
			.filter((item) => item.toLowerCase() !== "other")
	return value.trim().toLowerCase() === "other" ? undefined : value
}

/** 复用主线正式题源及答案键，仅归一选择题的保留选项。 */
function resolveDetailQuestions(
	questions: readonly ParsedQuestion[],
	detailQuestions: unknown,
): readonly ParsedQuestion[] {
	if (!Array.isArray(detailQuestions) || detailQuestions.length === 0) return questions

	// Prepared operations generate their questions on the server, so model XML
	// may be absent or differ from the confirmed scope. The detail is authoritative.
	return (detailQuestions as AskUserQuestionItem[]).map((question, index) => {
		return {
			// Keep existing XML answer/draft keys; server-only cards use the bound ID.
			id: questions[index]?.id || question.sub_id,
			type: question.interaction_type,
			label: question.question,
			options: (question.options ?? []).filter(
				(option) =>
					(question.interaction_type !== "select" &&
						question.interaction_type !== "multi_select") ||
					option.trim().toLowerCase() !== "other",
			),
			placeholder: question.placeholder ?? undefined,
			min: question.min_select ?? undefined,
			max: question.max_select ?? undefined,
			defaultValue: normalizeChoiceAnswer(
				question.default_value ?? undefined,
				question.interaction_type,
			),
			isComplete: true,
		}
	})
}

/** 服务端答案以 sub_id 为键，流式 XML 题目以 q-{index} 为键，按题目顺序对齐。 */
function resolveSubmittedAnswers({
	answers,
	detailQuestions,
	questions,
}: {
	answers: unknown
	detailQuestions: unknown
	questions: readonly ParsedQuestion[]
}): Record<string, AskUserAnswerValue> | undefined {
	if (!answers || typeof answers !== "object" || Array.isArray(answers)) return undefined

	const answerMap = answers as Record<string, unknown>
	const questionsFromDetail = Array.isArray(detailQuestions) ? detailQuestions : []
	const mappedAnswers: Record<string, AskUserAnswerValue> = {}
	let hasAnswer = false

	questions.forEach((question, index) => {
		const detailQuestion = questionsFromDetail[index] as AskUserDetailQuestion | undefined
		const subId = typeof detailQuestion?.sub_id === "string" ? detailQuestion.sub_id : ""
		const rawAnswer = answerMap[question.id] ?? (subId ? answerMap[subId] : undefined)
		const answer =
			typeof rawAnswer === "string" ||
			(Array.isArray(rawAnswer) && rawAnswer.every((item) => typeof item === "string"))
				? normalizeChoiceAnswer(rawAnswer, question.type)
				: undefined
		if (typeof answer === "string") {
			mappedAnswers[question.id] = answer
			hasAnswer = true
			return
		}
		if (Array.isArray(answer) && answer.every((item) => typeof item === "string")) {
			mappedAnswers[question.id] = answer
			hasAnswer = true
		}
	})

	return hasAnswer ? mappedAnswers : undefined
}

function AskUserToolCall(props: AskUserToolCallProps) {
	const { onMouseEnter, onMouseLeave, loading, classNames, selectedTopic } = props

	const { t } = useTranslation("super")
	const { isShareRoute } = useShareRoute()

	const tool = props.toolData
	const detailData = tool?.detail?.data as Record<string, unknown> | undefined
	// 错误文案由后端本地化，不能继续把原始参数渲染成可提交问卷。
	const errorMessage =
		tool?.detail?.type === "text" && typeof detailData?.message === "string"
			? detailData.message
			: ""

	// 优先从 rawArguments 读取原始 arguments 字符串（流式阶段 detail 可能不存在），
	// 兜底从 detail.data.arguments 读取（已完成的工具调用）。
	const rawArguments = tool?.rawArguments ?? detailData?.arguments
	const argumentsStr = typeof rawArguments === "string" ? rawArguments : ""
	const questionsFieldFromArgs = useMemo(
		() => extractQuestionsField(argumentsStr),
		[argumentsStr],
	)
	const rawQuestionsField = detailData?.questions
	const rawQuestions =
		questionsFieldFromArgs || (typeof rawQuestionsField === "string" ? rawQuestionsField : "")

	const deferredRaw = useDeferredValue(rawQuestions)
	const prevParsedRef = useRef<readonly ParsedQuestion[]>([])
	const [open, setOpen] = useMessageViewState("ask-user-tool-expanded", true)

	const parsedQuestions = useMemo(() => {
		const next = parseQuestionsXml(deferredRaw, prevParsedRef.current)
		const resolvedQuestions = resolveDetailQuestions(next, detailData?.questions)
		prevParsedRef.current = resolvedQuestions
		return resolvedQuestions
	}, [deferredRaw, detailData?.questions])
	const submittedAnswers = useMemo(
		() =>
			resolveSubmittedAnswers({
				answers: detailData?.answers,
				detailQuestions: detailData?.questions,
				questions: parsedQuestions,
			}),
		[detailData?.answers, detailData?.questions, parsedQuestions],
	)
	const submittedRemark = useMemo(
		() => normalizeAskUserRemark(detailData?.remark),
		[detailData?.remark],
	)
	const toolId = tool?.id
	const expiresAt =
		typeof detailData?.expires_at === "number" ? (detailData.expires_at as number) : undefined
	const expiryToastKey = useMemo(
		() => `ask-user-expiry-${selectedTopic?.chat_topic_id || "topic"}-${toolId || "tool"}`,
		[selectedTopic?.chat_topic_id, toolId],
	)
	const showExpiryTip = useCallback(() => {
		magicToast.warning({
			key: expiryToastKey,
			content: t("askUser.status.expiredPending"),
			duration: 0,
		})
	}, [expiryToastKey, t])
	const showClosedTip = useCallback(() => {
		magicToast.warning({
			key: expiryToastKey,
			content: t("askUser.status.alreadyProcessed"),
			duration: 4000,
		})
	}, [expiryToastKey, t])
	const clearExpiryTip = useCallback(() => {
		magicToast.destroy(expiryToastKey)
	}, [expiryToastKey])
	const replyStateKey = useMemo(
		() =>
			buildAskUserReplyStateKey({
				topicId: selectedTopic?.chat_topic_id,
				toolCallId: toolId,
			}),
		[selectedTopic?.chat_topic_id, toolId],
	)
	const [replyState, setReplyState] = useState<AskUserReplyState | null>(() =>
		readAskUserReplyState(replyStateKey),
	)

	useEffect(() => {
		setReplyState(readAskUserReplyState(replyStateKey))
	}, [replyStateKey])

	const toolStatus =
		(typeof detailData?.status === "string" ? detailData.status : "") ||
		(typeof tool?.status === "string" ? tool.status : "")
	const normalizedAskUserStatus = normalizeAskUserStatus(toolStatus)
	const isTaskSuspended = isAskUserTaskSuspended(selectedTopic)
	const hasAuthoritativeTerminalStatus =
		isTaskSuspended || normalizedAskUserStatus !== ASK_USER_CARD_STATUS.pending
	const askUserStatus =
		replyState?.status === "answered" || replyState?.status === "skipped"
			? replyState.status
			: replyState?.status === "timeout" || replyState?.status === "cancelled"
				? ASK_USER_CARD_STATUS.cancelled
				: isTaskSuspended && normalizedAskUserStatus === ASK_USER_CARD_STATUS.pending
					? ASK_USER_CARD_STATUS.cancelled
					: normalizedAskUserStatus
	const isLoading = loading && !isTaskSuspended
	const isOpen = !!isLoading || open
	const askUserLocale = resolveAskUserLocaleFromAction(
		typeof tool?.action === "string" ? tool.action : undefined,
	)

	const [pendingAction, setPendingAction] = useState<"submit" | "skip" | null>(null)
	const [answeredQuestionCount, setAnsweredQuestionCount] = useState(0)

	const allComplete = parsedQuestions.length > 0 && parsedQuestions.every((q) => q.isComplete)
	const isStreaming = !!isLoading && !allComplete
	const isFrozen =
		pendingAction !== null || replyState !== null || !isLoading || props.isShare || isShareRoute
	const detailQuestionId = detailData?.question_id
	const resolvedQuestionId =
		(typeof detailQuestionId === "string" ? detailQuestionId : "") || toolId || ""
	const draftCacheKey = buildAskUserDraftCacheKey({
		questionId: typeof detailQuestionId === "string" ? detailQuestionId : "",
		topicId: selectedTopic?.chat_topic_id,
	})
	const isExpiredAtNow = useCallback(
		() => typeof expiresAt === "number" && expiresAt > 0 && Date.now() / 1000 >= expiresAt,
		[expiresAt],
	)

	useEffect(() => {
		if (!selectedTopic?.chat_topic_id || !toolId) return
		return superMagicStore.subscribe(
			"message.committed",
			({ payload }) => {
				if (
					payload.message.event !== ASK_USER_RECOVERY_FAILED_EVENT ||
					payload.message.toolCallId !== toolId
				)
					return
				clearAskUserReply(replyStateKey)
				setReplyState(null)
				setPendingAction(null)
			},
			{ scope: { topicId: selectedTopic.chat_topic_id } },
		)
	}, [replyStateKey, selectedTopic?.chat_topic_id, toolId])

	useEffect(() => {
		if (normalizedAskUserStatus === ASK_USER_CARD_STATUS.pending) return
		markAskUserReply(replyStateKey, normalizedAskUserStatus)
		setReplyState(readAskUserReplyState(replyStateKey))
		clearAskUserDraftAnswers(draftCacheKey)
	}, [draftCacheKey, normalizedAskUserStatus, replyStateKey])

	useEffect(() => {
		if (hasAuthoritativeTerminalStatus) clearExpiryTip()
		return clearExpiryTip
	}, [clearExpiryTip, hasAuthoritativeTerminalStatus])

	const submitReply = useCallback(
		async (
			responseStatus: AskUserResponseStatusValue,
			answers?: AskUserAnswers,
			remark = "",
		) => {
			const conversationId = selectedTopic?.chat_conversation_id || ""
			const topicId = selectedTopic?.chat_topic_id || ""
			if (!conversationId || !topicId) throw new Error("missing_topic_context")

			const messages = (topicId ? superMagicStore.messages.get(topicId) : undefined) || []
			const relatedMessage = toolId
				? (messages as Array<Record<string, unknown>>).find((o) => {
						const m = superMagicStore.getMessageNode(o.super_message_id as string)
						const toolCalls = (m as { tool_calls?: Array<{ id?: string }> })?.tool_calls
						return (
							Array.isArray(toolCalls) &&
							toolCalls.some((tc) => (tc as { id?: string })?.id === toolId)
						)
					})
				: undefined
			const relatedMessageNode = superMagicStore.getMessageNode(
				relatedMessage?.super_message_id as string,
			) as { task_id?: unknown } | undefined
			const taskId =
				typeof relatedMessageNode?.task_id === "string" ? relatedMessageNode.task_id : ""

			const isAnswered = responseStatus === ASK_USER_RESPONSE_STATUS.answered
			const detail = buildAskUserToolReplyDetail({
				taskId,
				questionId: resolvedQuestionId,
				responseStatus,
				answer: isAnswered && answers ? JSON.stringify(answers) : "",
				remark: isAnswered ? remark : "",
			})
			if (!detail || !toolId) throw new Error("missing_ask_user_task_id")

			if (!claimAskUserReply(replyStateKey)) {
				setReplyState(readAskUserReplyState(replyStateKey))
				return
			}
			setReplyState(readAskUserReplyState(replyStateKey))

			try {
				await sendAskUserToolReply({
					conversationId,
					topicId,
					detail,
					isAnswered,
					toolCallId: toolId,
					toolName: ASK_USER_TOOL.name,
				})
			} catch (error) {
				if (isTerminalAskUserReplyError(error)) {
					showClosedTip()
					markAskUserReply(replyStateKey, "cancelled")
					setReplyState(readAskUserReplyState(replyStateKey))
					clearAskUserDraftAnswers(draftCacheKey)
					clearAskUserV2BrowserNotification({
						topicId,
						notificationKey: resolvedQuestionId || toolId,
					})
					return
				}

				clearAskUserReply(replyStateKey)
				setReplyState(null)
				throw error
			}
			clearAskUserV2BrowserNotification({
				topicId,
				notificationKey: resolvedQuestionId || toolId,
			})
			clearExpiryTip()
		},
		[
			clearExpiryTip,
			toolId,
			draftCacheKey,
			replyStateKey,
			resolvedQuestionId,
			selectedTopic?.chat_conversation_id,
			selectedTopic?.chat_topic_id,
			showClosedTip,
		],
	)

	const handleSubmit = useCallback<(answers: AskUserAnswers, remark: string) => void>(
		async (answers, remark) => {
			if (pendingAction || replyState?.status === "sending") return
			if (isExpiredAtNow()) {
				showExpiryTip()
				return
			}
			try {
				setPendingAction("submit")
				await submitReply(ASK_USER_RESPONSE_STATUS.answered, answers, remark)
				setPendingAction(null)
			} catch (error) {
				console.error(error)
				setPendingAction(null)
				magicToast.error(t("askUser.status.submitFailed"))
			}
		},
		[isExpiredAtNow, pendingAction, replyState?.status, showExpiryTip, submitReply, t],
	)

	const handleSkip = useCallback<(answers: AskUserAnswers) => void>(async () => {
		if (pendingAction || replyState?.status === "sending") return
		if (isExpiredAtNow()) {
			showExpiryTip()
			return
		}
		try {
			setPendingAction("skip")
			await submitReply(ASK_USER_RESPONSE_STATUS.skipped)
			setPendingAction(null)
		} catch (error) {
			console.error(error)
			setPendingAction(null)
			magicToast.error(t("askUser.status.submitFailed"))
		}
	}, [isExpiredAtNow, pendingAction, replyState?.status, showExpiryTip, submitReply, t])

	const { renderTooltip } = useToolTooltip({
		text: tool?.remark,
		placement: "top",
		checkOverflow: true,
	})

	return (
		<>
			<div
				className={cn(
					"h-fit w-fit min-w-[320px] max-w-full flex-none self-start overflow-hidden rounded-md border border-border bg-card p-1.5 text-xs text-card-foreground shadow-none",
					classNames,
				)}
				data-tool={tool?.id}
				data-testid="ask-user-v2-card"
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
			>
				<div className="flex flex-wrap items-center gap-1.5">
					<img
						src={questionIcon}
						alt=""
						className="size-4 shrink-0 overflow-hidden rounded-sm"
						aria-hidden="true"
						data-testid="ask-user-image"
					/>
					<div className="flex min-w-0 flex-1 items-center gap-2 text-xs font-normal leading-4 text-foreground">
						<span className="truncate">{tool?.action}</span>
					</div>
					<div className="ml-auto flex shrink-0 items-center gap-1.5">
						{parsedQuestions.length > 1 && (
							<div
								className="text-xs leading-4 text-muted-foreground"
								data-testid="ask-user-v2-card-count"
							>
								{`${answeredQuestionCount}/${parsedQuestions.length}`}
							</div>
						)}
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							onClick={() => setOpen((value) => !value)}
							disabled={!!isLoading}
							data-testid="ask-user-v2-card-collapse-button"
							aria-label={
								isOpen ? t("askUser.actions.collapse") : t("askUser.actions.expand")
							}
							aria-expanded={isOpen}
							className="h-4 w-4 shrink-0 p-0 text-muted-foreground hover:bg-transparent hover:text-accent-foreground active:bg-transparent"
						>
							{isLoading ? (
								<IconLoader2 size={14} className="animate-spin" aria-hidden />
							) : (
								<ChevronDown
									className={cn(
										"size-4 transition-transform duration-200",
										!isOpen && "rotate-180",
									)}
									aria-hidden
								/>
							)}
						</Button>
					</div>
				</div>
				{errorMessage && isOpen && (
					<p className="p-2 text-sm text-muted-foreground" role="alert">
						{errorMessage}
					</p>
				)}
				{!errorMessage && parsedQuestions.length > 0 && isOpen && (
					<div className="w-full duration-200 animate-in fade-in slide-in-from-top-1">
						<AskUserForm
							questions={parsedQuestions}
							locale={askUserLocale}
							streaming={isStreaming}
							disabled={isFrozen}
							status={askUserStatus}
							draftCacheKey={draftCacheKey}
							expiresAt={expiresAt}
							submittedAnswers={submittedAnswers}
							submittedRemark={submittedRemark}
							onSubmit={handleSubmit}
							onSkip={handleSkip}
							onLocalExpire={showExpiryTip}
							onExpiredInteraction={showExpiryTip}
							onProgressChange={setAnsweredQuestionCount}
						/>
					</div>
				)}
			</div>
			{renderTooltip()}
		</>
	)
}

export default observer(AskUserToolCall)
