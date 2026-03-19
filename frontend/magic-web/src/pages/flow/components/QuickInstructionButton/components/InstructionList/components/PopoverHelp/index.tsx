import { memo, useMemo } from "react"
import { Flex, Popover } from "antd"
import { useTranslation } from "react-i18next"
import { IconHelp, IconPlus } from "@tabler/icons-react"
import { InstructionGroupType } from "@/types/bot"
import toolHelpBg from "@/assets/resources/toolHelpBg.svg"
import dialogHelpBg from "@/assets/resources/dialogHelpBg.svg"
import { useStyles } from "./styles"

interface PopoverHelpProps {
	id: InstructionGroupType
	title: string
	addInstruction: (type: InstructionGroupType) => void
}

export const PopoverHelp = memo(({ id, title, addInstruction }: PopoverHelpProps) => {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()

	const helpContent = useMemo(() => {
		switch (id) {
			case InstructionGroupType.TOOL:
				return (
					<Flex gap={8} vertical>
						<div className={styles.tooltipContent}>
							<img src={toolHelpBg} alt="" className={styles.img} />
							<div className={styles.mask} />
						</div>
						<div className={styles.tooltipDesc}>{t("agent.toolbarHelp")}</div>
					</Flex>
				)
			case InstructionGroupType.DIALOG:
				return (
					<Flex gap={8} vertical>
						<div className={styles.tooltipContent}>
							<img src={dialogHelpBg} alt="" className={styles.img} />
							<div className={styles.mask} />
						</div>

						<div className={styles.tooltipDesc}>{t("agent.dialogHelp")}</div>
					</Flex>
				)
			default:
				return null
		}
	}, [id, styles.img, styles.mask, styles.tooltipContent, styles.tooltipDesc, t])

	return (
		<Flex align="center" justify="space-between">
			<Flex align="center" gap={2}>
				<div className={styles.topTitle}>{title}</div>
				<Popover
					title=""
					content={helpContent}
					placement="right"
					overlayStyle={{ width: 200 }}
				>
					<IconHelp size={16} className={styles.icon} />
				</Popover>
			</Flex>
			<Flex
				gap={2}
				className={styles.addButton}
				align="center"
				onClick={() => addInstruction(id)}
			>
				<IconPlus size={18} color="currentColor" />
				<div>{t("agent.addInstruction")}</div>
			</Flex>
		</Flex>
	)
})
