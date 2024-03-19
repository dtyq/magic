import { useSortable } from "@dnd-kit/sortable"
import { Flex } from "antd"
import { MagicButton, MagicAvatar } from "components"
import { IconGripVertical, IconTrash } from "@tabler/icons-react"
import { CSS } from "@dnd-kit/utilities"
import { useTranslation } from "react-i18next"
import { useMemo } from "react"
import { PlatformPackage } from "@/types/platformPackage"
import { useStyles } from "../../styles"
import { DragType } from "../../types"
import { useModeConfigContext } from "../../hooks/useModeConfigContext"

interface SortableItemProps {
	handle: boolean
	model: PlatformPackage.BaseModel
	dragOverlay?: boolean
	style?: React.CSSProperties
	/* 模型类型 */
	modelType?: DragType
	/* 父级数据, 子模型需要 */
	parentData?: PlatformPackage.DynamicModel
}

// 排序模型组件
function SortableModelItem({
	handle,
	model,
	dragOverlay,
	style,
	modelType = DragType.Model,
	parentData,
}: SortableItemProps) {
	const { t } = useTranslation("admin/platform/mode")
	const { styles, cx } = useStyles()

	// 从 Context 获取删除方法
	const { deleteModel, dragState } = useModeConfigContext()

	const { id, model_status, model_name, model_icon, model_id, group_id } = model

	const { setNodeRef, setActivatorNodeRef, listeners, isDragging, transform, transition } =
		useSortable({
			id,
			data: { item: model, type: modelType, parentData },
		})

	const disabled = model_status === PlatformPackage.ModeGroupModelStatus.Disabled
	const deleted = model_status === PlatformPackage.ModeGroupModelStatus.Deleted
	const normal = model_status === PlatformPackage.ModeGroupModelStatus.Normal

	const cursor = useMemo(() => {
		if (
			(dragState.overType === DragType.SubGroup ||
				dragState.overType === DragType.SubModel) &&
			dragState.overItem &&
			model.model_category !==
				(dragState.overItem as PlatformPackage.ModelItem).model_category
		) {
			return "not-allowed"
		}
		if (dragOverlay) {
			return "grabbing"
		}
		return "grab"
	}, [dragState.overType, dragState.overItem, model.model_category, dragOverlay])

	return (
		<Flex
			ref={setNodeRef}
			justify="space-between"
			align="center"
			gap={10}
			className={cx(
				styles.item,
				deleted && styles.deletedItem,
				disabled && styles.disabledItem,
				isDragging && styles.draggingItem,
				dragOverlay && styles.dragOverlay,
			)}
			style={{
				transform: CSS.Transform.toString(transform),
				transition,
				opacity: isDragging ? 0.5 : 1,
				...style,
			}}
		>
			<Flex gap={10} align="center" className={styles.nameWrapper}>
				{handle && (
					<MagicButton
						ref={setActivatorNodeRef}
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
				<MagicAvatar size={24} shape="circle" src={model_icon}>
					{model_name}
				</MagicAvatar>
				<span
					className={cx(styles.name, {
						[styles.opacity]: !normal,
						[styles.deletedText]: deleted,
					})}
				>
					{model_name}
				</span>
				<span className={styles.desc}>{model_id}</span>
			</Flex>
			<Flex gap={10} align="center">
				{deleted && <div className={styles.deletedText}>{t("deleted")}</div>}
				{disabled && <div className={styles.disabledText}>{t("disabled")}</div>}
				{handle && (
					<MagicButton
						icon={<IconTrash size={18} />}
						danger
						type="text"
						onClick={() => {
							if (modelType === DragType.SubModel && parentData) {
								deleteModel(parentData.group_id, id, parentData.id)
							} else {
								deleteModel(group_id, id)
							}
						}}
					/>
				)}
			</Flex>
		</Flex>
	)
}

export default SortableModelItem
