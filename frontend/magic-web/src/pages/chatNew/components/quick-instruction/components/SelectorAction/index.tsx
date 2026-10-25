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
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"

interface InstructionItemProps extends HTMLAttributes<HTMLDivElement> {
	instruction: SelectorQuickInstruction
}

/**
 * Quick instruction option selector.
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

	// Clear the previous configuration when the instruction is no longer persistent.
	useNonResidencyConfigCleanup(id, innerConfigValue, residency, updateRemoteInstructionConfig)

	/**
	 * Resolve the configured option.
	 */
	const targetValue = useMemo(() => {
		if (!residency && instruction.instruction_type !== InstructionMode.Flow) return undefined

		if (configValue) {
			return instruction.values.find((i) => i.id === configValue)
		}
		return undefined
	}, [residency, instruction.instruction_type, instruction.values, configValue])

	/**
	 * Build option menu entries.
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
	 * Derive the selected menu key.
	 */
	const selectedKeys = useMemo(() => {
		if (!targetValue) return []
		return [targetValue.id]
	}, [targetValue])

	/**
	 * Apply or clear the selected option.
	 */
	const handleClick = useMemoizedFn((v) => {
		// Clicking the active persistent or flow option clears its configuration.
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
	 * A single option can run directly without opening the menu.
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
				// Bound the actual viewport while retaining the menu's selection and keyboard behavior.
				<ScrollArea viewportClassName={styles.viewport}>
					<MagicMenu
						items={menuItems}
						className={styles.menu}
						onClick={handleClick}
						selectedKeys={selectedKeys}
					/>
				</ScrollArea>
			}
		>
			<ActionWrapper active={open || !!targetValue?.name} {...rest}>
				{targetValue?.name ?? instruction.name}
			</ActionWrapper>
		</Popover>
	)
})

export default SelectorAction
