import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useMemo } from "react"
import { observer } from "mobx-react-lite"
import {
	type QuickInstruction,
	type InstructionGroupType,
	type CommonQuickInstruction,
	type SystemInstruct,
} from "@/types/bot"
import { useTranslation } from "react-i18next"
import { Flex, Tag } from "antd"
import MagicButton from "@/components/base/MagicButton"
import {
	IconSparkles,
	IconEdit,
	IconTrashX,
	IconGripVertical,
	IconEye,
	IconEyeOff,
} from "@tabler/icons-react"
import MagicIcon from "@/components/base/MagicIcon"
import { botStore } from "@/stores/bot"
import { useStyles } from "../../styles"
import { StatusIcons } from "@/pages/flow/components/QuickInstructionButton/components/StatusButton/components/StatusIcons"

interface DragItemProps {
	id: string
	type: InstructionGroupType
	// 数据
	item: QuickInstruction
	// 是否排序
	isSortable: boolean
	// 是否隐藏背景色
	isHidden?: boolean
	// 是否是占位符
	isPlaceholder?: boolean
	selectInstruction?: (type: InstructionGroupType, item: CommonQuickInstruction) => void
	deleteInstruction?: (type: InstructionGroupType, data: CommonQuickInstruction) => void
	handleShowSystem?: (id?: string) => void
}

export const DragItem = observer(
	({
		id,
		type,
		item,
		isPlaceholder = false,
		isHidden = false,
		isSortable = true,
		selectInstruction,
		deleteInstruction,
		handleShowSystem,
	}: DragItemProps) => {
		const { styles } = useStyles()
		const { t } = useTranslation("interface")

		const systemInstructList = botStore.systemInstructList

		const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
			id,
			data: { item },
			// 禁用拖拽
			disabled: !isSortable,
		})

		const opacity = useMemo(() => {
			if (isPlaceholder) return 0.4
			if (isHidden) {
				return 0
			}
			return 1
		}, [isPlaceholder, isHidden])

		const style = {
			transform: isPlaceholder ? "scale(1.02)" : CSS.Transform.toString(transform),
			transition,
			opacity,
		}

		if (isPlaceholder) return <div className={styles.dropZoneBg} />

		return (
			<div style={{ position: "relative" }}>
				<Flex
					ref={setNodeRef}
					style={style}
					{...attributes}
					className={styles.instructionItem}
					gap={4}
					justify="space-between"
					align="center"
				>
					<Flex gap={8} align="center">
						<MagicButton
							type="text"
							size="small"
							icon={<IconGripVertical size={18} />}
							className={styles.icon}
							style={{
								cursor: isSortable ? "grabbing" : "default",
								opacity: isSortable ? 1 : 0.2,
							}}
							{...listeners}
						/>
						<Flex gap={4} align="center">
							{isSortable ? (
								<div className={styles.magicIcon}>
									<IconSparkles size={18} color="#fff" />
								</div>
							) : (
								<Flex align="center" className={styles.icon}>
									<MagicIcon
										size={20}
										color="currentColor"
										component={StatusIcons[(item as SystemInstruct).icon]}
									/>
								</Flex>
							)}
							<span className={styles.subTitle}>
								{isSortable ? item.name : systemInstructList[item.type]}
							</span>
						</Flex>
					</Flex>
					{isSortable ? (
						<Flex gap={4}>
							<MagicButton
								className={styles.actionButton}
								onClick={() =>
									selectInstruction?.(type, item as CommonQuickInstruction)
								}
							>
								<IconEdit size={18} color="currentColor" />
							</MagicButton>
							<MagicButton
								className={styles.actionButton}
								onClick={() =>
									deleteInstruction?.(type, item as CommonQuickInstruction)
								}
							>
								<IconTrashX size={18} color="currentColor" />
							</MagicButton>
						</Flex>
					) : (
						<Flex gap={8} align="center">
							<Tag className={styles.tag}>{t("setting.system")}</Tag>
							<Flex align="center" className={styles.pointer}>
								{!(item as SystemInstruct).hidden ? (
									<IconEye
										size={18}
										className={styles.icon}
										onClick={() => handleShowSystem?.(item.id)}
									/>
								) : (
									<IconEyeOff
										size={18}
										className={styles.icon}
										onClick={() => handleShowSystem?.(item.id)}
									/>
								)}
							</Flex>
						</Flex>
					)}
				</Flex>
				{isHidden && <div className={styles.dragZoneBg} />}
			</div>
		)
	},
)
