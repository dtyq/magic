// hooks/useDragHandler/useContainerCache.ts

import { useMemo } from "react"
import type { PlatformPackage } from "@/types/platformPackage"
import type { GroupItem } from "../types"
import { isDynamicModel } from "../utils"

export function useContainerCache(groupList: Map<string, GroupItem>) {
	// 容器映射
	const containerMap = useMemo(() => {
		const map = new Map<string, string>()

		groupList.forEach((groupItem, groupId) => {
			map.set(groupId, groupId)

			groupItem.models.forEach((model, modelId) => {
				map.set(modelId, groupId)

				if (isDynamicModel(model)) {
					const subModels = (
						model as PlatformPackage.DynamicModel
					).aggregate_config.models.map((m) => m.id)
					subModels.forEach((id) => map.set(id, groupId))
				}
			})
		})

		return map
	}, [groupList])

	// 子分组缓存
	const subGroupCache = useMemo(() => {
		const subGroupModels = new Map<string, string[]>()
		const subModelParent = new Map<string, { id: string; data: PlatformPackage.DynamicModel }>()
		const dynamicModels = new Set<string>()

		groupList.forEach((groupItem) => {
			groupItem.models.forEach((modelItem) => {
				if (isDynamicModel(modelItem)) {
					const dynamicModel = modelItem as PlatformPackage.DynamicModel
					dynamicModels.add(modelItem.id)

					const subModelIds = dynamicModel.aggregate_config.models.map((m) => m.id)
					subGroupModels.set(modelItem.id, subModelIds)

					subModelIds.forEach((id) =>
						subModelParent.set(id, { id: modelItem.id, data: dynamicModel }),
					)
				}
			})
		})

		return { subGroupModels, subModelParent, dynamicModels }
	}, [groupList])

	// 查找容器
	const findContainer = (id: string) => containerMap.get(id)

	return {
		containerMap,
		subGroupCache,
		findContainer,
	}
}
