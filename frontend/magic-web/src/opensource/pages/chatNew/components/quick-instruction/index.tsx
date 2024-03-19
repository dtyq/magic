import {
	QuickInstruction,
	InstructionGroupType,
	SystemInstruct,
	SystemInstructType,
	InstructionType,
	DisplayType,
} from "@/opensource/types/bot"
import { Flex } from "antd"
import { memo, type HTMLAttributes } from "react"
import { observer } from "mobx-react-lite"
import ConversationBotDataService from "@/opensource/services/chat/conversation/ConversationBotDataService"
import SelectorAction from "./components/SelectorAction"
import SwitchAction from "./components/SwitchAction"
import TextAction from "./components/TextAction/Index"
import { useStyles } from "./styles"
import StatusAction from "./components/StatusAction"
import SystemAction from "./components/SystemAction/Index"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"

interface InstructionSelectorProps {
	extraButtons?: React.ReactNode
	position: InstructionGroupType
	systemButtons?: Partial<Record<SystemInstructType, React.ReactNode>>
	className?: string
	noStyle?: boolean
}

interface InstructionItemProps extends HTMLAttributes<HTMLDivElement> {
	instruction: QuickInstruction
	systemButtons?: Partial<Record<SystemInstructType, React.ReactNode>>
}

const InstructionAction = ({ instruction, systemButtons, ...rest }: InstructionItemProps) => {
	if ((instruction as SystemInstruct)?.display_type === DisplayType.SYSTEM) {
		return (
			<SystemAction
				instruction={instruction as SystemInstruct}
				systemButtons={systemButtons}
				{...rest}
			/>
		)
	}

	switch (instruction.type) {
		case InstructionType.SINGLE_CHOICE:
			return <SelectorAction instruction={instruction} {...rest} />
		case InstructionType.SWITCH:
			return <SwitchAction instruction={instruction} {...rest} />
		case InstructionType.TEXT:
			return <TextAction instruction={instruction} {...rest} />
		case InstructionType.STATUS:
			return <StatusAction instruction={instruction} {...rest} />
		default:
			return null
	}
}

export const InstructionWrapper = memo(
	({ children, position }: { children: React.ReactNode; position: InstructionGroupType }) => {
		const isMobile = useIsMobile()
		const { styles } = useStyles({ position, isMobile })

		return <Flex className={styles.instructionSelector}>{children}</Flex>
	},
)

/**
 * 指令选择器
 */
const InstructionActions = observer(
	({ position, systemButtons, className, noStyle = false }: InstructionSelectorProps) => {
		const isMobile = useIsMobile()
		const { styles, cx } = useStyles({ position, isMobile })
		/** 指令列表 */
		const instructions = ConversationBotDataService.getQuickInstructionsByPosition(position)

		return (
			<>
				{instructions?.items?.map((instruction) => (
					<InstructionAction
						className={cx(!noStyle && styles[`actionWrapper${position}`], className)}
						key={instruction.id}
						instruction={instruction}
						systemButtons={systemButtons}
					/>
				))}
			</>
		)
	},
)

export default InstructionActions
