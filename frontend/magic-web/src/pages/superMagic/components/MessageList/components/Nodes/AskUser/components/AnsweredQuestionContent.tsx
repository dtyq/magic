import type { TFunction } from "i18next"
import { ASK_USER_INTERACTION_TYPE } from "@/pages/superMagic/components/MessageList/utils/askUserConstants"
import {
	type AskUserQuestionData,
	formatAskUserAnswerForDisplay,
	isAskUserOtherOption,
} from "@/pages/superMagic/components/MessageList/utils/askUser"
import { renderAskUserPendingQuestion } from "./InteractionQuestionRenderers"

const askUserAnswerTextClass =
	"pl-0 text-xs font-normal leading-4 text-foreground min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"

interface AskUserAnsweredOptionState {
	selectedValue: string
	selectedOptions: string[]
	otherText: string
}

function getAnsweredQuestionOptionState({
	question,
	answerValue,
}: {
	question: AskUserQuestionData
	answerValue?: string | string[] | null
}): AskUserAnsweredOptionState | null {
	const otherOption = question.options.find((option) => isAskUserOtherOption(option)) || ""

	if (question.interactionType === ASK_USER_INTERACTION_TYPE.confirm) {
		if (typeof answerValue !== "string" || !answerValue) return null
		return {
			selectedValue: answerValue,
			selectedOptions: [],
			otherText: "",
		}
	}

	if (question.interactionType === ASK_USER_INTERACTION_TYPE.select) {
		if (typeof answerValue !== "string" || !answerValue) return null
		if (question.options.includes(answerValue)) {
			return {
				selectedValue: answerValue,
				selectedOptions: [],
				otherText: "",
			}
		}
		if (otherOption) {
			return {
				selectedValue: otherOption,
				selectedOptions: [],
				otherText: answerValue,
			}
		}
		return null
	}

	if (question.interactionType === ASK_USER_INTERACTION_TYPE.multiSelect) {
		if (!Array.isArray(answerValue)) return null

		const selectedOptions: string[] = []
		let otherText = ""

		for (const item of answerValue) {
			if (question.options.includes(item)) {
				selectedOptions.push(item)
				continue
			}
			if (otherOption && !selectedOptions.includes(otherOption) && !otherText) {
				selectedOptions.push(otherOption)
				otherText = item
				continue
			}
			return null
		}

		return {
			selectedValue: "",
			selectedOptions,
			otherText,
		}
	}

	return null
}

export function AnsweredQuestionContent({
	question,
	answerValue,
	t,
}: {
	question: AskUserQuestionData
	answerValue?: string | string[] | null
	t: TFunction<"super", undefined>
}) {
	const optionState = getAnsweredQuestionOptionState({
		question,
		answerValue,
	})

	if (!optionState) {
		return (
			<p className={askUserAnswerTextClass}>
				{formatAskUserAnswerForDisplay(answerValue) || t("askUser.status.emptyAnswer")}
			</p>
		)
	}

	return (
		<div className="pointer-events-none">
			{renderAskUserPendingQuestion({
				getInputValue: () => "",
				getOtherText: () => optionState.otherText,
				getSelectedOptions: () => optionState.selectedOptions,
				getSelectedValue: () => optionState.selectedValue,
				handleConfirmSelect: () => undefined,
				handleToggleOption: () => undefined,
				pendingAction: null,
				question,
				renderQuestionDefaultHint: () => null,
				setInputValue: () => undefined,
				setOtherText: () => undefined,
				setSelectedValue: () => undefined,
				shouldDisableInteraction: true,
				t,
			})}
		</div>
	)
}
