import {
	createContext,
	memo,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ChangeEvent,
	type MouseEvent,
} from "react"
import { RadioGroup, RadioGroupItem } from "@/components/shadcn-ui/radio-group"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { Button } from "@/components/shadcn-ui/button"
import { Textarea } from "@/components/shadcn-ui/textarea"
import { cn } from "@/lib/utils"
import {
	ASK_USER_CONFIRM_VALUE,
	type AskUserConfirmValue,
} from "@/pages/superMagic/components/MessageList/utils/askUserConstants"
import type { AskUserLocale } from "@/pages/superMagic/components/MessageList/utils/askUser"
import type { ParsedQuestion } from "./parse"
import {
	getAskUserAutoSubmitInText,
	getAskUserConfirmActionText,
	getAskUserDefaultValueHintText,
	getAskUserInputPlaceholder,
	getAskUserMultiSelectRangeText,
	ASK_USER_OTHER_SENTINEL,
	AskUserOtherInput,
	getAskUserOtherPlaceholder,
	getAskUserRenderableOptions,
	getAskUserRejectActionText,
	getAskUserSkipActionText,
	getAskUserSubmitActionText,
	getAskUserUnlimitedText,
	mapMultiSelectAnswer,
	resolveMultiSelectDisplayState,
	resolveSelectDisplayState,
} from "./otherOption"

type AnswerValue = string | readonly string[]
export type AskUserAnswers = Readonly<Record<string, AnswerValue>>
type AskUserFormStatus = "pending" | "answered" | "skipped" | "timeout" | "cancelled" | string

interface AskUserFormProps {
	questions: readonly ParsedQuestion[]
	locale: AskUserLocale
	/** LLM arguments 仍在流式输入：未完成题只读，按钮不可用 */
	streaming?: boolean
	/** 表单整体冻结（本地已提交 / 工具响应已到）：所有字段只读、按钮不可用 */
	disabled?: boolean
	/** 到期时间戳（秒），不存在则不显示倒计时 */
	expiresAt?: number
	/** 已提交的答案（来自 toolResponseMap，用于回显） */
	submittedAnswers?: Readonly<Record<string, AnswerValue>>
	status?: AskUserFormStatus
	onSubmit?: (answers: AskUserAnswers) => void
	onSkip?: (answers: AskUserAnswers) => void
	onProgressChange?: (count: number) => void
	className?: string
}

const EMPTY_ARRAY: readonly string[] = Object.freeze([])
const askUserQuestionPanelClass = "mt-1.5 min-w-0 rounded-md border border-border bg-muted p-2.5"
const askUserBreakTextClass = "min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
const askUserScrollAreaClass =
	"[scrollbar-width:thin] [scrollbar-color:rgb(var(--muted-foreground-rgb)_/_0.22)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20"
const askUserOptionControlBase =
	"size-4 shrink-0 border border-input bg-background shadow-xs focus-visible:ring-1 focus-visible:ring-ring/50"
const askUserOptionRowClass = "flex min-h-6 cursor-pointer items-start gap-2 py-0.5"

function formatAnswerForDisplay(value?: AnswerValue | null) {
	if (Array.isArray(value)) return value.join("、")
	return value || ""
}

function shouldIgnoreOptionRowClick(event: MouseEvent<HTMLElement>) {
	const target = event.target
	return target instanceof HTMLElement && Boolean(target.closest("button,input,textarea"))
}

function formatQuestionTitle(question: ParsedQuestion, index: number, total: number) {
	if (total <= 1) return question.label
	if (/^\s*\d+[.\u3001)\uff09]\s*/.test(question.label)) return question.label
	return `${index + 1}. ${question.label}`
}

function normalizeDefaultAnswer(question: ParsedQuestion): AnswerValue | null {
	const defaultValue = question.defaultValue
	if (defaultValue === undefined || defaultValue === null) return null
	if (question.type === "multi_select") {
		if (Array.isArray(defaultValue)) return defaultValue
		return defaultValue
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean)
	}
	if (Array.isArray(defaultValue)) return defaultValue[0] || ""
	return defaultValue
}

function buildDefaultAnswers(questions: readonly ParsedQuestion[]) {
	const answers: Record<string, AnswerValue> = {}
	for (const question of questions) {
		const defaultValue = normalizeDefaultAnswer(question)
		if (defaultValue === null) return { isComplete: false, answers }
		if (Array.isArray(defaultValue) && defaultValue.length === 0) {
			return { isComplete: false, answers }
		}
		if (typeof defaultValue === "string" && !defaultValue.trim()) {
			return { isComplete: false, answers }
		}
		answers[question.id] = defaultValue
	}
	return { isComplete: questions.length > 0, answers }
}

function isAnsweredQuestionValueValid(question: ParsedQuestion, answer: AnswerValue | undefined) {
	if (question.type === "multi_select") {
		const values = parseMultiSelectAnswer(answer)
			.map((item) => item.trim())
			.filter(Boolean)
		if (values.length === 0) return false
		const min = question.min ?? 1
		if (values.length < min) return false
		if (typeof question.max === "number" && values.length > question.max) return false
		return true
	}

	if (typeof answer === "string") return answer.trim().length > 0
	if (Array.isArray(answer)) return (answer[0] || "").trim().length > 0
	return false
}

function getAnsweredQuestionCount(
	questions: readonly ParsedQuestion[],
	answers?: Readonly<Record<string, AnswerValue>>,
) {
	if (!answers) return 0
	return questions.filter((question) =>
		isAnsweredQuestionValueValid(question, answers[question.id]),
	).length
}

function useCountdown(expiresAt: number | undefined, onExpire?: () => void) {
	const [remaining, setRemaining] = useState<number>(() => {
		if (!expiresAt) return -1
		return Math.max(0, Math.ceil(expiresAt - Date.now() / 1000))
	})
	const onExpireRef = useRef(onExpire)
	onExpireRef.current = onExpire

	useEffect(() => {
		if (!expiresAt) {
			setRemaining(-1)
			return
		}
		const calc = () => Math.max(0, Math.ceil(expiresAt - Date.now() / 1000))
		setRemaining(calc())

		const timer = setInterval(() => {
			const next = calc()
			setRemaining(next)
			if (next <= 0) {
				clearInterval(timer)
				onExpireRef.current?.()
			}
		}, 1000)

		return () => clearInterval(timer)
	}, [expiresAt])

	return remaining
}

function formatCountdown(seconds: number): string {
	const totalSeconds = Math.max(seconds, 0)
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const secondsPart = totalSeconds % 60
	return [hours, minutes, secondsPart].map((value) => value.toString().padStart(2, "0")).join(":")
}

/**
 * 只透出"写入 answer"能力，子组件按键时不会让父 render。
 * Provider value 在组件生命周期内引用稳定，不会造成 Provider 级重渲染。
 */
interface AnswersContextValue {
	writeAnswer: (id: string, value: AnswerValue) => void
}

const AnswersContext = createContext<AnswersContextValue | null>(null)

function useWriteAnswer() {
	const ctx = useContext(AnswersContext)
	if (!ctx) {
		throw new Error("useWriteAnswer must be used within <AnswersContext.Provider>")
	}
	return ctx.writeAnswer
}

function AskUserFormImpl({
	questions,
	locale,
	streaming,
	disabled,
	expiresAt,
	submittedAnswers,
	status = "pending",
	onSubmit,
	onSkip,
	onProgressChange,
	className,
}: AskUserFormProps) {
	// answersRef 是 submit 时的唯一真源；按键路径只写不读，避免触发父 render
	const answersRef = useRef<Record<string, AnswerValue>>({})

	const writeAnswer = useCallback(
		(id: string, value: AnswerValue) => {
			answersRef.current[id] = value
			onProgressChange?.(getAnsweredQuestionCount(questions, answersRef.current))
		},
		[onProgressChange, questions],
	)

	const ctxValue = useMemo<AnswersContextValue>(() => ({ writeAnswer }), [writeAnswer])

	const hasPending = useMemo(() => questions.some((q) => !q.isComplete), [questions])
	const isTimeout = status === "timeout"
	const isTerminal = ["answered", "skipped", "timeout", "cancelled"].includes(status)
	const actionsDisabled =
		Boolean(streaming) ||
		Boolean(disabled) ||
		hasPending ||
		questions.length === 0 ||
		isTerminal
	const defaultAnswers = useMemo(() => buildDefaultAnswers(questions), [questions])
	const displayAnswers = submittedAnswers || (isTimeout ? defaultAnswers.answers : undefined)

	const handleSubmit = useCallback(
		(answers?: AskUserAnswers) => {
			onSubmit?.((answers ? { ...answers } : { ...answersRef.current }) as AskUserAnswers)
		},
		[onSubmit],
	)

	const handleSkip = useCallback(() => {
		onSkip?.({ ...answersRef.current } as AskUserAnswers)
	}, [onSkip])

	const expiredRef = useRef(false)
	const onCountdownExpire = useCallback(() => {
		if (expiredRef.current) return
		expiredRef.current = true
		if (defaultAnswers.isComplete) {
			handleSubmit(defaultAnswers.answers)
			return
		}
		onSkip?.({ ...answersRef.current } as AskUserAnswers)
	}, [defaultAnswers.answers, defaultAnswers.isComplete, handleSubmit, onSkip])

	const remaining = useCountdown(
		!disabled && !streaming && !isTerminal ? expiresAt : undefined,
		onCountdownExpire,
	)
	const showCountdown = typeof expiresAt === "number" && remaining > 0 && !disabled && !isTerminal
	const shouldShowActions = !submittedAnswers && !isTerminal

	useEffect(() => {
		onProgressChange?.(
			getAnsweredQuestionCount(questions, submittedAnswers || answersRef.current),
		)
	}, [onProgressChange, questions, submittedAnswers])

	return (
		<AnswersContext.Provider value={ctxValue}>
			<div
				className={cn("flex max-h-[320px] min-h-0 w-full flex-col gap-1.5", className)}
				data-testid="ask-user-v2-card-form"
			>
				<div
					className={cn("flex min-h-0 flex-1 flex-col", askUserQuestionPanelClass)}
					data-testid="ask-user-v2-card-question-panel"
				>
					<div
						className={cn(
							"-mr-1.5 min-h-0 flex-1 space-y-2.5 overflow-y-auto overflow-x-hidden pr-3",
							askUserScrollAreaClass,
						)}
						data-testid="ask-user-v2-card-questions"
					>
						{questions.map((question, index) => (
							<QuestionItem
								key={question.id}
								index={index}
								locale={locale}
								total={questions.length}
								question={question}
								disabled={
									Boolean(disabled) || (!!streaming && !question.isComplete)
								}
								submittedAnswer={displayAnswers?.[question.id]}
								showDefaultHint={!displayAnswers && !disabled && !isTimeout}
							/>
						))}
					</div>
				</div>
				{shouldShowActions && (
					<div className="shrink-0 pt-0.5" data-testid="ask-user-v2-card-footer">
						<div className="flex flex-wrap items-center justify-between gap-1.5">
							{showCountdown ? (
								<div className="flex min-w-0 items-center gap-1 text-xs font-medium leading-4 text-muted-foreground">
									<span
										className={cn(
											"min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
										)}
									>
										{getAskUserAutoSubmitInText({
											locale,
											time: formatCountdown(remaining),
										})}
									</span>
								</div>
							) : (
								<div />
							)}
							<div className="flex shrink-0 items-center gap-1">
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={actionsDisabled}
									onClick={handleSkip}
									data-testid="ask-user-v2-card-skip-button"
									className="h-6 rounded-md border border-border px-3 text-xs font-medium text-foreground shadow-none"
								>
									{getAskUserSkipActionText(locale)}
								</Button>
								<Button
									type="button"
									size="sm"
									disabled={actionsDisabled}
									onClick={() => handleSubmit()}
									data-testid="ask-user-v2-card-submit-button"
									className="h-6 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-none hover:bg-primary/90"
								>
									{getAskUserSubmitActionText(locale)}
								</Button>
							</div>
						</div>
					</div>
				)}
			</div>
		</AnswersContext.Provider>
	)
}

interface QuestionItemProps {
	index: number
	locale: AskUserLocale
	total: number
	question: ParsedQuestion
	disabled: boolean
	submittedAnswer?: AnswerValue
	showDefaultHint: boolean
}

const QuestionItem = memo(function QuestionItem({
	index,
	locale,
	total,
	question,
	disabled,
	submittedAnswer,
	showDefaultHint,
}: QuestionItemProps) {
	const hasMultipleQuestions = total > 1
	const questionContentIndentClass =
		hasMultipleQuestions && question.type === "input" ? "pl-4" : undefined

	return (
		<div
			className={cn("space-y-1 transition-opacity", !question.isComplete && "opacity-70")}
			data-testid={`ask-user-v2-card-question-item-${question.id}`}
		>
			<p
				className={cn(
					"text-xs font-medium leading-4 text-foreground",
					askUserBreakTextClass,
				)}
				data-testid={`ask-user-v2-card-question-text-${question.id}`}
			>
				{question.label ? (
					formatQuestionTitle(question, index, total)
				) : (
					<span className="text-muted-foreground">...</span>
				)}
			</p>

			<div className={questionContentIndentClass}>
				{question.type === "confirm" && (
					<ConfirmField
						locale={locale}
						questionId={question.id}
						disabled={disabled}
						submittedAnswer={submittedAnswer}
					/>
				)}

				{question.type === "input" && (
					<InputField
						questionId={question.id}
						placeholder={question.placeholder ?? getAskUserInputPlaceholder(locale)}
						disabled={disabled}
						submittedAnswer={submittedAnswer}
					/>
				)}

				{question.type === "select" && (
					<SelectField
						questionId={question.id}
						options={question.options}
						otherPlaceholder={getAskUserOtherPlaceholder(locale)}
						disabled={disabled}
						submittedAnswer={submittedAnswer}
					/>
				)}

				{question.type === "multi_select" && (
					<MultiSelectField
						questionId={question.id}
						locale={locale}
						options={question.options}
						otherPlaceholder={getAskUserOtherPlaceholder(locale)}
						min={question.min}
						max={question.max}
						disabled={disabled}
						submittedAnswer={submittedAnswer}
					/>
				)}
			</div>
			{showDefaultHint && question.defaultValue !== undefined && (
				<p
					className="text-xs leading-4 text-muted-foreground"
					data-testid={`ask-user-v2-card-default-value-hint-${question.id}`}
				>
					<span className={askUserBreakTextClass}>
						{getAskUserDefaultValueHintText({
							locale,
							defaultValue: formatAnswerForDisplay(question.defaultValue),
						})}
					</span>
				</p>
			)}
		</div>
	)
})

interface ConfirmFieldProps {
	locale: AskUserLocale
	questionId: string
	disabled: boolean
	submittedAnswer?: AnswerValue
}

const ConfirmField = memo(function ConfirmField({
	locale,
	questionId,
	disabled,
	submittedAnswer,
}: ConfirmFieldProps) {
	const writeAnswer = useWriteAnswer()
	const [value, setValue] = useState("")

	const displayValue = typeof submittedAnswer === "string" ? submittedAnswer : value

	const handleSelect = useCallback(
		(next: AskUserConfirmValue) => {
			setValue(next)
			writeAnswer(questionId, next)
		},
		[questionId, writeAnswer],
	)

	return (
		<div className="flex w-full justify-start">
			<div className="flex flex-wrap gap-3">
				<Button
					type="button"
					variant={displayValue === ASK_USER_CONFIRM_VALUE.yes ? "default" : "outline"}
					size="sm"
					disabled={disabled}
					onClick={() => handleSelect(ASK_USER_CONFIRM_VALUE.yes)}
					data-testid={`ask-user-v2-card-confirm-yes-button-${questionId}`}
					className={cn(
						"h-6 rounded-full border border-border px-3 text-xs font-normal text-foreground shadow-none transition-colors hover:bg-accent hover:text-accent-foreground",
						displayValue === ASK_USER_CONFIRM_VALUE.yes &&
							"border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground disabled:border-primary disabled:bg-primary disabled:text-primary-foreground disabled:opacity-100",
					)}
				>
					{getAskUserConfirmActionText(locale)}
				</Button>
				<Button
					type="button"
					variant={displayValue === ASK_USER_CONFIRM_VALUE.no ? "default" : "outline"}
					size="sm"
					disabled={disabled}
					onClick={() => handleSelect(ASK_USER_CONFIRM_VALUE.no)}
					data-testid={`ask-user-v2-card-confirm-no-button-${questionId}`}
					className={cn(
						"h-6 rounded-full border border-border px-3 text-xs font-normal text-foreground shadow-none transition-colors hover:bg-accent hover:text-accent-foreground",
						displayValue === ASK_USER_CONFIRM_VALUE.no &&
							"border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground disabled:border-primary disabled:bg-primary disabled:text-primary-foreground disabled:opacity-100",
					)}
				>
					{getAskUserRejectActionText(locale)}
				</Button>
			</div>
		</div>
	)
})

interface InputFieldProps {
	questionId: string
	placeholder?: string
	disabled: boolean
	submittedAnswer?: AnswerValue
}

const InputField = memo(function InputField({
	questionId,
	placeholder,
	disabled,
	submittedAnswer,
}: InputFieldProps) {
	const writeAnswer = useWriteAnswer()
	const [value, setValue] = useState("")

	const displayValue = typeof submittedAnswer === "string" ? submittedAnswer : value

	const handleChange = useCallback(
		(e: ChangeEvent<HTMLTextAreaElement>) => {
			const next = e.target.value
			setValue(next)
			writeAnswer(questionId, next)
		},
		[questionId, writeAnswer],
	)

	return (
		<Textarea
			value={displayValue}
			placeholder={placeholder}
			disabled={disabled}
			onChange={handleChange}
			data-testid={`ask-user-v2-card-input-${questionId}`}
			className="h-16 min-h-16 min-w-0 resize-none overflow-y-auto rounded-md border border-border bg-background px-2 py-1 text-left text-[13px] font-normal leading-4 text-foreground shadow-none [scrollbar-width:none] placeholder:text-[13px] placeholder:text-muted-foreground focus-visible:border-border focus-visible:!ring-0 md:text-[13px] [&::-webkit-scrollbar]:hidden"
		/>
	)
})

interface SelectFieldProps {
	questionId: string
	options: readonly string[]
	otherPlaceholder: string
	disabled: boolean
	submittedAnswer?: AnswerValue
}

const SelectField = memo(function SelectField({
	questionId,
	options,
	otherPlaceholder,
	disabled,
	submittedAnswer,
}: SelectFieldProps) {
	const writeAnswer = useWriteAnswer()
	const [value, setValue] = useState("")
	const [otherText, setOtherText] = useState("")

	const renderableOptions = useMemo(() => getAskUserRenderableOptions(options), [options])
	const submittedState = useMemo(
		() => resolveSelectDisplayState(options, submittedAnswer),
		[options, submittedAnswer],
	)

	const displayValue = submittedAnswer !== undefined ? submittedState.selectedValue : value
	const displayOtherText = submittedAnswer !== undefined ? submittedState.otherText : otherText

	const handleChange = useCallback(
		(next: string) => {
			setValue(next)
			writeAnswer(questionId, next === ASK_USER_OTHER_SENTINEL ? otherText : next)
		},
		[otherText, questionId, writeAnswer],
	)

	const handleOtherTextChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			const next = e.target.value
			setOtherText(next)
			writeAnswer(questionId, next)
		},
		[questionId, writeAnswer],
	)

	return (
		<RadioGroup
			value={displayValue}
			onValueChange={handleChange}
			disabled={disabled}
			className="gap-0.5"
			data-testid={`ask-user-v2-card-select-group-${questionId}`}
		>
			{renderableOptions.map((opt, idx) => {
				const optionId = `${questionId}-opt-${idx}`
				const isOther = opt === ASK_USER_OTHER_SENTINEL
				return (
					<div
						key={optionId}
						className={askUserOptionRowClass}
						onClick={(event) => {
							if (disabled || shouldIgnoreOptionRowClick(event)) return
							handleChange(opt)
						}}
						data-testid={`ask-user-v2-card-select-option-${questionId}`}
					>
						<RadioGroupItem
							id={optionId}
							value={opt}
							disabled={disabled}
							className={cn(
								askUserOptionControlBase,
								"rounded-full text-foreground [&_svg]:fill-primary",
							)}
						/>
						{isOther ? (
							<AskUserOtherInput
								testIdPrefix="select"
								placeholder={otherPlaceholder}
								value={displayOtherText}
								onChange={handleOtherTextChange}
								onFocus={() => {
									if (displayValue !== ASK_USER_OTHER_SENTINEL) {
										setValue(ASK_USER_OTHER_SENTINEL)
									}
									writeAnswer(questionId, displayOtherText)
								}}
								disabled={disabled}
								questionId={questionId}
							/>
						) : (
							<span
								className={cn(
									"text-xs font-normal leading-4 text-foreground",
									askUserBreakTextClass,
								)}
							>
								{opt}
							</span>
						)}
					</div>
				)
			})}
		</RadioGroup>
	)
})

interface MultiSelectFieldProps {
	questionId: string
	locale: AskUserLocale
	options: readonly string[]
	otherPlaceholder: string
	min?: number
	max?: number
	disabled: boolean
	submittedAnswer?: AnswerValue
}

function parseMultiSelectAnswer(answer: AnswerValue | undefined): readonly string[] {
	if (!answer) return EMPTY_ARRAY
	if (Array.isArray(answer)) return answer.filter(Boolean)
	try {
		const parsed = JSON.parse(answer)
		if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string")
	} catch {
		/* not JSON array, treat as single value */
	}
	return [answer]
}

const MultiSelectField = memo(function MultiSelectField({
	questionId,
	locale,
	options,
	otherPlaceholder,
	min,
	max,
	disabled,
	submittedAnswer,
}: MultiSelectFieldProps) {
	const writeAnswer = useWriteAnswer()
	const [value, setValue] = useState<readonly string[]>(EMPTY_ARRAY)
	const [otherText, setOtherText] = useState("")

	const renderableOptions = useMemo(() => getAskUserRenderableOptions(options), [options])
	const submittedValues = useMemo(
		() => parseMultiSelectAnswer(submittedAnswer),
		[submittedAnswer],
	)
	const submittedState = useMemo(
		() => resolveMultiSelectDisplayState(options, submittedValues),
		[options, submittedValues],
	)
	const displayValue = submittedAnswer !== undefined ? submittedState.selectedValues : value
	const displayOtherText = submittedAnswer !== undefined ? submittedState.otherText : otherText

	const valueRef = useRef<readonly string[]>(EMPTY_ARRAY)
	valueRef.current = value

	const toggle = useCallback(
		(option: string, checked: boolean) => {
			const current = valueRef.current
			let next: readonly string[]
			if (checked) {
				if (current.includes(option)) return
				next = [...current, option]
			} else {
				if (!current.includes(option)) return
				next = current.filter((x) => x !== option)
			}
			setValue(next)
			writeAnswer(questionId, mapMultiSelectAnswer(next, otherText))
		},
		[otherText, questionId, writeAnswer],
	)

	const handleOtherTextChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			const next = e.target.value
			setOtherText(next)
			writeAnswer(questionId, mapMultiSelectAnswer(valueRef.current, next))
		},
		[questionId, writeAnswer],
	)

	return (
		<div className="space-y-2">
			<div
				className="space-y-0.5"
				data-testid={`ask-user-v2-card-multi-select-group-${questionId}`}
			>
				{renderableOptions.map((opt, idx) => {
					const optionId = `${questionId}-opt-${idx}`
					const checked = displayValue.includes(opt)
					const isOther = opt === ASK_USER_OTHER_SENTINEL
					return (
						<div
							key={optionId}
							className={askUserOptionRowClass}
							onClick={(event) => {
								if (disabled || shouldIgnoreOptionRowClick(event)) return
								toggle(opt, !checked)
							}}
							data-testid={`ask-user-v2-card-multi-select-option-${questionId}`}
						>
							<Checkbox
								id={optionId}
								checked={checked}
								disabled={disabled}
								onCheckedChange={(next) => toggle(opt, next === true)}
								className={cn(
									askUserOptionControlBase,
									"rounded-[4px] data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
								)}
							/>
							{isOther ? (
								<AskUserOtherInput
									testIdPrefix="multi-select"
									placeholder={otherPlaceholder}
									value={displayOtherText}
									onChange={handleOtherTextChange}
									onFocus={() => {
										if (!displayValue.includes(ASK_USER_OTHER_SENTINEL)) {
											toggle(ASK_USER_OTHER_SENTINEL, true)
										}
									}}
									disabled={disabled}
									questionId={questionId}
								/>
							) : (
								<span
									className={cn(
										"text-xs font-normal leading-4 text-foreground",
										askUserBreakTextClass,
									)}
								>
									{opt}
								</span>
							)}
						</div>
					)
				})}
			</div>
			{(min !== undefined || max !== undefined) && (
				<p
					className="text-xs leading-4 text-muted-foreground"
					data-testid={`ask-user-v2-card-multi-select-hint-${questionId}`}
				>
					{getAskUserMultiSelectRangeText({
						locale,
						min: min ?? 1,
						max: typeof max === "number" ? max : getAskUserUnlimitedText(locale),
					})}
				</p>
			)}
		</div>
	)
})

export const AskUserForm = memo(AskUserFormImpl)
