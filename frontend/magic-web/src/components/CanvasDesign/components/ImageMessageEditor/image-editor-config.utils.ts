import type { TFunction } from "../../context/I18nContext"
import type { GenerateImageRequest, ImageModelItem } from "../../types.magic"

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

export interface ImageGenerationSettingOption {
	label: string
	value: string
}

export interface ImageGenerationSettingConfig {
	key: string
	label: string
	requestKey: string
	default?: string
	options: ImageGenerationSettingOption[]
}

export interface ImageSizeOption {
	label: string
	value: string
	scale?: string
}

export interface SupportedAspectRatioOption {
	value: string
	label: string
	width: number
	height: number
	iconWidth: number
	iconHeight: number
	originalLabel: string
	originalValue: string
	originalScale?: string
}

export interface SupportedResolutionOption {
	label: string
	value: string
	data: { label: string; value: string; scale: string }
}

export function buildImageSelectValue(label: string, value: string, scale?: string) {
	return JSON.stringify([label, value, scale || null])
}

export function parseImageSelectValue(value: string) {
	const parsed = JSON.parse(value)
	if (Array.isArray(parsed) && parsed.length >= 2) {
		return {
			label: parsed[0],
			value: parsed[1],
			scale: parsed[2] || undefined,
		}
	}
	return { label: "", value: "", scale: undefined }
}

export function parseAspectRatioFromSize(sizeValue: string) {
	const [width, height] = sizeValue.split("x").map(Number)
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		return undefined
	}
	return width / height
}

export function findBestSizeForResolution(
	allSizes: ImageSizeOption[],
	targetResolution: string | undefined,
	currentLabel: string | undefined,
	fallbackAspectRatio?: number,
) {
	const sizesForResolution = targetResolution
		? allSizes.filter((size) => size.scale === targetResolution)
		: allSizes

	if (sizesForResolution.length === 0) {
		return null
	}

	let targetSize = sizesForResolution.find((size) => size.label === currentLabel)

	if (
		!targetSize &&
		Number.isFinite(fallbackAspectRatio) &&
		fallbackAspectRatio &&
		fallbackAspectRatio > 0
	) {
		targetSize = sizesForResolution.reduce<ImageSizeOption | undefined>((bestSize, size) => {
			const sizeAspectRatio = parseAspectRatioFromSize(size.value)
			if (!sizeAspectRatio) {
				return bestSize
			}
			if (!bestSize) {
				return size
			}
			const bestAspectRatio = parseAspectRatioFromSize(bestSize.value)
			if (!bestAspectRatio) {
				return size
			}
			const currentDistance = Math.abs(Math.log(sizeAspectRatio / fallbackAspectRatio))
			const bestDistance = Math.abs(Math.log(bestAspectRatio / fallbackAspectRatio))
			return currentDistance < bestDistance ? size : bestSize
		}, undefined)
	}

	if (!targetSize) {
		targetSize = sizesForResolution[0]
	}

	return targetSize
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

export function buildSupportedAspectRatioOptions(
	model: ImageModelItem | undefined,
	buildSelectValue: (label: string, value: string, scale?: string) => string,
	selectedResolution?: string,
): SupportedAspectRatioOption[] {
	if (!model?.image_size_config?.sizes) {
		return []
	}
	const filteredSizes = model.image_size_config.sizes.filter((size) => {
		if (!selectedResolution) {
			return true
		}
		return size.scale === selectedResolution
	})

	return filteredSizes
		.map((size) => {
			const [width, height] = size.value.split("x").map(Number)
			const baseSize = 16
			const aspectRatio = width / height
			let iconWidth: number
			let iconHeight: number
			if (aspectRatio >= 1) {
				iconWidth = baseSize
				iconHeight = Math.round(baseSize / aspectRatio)
			} else {
				iconHeight = baseSize
				iconWidth = Math.round(baseSize * aspectRatio)
			}
			const value = buildSelectValue(size.label, size.value, size.scale)
			return {
				value,
				label: size.label,
				width,
				height,
				iconWidth,
				iconHeight,
				originalLabel: size.label,
				originalValue: size.value,
				originalScale: size.scale,
			}
		})
		.sort((a, b) => {
			const parseNFromLabel = (label: string): number => {
				const match = label.match(/^(\d+):(\d+)/)
				if (match) {
					return parseInt(match[1], 10)
				}
				return Infinity
			}
			const nA = parseNFromLabel(a.originalLabel)
			const nB = parseNFromLabel(b.originalLabel)
			return nA - nB
		})
}

export function buildSupportedResolutionOptions(
	model?: ImageModelItem,
): SupportedResolutionOption[] {
	if (!model?.image_size_config?.sizes) {
		return []
	}
	const scaleMap = new Map<string, { label: string; value: string; scale: string }>()
	model.image_size_config.sizes.forEach((size) => {
		if (size.scale && !scaleMap.has(size.scale)) {
			scaleMap.set(size.scale, {
				label: size.label,
				value: size.value,
				scale: size.scale,
			})
		}
	})
	return Array.from(scaleMap.entries()).map(([scale, sizeData]) => ({
		label: scale,
		value: scale,
		data: sizeData,
	}))
}

export function getImageGenerationSettings(model?: ImageModelItem): ImageGenerationSettingConfig[] {
	const settings = model?.image_size_config?.image_settings
	if (!settings?.length) return []

	return settings
		.map((setting) => ({
			key: setting.key,
			label: setting.label,
			requestKey: getImageGenerationRequestKey(setting.key),
			default: setting.default,
			options: setting.options?.filter((option) => option.value) ?? [],
		}))
		.filter((setting) => setting.requestKey && setting.options.length > 0)
}

function getImageGenerationRequestKey(key: string): string {
	const prefix = "image_generation_config."
	if (key.startsWith(prefix)) return key.slice(prefix.length)
	return key
}

export function buildDefaultImageGenerationConfig(
	settings: ImageGenerationSettingConfig[],
): Record<string, string> {
	return settings.reduce<Record<string, string>>((config, setting) => {
		const defaultOption = setting.options.find((option) => option.value === setting.default)
		config[setting.requestKey] = defaultOption?.value ?? setting.options[0]?.value ?? ""
		return config
	}, {})
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

export function getDefaultResolutionForModel(
	model?: ImageModelItem,
	preferredResolution?: string,
): string | undefined {
	const sizes = model?.image_size_config?.sizes
	if (!sizes?.length) return undefined

	const availableScales = Array.from(new Set(sizes.map((size) => size.scale).filter(Boolean)))
	if (availableScales.length === 0) return undefined
	if (preferredResolution && availableScales.includes(preferredResolution))
		return preferredResolution
	if (
		model?.image_size_config?.default_scale &&
		availableScales.includes(model.image_size_config.default_scale)
	)
		return model.image_size_config.default_scale
	return availableScales[0]
}
