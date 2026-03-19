import type { SwitchQuickInstruction } from "@/types/bot"
import { useBoolean, useMemoizedFn } from "ahooks"
import { Switch } from "antd"
import { useEffect, useState } from "react"
import { observer } from "mobx-react-lite"
import ConversationBotDataService from "@/services/chat/conversation/ConversationBotDataService"
import ActionWrapper from "../ActionWrapper"
import InstructionExplanation from "../InstructionExplanation/Index"
import { useNonResidencyConfigCleanup } from "../../hooks/useNonResidencyConfigCleanup"

interface InstructionItemProps {
	instruction: SwitchQuickInstruction
}

/**
 * 开关指令
 */
const SwitchAction = observer(({ instruction, ...rest }: InstructionItemProps) => {
	const [open, { setTrue, setFalse }] = useBoolean(instruction?.default_value === "on")
	const [loading, setLoading] = useState(false)
	const {
		instructConfig: { [instruction?.id]: configValue },
		innerInstructConfig: { [instruction?.id]: innerConfigValue } = {},
		handleSwitchQuickInstructionClick,
		updateRemoteInstructionConfig,
	} = ConversationBotDataService

	useEffect(() => {
		try {
			if (!configValue) {
				if (instruction?.default_value === "on") {
					setTrue()
				} else {
					setFalse()
				}
			} else if (configValue === "on") {
				setTrue()
			} else {
				setFalse()
			}
		} catch (error) {
			console.warn(error)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [configValue, instruction?.default_value])

	// 需要检测一下常驻功能是否关闭了，是的话得清除历史配置值
	useNonResidencyConfigCleanup(
		instruction?.id,
		innerConfigValue,
		instruction.residency ?? false,
		updateRemoteInstructionConfig,
	)

	const handleClick = useMemoizedFn(async () => {
		setLoading(true)
		if (open) {
			setFalse()
			await handleSwitchQuickInstructionClick("off", instruction)
		} else {
			setTrue()
			await handleSwitchQuickInstructionClick("on", instruction)
		}
		setLoading(false)
	})

	return (
		<InstructionExplanation data={instruction.instruction_explanation} placement="top">
			<ActionWrapper active={open} onClick={handleClick} {...rest}>
				{instruction.name}
				<Switch checked={open} size="small" loading={loading} />
			</ActionWrapper>
		</InstructionExplanation>
	)
})

export default SwitchAction
