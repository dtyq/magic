import { useEffect, useMemo, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	ASK_USER_CARD_STATUS,
	ASK_USER_INTERACTION_TYPE,
	ASK_USER_RESPONSE_STATUS,
	ASK_USER_TOOL,
	type AskUserConfirmValue,
} from "@/pages/superMagic/components/MessageList/utils/askUserConstants"
import {
	type AskUserPendingAction,
	type AskUserResponseStatus,
	buildAskUserToolReplyDetail,
	formatAskUserAnswer,
	isAskUserAnswerValid,
	isAskUserOtherOption,
	type AskUserCardData,
	type AskUserQuestionData,
	ASK_USER_RECOVERY_FAILED_EVENT,
} from "@/pages/superMagic/components/MessageList/utils/askUser"
import { isTerminalAskUserReplyError } from "@/pages/superMagic/components/MessageList/utils/askUserReplyState"
import {
	buildAskUserDraftCacheKey,
	clearAskUserDraftAnswers,
	readAskUserDraftAnswers,
	writeAskUserDraftAnswers,
	type AskUserDraftAnswers,
} from "@/pages/superMagic/components/MessageList/utils/askUserDraftCache"
import { sendAskUserToolReply } from "@/pages/superMagic/services/askUserToolReplyService"
import { superMagicStore } from "@/pages/superMagic/stores"

function getOtherOption(options: readonly string[]) {
	return options.find((option) => isAskUserOtherOption(option)) || ""
}

function buildDraftState(
	questions: readonly AskUserQuestionData[],
	answers: AskUserDraftAnswers | null,
) {
	const inputValues: Record<string, string> = {}
	const selectedValues: Record<string, string> = {}
	const selectedOptionsMap: Record<string, string[]> = {}
	const otherTexts: Record<string, string> = {}

	if (!answers) {
		return {
			inputValues,
			otherTexts,
			selectedOptionsMap,
			selectedValues,
		}
	}

	for (const question of questions) {
		const answer = answers[question.subId]
		const otherOption = getOtherOption(question.options)

		if (question.interactionType === ASK_USER_INTERACTION_TYPE.input) {
			inputValues[question.subId] = typeof answer === "string" ? answer : ""
			continue
		}

		if (question.interactionType === ASK_USER_INTERACTION_TYPE.multiSelect) {
			const selectedOptions: string[] = []
			const values = Array.isArray(answer) ? answer : []
			for (const value of values) {
				if (question.options.includes(value)) {
					selectedOptions.push(value)
					continue
				}
				if (otherOption && value.trim()) {
					if (!selectedOptions.includes(otherOption)) selectedOptions.push(otherOption)
					if (!otherTexts[question.subId]) otherTexts[question.subId] = value
				}
			}
			selectedOptionsMap[question.subId] = selectedOptions
			continue
		}

		const value = typeof answer === "string" ? answer : ""
		if (question.options.includes(value) || !otherOption || !value.trim()) {
			selectedValues[question.subId] = value
			continue
		}

		selectedValues[question.subId] = otherOption
		otherTexts[question.subId] = value
	}

	return {
		inputValues,
		otherTexts,
		selectedOptionsMap,
		selectedValues,
	}
}

export function useAskUserActions({
	askUser,
	context,
	isDisabled,
	onExpiredInteraction,
	onTerminalError,
}: {
	askUser: AskUserCardData
	context?: {
		conversationId?: string
		topicId?: string
		toolCallId?: string
	}
	isDisabled: boolean
	onExpiredInteraction?: () => void
	onTerminalError?: () => void
}) {
	const { t } = useTranslation("super")
	const [inputValues, setInputValues] = useState<Record<string, string>>({})
	const [selectedValues, setSelectedValues] = useState<Record<string, string>>({})
	const [selectedOptionsMap, setSelectedOptionsMap] = useState<Record<string, string[]>>({})
	const [otherTexts, setOtherTexts] = useState<Record<string, string>>({})
	const [pendingAction, setPendingAction] = useState<AskUserPendingAction>(null)
	const skipNextDraftWriteRef = useRef(true)
	const draftCacheKey = useMemo(
		() =>
			buildAskUserDraftCacheKey({
				questionId: askUser.questionId,
				topicId: context?.topicId,
			}),
		[askUser.questionId, context?.topicId],
	)

	useEffect(() => {
		const draftState = buildDraftState(
			askUser.questions,
			readAskUserDraftAnswers(draftCacheKey),
		)
		skipNextDraftWriteRef.current = true
		setInputValues(draftState.inputValues)
		setSelectedValues(draftState.selectedValues)
		setSelectedOptionsMap(draftState.selectedOptionsMap)
		setOtherTexts(draftState.otherTexts)
		setPendingAction(null)
	}, [askUser.questionId, askUser.questions, draftCacheKey])

	const answer = useMemo(() => {
		const answers: Record<string, string | string[]> = {}

		for (const question of askUser.questions) {
			const otherTrimmed = (otherTexts[question.subId] || "").trim()

			if (question.interactionType === ASK_USER_INTERACTION_TYPE.multiSelect) {
				const raw = selectedOptionsMap[question.subId] || []
				const resolved = raw.map((opt) =>
					isAskUserOtherOption(opt) ? otherTrimmed || opt : opt,
				)
				answers[question.subId] = formatAskUserAnswer({
					interactionType: question.interactionType,
					selectedOptions: resolved,
				})
				continue
			}

			const selected = selectedValues[question.subId] || ""
			const value =
				question.interactionType === ASK_USER_INTERACTION_TYPE.input
					? inputValues[question.subId] || ""
					: isAskUserOtherOption(selected)
						? otherTrimmed
						: selected
			answers[question.subId] = formatAskUserAnswer({
				interactionType: question.interactionType,
				value,
			})
		}

		return JSON.stringify(answers)
	}, [askUser.questions, inputValues, otherTexts, selectedOptionsMap, selectedValues])

	const isValid = useMemo(() => {
		return askUser.questions.every((question) => {
			const base = isAskUserAnswerValid({
				interactionType: question.interactionType,
				value:
					question.interactionType === ASK_USER_INTERACTION_TYPE.input
						? inputValues[question.subId] || ""
						: selectedValues[question.subId] || "",
				selectedOptions: selectedOptionsMap[question.subId] || [],
				minSelect: question.minSelect,
				maxSelect: question.maxSelect,
			})
			if (!base) return false

			const otherTrimmed = (otherTexts[question.subId] || "").trim()
			if (question.interactionType === ASK_USER_INTERACTION_TYPE.select) {
				const sv = selectedValues[question.subId] || ""
				if (isAskUserOtherOption(sv) && !otherTrimmed) return false
			}
			if (question.interactionType === ASK_USER_INTERACTION_TYPE.multiSelect) {
				const opts = selectedOptionsMap[question.subId] || []
				if (opts.some((o) => isAskUserOtherOption(o)) && !otherTrimmed) return false
			}
			return true
		})
	}, [askUser.questions, inputValues, otherTexts, selectedOptionsMap, selectedValues])

	const sendToolReply = useMemoizedFn(async (responseStatus: AskUserResponseStatus) => {
		const conversationId = context?.conversationId || ""
		const topicId = context?.topicId || ""
		const toolCallId = context?.toolCallId || ""
		if (!conversationId || !topicId) throw new Error("missing_topic_context")
		if (!toolCallId) throw new Error("missing_ask_user_tool_call_id")

		const detail = buildAskUserToolReplyDetail({
			taskId: askUser.taskId,
			questionId: askUser.questionId,
			responseStatus,
			answer: responseStatus === ASK_USER_RESPONSE_STATUS.answered ? answer : "",
		})
		if (!detail) throw new Error("missing_ask_user_task_id")
		await sendAskUserToolReply({
			conversationId,
			topicId,
			toolName: ASK_USER_TOOL.name,
			toolCallId,
			detail,
			isAnswered: responseStatus === ASK_USER_RESPONSE_STATUS.answered,
		})
	})

	useEffect(() => {
		if (!context?.topicId || !context.toolCallId) return
		return superMagicStore.subscribe(
			"message.committed",
			({ payload }) => {
				if (
					payload.message.event === ASK_USER_RECOVERY_FAILED_EVENT &&
					payload.message.toolCallId === context.toolCallId
				) {
					setPendingAction(null)
				}
			},
			{ scope: { topicId: context.topicId } },
		)
	}, [context?.topicId, context?.toolCallId])

	useEffect(() => {
		if (!draftCacheKey) return
		if (askUser.status !== ASK_USER_CARD_STATUS.pending) {
			clearAskUserDraftAnswers(draftCacheKey)
			return
		}
		if (skipNextDraftWriteRef.current) {
			skipNextDraftWriteRef.current = false
			return
		}
		if (isDisabled) return

		try {
			writeAskUserDraftAnswers(draftCacheKey, JSON.parse(answer) as AskUserDraftAnswers)
		} catch (error) {
			console.error(error)
		}
	}, [answer, askUser.status, draftCacheKey, isDisabled])

	const handleSubmit = useMemoizedFn(async () => {
		const isExpiredAtNow = askUser.expiresAt > 0 && Date.now() / 1000 >= askUser.expiresAt
		if (isExpiredAtNow) {
			onExpiredInteraction?.()
			return
		}
		if (isDisabled || pendingAction || !isValid) return

		try {
			setPendingAction("submit")
			await sendToolReply(ASK_USER_RESPONSE_STATUS.answered)
		} catch (error) {
			if (isTerminalAskUserReplyError(error)) {
				onTerminalError?.()
				setPendingAction(null)
				return
			}
			console.error(error)
			setPendingAction(null)
			magicToast.error(t("askUser.status.submitFailed"))
		}
	})

	const handleSkip = useMemoizedFn(async () => {
		const isExpiredAtNow = askUser.expiresAt > 0 && Date.now() / 1000 >= askUser.expiresAt
		if (isExpiredAtNow) {
			onExpiredInteraction?.()
			return
		}
		if (isDisabled || pendingAction) return

		try {
			setPendingAction("skip")
			await sendToolReply(ASK_USER_RESPONSE_STATUS.skipped)
		} catch (error) {
			if (isTerminalAskUserReplyError(error)) {
				onTerminalError?.()
				setPendingAction(null)
				return
			}
			console.error(error)
			setPendingAction(null)
			magicToast.error(t("askUser.status.submitFailed"))
		}
	})

	const setInputValue = useMemoizedFn((subId: string, value: string) => {
		setInputValues((currentValues) => ({
			...currentValues,
			[subId]: value,
		}))
	})

	const setSelectedValue = useMemoizedFn((subId: string, value: string) => {
		setSelectedValues((currentValues) => ({
			...currentValues,
			[subId]: value,
		}))
	})

	const handleConfirmSelect = useMemoizedFn((subId: string, value: AskUserConfirmValue) => {
		setSelectedValue(subId, value)
	})

	const handleToggleOption = useMemoizedFn(
		({
			question,
			option,
			checked,
		}: {
			question: AskUserQuestionData
			option: string
			checked: boolean
		}) => {
			setSelectedOptionsMap((currentMap) => {
				const currentOptions = currentMap[question.subId] || []
				const nextOptions = checked
					? [...currentOptions, option]
					: currentOptions.filter((currentOption) => currentOption !== option)
				return {
					...currentMap,
					[question.subId]: Array.from(new Set(nextOptions)),
				}
			})
		},
	)

	const getInputValue = useMemoizedFn((subId: string) => inputValues[subId] || "")
	const getSelectedValue = useMemoizedFn((subId: string) => selectedValues[subId] || "")
	const getSelectedOptions = useMemoizedFn((subId: string) => selectedOptionsMap[subId] || [])
	const getOtherText = useMemoizedFn((subId: string) => otherTexts[subId] || "")
	const setOtherText = useMemoizedFn((subId: string, value: string) => {
		setOtherTexts((current) => ({
			...current,
			[subId]: value,
		}))
	})
	const isQuestionValid = useMemoizedFn((question: AskUserQuestionData) => {
		const base = isAskUserAnswerValid({
			interactionType: question.interactionType,
			value:
				question.interactionType === ASK_USER_INTERACTION_TYPE.input
					? inputValues[question.subId] || ""
					: selectedValues[question.subId] || "",
			selectedOptions: selectedOptionsMap[question.subId] || [],
			minSelect: question.minSelect,
			maxSelect: question.maxSelect,
		})
		if (!base) return false

		const otherTrimmed = (otherTexts[question.subId] || "").trim()
		if (question.interactionType === ASK_USER_INTERACTION_TYPE.select) {
			const sv = selectedValues[question.subId] || ""
			if (isAskUserOtherOption(sv) && !otherTrimmed) return false
		}
		if (question.interactionType === ASK_USER_INTERACTION_TYPE.multiSelect) {
			const opts = selectedOptionsMap[question.subId] || []
			if (opts.some((o) => isAskUserOtherOption(o)) && !otherTrimmed) return false
		}
		return true
	})

	return {
		answer,
		getInputValue,
		getOtherText,
		getSelectedOptions,
		getSelectedValue,
		isValid,
		isQuestionValid,
		pendingAction,
		handleConfirmSelect,
		handleSkip,
		handleSubmit,
		handleToggleOption,
		setInputValue,
		setOtherText,
		setSelectedValue,
	}
}
