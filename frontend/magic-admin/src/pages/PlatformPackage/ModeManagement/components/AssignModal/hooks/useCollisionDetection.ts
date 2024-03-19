import { useMemoizedFn } from "ahooks"
import type { UniqueIdentifier, CollisionDetection, DroppableContainer } from "@dnd-kit/core"
import { closestCenter, getFirstCollision, pointerWithin, rectIntersection } from "@dnd-kit/core"
import { useRef } from "react"
import { PlatformPackage } from "@/types/platformPackage"
import type { DragState, GroupItem } from "../types"
import { DragType } from "../types"
import { isDynamicModel } from "../utils"

interface UseCollisionDetectionProps {
	groupList: Map<string, GroupItem>
	subGroupCache: {
		subGroupModels: Map<string, string[]>
		subModelParent: Map<string, { id: string; data: PlatformPackage.DynamicModel }>
		dynamicModels: Set<string>
	}
	containerMap: Map<string, string>
	dragState: DragState
	recentlyMovedToNewContainer: React.RefObject<boolean>
	setDragState: (draft: (prevState: DragState) => void) => void
}
export function useCollisionDetection({
	groupList,
	subGroupCache,
	containerMap,
	dragState,
	recentlyMovedToNewContainer,
}: UseCollisionDetectionProps) {
	// 碰撞检测相关 refs
	const lastOverId = useRef<UniqueIdentifier | null>(null)

	// 子分组碰撞模式缓存（用于滞后效应，防止闪烁）
	// const subGroupModeCache = useRef<{
	// 	overId: string
	// 	isInsertMode: boolean
	// 	lastZone: "top" | "middle" | "bottom" // 上次所在区域
	// } | null>({
	// 	overId: "",
	// 	isInsertMode: true,
	// 	lastZone: "middle",
	// })

	// 处理普通模型到子分组的碰撞
	const handleModelToSubGroupCollision = useMemoizedFn(
		(
			args: Parameters<CollisionDetection>[0],
			overId: UniqueIdentifier,
		): { id: UniqueIdentifier }[] | null => {
			// 排序模式
			if (!dragState.isInsertMode) {
				return [{ id: overId }]
			}

			// 插入模式：查找子分组内最近的子模型
			const subModelIds = subGroupCache.subGroupModels.get(overId as string) || []
			if (subModelIds.length > 0) {
				const subModelContainers = args.droppableContainers.filter((c) =>
					subModelIds.includes(c.id as string),
				)

				if (subModelContainers.length > 0) {
					const closest = closestCenter({
						...args,
						droppableContainers: subModelContainers,
					})[0]?.id

					if (closest) {
						return [{ id: closest }]
					}
				}
			}

			// 子分组为空，返回子分组ID（插入作为第一个）
			return [{ id: overId }]
		},
	)

	// 在分组容器中查找最近的模型
	const findClosestModelInGroup = useMemoizedFn(
		(
			args: Parameters<CollisionDetection>[0],
			groupItem: {
				models: Map<string, PlatformPackage.ModelItem>
			},
			isDraggingDynamicModel: boolean,
		): UniqueIdentifier | null => {
			const activeType = args.active.data.current?.type
			const containerModels = Array.from(groupItem.models.keys())
			if (containerModels.length === 0) return null

			const candidateContainers: DroppableContainer[] = []

			args.droppableContainers.forEach((container) => {
				const containerId = container.id as string
				if (!containerModels.includes(containerId)) return

				const model = groupItem.models.get(containerId)
				if (!model) return

				// 动态模型不能嵌套
				if (isDraggingDynamicModel && isDynamicModel(model)) return

				// 子分组碰撞子分组，将子分组加入候选
				if (activeType === DragType.SubGroup && isDynamicModel(model)) {
					candidateContainers.push(container)
					return
				}

				// 模型直接加入候选（排除活动项自己）
				if (containerId !== args.active.id) {
					candidateContainers.push(container)
				}

				// 动态模型加入候选，将子分组里的模型加入候选
				// if (isDynamicModel(model)) {
				// 	// 将子分组里的模型加入候选
				// 	const subGroupModelIds = subGroupCache.subGroupModels.get(containerId) || []
				// 	for (const subModelId of subGroupModelIds) {
				// 		// 排除活动项自己
				// 		if (subModelId === args.active.id) continue

				// 		const subModelContainer = args.droppableContainers.find(
				// 			(c) => c.id === subModelId,
				// 		)
				// 		if (subModelContainer) {
				// 			console.log("子模型加入候选", subModelId, subModelContainer)
				// 			candidateContainers.push(subModelContainer)
				// 		}
				// 	}
				// }
			})

			if (candidateContainers.length === 0) return null

			const closestModel = closestCenter({
				...args,
				droppableContainers: candidateContainers,
			})[0]?.id

			return closestModel || null
		},
	)

	// 场景1：分组排序碰撞检测
	const detectGroupSortCollision = useMemoizedFn(
		(collisionArgs: Parameters<CollisionDetection>[0]) => {
			return closestCenter({
				...collisionArgs,
				droppableContainers: collisionArgs.droppableContainers.filter(
					(container: DroppableContainer) => groupList.has(container.id as string),
				),
			})
		},
	)

	// 场景2：动态模型碰撞检测
	const detectDynamicModelCollision = useMemoizedFn(
		(overId: UniqueIdentifier, isSubGroup: boolean): UniqueIdentifier | null => {
			// 碰撞到子分组容器，返回父分组
			if (isSubGroup) {
				const parentGroupId = containerMap.get(overId as string)
				return parentGroupId || null
			}

			// 碰撞到子模型，返回父分组的父分组
			const subGroup = subGroupCache.subModelParent.get(overId as string)
			if (subGroup) {
				return containerMap.get(subGroup.id) || null
			}

			return null
		},
	)

	// 场景3：子分组碰撞检测
	const detectSubGroupCollision = useMemoizedFn(
		(
			args: Parameters<CollisionDetection>[0],
			overId: UniqueIdentifier,
		): { id: UniqueIdentifier }[] => {
			const activeType = args.active.data.current?.type
			const activeParentData = args.active.data.current?.parentData

			const subGroupModelIds = subGroupCache.subGroupModels.get(overId as string) || []

			// 场景3.0：左侧模型或普通模型到子分组碰撞检测
			if (activeType === DragType.Model) {
				const result = handleModelToSubGroupCollision(args, overId)
				if (result) {
					return result
				}
			}

			// 场景3.1：子模型移出子分组边缘检测
			if (activeType === DragType.SubModel && activeParentData) {
				// 检查是否是当前子分组的子模型想要移出
				if (activeParentData.id === overId) {
					// 获取子分组容器的位置信息
					const { translated } = args.active.rect.current
					const overContainer = args.droppableContainers.find((c) => c.id === overId)

					if (translated && overContainer?.rect?.current) {
						const activeCenter = translated.top + translated.height / 2
						const overRect = overContainer.rect.current
						const overTop = overRect.top
						const overBottom = overRect.top + overRect.height
						const overHeight = overRect.height

						// 定义边缘区域阈值（上下各 15%）
						const edgeThreshold = overHeight * 0.15
						const topEdge = overTop + edgeThreshold
						const bottomEdge = overBottom - edgeThreshold

						// 如果在边缘区域，允许移出到父分组
						if (activeCenter < topEdge || activeCenter > bottomEdge) {
							console.log("子模型在边缘区域，允许移出到父分组")
							return [{ id: activeParentData.group_id }]
						}
					}
				}
			}

			// 场景3.2：优先查找子分组内的其他子模型（避免间隙闪烁）
			if (subGroupModelIds.length > 0) {
				const subGroupContainers = args.droppableContainers.filter(
					(container: DroppableContainer) => {
						return (
							container.id !== overId &&
							container.id !== args.active.id &&
							subGroupModelIds.includes(container.id as string)
						)
					},
				)
				if (subGroupContainers.length > 0) {
					const closestSubModel = closestCenter({
						...args,
						droppableContainers: subGroupContainers,
					})[0]?.id
					if (closestSubModel) {
						// console.log("找到子分组内其他子模型", closestSubModel)
						return [{ id: closestSubModel }]
					}
				}
			}

			// 场景3.3：子模型拖出到父分组（兜底逻辑）
			if (activeType === DragType.SubModel && activeParentData) {
				if (activeParentData.id === overId) {
					return [{ id: activeParentData.group_id }]
				}
			}

			// 兜底：返回子分组本身
			return [{ id: overId }]
		},
	)

	// 场景4：容器碰撞检测
	const detectContainerCollision = useMemoizedFn(
		(
			args: Parameters<CollisionDetection>[0],
			overId: UniqueIdentifier,
			isDraggingDynamicModel: boolean,
		): UniqueIdentifier => {
			let finalOverId = overId
			if (groupList.has(overId as string)) {
				const groupItem = groupList.get(overId as string)
				if (groupItem) {
					const closestModel = findClosestModelInGroup(
						args,
						groupItem,
						isDraggingDynamicModel,
					)
					if (closestModel) {
						finalOverId = closestModel
					}
				}
			}
			return finalOverId
		},
	)

	// 碰撞检测策略
	const collisionDetectionStrategy: CollisionDetection = useMemoizedFn((args) => {
		// 场景1：分组排序 - 只检测其他分组
		if (dragState.activeId && groupList.has(dragState.activeId)) {
			return detectGroupSortCollision(args)
		}

		// 执行基础碰撞检测
		const pointerIntersections = pointerWithin(args)
		const intersections =
			pointerIntersections.length > 0 ? pointerIntersections : rectIntersection(args)
		let overId = getFirstCollision(intersections, "id")

		if (overId == null) {
			// 布局变化导致无碰撞时，使用缓存
			if (recentlyMovedToNewContainer.current) {
				lastOverId.current = dragState.activeId
			}
			return lastOverId.current ? [{ id: lastOverId.current }] : []
		}

		// 提取拖拽信息
		const activeData = args.active.data.current
		const activeType = activeData?.type
		const activeItem = activeData?.item

		// 判断是否是子分组
		const isSubGroup = subGroupCache.dynamicModels.has(overId as string)
		const isDraggingDynamicModel =
			activeType === DragType.LeftModel &&
			activeItem?.id === PlatformPackage.ModelType.Dynamic

		// 场景2：动态模型碰撞 - 不允许嵌套
		if (isDraggingDynamicModel || activeType === DragType.SubGroup) {
			// console.log("动态模型碰撞", overId, isSubGroup)
			// 碰到子分组或子模型时，转换为父分组ID，继续后续场景4处理
			const parentGroupId = detectDynamicModelCollision(overId, isSubGroup)
			if (parentGroupId) {
				overId = parentGroupId
			}
		}

		// 场景3：碰撞到子分组（排除子分组之间的碰撞，子分组间应该是排序）
		if (isSubGroup && !isDraggingDynamicModel && activeType !== DragType.SubGroup) {
			// console.log("子分组碰撞", overId, activeType, activeParentData)
			const result = detectSubGroupCollision(args, overId)
			if (result) {
				lastOverId.current = result[0].id
				return result
			}
		}

		// 场景4：碰撞到分组容器 - 查找最近的模型
		overId = detectContainerCollision(args, overId, isDraggingDynamicModel)

		// 场景5：排序模式优化 - 子模型ID替换为子分组ID
		// if (activeType === DragType.Model && !dragState.isInsertMode) {
		// 	const subGroup = subGroupCache.subModelParent.get(overId as string)
		// 	if (subGroup) {
		// 		// console.log("排序模式：将子模型ID替换为子分组ID", {
		// 		// 	subModelId: overId,
		// 		// 	subGroupId,
		// 		// })
		// 		overId = subGroup.id
		// 	}
		// }

		lastOverId.current = overId
		return [{ id: overId }]
	})

	return { collisionDetectionStrategy }
}
