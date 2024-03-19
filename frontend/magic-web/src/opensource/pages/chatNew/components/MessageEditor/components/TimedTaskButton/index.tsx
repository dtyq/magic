import type { MagicButtonProps } from "@/opensource/components/base/MagicButton"
import MagicButton from "@/opensource/components/base/MagicButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconClockPlay } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { Popover } from "antd"
import ConversationTaskService from "@/opensource/services/chat/conversation/ConversationTaskService"
import TaskContent from "./components/TaskContent"
import { useStyles } from "./styles"

interface TimedTaskButtonProps extends Omit<MagicButtonProps, "onClick"> {
	conversationId?: string
	iconSize?: number
}

function TimedTaskButton({
	conversationId,
	iconSize = 20,
	className,
	...props
}: TimedTaskButtonProps) {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()

	return (
		<Popover
			classNames={{ root: styles.popover }}
			content={<TaskContent conversationId={conversationId} />}
			trigger="click"
		>
			<MagicButton
				type="text"
				icon={<MagicIcon color="currentColor" size={iconSize} component={IconClockPlay} />}
				className={className}
				onClick={() => {
					ConversationTaskService.getTaskList()
				}}
				{...props}
			>
				{t("chat.timedTask.title")}
			</MagicButton>
		</Popover>
	)
}

export default TimedTaskButton
