import type {
	DragEndEvent,
	DragOverEvent,
	DragStartEvent,
	DragMoveEvent,
	Active,
	Over,
} from "@dnd-kit/core"
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { useMemoizedFn } from "ahooks"
import { useRef } from "react"
import { arrayMove } from "@dnd-kit/sortable"
import { useImmer } from "use-immer"
import { useTranslation } from "react-i18next"
import { message } from "antd"
import { PlatformPackage } from "@/types/platformPackage"
import type { AiManage } from "@/types/aiManage"
import type { DragState, GroupItem as GroupItemType } from "../types"
import { defaultDragState, DragType } from "../types"
import {
	mapToList,
	isDynamicModel,
	calculateIsBelowOverItem,
	createBaseModel,
	createDynamicModel,
} from "../utils"
import { useContainerCache } from "./useDragCache"
import { useCollisionDetection } from "./useCollisionDetection"

interface UseDragHandlerProps {
	/* 分组列表 */
	groupList: Map<string, GroupItemType>
	/* 更新分组列表 */
	setGroupList: React.Dispatch<React.SetStateAction<Map<string, GroupItemType>>>
	/* 模式详情 */
	setModeDetail: React.Dispatch<React.SetStateAction<PlatformPackage.ModeDetail | null>>
}

const useDragHandler = ({ groupList, setGroupList, setModeDetail }: UseDragHandlerProps) => {
	const { t } = useTranslation("admin/platform/mode")
	const [dragState, setDragState] = useImmer<DragState>(defaultDragState) // 拖拽状态管理

	const recentlyMovedToNewContainer = useRef(false)

	// 容器缓存
	const { containerMap, subGroupCache, findContainer } = useContainerCache(groupList)

	// 碰撞检测
	const { collisionDetectionStrategy } = useCollisionDetection({
		groupList,
		subGroupCache,
		containerMap,
		dragState,
		recentlyMovedToNewContainer,
		setDragState,
	})

	// === 通用函数 start ===
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 4,
			},
		}),
	)

	// 通用的分组更新函数 - 统一更新入口
	const updateGroupList = useMemoizedFn(
		(updater: (draft: Map<string, GroupItemType>) => void) => {
			const newGroupList = new Map(groupList)
			updater(newGroupList)
			setGroupList(newGroupList)
			setModeDetail((prev) => {
				if (!prev) return prev
				return {
					...prev,
					groups: mapToList(newGroupList),
				}
			})
		},
	)

	// === 通用函数 end ===

	// === 排序操作 start ===

	// 处理左侧模型拖拽到右侧动态模型分组
	const handleLeftModelToDynamicGroup = useMemoizedFn(
		({
			subGroup,
			subGroupId,
			overId,
			overContainer,
		}: {
			subGroup: PlatformPackage.DynamicModel
			subGroupId: string
			overId: string
			overContainer: string
		}) => {
			const draggedModel = dragState.activeItem as AiManage.ModelInfo
			if (!draggedModel) return

			// 动态模型分组不可嵌套动态模型分组
			if (draggedModel.id === PlatformPackage.ModelType.Dynamic) {
				message.error(t("dynamicModelError"))
				return
			}

			const subModels = [...(subGroup.aggregate_config.models || [])]
			if (subModels.some((model) => model.model_id === draggedModel.model_id)) {
				message.error(t("modelAlreadyExists"))
				return
			}

			if (draggedModel.category !== subGroup.model_category) {
				message.error(t("modelCategoryError"))
				return
			}

			updateGroupList((draft) => {
				const overGroup = draft.get(overContainer)
				if (!overGroup) return

				// 创建数组副本，避免修改不可扩展的对象
				const dynamicModels = [...(subGroup.aggregate_config.models || [])]

				// 查找 overId 在子分组中的位置
				const targetIndex = dynamicModels.findIndex((model) => model.id === overId)
				let insertIndex = dynamicModels.length

				if (targetIndex !== -1) {
					// overId 是子分组里的模型，根据 isBelowOverItem 判断插入位置
					insertIndex = dragState.isBelowOverItem ? targetIndex + 1 : targetIndex
				}
				// 如果 targetIndex === -1，说明 overId 是子分组容器本身，插入到最后
				const newModel = createBaseModel(draggedModel, insertIndex, overContainer)

				dynamicModels.splice(insertIndex, 0, newModel)

				// 更新子分组模型
				const updatedModels = new Map(overGroup.models)
				updatedModels.set(subGroupId, {
					...subGroup,
					aggregate_config: {
						...subGroup.aggregate_config,
						models: dynamicModels.map((model, index) => ({
							...model,
							sort: index,
						})),
					},
				})

				draft.set(overContainer, { ...overGroup, models: updatedModels })
			})
		},
	)

	// 处理左侧模型拖拽右侧分组
	const handleLeftModelToGroup = useMemoizedFn(
		({ overId, overContainer }: { overId: string; overContainer: string }) => {
			const draggedModel = dragState.activeItem as AiManage.ModelInfo
			if (!draggedModel) return

			// 排除动态模型，检查拖拽的模型是否已经在分组中存在（排除子分组中的模型）
			if (draggedModel.id !== PlatformPackage.ModelType.Dynamic) {
				const existingModel = Array.from(groupList.values()).find((groupItem) => {
					return Array.from(groupItem.models.values()).some((model) => {
						// 排除子分组（动态模型）
						if (isDynamicModel(model)) return false
						// 检查 model_id 和 provider_model_id 是否相同
						return model.model_id === draggedModel.model_id
					})
				})

				if (existingModel) {
					message.error(t("modelAlreadyExists"))
					return
				}
			}

			updateGroupList((draft) => {
				const overGroup = draft.get(overContainer)
				if (!overGroup) return

				// 目标项是普通模型
				const overModels = Array.from(overGroup.models.values())
				// 计算插入位置
				let insertIndex = overModels.length
				if (!groupList.has(overId)) {
					const overIndex = overModels.findIndex((m) => m.id === overId)

					if (overIndex !== -1) {
						console.log("overIndex", overIndex, dragState.isBelowOverItem)
						insertIndex = dragState.isBelowOverItem ? overIndex + 1 : overIndex
					}
				}

				let newModel: PlatformPackage.ModelItem | null = null
				// 动态模型
				if (draggedModel.id === PlatformPackage.ModelType.Dynamic) {
					newModel = createDynamicModel(draggedModel, insertIndex, overContainer)
				} else {
					// 创建新模型并插入
					newModel = createBaseModel(draggedModel, insertIndex, overContainer)
				}

				overModels.splice(insertIndex, 0, newModel)

				// 重新索引并更新
				const updatedModels = new Map(
					overModels.map((model, index) => [model.id, { ...model, sort: index }]),
				)

				draft.set(overContainer, { ...overGroup, models: updatedModels })
			})
		},
	)

	// 处理左侧模型拖拽到右侧
	const handleLeftModelDrop = useMemoizedFn((over: Over) => {
		const overId = over.id as string
		const overType = over.data.current?.type
		const overParentData = over.data.current?.parentData

		let overContainer: string | undefined

		// 目标项是否是某个子分组中的模型
		if (overType === DragType.SubModel && overParentData) {
			overContainer = findContainer(overParentData.id)
		} else {
			overContainer = findContainer(overId)
		}

		if (!overContainer) return

		// 找到对应的分组容器
		const overGroup = groupList.get(overContainer)

		if (!overGroup) return

		// 处理子分组相关的情况：overId 是子分组里的模型，还是子分组容器本身
		let targetSubGroup: PlatformPackage.DynamicModel | undefined
		let targetSubGroupId: string | undefined

		// 目标项是子分组里的模型
		if (overType === DragType.SubModel) {
			targetSubGroup = overParentData
			targetSubGroupId = overParentData.id
		} else {
			// 目标项是否是子分组容器本身
			const subGroup = overGroup.models.get(overId)
			if (overType === DragType.SubGroup && isDynamicModel(subGroup)) {
				targetSubGroup = subGroup as PlatformPackage.DynamicModel
				targetSubGroupId = overId
			}
		}

		// 场景1: 目标是子分组或是子分组中的模型
		if (targetSubGroup && targetSubGroupId && dragState.isInsertMode) {
			handleLeftModelToDynamicGroup({
				subGroup: targetSubGroup,
				subGroupId: targetSubGroupId,
				overId,
				overContainer,
			})
			return
		}

		// 场景2: 目标项是分组中的模型
		if (overType !== DragType.SubModel) {
			handleLeftModelToGroup({ overId, overContainer })
		}
	})

	// 处理分组排序
	const handleGroupSort = useMemoizedFn((activeId: string, overId: string) => {
		if (activeId === overId) return

		updateGroupList((draft) => {
			const entries = Array.from(draft.entries())
			const activeIndex = entries.findIndex(([key]) => key === activeId)
			const overIndex = entries.findIndex(([key]) => key === overId)
			if (activeIndex === -1 || overIndex === -1) return

			const moved = arrayMove(entries, activeIndex, overIndex)
			draft.clear()
			moved.forEach(([key, value]) => draft.set(key, value))
		})
	})

	// 处理同组内模型排序
	const handleModelSort = useMemoizedFn(
		(activeId: string, overId: string, activeContainer: string) => {
			updateGroupList((draft) => {
				const group = draft.get(activeContainer)
				if (!group) return

				const modelsArray = Array.from(group.models.values())
				const activeIndex = modelsArray.findIndex((m) => m.id === activeId)
				const overIndex = modelsArray.findIndex((m) => m.id === overId)

				if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return

				const updatedModels = new Map(
					arrayMove(modelsArray, activeIndex, overIndex).map((model) => [
						model.id,
						model,
					]),
				)

				draft.set(activeContainer, { ...group, models: updatedModels })
			})
		},
	)

	// 处理同一子分组内模型排序
	const handleSubModelSort = useMemoizedFn(
		(
			activeId: string,
			overId: string,
			subGroup: PlatformPackage.DynamicModel,
			groupId: string,
		) => {
			updateGroupList((draft) => {
				const group = draft.get(groupId)
				if (!group) return

				// 创建数组副本
				const dynamicModels = [...(subGroup.aggregate_config.models || [])]
				const activeIndex = dynamicModels.findIndex((m) => m.id === activeId)
				const overIndex = dynamicModels.findIndex((m) => m.id === overId)
				if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return

				const updatedDynamicModels = arrayMove(dynamicModels, activeIndex, overIndex).map(
					(model, index) => ({
						...model,
						sort: index,
					}),
				)

				// 更新子分组
				const updatedModels = new Map(group.models)
				updatedModels.set(subGroup.id, {
					...subGroup,
					aggregate_config: {
						...subGroup.aggregate_config,
						models: updatedDynamicModels,
					},
				})

				draft.set(groupId, { ...group, models: updatedModels })
			})
		},
	)

	// === 混合排序场景函数 start ===

	// 场景1: 子模型移动到分组内（变成普通模型）
	const handleSubModelToGroup = useMemoizedFn(
		({
			draft,
			group,
			groupId,
			activeId,
			overId,
			activeParentData,
			updatedGroupModels,
		}: {
			draft: Map<string, GroupItemType>
			group: GroupItemType
			groupId: string
			activeId: string
			overId: string
			activeParentData: PlatformPackage.DynamicModel
			updatedGroupModels: Map<string, PlatformPackage.ModelItem>
		}) => {
			// console.log("子模型移动到分组内（变成普通模型）", activeId, overId)
			const activeModel = dragState.activeItem as PlatformPackage.ModelItem
			if (!activeModel) return

			// 从子分组中移除 active 模型
			const updatedActiveSubGroup: PlatformPackage.DynamicModel = {
				...activeParentData,
				aggregate_config: {
					...activeParentData.aggregate_config,
					models: (activeParentData.aggregate_config.models || []).filter(
						(m) => m.id !== activeId,
					),
				},
			}
			updatedGroupModels.set(activeParentData.id, updatedActiveSubGroup)

			// 将 active 模型作为普通模型添加到分组中
			const newModel = {
				...activeModel,
				group_id: groupId,
			} as PlatformPackage.ModelItem

			// 计算插入位置
			const groupModelsArray = Array.from(updatedGroupModels.values())
			let insertIndex = groupModelsArray.findIndex((m) => m.id === overId)
			if (insertIndex !== -1 && dragState.isBelowOverItem) insertIndex += 1
			if (insertIndex === -1) insertIndex = groupModelsArray.length

			// 插入新模型并重新索引
			groupModelsArray.splice(insertIndex, 0, newModel)
			const newGroupModels = new Map<string, PlatformPackage.ModelItem>()

			groupModelsArray.forEach((model, index) => {
				newGroupModels.set(model.id, {
					...model,
					sort: index,
				})
			})

			draft.set(groupId, { ...group, models: newGroupModels })
		},
	)

	// 场景2: 子模型移动到不同子分组的特定位置
	const handleSubModelToSubModel = useMemoizedFn(
		({
			draft,
			group,
			groupId,
			activeId,
			overId,
			activeParentData,
			overParentData,
			updatedGroupModels,
		}: {
			draft: Map<string, GroupItemType>
			group: GroupItemType
			groupId: string
			activeId: string
			overId: string
			activeParentData: PlatformPackage.DynamicModel
			overParentData: PlatformPackage.DynamicModel
			updatedGroupModels: Map<string, PlatformPackage.ModelItem>
		}) => {
			const activeItem = dragState.activeItem as PlatformPackage.ModelItem
			if (!activeItem) return

			// 检查模型分类是否相同
			if (activeItem.model_category !== overParentData.model_category) {
				message.error(t("modelCategoryError"))
				return
			}

			// 从源子分组中移除
			const sourceSubModels = [...(activeParentData.aggregate_config.models || [])]
			const activeIndex = sourceSubModels.findIndex((m) => m.id === activeId)
			if (activeIndex === -1) return

			const movedModel = sourceSubModels[activeIndex]
			sourceSubModels.splice(activeIndex, 1)

			const updatedActiveSubGroup: PlatformPackage.DynamicModel = {
				...activeParentData,
				aggregate_config: {
					...activeParentData.aggregate_config,
					models: sourceSubModels.map((m, idx) => ({
						...m,
						sort: idx,
					})),
				},
			}
			updatedGroupModels.set(activeParentData.id, updatedActiveSubGroup)

			// 添加到目标子分组
			const targetSubModels = [...(overParentData.aggregate_config.models || [])]
			const overIndex = targetSubModels.findIndex((m) => m.id === overId)

			let insertIndex = 0
			if (overIndex !== -1) {
				insertIndex = dragState.isBelowOverItem ? overIndex + 1 : overIndex
			}

			const newSubModel: PlatformPackage.BaseModel = {
				...movedModel,
				group_id: overParentData.id,
				sort: insertIndex,
			}

			targetSubModels.splice(insertIndex, 0, newSubModel)

			const updatedOverSubGroup: PlatformPackage.DynamicModel = {
				...overParentData,
				aggregate_config: {
					...overParentData.aggregate_config,
					models: targetSubModels.map((m, idx) => ({
						...m,
						sort: idx,
					})),
				},
			}
			updatedGroupModels.set(overParentData.id, updatedOverSubGroup)

			draft.set(groupId, { ...group, models: updatedGroupModels })
		},
	)

	// 场景3: 子模型移动到不同子分组容器（放到末尾）
	const handleSubModelToSubGroup = useMemoizedFn(
		({
			draft,
			group,
			groupId,
			activeId,
			overId,
			activeParentData,
			updatedGroupModels,
		}: {
			draft: Map<string, GroupItemType>
			group: GroupItemType
			groupId: string
			activeId: string
			overId: string
			activeParentData: PlatformPackage.DynamicModel
			updatedGroupModels: Map<string, PlatformPackage.ModelItem>
		}) => {
			const activeModel = dragState.activeItem as PlatformPackage.ModelItem
			if (!activeModel) return

			// 添加到目标子分组容器（作为最后一个子模型）
			const targetSubGroup = updatedGroupModels.get(overId) as
				| PlatformPackage.DynamicModel
				| undefined
			if (!targetSubGroup || !isDynamicModel(targetSubGroup)) return

			// 检查模型分类是否相同
			if (activeModel.model_category !== targetSubGroup.model_category) {
				message.error(t("modelCategoryError"))
				return
			}

			// 从源子分组中移除
			const sourceSubModels = [...(activeParentData.aggregate_config.models || [])]
			const activeIndex = sourceSubModels.findIndex((m) => m.id === activeId)
			if (activeIndex === -1) return

			const movedModel = sourceSubModels[activeIndex]
			sourceSubModels.splice(activeIndex, 1)

			const updatedActiveSubGroup: PlatformPackage.DynamicModel = {
				...activeParentData,
				aggregate_config: {
					...activeParentData.aggregate_config,
					models: sourceSubModels.map((m, idx) => ({
						...m,
						sort: idx,
					})),
				},
			}
			updatedGroupModels.set(activeParentData.id, updatedActiveSubGroup)

			const targetSubModels = [...(targetSubGroup.aggregate_config.models || [])]
			const newSubModel: PlatformPackage.BaseModel = {
				...movedModel,
				group_id: overId,
				sort: targetSubModels.length,
			}

			targetSubModels.push(newSubModel)

			const updatedOverSubGroup: PlatformPackage.DynamicModel = {
				...targetSubGroup,
				aggregate_config: {
					...targetSubGroup.aggregate_config,
					models: targetSubModels.map((m, idx) => ({
						...m,
						sort: idx,
					})),
				},
			}
			updatedGroupModels.set(overId, updatedOverSubGroup)

			draft.set(groupId, { ...group, models: updatedGroupModels })
		},
	)

	// 场景4: 普通模型移动到子分组内的特定位置
	const handleModelToSubModel = useMemoizedFn(
		({
			draft,
			group,
			groupId,
			activeId,
			overId,
			overParentData,
			updatedGroupModels,
		}: {
			draft: Map<string, GroupItemType>
			group: GroupItemType
			groupId: string
			activeId: string
			overId: string
			overParentData: PlatformPackage.DynamicModel
			updatedGroupModels: Map<string, PlatformPackage.ModelItem>
		}) => {
			const activeModel = dragState.activeItem as PlatformPackage.ModelItem
			if (!activeModel) return

			// 检查模型分类是否相同
			if (activeModel.model_category !== overParentData.model_category) {
				message.error(t("modelCategoryError"))
				return
			}

			// 从分组中移除 active 模型
			updatedGroupModels.delete(activeId)

			// 将 active 模型添加到目标子分组中
			const subModels = [...(overParentData.aggregate_config.models || [])]
			const overModelIndex = subModels.findIndex((m) => m.id === overId)

			let insertIndex = 0
			if (overModelIndex !== -1) {
				insertIndex = dragState.isBelowOverItem ? overModelIndex + 1 : overModelIndex
			}

			const newSubModel: PlatformPackage.BaseModel = {
				...activeModel,
				group_id: overParentData.id,
				sort: insertIndex,
			} as PlatformPackage.BaseModel

			subModels.splice(insertIndex, 0, newSubModel)

			// 重新索引子模型
			const reindexedSubModels = subModels.map((m, idx) => ({
				...m,
				sort: idx,
			}))

			const updatedOverSubGroup: PlatformPackage.DynamicModel = {
				...overParentData,
				aggregate_config: {
					...overParentData.aggregate_config,
					models: reindexedSubModels,
				},
			}

			updatedGroupModels.set(overParentData.id, updatedOverSubGroup)

			const finalModels = new Map<string, PlatformPackage.ModelItem>()
			Array.from(updatedGroupModels.values()).forEach((model, index) => {
				finalModels.set(model.id, { ...model, sort: index })
			})

			draft.set(groupId, { ...group, models: finalModels })
		},
	)

	// 场景5: 普通模型移动到子分组容器（放到末尾）
	const handleModelToSubGroup = useMemoizedFn(
		({
			draft,
			group,
			groupId,
			activeId,
			overId,
			updatedGroupModels,
		}: {
			draft: Map<string, GroupItemType>
			group: GroupItemType
			groupId: string
			activeId: string
			overId: string
			updatedGroupModels: Map<string, PlatformPackage.ModelItem>
		}) => {
			const activeModel = dragState.activeItem as PlatformPackage.ModelItem
			if (!activeModel) return

			// 获取目标子分组（就是 over 本身）
			const overSubGroupData = updatedGroupModels.get(overId) as
				| PlatformPackage.DynamicModel
				| undefined

			if (!overSubGroupData || !isDynamicModel(overSubGroupData)) return

			// 检查模型分类是否相同
			if (activeModel.model_category !== overSubGroupData.model_category) {
				message.error(t("modelCategoryError"))
				return
			}

			// 从分组中移除 active 模型
			updatedGroupModels.delete(activeId)

			// 将 active 模型添加到目标子分组中
			const subModels = [...(overSubGroupData.aggregate_config.models || [])]

			const newSubModel: PlatformPackage.BaseModel = {
				...activeModel,
				group_id: overId,
				sort: subModels.length,
			} as PlatformPackage.BaseModel

			subModels.push(newSubModel)

			// 重新索引子模型
			const reindexedSubModels = subModels.map((m, idx) => ({
				...m,
				sort: idx,
			}))

			const updatedOverSubGroup: PlatformPackage.DynamicModel = {
				...overSubGroupData,
				aggregate_config: {
					...overSubGroupData.aggregate_config,
					models: reindexedSubModels,
				},
			}

			updatedGroupModels.set(overId, updatedOverSubGroup)

			// 重新索引分组中的普通模型
			const finalModels = new Map<string, PlatformPackage.ModelItem>()
			Array.from(updatedGroupModels.values()).forEach((model, index) => {
				finalModels.set(model.id, { ...model, sort: index })
			})

			draft.set(groupId, { ...group, models: finalModels })
		},
	)

	// 处理混合排序：子分组内模型与分组内模型/子分组的排序
	const handleMixedSort = useMemoizedFn(
		({ active, over, groupId }: { active: Active; over: Over; groupId: string }) => {
			// console.log("混合排序", active, over, groupId)
			const activeId = active.id as string
			const overId = over.id as string
			const activeType = active.data.current?.type as DragType
			const overType = over.data.current?.type as DragType
			const activeParentData = active.data.current?.parentData as
				| PlatformPackage.DynamicModel
				| undefined
			const overParentData = over.data.current?.parentData as
				| PlatformPackage.DynamicModel
				| undefined

			updateGroupList((draft) => {
				const group = draft.get(groupId)
				if (!group) return

				// 克隆分组数据，用于更新
				const updatedGroupModels = new Map(group.models)

				// 场景1: 子模型移动到分组内（变成普通模型）
				if (
					activeType === DragType.SubModel &&
					overType !== DragType.SubModel
					// && overType !== DragType.SubGroup
				) {
					if (!activeParentData) return
					handleSubModelToGroup({
						draft,
						group,
						groupId,
						activeId,
						overId,
						activeParentData,
						updatedGroupModels,
					})
					return
				}

				// 场景2: 子模型移动到不同子分组子模型附近
				if (
					activeType === DragType.SubModel &&
					overType === DragType.SubModel &&
					activeParentData &&
					overParentData &&
					activeParentData.id !== overParentData.id
				) {
					handleSubModelToSubModel({
						draft,
						group,
						groupId,
						activeId,
						overId,
						activeParentData,
						overParentData,
						updatedGroupModels,
					})
					return
				}

				// 场景3: 子模型移动到不同子分组容器（同一父分组内）
				if (
					activeType === DragType.SubModel &&
					overType === DragType.SubGroup &&
					activeParentData &&
					activeParentData.id !== overId
				) {
					handleSubModelToSubGroup({
						draft,
						group,
						groupId,
						activeId,
						overId,
						activeParentData,
						updatedGroupModels,
					})
					return
				}

				// 场景4: 普通模型移动到子分组内, 特定位置
				if (activeType === DragType.Model && overType === DragType.SubModel) {
					if (!overParentData) return
					handleModelToSubModel({
						draft,
						group,
						groupId,
						activeId,
						overId,
						overParentData,
						updatedGroupModels,
					})
					return
				}

				// 场景5: 普通模型移动到子分组容器（变成子分组的第一个子模型）
				if (activeType === DragType.Model && overType === DragType.SubGroup) {
					handleModelToSubGroup({
						draft,
						group,
						groupId,
						activeId,
						overId,
						updatedGroupModels,
					})
				}
			})
		},
	)

	// === 混合排序场景函数 end ===

	// === 模型跨分组排序场景函数 start ===

	/** 场景1: 从子分组中移除模型, 返回被移除的模型 */
	const removeModelFromSubGroup = useMemoizedFn(
		({
			draft,
			activeId,
			activeContainer,
			activeParentData,
		}): PlatformPackage.BaseModel | null => {
			const activeGroup = draft.get(activeContainer)
			if (!activeGroup) return null

			const subModels = [...(activeParentData.aggregate_config.models || [])]
			const activeIndex = subModels.findIndex((m) => m.id === activeId)
			if (activeIndex === -1) return null

			const activeModel = subModels[activeIndex]
			subModels.splice(activeIndex, 1)

			// 重新索引子模型
			const reindexedSubModels = subModels.map((m, idx) => ({
				...m,
				sort: idx,
			}))

			const updatedParentSubGroup: PlatformPackage.DynamicModel = {
				...activeParentData,
				aggregate_config: {
					...activeParentData.aggregate_config,
					models: reindexedSubModels,
				},
			}

			const newActiveModels = new Map(activeGroup.models)
			newActiveModels.set(activeParentData.id, updatedParentSubGroup)
			draft.set(activeContainer, { ...activeGroup, models: newActiveModels })

			return activeModel
		},
	)

	/**  场景2: 从顶层分组中移除模型, 返回被移除的模型 */
	const removeModelFromTopLevel = useMemoizedFn(
		({ draft, activeId, activeContainer }): PlatformPackage.BaseModel | null => {
			const activeGroup = draft.get(activeContainer)
			if (!activeGroup) return null

			const activeModel = activeGroup.models.get(activeId) as PlatformPackage.BaseModel
			if (!activeModel) return null

			const newActiveModels = new Map(activeGroup.models)
			newActiveModels.delete(activeId)
			draft.set(activeContainer, { ...activeGroup, models: newActiveModels })

			return activeModel
		},
	)

	// 场景3: 插入模型到子分组容器（作为最后一个子模型）
	const insertModelToSubGroupContainer = useMemoizedFn(
		({ draft, activeModel, overId, overContainer, overSubGroup }) => {
			const overGroup = draft.get(overContainer)
			if (!overGroup) return

			const subModels = [...(overSubGroup.aggregate_config.models || [])]
			const newSubModel: PlatformPackage.BaseModel = {
				...activeModel,
				group_id: overId,
				sort: subModels.length,
			}
			subModels.push(newSubModel)

			const reindexedSubModels = subModels.map((m, idx) => ({
				...m,
				sort: idx,
			}))

			const updatedOverSubGroup: PlatformPackage.DynamicModel = {
				...overSubGroup,
				aggregate_config: {
					...overSubGroup.aggregate_config,
					models: reindexedSubModels,
				},
			}

			const newOverModels = new Map(overGroup.models)
			newOverModels.set(overId, updatedOverSubGroup)
			draft.set(overContainer, { ...overGroup, models: newOverModels })
		},
	)

	// 场景4: 插入模型到子分组中的指定位置
	const insertModelToSubGroupPosition = useMemoizedFn(
		({ draft, activeModel, overContainer, overParentData, active, over }) => {
			const overId = over.id as string
			const overGroup = draft.get(overContainer)
			if (!overGroup) return

			const subModels = [...(overParentData.aggregate_config.models || [])]
			const overIndex = subModels.findIndex((m) => m.id === overId)

			if (overIndex === -1) return

			const isBelow = calculateIsBelowOverItem(active, over)
			const insertIndex = overIndex + (isBelow ? 1 : 0)

			const newSubModel: PlatformPackage.BaseModel = {
				...activeModel,
				group_id: overParentData.id,
				sort: insertIndex,
			}

			subModels.splice(insertIndex, 0, newSubModel)

			const reindexedSubModels = subModels.map((m, idx) => ({
				...m,
				sort: idx,
			}))

			const updatedParentSubGroup: PlatformPackage.DynamicModel = {
				...overParentData,
				aggregate_config: {
					...overParentData.aggregate_config,
					models: reindexedSubModels,
				},
			}

			const newOverModels = new Map(overGroup.models)
			newOverModels.set(overParentData.id, updatedParentSubGroup)
			draft.set(overContainer, { ...overGroup, models: newOverModels })
		},
	)

	// 场景5: 插入模型到顶层分组
	const insertModelToTopLevel = useMemoizedFn(
		({
			draft,
			activeModel,
			over,
			active,
			overContainer,
		}: {
			draft: Map<string, GroupItemType>
			activeModel: PlatformPackage.BaseModel
			over: Over
			active: Active
			overContainer: string
		}) => {
			const overId = over.id as string
			const overGroup = draft.get(overContainer)
			if (!overGroup) return

			const overModels = Array.from(overGroup.models.values())
			const overIndex = overModels.findIndex((m) => m.id === overId)

			const isBelow = calculateIsBelowOverItem(active, over)
			const modifier = isBelow ? 1 : 0
			const newIndex = overIndex >= 0 ? overIndex + modifier : overModels.length + 1

			const newOverModels = new Map<string, PlatformPackage.ModelItem>()
			const overModelsArr = [...overModels]

			const insertModel: PlatformPackage.ModelItem = {
				...activeModel,
				group_id: overContainer,
				sort: newIndex,
			}

			overModelsArr.splice(newIndex, 0, insertModel)

			// 重新索引所有模型
			overModelsArr.forEach((m, idx) => {
				newOverModels.set(m.id, { ...m, sort: idx })
			})

			draft.set(overContainer, { ...overGroup, models: newOverModels })
		},
	)

	// 模型跨分组排序（支持嵌套子分组）
	const handleModelCrossGroupSort = useMemoizedFn(
		({
			active,
			over,
			activeContainer,
			overContainer,
		}: {
			active: Active
			over: Over
			activeContainer: string
			overContainer: string
		}) => {
			// console.log("模型跨分组排序", active, over, activeContainer, overContainer)
			// const activeModel = dragState.activeItem as PlatformPackage.ModelItem
			// if (!activeModel) return

			const activeId = active.id as string
			const overId = over.id as string
			const activeType = active.data.current?.type as DragType
			const overType = over.data.current?.type as DragType
			const activeParentData = active.data.current?.parentData
			const overParentData = over.data.current?.parentData

			const activeGroup = groupList.get(activeContainer)
			const overGroup = groupList.get(overContainer)

			if (!activeGroup || !overGroup) return

			if (activeType === DragType.SubGroup && overType === DragType.SubGroup) {
				message.error(t("dynamicModelError"))
				return
			}

			// 判断 active 和 over 的位置（顶层分组还是子分组）
			const activeIsInSubGroup = activeType === DragType.SubModel && activeParentData
			const overIsInSubGroup = overType === DragType.SubModel && overParentData
			const overIsSubGroup = overType === DragType.SubGroup

			recentlyMovedToNewContainer.current = true

			updateGroupList((draft) => {
				// Step 1: 从源位置移除 activeModel
				const activeModel = activeIsInSubGroup
					? removeModelFromSubGroup({
							draft,
							activeId,
							activeContainer,
							activeParentData,
						})
					: removeModelFromTopLevel({
							draft,
							activeId,
							activeContainer,
						})

				if (!activeModel) return

				// Step 2: 插入到目标位置,
				if (overIsSubGroup) {
					// 获取目标子分组
					const overSubGroup = over.data.current?.item as PlatformPackage.DynamicModel
					if (!overSubGroup) return

					if (activeModel.model_category === overSubGroup.model_category) {
						// 场景1: 插入到子分组容器（作为子分组的最后一个子模型）, 模型分类相同
						insertModelToSubGroupContainer({
							draft,
							activeModel,
							overId,
							overContainer,
							overSubGroup,
						})
						return
					}
				}
				if (
					overIsInSubGroup &&
					activeModel.model_category === overParentData.model_category
				) {
					// 场景2: 插入到子分组中的某个子模型位置, 模型分类相同
					insertModelToSubGroupPosition({
						draft,
						activeModel,
						overContainer,
						overParentData,
						active,
						over,
					})
					return
				}

				// 场景3: 插入到顶层分组中
				insertModelToTopLevel({ draft, activeModel, overContainer, active, over })
			})
		},
	)

	// === 模型跨分组排序场景函数 end ===

	// === 排序操作 end ===

	// === 拖拽状态操作 start ===

	// 拖拽开始
	const handleDragStart = useMemoizedFn((event: DragStartEvent) => {
		const { active } = event
		const activeData = active.data.current
		const activeType = activeData?.type as DragType
		const activeItem = activeData?.item

		setDragState((draft) => {
			draft.activeId = String(active.id)
			draft.activeType = activeType
			draft.activeItem = activeItem
		})
	})

	// 拖拽移动中 - 实时更新位置状态
	const handleDragMove = useMemoizedFn((event: DragMoveEvent) => {
		const { active, over } = event
		if (!over) return

		const activeType = active.data.current?.type

		// 活动项不是左侧模型或子模型或模型 ，则不进行计算
		if (![DragType.LeftModel, DragType.SubModel, DragType.Model].includes(activeType)) return

		const isBelowOverItem = calculateIsBelowOverItem(active, over)

		// console.log("move isBelowOverItem", isBelowOverItem, over.data.current?.item)
		// 只更新 isBelowOverItem
		setDragState((draft) => {
			draft.isBelowOverItem = isBelowOverItem
		})
	})

	// 拖拽过程中
	const handleDragOver = useMemoizedFn((event: DragOverEvent) => {
		const { active, over } = event
		if (!over) return

		const activeId = active.id as string
		const activeType = active.data.current?.type
		const overId = over.id as string
		const overType = over.data.current?.type
		const overItem = over.data.current?.item
		const overContainer = findContainer(overId)

		// 活动项是分组项, 则不进行后续操作
		if (activeType === DragType.Group || groupList.has(activeId)) {
			setDragState((draft) => {
				draft.overId = null
				draft.overGroupId = null
				draft.overType = null
				draft.isBelowOverItem = false
				draft.overItem = null
			})
			return
		}

		setDragState((draft) => {
			draft.overId = overId
			draft.overType = overType
			draft.overGroupId = overContainer || null
			draft.overItem = overItem
		})

		// 左侧模型 或 子模型拖拽 - 只更新拖拽状态位置，用于显示占位符
		if ([DragType.LeftModel, DragType.SubModel, DragType.Model].includes(activeType)) {
			const isBelowOverItem = calculateIsBelowOverItem(active, over)

			// console.log("move isBelowOverItem", isBelowOverItem, over.data.current?.item.model_name)
			// 当 overId 变化时，同步更新 isBelowOverItem，避免闪烁
			setDragState((draft) => {
				draft.isBelowOverItem = isBelowOverItem
			})

			if (activeType === DragType.LeftModel) return
		}

		const activeContainer = findContainer(activeId)

		if (!overContainer || !activeContainer) return

		// 跨组排序
		if (activeContainer !== overContainer) {
			handleModelCrossGroupSort({
				active,
				over,
				activeContainer,
				overContainer,
			})
		}
	})

	// 拖拽结束
	const handleDragEnd = useMemoizedFn(({ active, over }: DragEndEvent) => {
		// 重置拖拽状态
		setDragState(defaultDragState)
		recentlyMovedToNewContainer.current = false

		if (!over) return

		const overId = over.id as string
		const activeId = active.id as string
		const activeType = active.data.current?.type
		const overType = over.data.current?.type
		const activeParentData = active.data.current?.parentData
		const overParentData = over.data.current?.parentData

		// 场景2：分组排序
		if (activeType === DragType.Group && overType === DragType.Group) {
			// console.log("分组排序")
			handleGroupSort(activeId, overId)
			return
		}

		// 场景2：处理左侧模型拖拽到右侧
		if (activeType === DragType.LeftModel) {
			// console.log("左侧模型拖拽到右侧", over)
			handleLeftModelDrop(over)
			return
		}

		// 场景3: 同组内模型排序
		const activeContainer = findContainer(activeId)
		const overContainer = findContainer(overId)

		if (!activeContainer || !overContainer) return

		// 同组内模型排序
		if (activeContainer === overContainer) {
			// console.log("同组内模型排序", activeContainer, overContainer, activeType, overType)

			// 子分组不能嵌套子分组
			// if (
			// 	activeType === DragType.SubGroup &&
			// 	(overType === DragType.SubGroup || overType === DragType.SubModel)
			// ) {
			// 	console.log("子分组不能嵌套子分组", overType)
			// 	message.error(t("dynamicModelError"))
			// 	return
			// }

			// 场景1：同一子分组内模型之间的排序
			if (
				activeType === DragType.SubModel &&
				overType === DragType.SubModel &&
				activeParentData.id === overParentData.id
			) {
				// console.log("同一子分组内模型排序", activeParentData.id)
				handleSubModelSort(activeId, overId, activeParentData, activeContainer)
				return
			}

			// 场景2：分组内普通模型/子分组之间的排序（不涉及子模型）
			// Model → Model: 总是排序
			// Model → SubGroup: 不按 Shift 时排序（isInsertMode = false）
			// SubGroup → Model/SubGroup: 总是排序
			if (
				(activeType === DragType.Model && overType === DragType.Model) ||
				activeType === DragType.SubGroup ||
				(activeType === DragType.Model &&
					overType === DragType.SubGroup &&
					!dragState.isInsertMode)
			) {
				// console.log("分组内普通元素排序（Model/SubGroup之间）")
				handleModelSort(activeId, overId, activeContainer)
				return
			}

			// 场景3：混合操作（涉及子模型的插入/移出）
			// SubModel → Model: 子模型移出到分组
			// SubModel → SubGroup: 子模型移出到分组（排在子分组前/后）
			// Model → SubModel: 模型放入子分组
			// SubModel → SubModel（不同子分组）: 从一个子分组移到另一个
			handleMixedSort({
				active,
				over,
				groupId: activeContainer,
			})
		}

		// 跨组排序已在 handleDragOver 中处理
	})

	// === 拖拽状态操作 end ===

	return {
		sensors,
		dragState,
		setDragState,
		handleDragStart,
		handleDragOver,
		handleDragMove,
		handleDragEnd,
		collisionDetectionStrategy,
	}
}

export default useDragHandler
