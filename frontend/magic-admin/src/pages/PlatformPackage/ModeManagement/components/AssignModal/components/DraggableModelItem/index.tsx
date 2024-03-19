import { Flex } from "antd"
import { MagicAvatar, MagicButton } from "components"
import { IconGripVertical } from "@tabler/icons-react"
import { useDraggable } from "@dnd-kit/core"
import { useMemo } from "react"
import type { AiManage } from "@/types/aiManage"
import type { PlatformPackage } from "@/types/platformPackage"
import { useStyles } from "../../styles"
import { DragType } from "../../types"
import { useModeConfigContext } from "../../hooks/useModeConfigContext"

interface DraggableModelItemProps {
	model: AiManage.ModelInfo
	disableDrag?: boolean
	style?: React.CSSProperties
	dragOverlay?: boolean
}

// 创建可拖拽的模型项组件
const DraggableModelItem = ({
	model,
	disableDrag = false,
	style,
	dragOverlay = false,
}: DraggableModelItemProps) => {
	const { styles } = useStyles()

	const { dragState } = useModeConfigContext()

	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: model.id,
		data: {
			item: {
				...model,
				model_category: model.category,
			},
			type: DragType.LeftModel,
		},
		disabled: disableDrag,
	})

	const cursor = useMemo(() => {
		if (
			(dragState.overType === DragType.SubGroup ||
				dragState.overType === DragType.SubModel) &&
			dragState.overItem &&
			model.category !== (dragState.overItem as PlatformPackage.ModelItem).model_category
		) {
			return "not-allowed"
		}
		if (dragOverlay) {
			return "grabbing"
		}
		return "grab"
	}, [dragState.overType, dragState.overItem, model.category, dragOverlay])

	return (
		<Flex
			ref={setNodeRef}
			justify="space-between"
			align="center"
			className={styles.item}
			style={{ opacity: isDragging ? 0.5 : 1, ...style }}
			gap={10}
			{...attributes}
		>
			<Flex gap={10} align="center" className={styles.nameWrapper}>
				<MagicAvatar size={24} shape="circle" src={model.icon}>
					{model?.name}
				</MagicAvatar>
				<span className={styles.name}>{model?.name}</span>
				<span className={styles.desc}>
					{model?.id === "default" ? model?.description : model?.model_id}
				</span>
			</Flex>
			{!disableDrag && (
				<MagicButton
					type="text"
					size="small"
					icon={<IconGripVertical size={20} />}
					className={styles.gripIcon}
					style={{
						cursor,
					}}
					{...listeners}
				/>
			)}
		</Flex>
	)
}

export default DraggableModelItem
