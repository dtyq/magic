import { useMemo } from "react"
import { Flex } from "antd"
import { WarningModal, MagicButton, MagicAvatar, MagicSelect, DangerLevel } from "components"
import { IconEdit, IconGripVertical, IconTrash } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { PlatformPackage } from "@/types/platformPackage"
import { useOpenModal } from "@/hooks/useOpenModal"
import { AiModel } from "@/const/aiModel"
import { useStyles } from "../../styles"
import { useModeConfigContext } from "../../hooks/useModeConfigContext"
import { DragType } from "../../types"
import SortableModelItem from "../SortableModelItem"

interface DynamicModelItemProps {
	handle: boolean
	data: PlatformPackage.DynamicModel
	dragOverlay?: boolean
	style?: React.CSSProperties
}

// 动态模型项组件
function DynamicModelItem({ handle, data, dragOverlay, style }: DynamicModelItemProps) {
	const { t } = useTranslation("admin/platform/mode")
	const { t: tCommon } = useTranslation("admin/common")
	const { styles, cx } = useStyles()
	const { id, model_name, model_icon, model_description, group_id, aggregate_config } = data
	const openModal = useOpenModal()

	const { setNodeRef, setActivatorNodeRef, listeners, isDragging, transform, transition } =
		useSortable({
			id,
			data: { item: data, type: DragType.SubGroup },
		})

	// 从 Context 获取删除方法
	const { dragState, deleteModel, editModel, changeModel } = useModeConfigContext()

	const models = useMemo(
		() => (dragOverlay ? [] : aggregate_config.models),
		[aggregate_config.models, dragOverlay],
	)

	const options = useMemo(
		() => [
			{
				label: t("languageModel"),
				value: AiModel.ServiceProviderCategory.LLM,
			},
			{
				label: t("imageModel"),
				value: AiModel.ServiceProviderCategory.VLM,
			},
		],
		[t],
	)

	const downgradeOptions = useMemo(
		() => [
			{
				label: t("asc"),
				value: PlatformPackage.OrderDirection.Asc,
			},
			{
				label: t("desc"),
				value: PlatformPackage.OrderDirection.Desc,
			},
		],
		[t],
	)

	// 1. 提取基础状态判断
	const dragContext = useMemo(() => {
		const {
			overId,
			activeId,
			activeType,
			activeItem,
			overType,
			isInsertMode,
			isBelowOverItem,
		} = dragState

		// 基础验证
		if (!overId || !activeId) {
			return { isValid: false }
		}

		// 类型安全的 activeItem
		const typedActiveItem = activeItem as PlatformPackage.ModelItem

		// 核心判断
		// 是否是组自身排序
		const isGroupSelfSort = activeId === id && activeType === DragType.SubGroup
		// 是否是同组内的模型排序
		const isSameGroupModelDrag = models.some((model) => model.id === activeId)
		// 是否是悬停在当前子分组上
		const isOverCurrentSubGroup = overType === DragType.SubGroup && overId === id
		// 是否是悬停在子模型上
		const isOverSubModel =
			overType === DragType.SubModel && models.some((model) => model.id === overId)
		// 是否是模型分类匹配
		const isCategoryMatched = typedActiveItem?.model_category === data.model_category

		// 是否应该跳过处理（自身排序或同组排序）
		const shouldSkip = isGroupSelfSort || isSameGroupModelDrag

		// 是否悬停在当前子分组或其子模型上
		const isOverThisGroup = isOverCurrentSubGroup || isOverSubModel

		return {
			isValid: true,
			overId,
			activeId,
			activeType,
			overType,
			isInsertMode,
			isBelowOverItem,
			typedActiveItem,
			isGroupSelfSort,
			isSameGroupModelDrag,
			isOverCurrentSubGroup,
			isOverSubModel,
			isOverThisGroup,
			isCategoryMatched,
			shouldSkip,
		}
	}, [dragState, id, models, data.model_category])

	// 判断是否应该显示"按 Shift 插入"提示
	const shouldShowInsertHint = useMemo(() => {
		if (!dragContext.isValid || dragContext.shouldSkip) return false

		// 悬停在当前子分组 + 分类匹配 + 排序模式（非插入模式）
		return (
			dragContext.isOverThisGroup &&
			dragContext.isCategoryMatched &&
			!dragContext.isInsertMode
		)
	}, [dragContext])

	// 判断是否应该显示占位符，以及占位符应该插入的位置
	const placeholderInfo = useMemo(() => {
		if (!dragContext.isValid || dragContext.shouldSkip) return null

		// 排序模式，不需要占位符
		const isModelInSortMode =
			!dragContext.isInsertMode &&
			(dragContext.activeType === DragType.Model ||
				dragContext.activeType === DragType.LeftModel)
		if (isModelInSortMode) return null

		// 拖拽项模型分类与当前分组模型分类不匹配，不需要占位符
		if (!dragContext.isCategoryMatched) return null

		// 拖拽到子分组容器（空白区域）
		if (dragContext.isOverCurrentSubGroup && dragContext.activeType !== DragType.SubGroup) {
			return { insertIndex: models.length - 1, insertAfter: true }
		}

		// 拖拽到某个模型上，根据鼠标位置判断插入前还是插入后
		const targetIndex = models.findIndex((model) => model.id === dragContext.overId)
		if (targetIndex !== -1) {
			// 根据 isBelowOverItem 判断：鼠标在下半部分则插入后面，否则插入前面
			return { insertIndex: targetIndex, insertAfter: dragContext.isBelowOverItem }
		}

		return null
	}, [dragContext, models])

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
			model_category: data.model_category,
			model_status: PlatformPackage.ModeGroupModelStatus.Normal,
		})

		return newModels
	}, [data.model_category, id, models, placeholderInfo])

	const showDowngrade = useMemo(() => {
		return (
			!dragContext.isGroupSelfSort &&
			displayModels.filter((model) => model.id !== "placeholder").length > 0
		)
	}, [dragContext.isGroupSelfSort, displayModels])

	const changeModelCategory = (value: AiModel.ServiceProviderCategory) => {
		if (models.length > 0) {
			openModal(WarningModal, {
				open: true,
				title: t("tip"),
				content: t("tipDesc"),
				showDeleteText: false,
				dangerLevel: DangerLevel.Warning,
				zIndex: 1002,
				okButtonProps: {
					danger: false,
				},
				okText: tCommon("button.confirm"),
				onOk: async () => {
					changeModel(data, {
						model_category: value,
						aggregate_config: {
							...data.aggregate_config,
							models: [],
						},
					})
				},
			})
		} else {
			changeModel(data, {
				model_category: value,
			})
		}
	}

	return (
		<Flex
			ref={setNodeRef}
			gap={8}
			vertical
			justify="center"
			className={cx(
				styles.item,
				styles.dynamicModelItem,
				isDragging && styles.draggingItem,
				!!placeholderInfo && styles.groupDragOver,
				shouldShowInsertHint && styles.groupSortHover,
			)}
			style={{
				transform: CSS.Transform.toString(transform),
				transition,
				opacity: isDragging ? 0.5 : 1,
				...style,
			}}
		>
			{/* Shift 键插入提示 */}
			{shouldShowInsertHint && (
				<div className={styles.insertHint}>
					<span className={styles.insertHintText}>⌨️ {t("pressShiftToInsert")}</span>
				</div>
			)}

			<Flex justify="space-between" align="center">
				<Flex gap={10} align="center" className={styles.nameWrapper}>
					{handle && (
						<MagicButton
							ref={setActivatorNodeRef}
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
					<MagicAvatar size={24} shape="circle" src={model_icon}>
						{model_name}
					</MagicAvatar>
					<span className={styles.name}>{model_name}</span>
					<span className={styles.desc}>{model_description}</span>
				</Flex>
				<Flex align="center" className={styles.actionWrapper}>
					<MagicSelect
						options={options}
						defaultValue={data.model_category}
						className={styles.select}
						onChange={changeModelCategory}
					/>
					<MagicButton
						icon={<IconEdit size={18} />}
						type="text"
						onClick={() => editModel(data)}
					/>
					<MagicButton
						icon={<IconTrash size={18} />}
						danger
						type="text"
						onClick={() => deleteModel(group_id, id)}
					/>
				</Flex>
			</Flex>

			{!dragContext.isGroupSelfSort && !!displayModels.length && (
				<SortableContext items={displayModels} strategy={verticalListSortingStrategy}>
					<Flex gap={4} vertical>
						{displayModels.map((model) => {
							// 渲染占位符
							if (model.id === "placeholder") {
								return <div key="placeholder" className={styles.dropZoneBg} />
							}
							// 渲染正常模型
							return (
								<SortableModelItem
									key={model.id}
									model={model}
									handle={handle}
									modelType={DragType.SubModel}
									parentData={data}
								/>
							)
						})}
					</Flex>
				</SortableContext>
			)}
			{showDowngrade && (
				<Flex justify="space-between" align="center" gap={10}>
					<Flex vertical>
						<span className={styles.downgrade}>{t("downgrade")}</span>
						<span className={styles.desc}>{t("downgradeDesc")}</span>
					</Flex>
					<MagicSelect
						options={downgradeOptions}
						defaultValue={data.aggregate_config.strategy_config?.order}
						style={{ width: 240 }}
						onChange={(value) => {
							changeModel(data, {
								aggregate_config: {
									...data.aggregate_config,
									strategy_config: { order: value },
								},
							})
						}}
					/>
				</Flex>
			)}
		</Flex>
	)
}

export default DynamicModelItem
