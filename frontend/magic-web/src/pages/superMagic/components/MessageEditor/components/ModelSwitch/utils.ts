import modelCache from "@/services/superMagic/topicModel/SuperMagicTopicModelCacheService"
import {
	ModelItem,
	ModelStatusEnum,
	ModelTagEnum,
	ReasoningEffort,
	reasoningEffortLevels,
} from "./types"

interface ResolveShowSelectedModelNameOptions {
	showSelectedModelName: boolean
	showImageTab: boolean
	showVideoTab: boolean
}

export function resolveShowSelectedModelName({
	showSelectedModelName,
	showImageTab,
	showVideoTab,
}: ResolveShowSelectedModelNameOptions): boolean {
	return showSelectedModelName || (!showImageTab && !showVideoTab)
}

export function isMaxModel(model?: Pick<ModelItem, "model_id" | "model_name">): boolean {
	if (!model) return false
	return (model.model_name || model.model_id).toLocaleLowerCase() === "max"
}

export function isAutoModel(model?: ModelItem): boolean {
	if (!model) return false
	return (model.model_name || model.model_id).toLocaleLowerCase() === "auto"
}

export function isQwenCoderPlusModel(model?: ModelItem): boolean {
	if (!model) return false
	return model.model_id.toLocaleLowerCase() === "qwen3-coder-plus"
}

export function isGemini3FlashModel(model?: ModelItem): boolean {
	if (!model) return false
	return model.model_id.toLocaleLowerCase() === "gemini-3-flash-preview"
}

/** 只展示仍在可选档位中的有效默认值，兼容旧接口缺失字段及未来未知档位。 */
export function getModelDefaultReasoningEffort(
	model?: ModelItem | null,
): ReasoningEffort | undefined {
	return reasoningEffortLevels.find(
		(level) =>
			level === model?.reasoning_effort_default &&
			model.reasoning_effort_levels?.includes(level),
	)
}

/** 返回模型实际可选的档位，按统一顺序排列；空数组表示该模型不支持调强度。 */
export function getSelectableReasoningLevels(model?: ModelItem | null): ReasoningEffort[] {
	return reasoningEffortLevels.filter((level) => model?.reasoning_effort_levels?.includes(level))
}

/** 读取有效用户覆盖，显式 null 表示继承，不能回读旧缓存。 */
export function getModelReasoningEffort(model?: ModelItem | null): ReasoningEffort | undefined {
	if (!model?.reasoning_effort_levels?.length) return undefined
	const preference = Object.prototype.hasOwnProperty.call(model, "reasoning_effort")
		? (model.reasoning_effort ?? undefined)
		: modelCache.getReasoningEffort(model)
	return reasoningEffortLevels.find(
		(level) => level === preference && model.reasoning_effort_levels?.includes(level),
	)
}

/** 展示实际选中档位：用户有效偏好优先，否则继承后台；后台空默认时无选中项。 */
export function getModelDisplayedReasoningEffort(
	model?: ModelItem | null,
): ReasoningEffort | undefined {
	return getModelReasoningEffort(model) ?? getModelDefaultReasoningEffort(model)
}

/**
 * Check if a model has a specific tag
 * @param model - The model to check
 * @param tag - The tag to look for
 * @returns true if the model has the tag
 */
export function hasModelTag(model: ModelItem, tag: ModelTagEnum): boolean {
	return model.tags?.includes(tag) ?? false
}

/**
 * Check if a model is disabled based on its status
 * @param model - The model to check
 * @returns true if the model status is Disabled or Deleted
 */
export function isModelDisabled(model: ModelItem): boolean {
	return [ModelStatusEnum.Disabled, ModelStatusEnum.Deleted].includes(model.model_status)
}
