import { StatusIcons } from "@/pages/flow/components/QuickInstructionButton/components/StatusButton/components/StatusIcons"
import type { StatusQuickInstruction } from "@/types/bot"
import { useEffect, useMemo, useRef, useState, type HTMLAttributes } from "react"
import { useBoolean, useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import ConversationBotDataService from "@/services/chat/conversation/ConversationBotDataService"
import ActionWrapper from "../ActionWrapper"
import InstructionExplanation from "../InstructionExplanation/Index"

interface InstructionItemProps extends HTMLAttributes<HTMLDivElement> {
	instruction: StatusQuickInstruction
}

const StatusAction = observer(({ instruction, ...rest }: InstructionItemProps) => {
	const {
		instructConfig: { [instruction?.id]: configValue },
		handleStatusQuickInstructionClick,
	} = ConversationBotDataService

	const defaultIndex = useMemo(() => {
		if (!instruction?.default_value || !instruction?.values) return 0
		return (
			((instruction?.default_value ?? 1) - 2 + instruction.values.length) %
			instruction.values.length
		)
	}, [instruction?.default_value, instruction.values])

	const [statusId, setStatusId] = useState(instruction?.values?.[defaultIndex]?.id)

	useEffect(() => {
		try {
			if (!configValue) return
			setStatusId(configValue as string)
		} catch (error) {
			console.warn(error)
		}
	}, [configValue, instruction.id, instruction.values, statusId])

	// 当前状态配置
	const nextValue = useMemo(() => {
		const currentIndex = instruction?.values?.findIndex((i) => i.id === statusId)

		if (currentIndex === -1 || !instruction?.values) {
			return undefined
		}

		// 取下一个
		const i = (currentIndex + 1) % instruction.values.length
		return instruction?.values?.[i]
	}, [instruction?.values, statusId])

	const disabled = useRef<boolean>(false)
	const [disabledValue, { setTrue, setFalse }] = useBoolean(false)

	const handleClick = useMemoizedFn(() => {
		const nextId = nextValue?.id
		if (disabled.current || !nextId) return
		const prevId = statusId
		setStatusId(nextId)
		disabled.current = true
		setTrue()
		handleStatusQuickInstructionClick(nextValue.value, instruction, nextId)
			.catch(() => {
				setStatusId(prevId)
			})
			.finally(() => {
				disabled.current = false
				setFalse()
			})
	})

	const styles = useMemo(
		() => ({ color: nextValue?.text_color === "default" ? undefined : nextValue?.text_color }),
		[nextValue?.text_color],
	)
	const text = nextValue?.status_text ?? nextValue?.value ?? instruction.name

	if (!nextValue) return null

	return (
		<InstructionExplanation data={instruction.instruction_explanation} placement="top">
			<ActionWrapper
				iconComponent={StatusIcons?.[nextValue?.icon]}
				style={styles}
				onClick={handleClick}
				disabled={disabledValue}
				{...rest}
			>
				{text}
			</ActionWrapper>
		</InstructionExplanation>
	)
})

export default StatusAction
