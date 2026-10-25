import type { TFunction } from "../../../../public/i18n-types"
import type { GenerateImageRequest, ImageModelItem } from "../../../../public/magic-types"
import {
	buildDefaultImageGenerationConfig,
	type ImageGenerationSettingConfig,
} from "../../../../runtime/shared/imageGenerationConfig"

export {
	buildDefaultImageGenerationConfig,
	buildImageSelectValue,
	buildSupportedAspectRatioOptions,
	buildSupportedResolutionOptions,
	findBestSizeForResolution,
	getDefaultResolutionForModel,
	getImageGenerationSettings,
	normalizeImageSizeValue,
	parseAspectRatioFromSize,
	parseImageSelectValue,
	resolveImageSizeOptionFromRequest,
} from "../../../../runtime/shared/imageGenerationConfig"
export type {
	ImageGenerationSettingConfig,
	ImageGenerationSettingOption,
	ImageSizeOption,
	SupportedAspectRatioOption,
	SupportedResolutionOption,
} from "../../../../runtime/shared/imageGenerationConfig"

export interface ImageModelOption {
	label: string
	value: string
	model: ImageModelItem
}

export interface ImageModelOptionGroup {
	id: string
	label: string
	icon?: string
	sort: number
	source: "official" | "custom"
	options: ImageModelOption[]
}

export function buildImageModelOptions(imageModelList: ImageModelItem[]): ImageModelOption[] {
	return imageModelList.map((model) => ({
		label: model.model_name,
		value: model.model_id,
		model,
	}))
}

export function buildImageModelOptionGroups(
	modelOptions: ImageModelOption[],
	t: TFunction,
): ImageModelOptionGroup[] {
	const groupMap = new Map<string, ImageModelOptionGroup>()

	modelOptions.forEach((option) => {
		const groupId =
			option.model.model_group?.id || option.model.group_id || option.model.model_id
		const groupLabel = option.model.model_group?.name || t("imageEditor.model", "模型")
		const groupSource =
			option.model.model_group?.source || option.model.model_source || "official"

		if (!groupMap.has(groupId)) {
			groupMap.set(groupId, {
				id: groupId,
				label: groupLabel,
				icon: option.model.model_group?.icon,
				sort: option.model.model_group?.sort ?? Number.MAX_SAFE_INTEGER,
				source: groupSource,
				options: [],
			})
		}

		groupMap.get(groupId)?.options.push(option)
	})

	return Array.from(groupMap.values()).sort((groupA, groupB) => {
		if (groupA.source !== groupB.source) {
			return groupA.source === "custom" ? -1 : 1
		}

		if (groupA.sort !== groupB.sort) {
			return groupA.sort - groupB.sort
		}

		return groupA.label.localeCompare(groupB.label)
	})
}

export function getModelMaxReferenceImages(model?: ImageModelItem) {
	return model?.image_size_config?.max_reference_images
}

export function supportsReferenceImages(model?: ImageModelItem) {
	const maxReferenceImages = getModelMaxReferenceImages(model)
	return maxReferenceImages !== undefined && maxReferenceImages > 0
}

export function restoreImageGenerationConfig(
	settings: ImageGenerationSettingConfig[],
	sourceConfig?: GenerateImageRequest["image_generation_config"],
): Record<string, string> {
	const defaultConfig = buildDefaultImageGenerationConfig(settings)
	if (!sourceConfig) return defaultConfig

	return settings.reduce<Record<string, string>>((config, setting) => {
		const restoredValue = sourceConfig[setting.requestKey]
		if (restoredValue && setting.options.some((option) => option.value === restoredValue)) {
			config[setting.requestKey] = restoredValue
		}
		return config
	}, defaultConfig)
}

export function getSerializableImageGenerationConfig(
	config: Record<string, string>,
	settings: ImageGenerationSettingConfig[],
): GenerateImageRequest["image_generation_config"] {
	const supportedKeys = new Set(settings.map((setting) => setting.requestKey))
	const entries = Object.entries(config).filter(([key, value]) => supportedKeys.has(key) && value)
	if (entries.length === 0) return undefined
	return Object.fromEntries(entries)
}
