import {
	defaultAnimateLayoutChanges,
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
	type AnimateLayoutChanges,
} from "@dnd-kit/sortable"
import { useMemo } from "react"
import { Flex } from "antd"
import { CSS } from "@dnd-kit/utilities"
import { MagicButton, MagicAvatar } from "components"
import { IconGripVertical } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { PlatformPackage } from "@/types/platformPackage"
import { AiModel } from "@/const/aiModel"
import { useStyles } from "../../styles"
import { DragType } from "../../types"
import SortableModelItem from "../SortableModelItem"
import DynamicModelItem from "../DynamicModelItem"
import { useModeConfigContext } from "../../hooks/useModeConfigContext"
import { isDynamicModel } from "../../utils"

const animateLayoutChanges: AnimateLayoutChanges = (args) =>
	defaultAnimateLayoutChanges({ ...args, wasDragging: true })

interface DroppableContainerProps {
	/* 分组 */
	group: PlatformPackage.ModeGroup
	/* 分组下的模型 */
	models: PlatformPackage.ModelItem[]
	/* 是否自定义配置 */
	handle: boolean
	/* 样式 */
	style?: React.CSSProperties
	/* 是否是拖拽覆盖层 */
	dragOverlay?: boolean
}

// 分组组件
function GroupItem({ handle, group, models, style, dragOverlay }: DroppableContainerProps) {
	const { t } = useTranslation("admin/platform/mode")
	const { styles, cx } = useStyles()
	const { id } = group

	// 从 Context 获取状态和方法
	const { dragState, openAddOrEditGroupModal, deleteGroup } = useModeConfigContext()

	const { attributes, isDragging, listeners, setNodeRef, transition, transform } = useSortable({
		id,
		data: { item: group, type: DragType.Group },
		animateLayoutChanges,
	})

	const internalStyle = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	}

	const dragContext = useMemo(() => {
		const {
			overId,
			activeId,
			activeType,
			overGroupId,
			overType,
			isInsertMode,
			isBelowOverItem,
		} = dragState

		// 基础验证
		if (!overId || !activeId) {
			return { isValid: false }
		}

		// 核心判断（一次性计算）
		// 是否是组自身排序
		const isGroupSelfSort = activeId === id && activeType === DragType.Group
		// 是否是同组内的模型排序
		const isSameGroupModelDrag = models.some((model) => model.id === activeId)
		// 是否是悬停在当前分组上
		const isOverThisGroup = overGroupId === id
		// 是否是悬停在子分组上，且处于插入模式
		const isOverSubGroupInInsertMode = overType === DragType.SubGroup && isInsertMode

		// 统一的跳过条件
		const shouldSkip = isGroupSelfSort || isSameGroupModelDrag || !isOverThisGroup

		return {
			isValid: true,
			isGroupSelfSort,
			shouldSkip,
			isOverSubGroupInInsertMode,
			overId,
			isBelowOverItem,
		}
	}, [dragState, id, models])

	// 判断是否应该显示占位符，以及占位符应该插入的位置
	const placeholderInfo = useMemo(() => {
		// 分组自身排序或同组内模型排序，不需要占位符
		if (!dragContext.isValid || dragContext.shouldSkip) return null

		// 目标项是子分组，且处于插入模式，不显示占位符
		if (dragContext.isOverSubGroupInInsertMode) return null

		// 拖拽到分组容器（空白区域），在末尾显示占位符
		if (dragContext.overId === id) {
			return { insertIndex: models.length - 1, insertAfter: true }
		}

		// 拖拽到某个模型上，根据鼠标位置判断插入前还是插入后
		const targetIndex = models.findIndex((model) => model.id === dragContext.overId)
		if (targetIndex !== -1) {
			// 根据 isBelowOverItem 判断：鼠标在下半部分则插入后面，否则插入前面
			return { insertIndex: targetIndex, insertAfter: dragContext.isBelowOverItem }
		}

		return null
	}, [dragContext, id, models])

	// 构建显示列表，在指定位置插入占位符
	const displayModels = useMemo(() => {
		if (!placeholderInfo) return models

		const { insertIndex, insertAfter } = placeholderInfo
		const newModels = [...models]

		// 根据 insertAfter 决定插入位置
		const actualIndex = insertAfter ? insertIndex + 1 : insertIndex

		// 在指定位置插入占位符
		newModels.splice(actualIndex, 0, {
			group_id: id,
			id: "placeholder",
			provider_model_id: "placeholder",
			model_id: "placeholder",
			model_name: "placeholder",
			model_icon: "",
			sort: insertIndex,
			model_category: AiModel.ServiceProviderCategory.LLM,
			model_status: PlatformPackage.ModeGroupModelStatus.Normal,
		})

		return newModels
	}, [models, placeholderInfo, id])

	return (
		<Flex
			ref={setNodeRef}
			vertical
			gap={4}
			className={cx(styles.group, !!placeholderInfo && styles.groupDragOver)}
			style={{ ...internalStyle, ...style }}
			{...attributes}
		>
			<Flex justify="space-between" align="center" className={styles.groupHeader}>
				<Flex gap={10} align="center">
					{handle && (
						<MagicButton
							type="text"
							size="small"
							icon={<IconGripVertical size={20} />}
							className={styles.gripIcon}
							style={{
								cursor: dragOverlay ? "grabbing" : "grab",
							}}
							{...listeners}
						/>
					)}
					<Flex gap={4} align="center">
						<MagicAvatar size={16} src={group.icon}>
							{group.name_i18n.zh_CN}
						</MagicAvatar>
						<span>{group.name_i18n.zh_CN}</span>
					</Flex>
				</Flex>
				{handle && !dragContext.isGroupSelfSort && (
					<Flex gap={10} align="center">
						<div
							className={styles.link}
							onClick={() => {
								console.log(group)
								openAddOrEditGroupModal(group)
							}}
						>
							{t("editGroup")}
						</div>
						<div
							className={cx(styles.link, styles.dangerLink)}
							onClick={() => {
								console.log(group)
								deleteGroup(group)
							}}
						>
							{t("deleteGroup")}
						</div>
					</Flex>
				)}
			</Flex>
			{!dragContext.isGroupSelfSort && !!displayModels.length && (
				<SortableContext
					items={displayModels.map((model) => model.id)}
					strategy={verticalListSortingStrategy}
				>
					{displayModels.map((model) => {
						// 渲染占位符
						if (model.id === "placeholder") {
							return <div key="placeholder" className={styles.dropZoneBg} />
						}

						if (isDynamicModel(model)) {
							return (
								<DynamicModelItem
									key={model.id}
									data={model as unknown as PlatformPackage.DynamicModel}
									handle={handle}
								/>
							)
						}

						// 渲染正常模型
						return (
							<SortableModelItem
								key={model.id}
								model={model as unknown as PlatformPackage.BaseModel}
								handle={handle}
							/>
						)
					})}
				</SortableContext>
			)}
		</Flex>
	)
}

export default GroupItem
