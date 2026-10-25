import type { GenerateImageRequest, ImageModelItem } from "../../public/magic-types"

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

/**
 * Select 使用 JSON 元组作为临时 value；请求、DSL 和展示层只应使用真实尺寸值。
 * 同时兼容已经持久化了旧编码值的历史数据。
 */
export function normalizeImageSizeValue(value?: string): string | undefined {
	if (!value) return value
	try {
		const parsed = parseImageSelectValue(value)
		return parsed.value || value
	} catch {
		return value
	}
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

	if (sizesForResolution.length === 0) return null

	let targetSize = sizesForResolution.find((size) => size.label === currentLabel)
	if (
		!targetSize &&
		Number.isFinite(fallbackAspectRatio) &&
		fallbackAspectRatio &&
		fallbackAspectRatio > 0
	) {
		targetSize = sizesForResolution.reduce<ImageSizeOption | undefined>((bestSize, size) => {
			const sizeAspectRatio = parseAspectRatioFromSize(size.value)
			if (!sizeAspectRatio) return bestSize
			if (!bestSize) return size
			const bestAspectRatio = parseAspectRatioFromSize(bestSize.value)
			if (!bestAspectRatio) return size
			const currentDistance = Math.abs(Math.log(sizeAspectRatio / fallbackAspectRatio))
			const bestDistance = Math.abs(Math.log(bestAspectRatio / fallbackAspectRatio))
			return currentDistance < bestDistance ? size : bestSize
		}, undefined)
	}

	return targetSize ?? sizesForResolution[0]
}

export function resolveImageSizeOptionFromRequest(options: {
	sizes: ImageSizeOption[]
	request?: Pick<GenerateImageRequest, "size" | "resolution"> | null
	preferredResolution?: string
	currentLabel?: string
	fallbackAspectRatio?: number
}): { size: ImageSizeOption; resolution?: string } | null {
	const { sizes, request, preferredResolution, currentLabel, fallbackAspectRatio } = options
	if (sizes.length === 0) return null

	const availableScales = Array.from(new Set(sizes.map((size) => size.scale).filter(Boolean)))
	const requestedResolution = request?.resolution
	const requestedSize = normalizeImageSizeValue(request?.size)
	const targetResolution =
		requestedResolution && availableScales.includes(requestedResolution)
			? requestedResolution
			: preferredResolution && availableScales.includes(preferredResolution)
				? preferredResolution
				: undefined

	const exactSize =
		requestedSize && requestedResolution
			? sizes.find(
					(size) =>
						size.value === requestedSize &&
						(size.scale || undefined) === requestedResolution,
				)
			: undefined
	const sameValueSize = requestedSize
		? sizes.find((size) => size.value === requestedSize)
		: undefined
	const requestAspectRatio = requestedSize ? parseAspectRatioFromSize(requestedSize) : undefined
	const targetSize =
		exactSize ||
		sameValueSize ||
		findBestSizeForResolution(
			sizes,
			targetResolution,
			currentLabel,
			fallbackAspectRatio ?? requestAspectRatio,
		) ||
		sizes[0]

	return {
		size: targetSize,
		resolution: availableScales.length
			? targetSize.scale || targetResolution || undefined
			: undefined,
	}
}

export function buildSupportedAspectRatioOptions(
	model: ImageModelItem | undefined,
	buildSelectValue: (label: string, value: string, scale?: string) => string,
	selectedResolution?: string,
): SupportedAspectRatioOption[] {
	if (!model?.image_size_config?.sizes) return []
	const filteredSizes = model.image_size_config.sizes.filter(
		(size) => !selectedResolution || size.scale === selectedResolution,
	)

	return filteredSizes
		.map((size) => {
			const [width, height] = size.value.split("x").map(Number)
			const baseSize = 16
			const aspectRatio = width / height
			const iconWidth = aspectRatio >= 1 ? baseSize : Math.round(baseSize * aspectRatio)
			const iconHeight = aspectRatio >= 1 ? Math.round(baseSize / aspectRatio) : baseSize
			return {
				value: buildSelectValue(size.label, size.value, size.scale),
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
				return match ? parseInt(match[1], 10) : Infinity
			}
			return parseNFromLabel(a.originalLabel) - parseNFromLabel(b.originalLabel)
		})
}

export function buildSupportedResolutionOptions(
	model?: ImageModelItem,
): SupportedResolutionOption[] {
	if (!model?.image_size_config?.sizes) return []
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
	return key.startsWith(prefix) ? key.slice(prefix.length) : key
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

export function getDefaultResolutionForModel(
	model?: ImageModelItem,
	preferredResolution?: string,
): string | undefined {
	const sizes = model?.image_size_config?.sizes
	if (!sizes?.length) return undefined

	const availableScales = Array.from(new Set(sizes.map((size) => size.scale).filter(Boolean)))
	if (availableScales.length === 0) return undefined
	if (preferredResolution && availableScales.includes(preferredResolution)) {
		return preferredResolution
	}
	if (
		model.image_size_config?.default_scale &&
		availableScales.includes(model.image_size_config.default_scale)
	) {
		return model.image_size_config.default_scale
	}
	return availableScales[0]
}
