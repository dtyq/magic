import { memo, useEffect, useMemo, useState } from "react"
import type { DragOverEvent, DragStartEvent } from "@dnd-kit/core"
import {
	DndContext,
	useSensor,
	useSensors,
	PointerSensor,
	DragOverlay,
	rectIntersection,
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { Flex } from "antd"
import type {
	QuickInstruction,
	QuickInstructionList,
	SystemInstruct,
	CommonQuickInstruction,
} from "@/types/bot"
import { InstructionGroupType } from "@/types/bot"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { isSystemItem } from "../../const"
import { DropZone } from "./components/DropZone"
import { DragItem } from "./components/DragItem"
import magicToast from "@/components/base/MagicToaster/utils"

export type IdType = InstructionGroupType | string

interface InstructionListProps {
	instructionsList: QuickInstructionList[]
	updateInstructsList: (list: QuickInstructionList[]) => void
	addInstruction: (type: InstructionGroupType) => void
	selectInstruction: (type: InstructionGroupType, data: CommonQuickInstruction) => void
	deleteInstruction: (type: InstructionGroupType, data: CommonQuickInstruction) => void
}

const InstructionList = memo(
	({
		instructionsList,
		selectInstruction,
		addInstruction,
		deleteInstruction,
		updateInstructsList,
	}: InstructionListProps) => {
		const { t } = useTranslation("interface")

		const [list, setList] = useState<QuickInstructionList[]>([])
		const [activeItem, setActiveItem] = useState<QuickInstruction>()
		const [placeholderId, setPlaceholderId] = useState<IdType | null>(null)
		const [activeContainer, setActiveContainer] = useState<InstructionGroupType | null>(null)
		const [isCrossContainer, setIsCrossContainer] = useState(false)
		const [isDrag, setIsDrag] = useState(false)
		// const sensors = useSensors(useSensor(PointerSensor));

		const sensors = useSensors(
			useSensor(PointerSensor, {
				activationConstraint: {
					distance: 4,
				},
			}),
		)

		useEffect(() => {
			if (instructionsList.length > 0) {
				setList(instructionsList)
			}
		}, [instructionsList])

		// 找出 ID 属于哪个容器
		const findContainer = (id: IdType) => {
			return list.find((container) => container.items.some((item) => item.id === id))
				?.position
		}

		const clear = () => {
			setPlaceholderId(null)
			setActiveItem(undefined)
			setActiveContainer(null)
			setIsCrossContainer(false)
			setIsDrag(false)
		}

		// 开始拖拽
		const handleDragStart = (event: DragStartEvent) => {
			const { active } = event

			const activeId = active.id as string
			const container = findContainer(activeId)
			if (!container) return
			setActiveItem(active.data.current?.item)
			setActiveContainer(container) // 记录原始容器
			setIsDrag(true)
		}

		// 拖拽过程中
		const handleDragOver = (event: DragOverEvent) => {
			const { over } = event
			if (!over) return

			setIsCrossContainer(true)
			// 目标项id或是目标容器id
			const overId = over.id as IdType

			const isZone = over.data.current?.isContainer || false

			// 如果悬停在容器上
			if (isZone) {
				// 相同容器，置空
				if (activeContainer === overId) {
					setPlaceholderId(null)
				}
				// 不是当前移动项所在的容器，则设置占位符为容器id
				else if (!placeholderId) {
					setPlaceholderId(overId)
					return
				}
			}

			// 悬停在项上，则设置占位符为项的id

			// 目标容器
			const overContainer = findContainer(overId)

			if (!activeContainer || !overContainer) return

			// 拖拽是否跨容器
			if (overContainer !== activeContainer) {
				// 如果目标容器是工具栏，需要看目标项是否是系统指令，是则不可移动，否则可以移动
				if (overContainer === InstructionGroupType.TOOL) {
					const overItem = over.data.current?.item

					if (overItem && isSystemItem(overItem)) return
					setPlaceholderId(overId)
				} else if (placeholderId !== overId) {
					setPlaceholderId(overId)
				}
			} else {
				// 同一容器内拖拽不设置占位符
				setPlaceholderId(null)
			}
		}

		// 拖拽结束
		const handleDragEnd = (event: any) => {
			const { active, over } = event
			if (!over) {
				setPlaceholderId(null)
				return
			}

			const activeId = active.id
			const overId = over.id

			const fromZone = findContainer(activeId)
			const overZone = findContainer(overId)

			if (!fromZone) {
				setPlaceholderId(null)
				return
			}

			const newItems = [...list]

			// 获取源区域和目标区域的数据
			let fromZoneData = newItems.find((item) => item.position === fromZone)
			let overZoneData = newItems.find((item) => item.position !== fromZone)

			// 初始化为默认值
			if (!fromZoneData) {
				fromZoneData = { position: fromZone, items: [] }
				newItems.push(fromZoneData)
			}
			if (!overZoneData) {
				const targetPosition =
					InstructionGroupType.TOOL === fromZone
						? InstructionGroupType.DIALOG
						: InstructionGroupType.TOOL
				overZoneData = { position: targetPosition, items: [] }
				newItems.push(overZoneData)
			}

			if (fromZone === overZone) {
				// **同容器内排序**
				const newIndex = fromZoneData.items.findIndex((item) => item.id === overId)
				const newItem = fromZoneData.items[newIndex]
				if (!newItem) return
				if (isSystemItem(newItem)) {
					magicToast.error(t("agent.systemInstructionError"))
					clear()
					return
				}

				const oldIndex = fromZoneData.items.findIndex((item) => item.id === activeId)
				fromZoneData.items = arrayMove(fromZoneData.items, oldIndex, newIndex)
			} else {
				// **跨容器移动**

				const movedItem = fromZoneData.items.find((item) => item.id === activeId)
				if (!movedItem) return

				// 目标源不能有重复的指令名称
				if (overZoneData.items.findIndex((i) => i.name === movedItem.name) !== -1) {
					magicToast.error(t("agent.nameRepeatError"))
					clear()
					return
				}

				// 目标源最多只能有5个指令
				const filterItems = overZoneData.items.filter((item) => !isSystemItem(item)) || []
				if (filterItems.length >= 5) {
					magicToast.error(t("agent.maxInstruction"))
					clear()
					return
				}

				fromZoneData.items = fromZoneData.items.filter((item) => item.id !== activeId)
				const overIndex = overZoneData.items.findIndex((item) => item.id === placeholderId)
				// 没找到位置，则插入到末尾
				if (overIndex !== -1) {
					overZoneData.items.splice(overIndex, 0, movedItem!)
				} else {
					overZoneData.items.push(movedItem!)
				}
			}

			// 更新数据源
			updateInstructsList(newItems)
			setList(newItems)
			clear()
		}

		const zoneItems = useMemo(() => {
			return [
				{
					id: InstructionGroupType.TOOL,
					title: t("agent.toolbar"),
					data:
						list.find((item) => item.position === InstructionGroupType.TOOL)?.items ||
						[],
				},
				{
					id: InstructionGroupType.DIALOG,
					title: t("agent.dialog"),
					data:
						list.find((item) => item.position === InstructionGroupType.DIALOG)?.items ||
						[],
				},
			]
		}, [list, t])

		// 系统指令显隐藏
		const handleShowSystem = useMemoizedFn((itemId?: string) => {
			if (!itemId) return
			const newList = instructionsList.map((group) => {
				if (group.position === InstructionGroupType.TOOL) {
					const newItems = group.items.map((item) => {
						if (item.id === itemId) {
							return { ...item, hidden: !(item as SystemInstruct).hidden }
						}
						return item
					})
					return { ...group, items: newItems }
				}
				return group
			})

			updateInstructsList(newList)
		})

		return (
			<Flex vertical gap={6} flex={1} style={{ height: "100%" }}>
				<DndContext
					sensors={sensors}
					collisionDetection={rectIntersection}
					onDragStart={handleDragStart}
					onDragOver={handleDragOver}
					onDragEnd={handleDragEnd}
				>
					<Flex gap={12} style={{ height: "100%" }}>
						{zoneItems.map((zone) => (
							<DropZone
								key={zone.id}
								title={zone.title}
								id={zone.id}
								items={zone.data}
								isDrag={isDrag}
								fromZone={activeContainer}
								activeItem={activeItem}
								isCrossContainer={isCrossContainer}
								placeholderId={placeholderId}
								addInstruction={addInstruction}
								selectInstruction={selectInstruction}
								deleteInstruction={deleteInstruction}
								handleShowSystem={handleShowSystem}
							/>
						))}
					</Flex>
					<DragOverlay>
						{isCrossContainer && activeItem ? (
							<DragItem
								type={InstructionGroupType.TOOL}
								isSortable
								id={activeItem.id}
								item={activeItem}
							/>
						) : null}
					</DragOverlay>
				</DndContext>
			</Flex>
		)
	},
)

export default InstructionList
