import questionIcon from "@/assets/logos/question.svg"
import magicToast from "@/components/base/MagicToaster/utils"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import useShareRoute from "@/pages/superMagic/hooks/useShareRoute"
import { useToolTooltip } from "@/pages/superMagic/components/MessageList/components/Nodes/ToolCall/hooks/useToolTooltip"
import type {
	DefaultToolProps,
	ToolDataLike,
} from "@/pages/superMagic/components/MessageList/components/Nodes/ToolCall/tools/DefaultTool"
import {
	buildAskUserToolReplyDetail,
	resolveAskUserLocaleFromAction,
} from "@/pages/superMagic/components/MessageList/utils/askUser"
import {
	ASK_USER_CARD_STATUS,
	ASK_USER_RESPONSE_STATUS,
	ASK_USER_TOOL,
	type AskUserResponseStatusValue,
} from "@/pages/superMagic/components/MessageList/utils/askUserConstants"
import { sendAskUserToolReply } from "@/pages/superMagic/services/askUserToolReplyService"
import { superMagicStore } from "@/pages/superMagic/stores"
import { IconLoader2 } from "@tabler/icons-react"
import { ChevronDown } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useCallback, useDeferredValue, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { AskUserForm, type AskUserAnswers } from "./AskUserForm"
import { extractQuestionsField, parseQuestionsXml, type ParsedQuestion } from "./parse"

type AskUserDetailQuestion = {
	default_value?: string | readonly string[] | null
}

function normalizeAskUserStatus(status: unknown) {
	if (status === ASK_USER_CARD_STATUS.answered) return ASK_USER_CARD_STATUS.answered
	if (status === ASK_USER_CARD_STATUS.skipped) return ASK_USER_CARD_STATUS.skipped
	if (status === ASK_USER_CARD_STATUS.timeout) return ASK_USER_CARD_STATUS.timeout
	if (status === ASK_USER_CARD_STATUS.cancelled) return ASK_USER_CARD_STATUS.cancelled
	return ASK_USER_CARD_STATUS.pending
}

function mergeDetailQuestionDefaults(
	questions: readonly ParsedQuestion[],
	detailQuestions: unknown,
): readonly ParsedQuestion[] {
	if (!Array.isArray(detailQuestions) || detailQuestions.length === 0) return questions

	let changed = false
	const nextQuestions = questions.map((question, index) => {
		const detailQuestion = detailQuestions[index] as AskUserDetailQuestion | undefined
		if (
			!detailQuestion ||
			question.defaultValue !== undefined ||
			detailQuestion.default_value == null
		) {
			return question
		}

		changed = true
		return {
			...question,
			defaultValue: detailQuestion.default_value,
		}
	})

	return changed ? nextQuestions : questions
}

function AskUserToolCall(props: DefaultToolProps) {
	const { onMouseEnter, onMouseLeave, loading, classNames, selectedTopic } = props

	const { t } = useTranslation("super")
	const { isShareRoute } = useShareRoute()

	const node = superMagicStore.getMessageNode(props?.node?.app_message_id) as
		| { tool?: ToolDataLike }
		| undefined
	const tool = props.toolData || node?.tool
	const detailData = tool?.detail?.data as Record<string, unknown> | undefined

	// 上游 ToolCall.tsx 的 parseToolArguments 遇到不完整 JSON 会降级成 `{ value: text }`，
	// 此时 data.questions 还不存在，所以这里从原始 arguments 字符串中容错提取。
	const rawArguments = detailData?.arguments
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
	const [open, setOpen] = useState(true)

	const parsedQuestions = useMemo(() => {
		const next = parseQuestionsXml(deferredRaw, prevParsedRef.current)
		const resolvedQuestions = mergeDetailQuestionDefaults(next, detailData?.questions)
		prevParsedRef.current = resolvedQuestions
		return resolvedQuestions
	}, [deferredRaw, detailData?.questions])

	const isOpen = !!loading || open
	const toolStatus =
		(typeof detailData?.status === "string" ? detailData.status : "") ||
		(typeof tool?.status === "string" ? tool.status : "")
	const askUserStatus = normalizeAskUserStatus(toolStatus)
	const askUserLocale = resolveAskUserLocaleFromAction(tool?.action)

	const [pendingAction, setPendingAction] = useState<"submit" | "skip" | null>(null)
	const [answeredQuestionCount, setAnsweredQuestionCount] = useState(0)

	const allComplete = parsedQuestions.length > 0 && parsedQuestions.every((q) => q.isComplete)
	const isStreaming = !!loading && !allComplete
	const isFrozen = pendingAction !== null || !loading || props.isShare || isShareRoute
	const toolId = tool?.id
	const detailQuestionId = detailData?.question_id
	const resolvedQuestionId =
		(typeof detailQuestionId === "string" ? detailQuestionId : "") || toolId || ""

	const submitReply = useCallback(
		async (responseStatus: AskUserResponseStatusValue, answers?: AskUserAnswers) => {
			const conversationId = selectedTopic?.chat_conversation_id || ""
			const topicId = selectedTopic?.chat_topic_id || ""
			if (!conversationId || !topicId) throw new Error("missing_topic_context")

			const messages = (topicId ? superMagicStore.messages.get(topicId) : undefined) || []
			const relatedMessage = toolId
				? (messages as Array<Record<string, unknown>>).find((o) => {
						const m = superMagicStore.getMessageNode(o.app_message_id as string)
						const toolCalls = (m as { tool_calls?: Array<{ id?: string }> })?.tool_calls
						return (
							Array.isArray(toolCalls) &&
							toolCalls.some((tc) => (tc as { id?: string })?.id === toolId)
						)
					})
				: undefined
			const relatedMessageNode = superMagicStore.getMessageNode(
				relatedMessage?.app_message_id as string,
			) as { task_id?: unknown } | undefined
			const taskId =
				typeof relatedMessageNode?.task_id === "string" ? relatedMessageNode.task_id : ""

			const isAnswered = responseStatus === ASK_USER_RESPONSE_STATUS.answered
			const detail = buildAskUserToolReplyDetail({
				taskId,
				questionId: resolvedQuestionId,
				responseStatus,
				answer: isAnswered && answers ? JSON.stringify(answers) : "",
			})
			if (!detail || !toolId) throw new Error("missing_ask_user_task_id")
			await sendAskUserToolReply({
				conversationId,
				topicId,
				detail,
				isAnswered,
				toolCallId: toolId,
				toolName: ASK_USER_TOOL.name,
			})
		},
		[
			toolId,
			resolvedQuestionId,
			selectedTopic?.chat_conversation_id,
			selectedTopic?.chat_topic_id,
		],
	)

	const handleSubmit = useCallback<(answers: AskUserAnswers) => void>(
		async (answers) => {
			if (pendingAction) return
			try {
				setPendingAction("submit")
				await submitReply(ASK_USER_RESPONSE_STATUS.answered, answers)
			} catch (error) {
				console.error(error)
				setPendingAction(null)
				magicToast.error(t("askUser.status.submitFailed"))
			}
		},
		[pendingAction, submitReply, t],
	)

	const handleSkip = useCallback<(answers: AskUserAnswers) => void>(async () => {
		if (pendingAction) return
		try {
			setPendingAction("skip")
			await submitReply(ASK_USER_RESPONSE_STATUS.skipped)
		} catch (error) {
			console.error(error)
			setPendingAction(null)
			magicToast.error(t("askUser.status.submitFailed"))
		}
	}, [pendingAction, submitReply, t])

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
							disabled={!!loading}
							data-testid="ask-user-v2-card-collapse-button"
							aria-label={
								isOpen ? t("askUser.actions.collapse") : t("askUser.actions.expand")
							}
							aria-expanded={isOpen}
							className="h-4 w-4 shrink-0 p-0 text-muted-foreground hover:bg-transparent hover:text-accent-foreground active:bg-transparent"
						>
							{loading ? (
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
				{parsedQuestions.length > 0 && isOpen && (
					<div className="w-full duration-200 animate-in fade-in slide-in-from-top-1">
						<AskUserForm
							questions={parsedQuestions}
							locale={askUserLocale}
							streaming={isStreaming}
							disabled={isFrozen}
							status={askUserStatus}
							expiresAt={
								typeof detailData?.expires_at === "number"
									? (detailData.expires_at as number)
									: undefined
							}
							submittedAnswers={
								detailData?.answers &&
								typeof detailData.answers === "object" &&
								!Array.isArray(detailData.answers)
									? (detailData.answers as Record<
											string,
											string | readonly string[]
										>)
									: undefined
							}
							onSubmit={handleSubmit}
							onSkip={handleSkip}
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
