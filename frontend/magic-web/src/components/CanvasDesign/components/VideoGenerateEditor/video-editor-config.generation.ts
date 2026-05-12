import type {
	GenerateVideoRequest,
	VideoGenerationConstraints,
	VideoGenerationSizeOption,
	VideoModelItem,
} from "../../types.magic"
import type { VideoEditorConfig } from "./video-editor-config.types"

function dedupeStringArray(values: string[]): string[] {
	return Array.from(new Set(values.filter(Boolean)))
}

function normalizeConstraintSizes(
	sizes?: VideoGenerationConstraints["sizes"],
): Array<VideoGenerationSizeOption & { width: number; height: number }> {
	if (!sizes) return []
	return sizes
		.map((size) => {
			const parsedSize = parseVideoSizeValue(size.value)
			const width = Number.isFinite(size.width) ? size.width : parsedSize?.width
			const height = Number.isFinite(size.height) ? size.height : parsedSize?.height
			if (!size.label || !size.value || !size.resolution || !width || !height) return null
			return {
				...size,
				width,
				height,
			}
		})
		.filter(
			(
				size,
			): size is VideoGenerationSizeOption & {
				width: number
				height: number
			} => Boolean(size),
		)
}

function getFilteredVideoGenerationSizes(
	model: VideoModelItem | undefined,
	constraints?: VideoGenerationConstraints,
): Array<VideoGenerationSizeOption & { width: number; height: number }> {
	const sourceSizes =
		constraints?.sizes !== undefined
			? normalizeConstraintSizes(constraints.sizes)
			: getNormalizedVideoGenerationSizes(model)

	const constrainedResolutions = constraints?.resolutions
	const constrainedAspectRatios = constraints?.aspect_ratios

	return sourceSizes.filter((size) => {
		if (constrainedResolutions && !constrainedResolutions.includes(size.resolution))
			return false
		if (constrainedAspectRatios && !constrainedAspectRatios.includes(size.label)) return false
		return true
	})
}

function getFilteredGenerationResolutions(
	model: VideoModelItem | undefined,
	constraints?: VideoGenerationConstraints,
): string[] {
	const generationSizes = getFilteredVideoGenerationSizes(model, constraints)
	if (generationSizes.length > 0) {
		return dedupeStringArray(generationSizes.map((size) => size.resolution))
	}

	const topLevelResolutions = model?.video_generation_config?.generation?.resolutions || []
	if (constraints?.resolutions === undefined) return dedupeStringArray(topLevelResolutions)
	if (constraints.resolutions.length === 0) return []
	return constraints.resolutions.filter((resolution) => topLevelResolutions.includes(resolution))
}

function getFilteredGenerationAspectRatios(
	model: VideoModelItem | undefined,
	constraints?: VideoGenerationConstraints,
): string[] {
	const generationSizes = getFilteredVideoGenerationSizes(model, constraints)
	if (generationSizes.length > 0) {
		return dedupeStringArray(generationSizes.map((size) => size.label))
	}

	const topLevelAspectRatios = model?.video_generation_config?.generation?.aspect_ratios || []
	if (constraints?.aspect_ratios === undefined) return dedupeStringArray(topLevelAspectRatios)
	if (constraints.aspect_ratios.length === 0) return []
	return constraints.aspect_ratios.filter((ratio) => topLevelAspectRatios.includes(ratio))
}

export function buildVideoDurationOptions(
	model: VideoModelItem | undefined,
	constraints?: VideoGenerationConstraints,
): number[] {
	const topLevelDurations = (model?.video_generation_config?.generation?.durations || []).filter(
		(value) => typeof value === "number" && Number.isFinite(value),
	)
	if (constraints?.durations === undefined) return Array.from(new Set(topLevelDurations))
	if (constraints.durations.length === 0) return []
	return constraints.durations.filter((duration) => topLevelDurations.includes(duration))
}

/** 为宽高比下拉生成预览块与图标的像素尺寸 */
export function buildAspectRatioPreviewSize(aspectRatio: string): {
	width: number
	height: number
	iconWidth: number
	iconHeight: number
} {
	const [rawWidth, rawHeight] = aspectRatio.split(":").map(Number)
	if (!rawWidth || !rawHeight) {
		return {
			width: 160,
			height: 90,
			iconWidth: 24,
			iconHeight: 14,
		}
	}

	const width = rawWidth * 10
	const height = rawHeight * 10
	const maxIconWidth = 24
	const maxIconHeight = 24
	const scale = Math.min(maxIconWidth / width, maxIconHeight / height)

	return {
		width,
		height,
		iconWidth: Math.max(10, Math.round(width * scale)),
		iconHeight: Math.max(10, Math.round(height * scale)),
	}
}

export function buildVideoResolutionOptions(
	model: VideoModelItem | undefined,
	constraints?: VideoGenerationConstraints,
): VideoEditorConfig["supportedResolutionOptions"] {
	const generationSizes = getFilteredVideoGenerationSizes(model, constraints)
	if (generationSizes.length > 0) {
		const resolutionMap = new Map<string, { label: string; value: string; scale: string }>()
		generationSizes.forEach((size) => {
			if (!size.resolution || resolutionMap.has(size.resolution)) return
			resolutionMap.set(size.resolution, {
				label: size.resolution,
				value: size.value,
				scale: size.resolution,
			})
		})
		return Array.from(resolutionMap.entries()).map(([resolution, data]) => ({
			label: resolution,
			value: resolution,
			data,
		}))
	}

	const resolutions = getFilteredGenerationResolutions(model, constraints)
	return resolutions.map((resolution) => ({
		label: resolution,
		value: resolution,
		data: {
			label: resolution,
			value: resolution,
			scale: resolution,
		},
	}))
}

export function buildVideoAspectRatioOptions(
	model: VideoModelItem | undefined,
	selectedResolution?: string,
	constraints?: VideoGenerationConstraints,
): VideoEditorConfig["supportedAspectRatioOptions"] {
	const generationSizes = getFilteredVideoGenerationSizes(model, constraints)
	if (generationSizes.length > 0) {
		const filteredSizes = selectedResolution
			? generationSizes.filter((size) => size.resolution === selectedResolution)
			: generationSizes
		return filteredSizes.map((size) => {
			const previewSize = buildAspectRatioPreviewSize(size.label)
			return {
				value: size.label,
				label: size.label,
				width: size.width,
				height: size.height,
				iconWidth: previewSize.iconWidth,
				iconHeight: previewSize.iconHeight,
				originalLabel: size.label,
				originalValue: size.value,
				originalScale: size.resolution,
			}
		})
	}

	const aspectRatios = getFilteredGenerationAspectRatios(model, constraints)
	return aspectRatios.map((aspectRatio) => {
		const canvasSize = calculateCanvasSizeFromAspectRatio(aspectRatio)
		const previewSize = buildAspectRatioPreviewSize(aspectRatio)
		return {
			value: aspectRatio,
			label: aspectRatio,
			width: canvasSize?.width || previewSize.width,
			height: canvasSize?.height || previewSize.height,
			iconWidth: previewSize.iconWidth,
			iconHeight: previewSize.iconHeight,
			originalLabel: aspectRatio,
			originalValue: aspectRatio,
		}
	})
}

export function resolveVideoGenerationSelection(
	model: VideoModelItem | undefined,
	generation?: Partial<NonNullable<GenerateVideoRequest["generation"]>>,
	constraints?: VideoGenerationConstraints,
): {
	resolution: string | undefined
	aspectRatio: string | undefined
	size: { width: number; height: number } | null
} {
	const generationSizes = getFilteredVideoGenerationSizes(model, constraints)
	if (generationSizes.length > 0) {
		const exactMatch =
			generation?.aspect_ratio && generation?.resolution
				? generationSizes.find(
						(size) =>
							size.label === generation.aspect_ratio &&
							size.resolution === generation.resolution,
					)
				: undefined
		const resolutionMatch = generation?.resolution
			? generationSizes.find((size) => size.resolution === generation.resolution)
			: undefined
		const aspectRatioMatch = generation?.aspect_ratio
			? generationSizes.find((size) => size.label === generation.aspect_ratio)
			: undefined
		const targetSize = exactMatch || resolutionMatch || aspectRatioMatch || generationSizes[0]
		return {
			resolution: targetSize?.resolution,
			aspectRatio: targetSize?.label,
			size: targetSize
				? {
						width: targetSize.width,
						height: targetSize.height,
					}
				: null,
		}
	}

	const resolutions = getFilteredGenerationResolutions(model, constraints)
	const aspectRatios = getFilteredGenerationAspectRatios(model, constraints)
	const resolution =
		generation?.resolution && resolutions.includes(generation.resolution)
			? generation.resolution
			: resolutions[0]
	const aspectRatio =
		generation?.aspect_ratio && aspectRatios.includes(generation.aspect_ratio)
			? generation.aspect_ratio
			: aspectRatios[0]

	return {
		resolution,
		aspectRatio,
		size: calculateCanvasSizeFromAspectRatio(aspectRatio),
	}
}

/** 换模型时：若旧分辨率/比例在新模型中仍合法则尽量保留，否则再退回默认 */
export function resolveVideoGenerationSelectionPreserving(
	model: VideoModelItem | undefined,
	prev: { resolution?: string; aspectRatio?: string },
	constraints?: VideoGenerationConstraints,
): {
	resolution: string | undefined
	aspectRatio: string | undefined
	size: { width: number; height: number } | null
} {
	const fallback = resolveVideoGenerationSelection(model, undefined, constraints)
	if (!model) return fallback

	const generationSizes = getFilteredVideoGenerationSizes(model, constraints)
	const pr = prev.resolution
	const pa = prev.aspectRatio

	if (generationSizes.length > 0) {
		if (pr && pa) {
			const exact = generationSizes.find((s) => s.resolution === pr && s.label === pa)
			if (exact) {
				return {
					resolution: exact.resolution,
					aspectRatio: exact.label,
					size: { width: exact.width, height: exact.height },
				}
			}
		}
		if (pr) {
			const withRes = generationSizes.filter((s) => s.resolution === pr)
			if (withRes.length > 0) {
				if (pa) {
					const aspectMatch = withRes.find((s) => s.label === pa)
					if (aspectMatch) {
						return {
							resolution: aspectMatch.resolution,
							aspectRatio: aspectMatch.label,
							size: {
								width: aspectMatch.width,
								height: aspectMatch.height,
							},
						}
					}
				}
				const first = withRes[0]
				return {
					resolution: first.resolution,
					aspectRatio: first.label,
					size: { width: first.width, height: first.height },
				}
			}
		}
		if (pa) {
			const withAspect = generationSizes.filter((s) => s.label === pa)
			if (withAspect.length > 0) {
				const first = withAspect[0]
				return {
					resolution: first.resolution,
					aspectRatio: first.label,
					size: { width: first.width, height: first.height },
				}
			}
		}
		return fallback
	}

	const resolutions = getFilteredGenerationResolutions(model, constraints)
	const aspectRatios = getFilteredGenerationAspectRatios(model, constraints)
	const prOk = Boolean(pr && resolutions.includes(pr))
	const paOk = Boolean(pa && aspectRatios.includes(pa))

	if (prOk && paOk) {
		return {
			resolution: pr,
			aspectRatio: pa,
			size: calculateCanvasSizeFromAspectRatio(pa),
		}
	}
	if (prOk) {
		const aspect = paOk && pa ? pa : (aspectRatios[0] ?? fallback.aspectRatio)
		return {
			resolution: pr,
			aspectRatio: aspect,
			size: calculateCanvasSizeFromAspectRatio(aspect),
		}
	}
	if (paOk && pa) {
		const resolution = resolutions[0] ?? fallback.resolution
		return {
			resolution,
			aspectRatio: pa,
			size: calculateCanvasSizeFromAspectRatio(pa),
		}
	}
	return fallback
}

export function getNormalizedVideoGenerationSizes(
	model: VideoModelItem | undefined,
): Array<VideoGenerationSizeOption & { width: number; height: number }> {
	const sizes = model?.video_generation_config?.generation?.sizes || []
	return sizes
		.map((size) => {
			const parsedSize = parseVideoSizeValue(size.value)
			const width = Number.isFinite(size.width) ? size.width : parsedSize?.width
			const height = Number.isFinite(size.height) ? size.height : parsedSize?.height
			if (!size.label || !size.value || !size.resolution || !width || !height) return null
			return {
				...size,
				width,
				height,
			}
		})
		.filter(
			(
				size,
			): size is VideoGenerationSizeOption & {
				width: number
				height: number
			} => Boolean(size),
		)
}

export function parseVideoSizeValue(value?: string): { width: number; height: number } | null {
	if (!value) return null
	const [width, height] = value.split("x").map(Number)
	if (!Number.isFinite(width) || !Number.isFinite(height)) return null
	return { width, height }
}

export function calculateCanvasSizeFromAspectRatio(
	aspectRatio?: string,
): { width: number; height: number } | null {
	if (!aspectRatio) return null
	const [rawWidth, rawHeight] = aspectRatio.split(":").map(Number)
	if (!rawWidth || !rawHeight) return null

	const defaultLongSide = 320
	if (rawWidth >= rawHeight) {
		return {
			width: defaultLongSide,
			height: Math.round((defaultLongSide * rawHeight) / rawWidth),
		}
	}

	return {
		width: Math.round((defaultLongSide * rawWidth) / rawHeight),
		height: defaultLongSide,
	}
}
