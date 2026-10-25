import { useLayoutEffect, useRef, type ChangeEvent } from "react"
import enUSSuper from "@/assets/locales/en_US/super.json"
import zhCNSuper from "@/assets/locales/zh_CN/super.json"
import type { AskUserLocale } from "@/pages/superMagic/components/MessageList/utils/askUser"
type AnswerValue = string | readonly string[]

export const ASK_USER_OTHER_SENTINEL = "__ask_user_other__"
const ASK_USER_OTHER_INPUT_MAX_HEIGHT = 200
const askUserOtherInputScrollAreaClass =
	"[scrollbar-width:thin] [scrollbar-color:rgb(var(--muted-foreground-rgb)_/_0.22)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20"

export const askUserOtherInputClass = `h-auto !min-h-7 max-h-[200px] min-w-0 flex-1 resize-none overflow-hidden rounded-md border border-border bg-background px-2.5 py-1 text-left text-sm font-normal leading-5 text-foreground shadow-none outline-none placeholder:text-sm placeholder:text-muted-foreground focus-visible:border-border focus-visible:!ring-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm ${askUserOtherInputScrollAreaClass}`

export function getAskUserRenderableOptions(options: readonly string[]) {
	return [...options, ASK_USER_OTHER_SENTINEL]
}

export function resolveSelectDisplayState(
	options: readonly string[],
	answer: AnswerValue | undefined,
) {
	if (typeof answer !== "string") {
		return {
			selectedValue: "",
			otherText: "",
		}
	}

	if (options.includes(answer)) {
		return {
			selectedValue: answer,
			otherText: "",
		}
	}

	return {
		selectedValue: answer ? ASK_USER_OTHER_SENTINEL : "",
		otherText: answer || "",
	}
}

export function resolveMultiSelectDisplayState(
	options: readonly string[],
	answerValues: readonly string[],
) {
	if (answerValues.length === 0) {
		return {
			selectedValues: [] as readonly string[],
			otherText: "",
		}
	}

	const selectedValues: string[] = []
	let otherText = ""

	for (const value of answerValues) {
		if (options.includes(value)) {
			selectedValues.push(value)
			continue
		}
		if (!selectedValues.includes(ASK_USER_OTHER_SENTINEL)) {
			selectedValues.push(ASK_USER_OTHER_SENTINEL)
		}
		if (!otherText && value) {
			otherText = value
		}
	}

	return {
		selectedValues,
		otherText,
	}
}

export function mapMultiSelectAnswer(
	selectedValues: readonly string[],
	otherText: string,
): readonly string[] {
	return selectedValues.map((value) => (value === ASK_USER_OTHER_SENTINEL ? otherText : value))
}

export function getAskUserOtherPlaceholder(locale: AskUserLocale) {
	return locale === "zh_CN"
		? zhCNSuper.askUser.otherPlaceholder
		: enUSSuper.askUser.otherPlaceholder
}

export function getAskUserMultiSelectRangeText({
	locale,
	max,
	min,
}: {
	locale: AskUserLocale
	max: number | string
	min: number
}) {
	const template =
		locale === "zh_CN"
			? zhCNSuper.askUser.validation.multiSelectRange
			: enUSSuper.askUser.validation.multiSelectRange

	return template.replace("{{min}}", String(min)).replace("{{max}}", String(max))
}

export function getAskUserRequiredValidationText(locale: AskUserLocale) {
	return locale === "zh_CN"
		? zhCNSuper.askUser.validation.required
		: enUSSuper.askUser.validation.required
}

export function getAskUserUnlimitedText(locale: AskUserLocale) {
	return locale === "zh_CN"
		? zhCNSuper.askUser.validation.unlimited
		: enUSSuper.askUser.validation.unlimited
}

export function getAskUserConfirmActionText(locale: AskUserLocale) {
	return locale === "zh_CN"
		? zhCNSuper.askUser.actions.confirm
		: enUSSuper.askUser.actions.confirm
}

export function getAskUserRejectActionText(locale: AskUserLocale) {
	return locale === "zh_CN" ? zhCNSuper.askUser.actions.reject : enUSSuper.askUser.actions.reject
}

export function getAskUserSkipActionText(locale: AskUserLocale) {
	return locale === "zh_CN" ? zhCNSuper.askUser.actions.skip : enUSSuper.askUser.actions.skip
}

export function getAskUserSubmitActionText(locale: AskUserLocale) {
	return locale === "zh_CN" ? zhCNSuper.askUser.actions.submit : enUSSuper.askUser.actions.submit
}

export function getAskUserRemarkLabel(locale: AskUserLocale) {
	return locale === "zh_CN" ? zhCNSuper.askUser.remarkLabel : enUSSuper.askUser.remarkLabel
}

export function getAskUserRemarkPlaceholder(locale: AskUserLocale) {
	return locale === "zh_CN"
		? zhCNSuper.askUser.remarkPlaceholder
		: enUSSuper.askUser.remarkPlaceholder
}

export function getAskUserInputPlaceholder(locale: AskUserLocale) {
	return locale === "zh_CN" ? zhCNSuper.askUser.placeholder : enUSSuper.askUser.placeholder
}

export function getAskUserAutoSubmitInText({
	locale,
	time,
}: {
	locale: AskUserLocale
	time: string
}) {
	const template =
		locale === "zh_CN"
			? zhCNSuper.askUser.status.autoSubmitIn
			: enUSSuper.askUser.status.autoSubmitIn
	return template.replace("{{time}}", time)
}

export function getAskUserDefaultValueHintText({
	defaultValue,
	locale,
}: {
	defaultValue: string
	locale: AskUserLocale
}) {
	const template =
		locale === "zh_CN" ? zhCNSuper.askUser.defaultValueHint : enUSSuper.askUser.defaultValueHint
	return template.replace("{{defaultValue}}", defaultValue)
}

interface AskUserOtherInputProps {
	disabled: boolean
	placeholder: string
	onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
	onFocus: () => void
	questionId: string
	testIdPrefix: "confirm" | "select" | "multi-select"
	value: string
}

export function AskUserOtherInput({
	disabled,
	placeholder,
	onChange,
	onFocus,
	questionId,
	testIdPrefix,
	value,
}: AskUserOtherInputProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	useLayoutEffect(() => {
		const textarea = textareaRef.current
		if (!textarea) return
		textarea.style.height = "auto"
		const nextHeight = Math.min(textarea.scrollHeight, ASK_USER_OTHER_INPUT_MAX_HEIGHT)
		textarea.style.height = `${nextHeight}px`
		textarea.style.overflowY =
			textarea.scrollHeight > ASK_USER_OTHER_INPUT_MAX_HEIGHT ? "auto" : "hidden"
	}, [value, placeholder])

	return (
		<textarea
			ref={textareaRef}
			value={value}
			onChange={onChange}
			onFocus={onFocus}
			placeholder={placeholder}
			disabled={disabled}
			rows={1}
			data-testid={`ask-user-v2-card-${testIdPrefix}-other-input-${questionId}`}
			className={askUserOtherInputClass}
		/>
	)
}
