import type { Active, Over } from "@dnd-kit/core"
import { nanoid } from "nanoid"
import { PlatformPackage } from "@admin/types/platformPackage"
import type { AiManage } from "@admin/types/aiManage"
import { AiModel } from "@admin/const/aiModel"
import type { GroupItem as GroupItemType } from "./types"

const defaultIcon = ""

// 数组转 Map
export const listToMap = (
	list: PlatformPackage.ModeDetail["groups"],
): Map<string, GroupItemType> => {
	return list.reduce((acc, curr) => {
		acc.set(curr.group.id, {
			group: curr.group,
			models: new Map(curr.models.map((model) => [model.id, model])),
		})
		return acc
	}, new Map<string, GroupItemType>())
}

// Map 转数组
export const mapToList = (
	map: Map<string, GroupItemType>,
): PlatformPackage.ModeDetail["groups"] => {
	return Array.from(map.values()).map(({ group, models }) => ({
		group,
		models: Array.from(models.values()),
	}))
}

// 保存前统一重排 sort，确保顶层模型和子模型顺序一致
export const normalizeGroupListForSave = (
	map: Map<string, GroupItemType>,
): PlatformPackage.ModeDetail["groups"] => {
	return Array.from(map.values()).map(({ group, models }) => {
		const normalizedModels = Array.from(models.values()).map((model, modelIndex) => {
			// 动态模型组里模型已经排序过了，所以无需再处理动态模型里的模型
			return {
				...model,
				sort: modelIndex,
			}
		})

		return {
			group,
			models: normalizedModels,
		}
	})
}

// 判断是否是动态模型
export const isDynamicModel = (
	model?: PlatformPackage.ModelItem,
): model is PlatformPackage.DynamicModel => {
	if (!model) return false
	return "model_type" in model && model.model_type === PlatformPackage.ModelType.Dynamic
}

// 计算拖拽项是否在目标项下方
export const calculateIsBelowOverItem = (active: Active, over: Over | null) => {
	if (!over || !active.rect.current.translated) return false

	// 使用 translated（实时位置）计算
	const activeTop = active.rect.current.translated.top
	const overCenterY = over.rect.top + over.rect.height / 2

	return activeTop > overCenterY
}

// 创建基础模型数据
export const createBaseModel = (
	draggedModel: AiManage.ModelInfo,
	insertIndex: number,
	overContainer: string,
) => {
	return {
		id: nanoid(),
		provider_model_id: draggedModel.service_provider_config_id,
		group_id: overContainer,
		model_id: draggedModel.model_id,
		model_name: draggedModel.name,
		model_icon: draggedModel.icon,
		sort: insertIndex,
		model_status: PlatformPackage.ModeGroupModelStatus.Normal,
		model_category: draggedModel.category,
	}
}

// 创建动态模型数据
export const createDynamicModel = (
	draggedModel: AiManage.ModelInfo,
	insertIndex: number,
	overContainer: string,
) => {
	return {
		id: `${PlatformPackage.ModelType.Dynamic}-${nanoid()}`,
		provider_model_id: "0",
		group_id: overContainer,
		model_id: draggedModel.model_id,
		model_name: draggedModel.name,
		model_icon: defaultIcon || draggedModel.icon,
		sort: insertIndex,
		model_type: PlatformPackage.ModelType.Dynamic,
		model_category: AiModel.ServiceProviderCategory.LLM,
		model_description: draggedModel.description,
		aggregate_config: {
			models: [],
			strategy: PlatformPackage.StrategyType.PermissionFallback,
			strategy_config: {
				order: PlatformPackage.OrderDirection.Asc,
			},
		},
		model_translate: {
			name: { zh_CN: draggedModel.name, en_US: "Dynamic Model" },
			description: {
				zh_CN: draggedModel.description,
				en_US: "",
			},
		},
	}
}
