import type { TextQuickInstruction } from "@/types/bot"
import { observer } from "mobx-react-lite"
import ConversationBotDataService from "@/services/chat/conversation/ConversationBotDataService"
import ActionWrapper from "../ActionWrapper"
import InstructionExplanation from "../InstructionExplanation/Index"

interface InstructionItemProps {
	instruction: TextQuickInstruction
}

/**
 * 文本指令
 */
const TextAction = observer(({ instruction, ...rest }: InstructionItemProps) => {
	const { handleTextQuickInstructionClick } = ConversationBotDataService
	return (
		<InstructionExplanation data={instruction.instruction_explanation} placement="top">
			<ActionWrapper
				active={false}
				onClick={() => handleTextQuickInstructionClick(instruction.content, instruction)}
				{...rest}
			>
				{instruction.name}
			</ActionWrapper>
		</InstructionExplanation>
	)
})

export default TextAction
