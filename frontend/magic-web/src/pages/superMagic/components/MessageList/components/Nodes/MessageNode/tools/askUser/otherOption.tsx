import type { ChangeEvent } from "react"
import { Input } from "@/components/shadcn-ui/input"
import enUSSuper from "@/assets/locales/en_US/super.json"
import zhCNSuper from "@/assets/locales/zh_CN/super.json"
import type { AskUserLocale } from "@/pages/superMagic/components/MessageList/utils/askUser"
type AnswerValue = string | readonly string[]

export const ASK_USER_OTHER_SENTINEL = "__ask_user_other__"

export const askUserOtherInputClass =
	"h-6 min-w-0 flex-1 rounded-md !border-0 bg-background px-2.5 text-left text-xs font-normal leading-4 text-foreground !shadow-none placeholder:text-xs placeholder:text-muted-foreground focus-visible:!border-transparent focus-visible:!ring-0 md:h-6 md:text-xs"

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
	onChange: (event: ChangeEvent<HTMLInputElement>) => void
	onFocus: () => void
	questionId: string
	testIdPrefix: "select" | "multi-select"
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
	return (
		<Input
			type="text"
			value={value}
			onChange={onChange}
			onFocus={onFocus}
			placeholder={placeholder}
			disabled={disabled}
			data-testid={`ask-user-v2-card-${testIdPrefix}-other-input-${questionId}`}
			className={askUserOtherInputClass}
		/>
	)
}
