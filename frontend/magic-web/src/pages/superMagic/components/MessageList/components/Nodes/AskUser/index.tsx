import { memo, useMemo, useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { ChevronDown } from "lucide-react"
import questionIcon from "@/assets/logos/question.svg"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import {
	ASK_USER_CARD_STATUS,
	ASK_USER_INTERACTION_TYPE,
} from "@/pages/superMagic/components/MessageList/utils/askUserConstants"
import type { NodeProps } from "../types"
import {
	type AskUserQuestionData,
	formatAskUserAnswerForDisplay,
	getAskUserErrorTextKey,
	resolveAskUserLocaleFromAction,
} from "@/pages/superMagic/components/MessageList/utils/askUser"
import { AnsweredQuestionContent } from "./components/AnsweredQuestionContent"
import { renderAskUserPendingQuestion } from "./components/InteractionQuestionRenderers"
import { useAskUserViewModel } from "./hooks/useAskUserViewModel"
import { superMagicStore } from "@/pages/superMagic/stores"

/** 题目区：卡片内次级背景（随主题 / 深浅色变化） */
const askUserQuestionPanelClass = "mt-1.5 min-w-0 rounded-md border border-border bg-muted p-2.5"

const askUserBreakTextClass = "min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"

/** 细滚动条：沿用主题 muted-foreground */
const askUserScrollAreaClass =
	"[scrollbar-width:thin] [scrollbar-color:rgb(var(--muted-foreground-rgb)_/_0.22)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20"

interface AskUserQuestionListItem {
	index: number
	question: AskUserQuestionData
}

function AskUser(props: NodeProps) {
	const { node } = props
	const { i18n } = useTranslation("super")
	const [isCollapsed, setIsCollapsed] = useState(false)
	const {
		answeredQuestionCount,
		errorState,
		getInputValue,
		getOtherText,
		getSelectedOptions,
		getSelectedValue,
		handleConfirmSelect,
		handleSkip,
		handleSubmit,
		handleToggleOption,
		hasMultipleQuestions,
		isExpiredLocal,
		isValid,
		isQuestionValid,
		pendingAction,
		remainingText,
		resolvedAskUser,
		setInputValue,
		setOtherText,
		setSelectedValue,
		shouldDisableInteraction,
		shouldRender,
	} = useAskUserViewModel({
		node,
		selectedTopic: props.selectedTopic,
	})
	const headerTitle =
		resolvedAskUser.status === ASK_USER_CARD_STATUS.answered
			? "askUser.answersTitle"
			: "askUser.title"
	const messageNode = superMagicStore.getMessageNode(props?.node?.app_message_id) as
		| { tool?: { action?: string } }
		| undefined
	const askUserAction = messageNode?.tool?.action
	const askUserLocale = useMemo(
		() => resolveAskUserLocaleFromAction(askUserAction),
		[askUserAction],
	)
	const askUserT = useMemo(() => i18n.getFixedT(askUserLocale, "super"), [askUserLocale, i18n])

	if (!shouldRender) return null

	function renderQuestionDefaultHint(question: AskUserQuestionData) {
		if (!question.defaultValue || errorState || isExpiredLocal) return null

		return (
			<p
				className="text-xs leading-4 text-muted-foreground"
				data-testid={`ask-user-card-default-value-hint-${question.subId}`}
			>
				<span className={askUserBreakTextClass}>
					{askUserT("askUser.defaultValueHint", {
						defaultValue: formatAskUserAnswerForDisplay(question.defaultValue),
					})}
				</span>
			</p>
		)
	}

	function renderPendingQuestion(question: AskUserQuestionData) {
		return renderAskUserPendingQuestion({
			getInputValue,
			getOtherText,
			getSelectedOptions,
			getSelectedValue,
			handleConfirmSelect,
			handleToggleOption,
			pendingAction,
			question,
			renderQuestionDefaultHint,
			setInputValue,
			setOtherText,
			setSelectedValue,
			shouldDisableInteraction,
			t: askUserT,
		})
	}

	function formatQuestionTitle(question: AskUserQuestionData, index: number) {
		return hasMultipleQuestions ? `${index + 1}. ${question.question}` : question.question
	}

	function getQuestionContentIndentClass(question: AskUserQuestionData) {
		return hasMultipleQuestions &&
			question.interactionType !== ASK_USER_INTERACTION_TYPE.confirm
			? "pl-4"
			: undefined
	}

	function renderPendingContent() {
		return (
			<div
				className="flex max-h-[320px] min-h-0 flex-col gap-1.5"
				data-testid="ask-user-card-pending-layout"
			>
				<div
					className={cn("flex min-h-0 flex-1 flex-col", askUserQuestionPanelClass)}
					data-testid="ask-user-card-question-panel"
				>
					<div
						className={cn(
							"min-h-0 flex-1 space-y-2.5 overflow-y-auto overflow-x-hidden pr-1",
							askUserScrollAreaClass,
						)}
						data-testid="ask-user-card-questions"
					>
						{resolvedAskUser.questions.map((question, index) => (
							<div
								key={question.subId}
								className="space-y-1"
								data-testid={`ask-user-card-question-item-${question.subId}`}
							>
								<p
									className={cn(
										"text-xs font-medium leading-4 text-foreground",
										askUserBreakTextClass,
									)}
									data-testid={`ask-user-card-question-text-${question.subId}`}
								>
									{formatQuestionTitle(question, index)}
								</p>
								<div className={getQuestionContentIndentClass(question)}>
									{renderPendingQuestion(question)}
								</div>
								{!isQuestionValid(question) && pendingAction === "submit" && (
									<p
										className="text-xs leading-4 text-destructive"
										data-testid={`ask-user-card-question-error-${question.subId}`}
									>
										{askUserT("askUser.validation.incomplete")}
									</p>
								)}
							</div>
						))}
					</div>
				</div>
				<div className="shrink-0 pt-0.5" data-testid="ask-user-card-footer">
					<div className="flex flex-wrap items-center justify-between gap-1.5">
						<div className="flex min-w-0 items-center gap-1 text-xs font-medium leading-4 text-muted-foreground">
							<span
								className={cn(
									"min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
								)}
							>
								{askUserT("askUser.status.autoSubmitIn", {
									time: remainingText,
								})}
							</span>
						</div>
						<div className="flex shrink-0 items-center gap-1">
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={shouldDisableInteraction || pendingAction !== null}
								onClick={handleSkip}
								data-testid="ask-user-card-skip-button"
								className="h-6 rounded-md border border-border px-3 text-xs font-medium text-foreground shadow-none"
							>
								{askUserT("askUser.actions.skip")}
							</Button>
							<Button
								type="button"
								size="sm"
								disabled={
									shouldDisableInteraction || !isValid || pendingAction !== null
								}
								onClick={handleSubmit}
								data-testid="ask-user-card-submit-button"
								className="h-6 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-none hover:bg-primary/90"
							>
								{askUserT("askUser.actions.submit")}
							</Button>
						</div>
					</div>
				</div>
			</div>
		)
	}

	function renderAnswerList() {
		if (!resolvedAskUser.answer) return null

		return (
			<div className={cn(askUserQuestionPanelClass)} data-testid="ask-user-card-answer-list">
				<div className="space-y-2.5">
					{resolvedAskUser.questions.map((question, index) => (
						<div
							key={question.subId}
							className="space-y-1"
							data-testid={`ask-user-card-answer-item-${question.subId}`}
						>
							<p
								className={cn(
									"text-xs font-medium leading-4 text-foreground",
									askUserBreakTextClass,
								)}
							>
								{formatQuestionTitle(question, index)}
							</p>
							<div className={getQuestionContentIndentClass(question)}>
								<AnsweredQuestionContent
									question={question}
									answerValue={resolvedAskUser.answer?.[question.subId]}
									t={askUserT}
								/>
							</div>
						</div>
					))}
				</div>
			</div>
		)
	}

	function renderReadonlyQuestionList(
		questionItems: AskUserQuestionListItem[] = resolvedAskUser.questions.map(
			(question, index) => ({
				question,
				index,
			}),
		),
	) {
		if (questionItems.length === 0) return null

		return (
			<div className="space-y-2.5" data-testid="ask-user-card-readonly-question-list">
				{questionItems.map(({ question, index }) => (
					<p
						key={question.subId}
						className={cn(
							"text-xs font-medium leading-4 text-foreground",
							askUserBreakTextClass,
						)}
						data-testid={`ask-user-card-readonly-question-${question.subId}`}
					>
						{formatQuestionTitle(question, index)}
					</p>
				))}
			</div>
		)
	}

	function renderStatusContent() {
		if (errorState) {
			if (errorState.reason === "already_processed") {
				return (
					<div
						className={cn(askUserQuestionPanelClass, "space-y-3")}
						data-testid="ask-user-card-obsolete-panel"
					>
						<p
							className={cn(
								"text-xs leading-4 text-muted-foreground",
								askUserBreakTextClass,
							)}
							data-testid="ask-user-card-obsolete-text"
						>
							{askUserT("askUser.status.alreadyProcessed")}
						</p>
						{renderReadonlyQuestionList()}
					</div>
				)
			}

			return (
				<div
					className={cn(askUserQuestionPanelClass)}
					data-testid="ask-user-card-error-panel"
				>
					<p
						className={cn("text-xs leading-4 text-destructive", askUserBreakTextClass)}
						data-testid="ask-user-card-error-text"
					>
						{errorState.message || askUserT(getAskUserErrorTextKey(errorState.reason))}
					</p>
				</div>
			)
		}

		// 工具回执消息会被列表层过滤，不刷新时用本地 pendingAction 兜底展示“已跳过”状态
		if (pendingAction === "skip") {
			return (
				<div
					className={cn(askUserQuestionPanelClass, "space-y-3")}
					data-testid="ask-user-card-skipped-panel"
				>
					<p
						className={cn(
							"text-xs leading-4 text-muted-foreground",
							askUserBreakTextClass,
						)}
						data-testid="ask-user-card-skipped-text"
					>
						{askUserT("askUser.status.skipped")}
					</p>
					{renderReadonlyQuestionList()}
				</div>
			)
		}

		if (resolvedAskUser.status === ASK_USER_CARD_STATUS.answered) {
			return <div data-testid="ask-user-card-answered-content">{renderAnswerList()}</div>
		}

		if (resolvedAskUser.status === ASK_USER_CARD_STATUS.skipped) {
			return (
				<div
					className={cn(askUserQuestionPanelClass, "space-y-3")}
					data-testid="ask-user-card-skipped-panel"
				>
					<p
						className={cn(
							"text-xs leading-4 text-muted-foreground",
							askUserBreakTextClass,
						)}
						data-testid="ask-user-card-skipped-text"
					>
						{askUserT("askUser.status.skipped")}
					</p>
					{renderReadonlyQuestionList()}
				</div>
			)
		}

		if (resolvedAskUser.status === ASK_USER_CARD_STATUS.timeout) {
			const questionsWithIndex = resolvedAskUser.questions.map((question, index) => ({
				question,
				index,
			}))
			const questionsWithoutDefault = questionsWithIndex.filter(
				({ question }) => !question.defaultValue,
			)
			const questionsWithDefault = questionsWithIndex.filter(
				({ question }) => question.defaultValue,
			)

			return (
				<div
					className={cn(askUserQuestionPanelClass, "space-y-3")}
					data-testid="ask-user-card-timeout-content"
				>
					<p
						className={cn(
							"text-xs font-medium leading-4 text-muted-foreground",
							askUserBreakTextClass,
						)}
						data-testid="ask-user-card-timeout-text"
					>
						{askUserT("askUser.status.timeout")}
					</p>
					{renderReadonlyQuestionList(questionsWithoutDefault)}
					<div className="space-y-2">
						{questionsWithDefault.map(({ question }) => (
							<p
								key={question.subId}
								className={cn(
									"rounded-lg border border-border bg-background px-3 py-2 text-xs leading-4 text-muted-foreground",
									askUserBreakTextClass,
								)}
								data-testid={`ask-user-card-timeout-default-${question.subId}`}
							>
								{askUserT("askUser.status.timeoutWithDefaultItem", {
									question: question.question,
									defaultValue: formatAskUserAnswerForDisplay(
										question.defaultValue,
									),
								})}
							</p>
						))}
					</div>
				</div>
			)
		}

		if (resolvedAskUser.status === ASK_USER_CARD_STATUS.cancelled) {
			return (
				<div
					className={cn(askUserQuestionPanelClass, "space-y-3")}
					data-testid="ask-user-card-cancelled-panel"
				>
					<p
						className={cn(
							"text-xs leading-4 text-muted-foreground",
							askUserBreakTextClass,
						)}
						data-testid="ask-user-card-cancelled-text"
					>
						{askUserT("askUser.status.cancelled")}
					</p>
					{renderReadonlyQuestionList()}
				</div>
			)
		}

		if (isExpiredLocal) {
			return (
				<div
					className={cn(askUserQuestionPanelClass, "space-y-3")}
					data-testid="ask-user-card-expired-pending-panel"
				>
					<p
						className={cn(
							"text-xs leading-4 text-muted-foreground",
							askUserBreakTextClass,
						)}
						data-testid="ask-user-card-expired-pending-text"
					>
						{askUserT("askUser.status.timeout")}
					</p>
					{renderReadonlyQuestionList()}
				</div>
			)
		}

		return renderPendingContent()
	}

	return (
		<div
			className="h-fit w-fit min-w-[320px] max-w-full flex-none self-start overflow-hidden rounded-md border border-border bg-card p-1.5 text-xs text-card-foreground shadow-none"
			data-testid="ask-user-card"
		>
			<div className="flex flex-wrap items-center gap-1.5">
				<img
					src={questionIcon}
					alt=""
					className="size-4 shrink-0 overflow-hidden rounded-sm"
					aria-hidden="true"
				/>
				<div className="flex min-w-0 flex-1 items-center gap-2 text-xs font-normal leading-4 text-foreground">
					<span className="truncate">{askUserT(headerTitle)}</span>
				</div>
				<div className="ml-auto flex shrink-0 items-center gap-1.5">
					{hasMultipleQuestions && (
						<div
							className="text-xs leading-4 text-muted-foreground"
							data-testid="ask-user-card-countdown"
						>
							{`${answeredQuestionCount}/${resolvedAskUser.questions.length}`}
						</div>
					)}
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						onClick={() => setIsCollapsed((value) => !value)}
						data-testid="ask-user-card-collapse-button"
						aria-label={
							isCollapsed
								? askUserT("askUser.actions.expand")
								: askUserT("askUser.actions.collapse")
						}
						aria-expanded={!isCollapsed}
						className="h-4 w-4 shrink-0 p-0 text-muted-foreground hover:bg-transparent hover:text-accent-foreground active:bg-transparent"
					>
						<ChevronDown
							className={cn(
								"size-4 transition-transform duration-200",
								isCollapsed && "rotate-180",
							)}
							aria-hidden
						/>
					</Button>
				</div>
			</div>
			{!isCollapsed && renderStatusContent()}
		</div>
	)
}

export default memo(observer(AskUser))
