import MagicMenu from "@/components/base/MagicMenu"
import { InstructionMode, type SelectorQuickInstruction } from "@/types/bot"
import { Popover } from "antd"
import type { HTMLAttributes } from "react"
import { useState, useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import ConversationBotDataService from "@/services/chat/conversation/ConversationBotDataService"
import ActionWrapper from "../ActionWrapper"
import { useStyles } from "./styles"
import InstructionExplanation from "../InstructionExplanation/Index"
import { useNonResidencyConfigCleanup } from "../../hooks/useNonResidencyConfigCleanup"

interface InstructionItemProps extends HTMLAttributes<HTMLDivElement> {
	instruction: SelectorQuickInstruction
}

/**
 * 选择器指令
 */
const SelectorAction = observer(({ instruction, ...rest }: InstructionItemProps) => {
	const { styles } = useStyles()

	const [open, setOpen] = useState(false)

	const { residency = false, id } = instruction

	const {
		instructConfig: { [id]: configValue },
		innerInstructConfig: { [id]: innerConfigValue } = {},
		handleSelectorQuickInstructionClick,
		removeSelectorValueFromConfig,
		updateRemoteInstructionConfig,
	} = ConversationBotDataService

	// 需要检测一下常驻功能是否关闭了，是的话得清除历史配置值
	useNonResidencyConfigCleanup(id, innerConfigValue, residency, updateRemoteInstructionConfig)

	/**
	 * 目标选项
	 */
	const targetValue = useMemo(() => {
		if (!residency && instruction.instruction_type !== InstructionMode.Flow) return undefined

		if (configValue) {
			return instruction.values.find((i) => i.id === configValue)
		}
		return undefined
	}, [residency, instruction.instruction_type, instruction.values, configValue])

	/**
	 * 选项配置
	 */
	const menuItems = useMemo(() => {
		return (
			instruction?.values?.map((i) => ({
				label: (
					<InstructionExplanation data={i.instruction_explanation}>
						{i.name}
					</InstructionExplanation>
				),
				key: i.id,
			})) ?? []
		)
	}, [instruction])

	/**
	 * 选中的选项
	 */
	const selectedKeys = useMemo(() => {
		if (!targetValue) return []
		return [targetValue.id]
	}, [targetValue])

	/**
	 * 点击选项
	 */
	const handleClick = useMemoizedFn((v) => {
		// 如果是常驻或者流程指令
		if (
			(instruction.residency || instruction.instruction_type === InstructionMode.Flow) &&
			selectedKeys[0] === v.key
		) {
			removeSelectorValueFromConfig(instruction)
		} else {
			handleSelectorQuickInstructionClick(v.key, instruction)
		}
		setOpen(false)
	})

	/**
	 * 只有一个选项时，可以直接点击选项
	 */
	if (menuItems.length === 1) {
		return (
			<ActionWrapper active={false} onClick={() => handleClick(menuItems[0])} {...rest}>
				{instruction.name}
			</ActionWrapper>
		)
	}

	return (
		<Popover
			rootClassName={styles.popover}
			trigger="click"
			placement="topLeft"
			open={open}
			arrow={false}
			onOpenChange={setOpen}
			content={
				<MagicMenu
					items={menuItems}
					className={styles.menu}
					onClick={handleClick}
					selectedKeys={selectedKeys}
				/>
			}
		>
			<ActionWrapper active={open || !!targetValue?.name} {...rest}>
				{targetValue?.name ?? instruction.name}
			</ActionWrapper>
		</Popover>
	)
})

export default SelectorAction
