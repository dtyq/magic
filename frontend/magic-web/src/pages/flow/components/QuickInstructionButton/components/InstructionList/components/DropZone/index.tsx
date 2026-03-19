import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import {
	type CommonQuickInstruction,
	type QuickInstruction,
	type InstructionGroupType,
	SystemInstructType,
} from "@/types/bot"
import { Flex } from "antd"
import { useTranslation } from "react-i18next"
import { IconSparkles } from "@tabler/icons-react"
import { useDroppable } from "@dnd-kit/core"
import { useStyles } from "../../styles"
import { PopoverHelp } from "../PopoverHelp"
import { isSystemItem } from "../../../../const"
import type { IdType } from "../../index"
import { DragItem } from "../DragItem"

interface DropZoneProps {
	title: string
	id: InstructionGroupType
	items: QuickInstruction[]
	fromZone: InstructionGroupType | null
	activeItem?: QuickInstruction
	placeholderId: IdType | null
	isDrag: boolean
	isCrossContainer: boolean
	addInstruction: (type: InstructionGroupType) => void
	selectInstruction: (type: InstructionGroupType, item: CommonQuickInstruction) => void
	deleteInstruction: (type: InstructionGroupType, data: CommonQuickInstruction) => void
	handleShowSystem: (itemId?: string) => void
}

export const DropZone = ({
	id,
	items,
	title,
	placeholderId,
	activeItem,
	isCrossContainer,
	fromZone,
	isDrag,
	addInstruction,
	selectInstruction,
	deleteInstruction,
	handleShowSystem,
}: DropZoneProps) => {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()

	const { setNodeRef } = useDroppable({
		id,
		data: { isContainer: true },
	})

	const isShowEnd = id !== fromZone && isDrag && placeholderId === id

	const adjustedItems = items
		.reduce((acc: QuickInstruction[], item) => {
			if (item.id === placeholderId && isCrossContainer) {
				acc.push({ id: "placeholder" } as QuickInstruction)
			}
			acc.push(item)
			return acc
		}, [])
		.filter((item) => {
			if (isSystemItem(item)) {
				return [
					SystemInstructType.EMOJI,
					SystemInstructType.FILE,
					SystemInstructType.TOPIC,
					SystemInstructType.TASK,
				].includes(item.type as SystemInstructType)
			}
			return true
		})

	const filterId = adjustedItems.filter((item) => !isSystemItem(item)).map((item) => item.id!)

	return (
		<Flex gap={12} vertical className={styles.dropZone} ref={setNodeRef}>
			<PopoverHelp id={id} title={title} addInstruction={addInstruction} />
			<div className={styles.desc}>{t("agent.maxInstruction")}</div>
			<SortableContext items={filterId} strategy={verticalListSortingStrategy}>
				<Flex vertical gap={12}>
					{adjustedItems.map((item) => {
						// 是否是系统指令
						const isSystem = isSystemItem(item)
						return (
							<DragItem
								key={item.id}
								type={id}
								id={item.id}
								item={item}
								isPlaceholder={item.id === "placeholder"}
								isHidden={isCrossContainer && activeItem?.id === item.id}
								isSortable={!isSystem}
								selectInstruction={selectInstruction}
								deleteInstruction={deleteInstruction}
								handleShowSystem={handleShowSystem}
							/>
						)
					})}
				</Flex>
			</SortableContext>
			{isShowEnd && <div className={styles.dropZoneBg} />}
			{adjustedItems.length === 0 && (
				<Flex
					vertical
					align="center"
					gap={4}
					flex={1}
					justify="center"
					className={styles.desc}
				>
					<IconSparkles size={32} color="currentColor" />
					<div>{t("agent.emptyQuickInstruction")}</div>
				</Flex>
			)}
		</Flex>
	)
}
