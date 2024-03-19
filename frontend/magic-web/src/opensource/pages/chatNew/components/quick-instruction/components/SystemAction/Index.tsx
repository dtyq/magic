import type { ForwardRefExoticComponent, HTMLAttributes, RefAttributes } from "react"
import { SystemInstructType, type SystemInstruct } from "@/opensource/types/bot"
import { StatusIcons } from "@/opensource/pages/flow/components/QuickInstructionButton/components/StatusButton/components/StatusIcons"
import type { Icon, IconProps } from "@tabler/icons-react"
import { t } from "i18next"
import ActionWrapper from "../ActionWrapper"

interface SystemActionProps extends HTMLAttributes<HTMLDivElement> {
	instruction: SystemInstruct
	systemButtons?: Partial<Record<SystemInstructType, React.ReactNode>>
}

const SystemInstructionIcons: Record<
	SystemInstructType,
	ForwardRefExoticComponent<IconProps & RefAttributes<Icon>>
> = {
	[SystemInstructType.EMOJI]: StatusIcons.IconMoodHappy,
	[SystemInstructType.FILE]: StatusIcons.IconFile,
	[SystemInstructType.TOPIC]: StatusIcons.IconMessage2Plus,
	[SystemInstructType.TASK]: StatusIcons.IconClock,
	[SystemInstructType.RECORD]: StatusIcons.IconMicrophone,
}

const SystemInstructionNames: Record<SystemInstructType, string> = {
	[SystemInstructType.EMOJI]: t("chat.input.emoji", { ns: "interface" }),
	[SystemInstructType.FILE]: t("chat.input.upload", { ns: "interface" }),
	[SystemInstructType.TOPIC]: t("chat.input.newTopic", { ns: "interface" }),
	[SystemInstructType.TASK]: t("chat.input.task", { ns: "interface" }),
	[SystemInstructType.RECORD]: t("chat.recording_summary.title", {
		ns: "message",
	}),
}

const SystemAction = ({ instruction, systemButtons, ...rest }: SystemActionProps) => {
	if (instruction.hidden) return null

	switch (instruction.type) {
		case SystemInstructType.EMOJI:
			return systemButtons?.[SystemInstructType.EMOJI]
		case SystemInstructType.FILE:
			return systemButtons?.[SystemInstructType.FILE]
		case SystemInstructType.TOPIC:
			return systemButtons?.[SystemInstructType.TOPIC]
		case SystemInstructType.TASK:
			return systemButtons?.[SystemInstructType.TASK]
		case SystemInstructType.RECORD:
			return systemButtons?.[SystemInstructType.RECORD]
		default:
			return (
				<ActionWrapper
					active={false}
					iconComponent={
						StatusIcons?.[instruction.icon] ??
						SystemInstructionIcons?.[instruction.type]
					}
					{...rest}
				>
					{SystemInstructionNames?.[instruction.type]}
				</ActionWrapper>
			)
	}
}

export default SystemAction
