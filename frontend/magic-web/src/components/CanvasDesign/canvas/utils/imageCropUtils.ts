import type { ReferenceImageOptions } from "../../types.magic"
import type { CropConfig } from "../types"

interface ImageDimensions {
	width: number
	height: number
}

function normalizeDimension(value: number | undefined): number {
	if (!Number.isFinite(value) || !value || value <= 0) {
		return 0
	}
	return value
}

/** 消除除法换算带来的浮点尾数，避免持久化 JSON 出现 767.9999999999983 等形式 */
function roundCropScalar(value: number): number {
	if (!Number.isFinite(value)) return 0
	return Math.round(value * 1e6) / 1e6
}

function roundSourceCropRect(
	rect: Pick<CropConfig, "x" | "y" | "width" | "height">,
): Pick<CropConfig, "x" | "y" | "width" | "height"> {
	return {
		x: roundCropScalar(rect.x),
		y: roundCropScalar(rect.y),
		width: roundCropScalar(rect.width),
		height: roundCropScalar(rect.height),
	}
}

export function getFullSourceCrop(dimensions: ImageDimensions): CropConfig {
	return {
		x: 0,
		y: 0,
		width: normalizeDimension(dimensions.width),
		height: normalizeDimension(dimensions.height),
	}
}

export function getPersistedSourceCrop(
	crop: CropConfig | undefined,
	dimensions: ImageDimensions,
): CropConfig {
	const sourceWidth = normalizeDimension(dimensions.width)
	const sourceHeight = normalizeDimension(dimensions.height)
	if (!crop) {
		return getFullSourceCrop(dimensions)
	}

	const left = Math.max(crop.x, 0)
	const top = Math.max(crop.y, 0)
	const right = Math.min(crop.x + normalizeDimension(crop.width), sourceWidth)
	const bottom = Math.min(crop.y + normalizeDimension(crop.height), sourceHeight)

	return {
		...roundSourceCropRect({
			x: left,
			y: top,
			width: Math.max(0, right - left),
			height: Math.max(0, bottom - top),
		}),
		...(crop.displayWidth !== undefined
			? { displayWidth: roundCropScalar(crop.displayWidth) }
			: {}),
		...(crop.displayHeight !== undefined
			? { displayHeight: roundCropScalar(crop.displayHeight) }
			: {}),
	}
}

export function getNormalizedImageProcessCrop(params: {
	crop: CropConfig | undefined
	sourceDimensions: ImageDimensions
}): Pick<CropConfig, "width" | "height" | "x" | "y"> | undefined {
	const { crop, sourceDimensions } = params
	const sourceCrop = getPersistedSourceCrop(crop, sourceDimensions)

	if (sourceCrop.width <= 0 || sourceCrop.height <= 0) {
		return undefined
	}

	const left = Math.max(0, Math.floor(sourceCrop.x))
	const top = Math.max(0, Math.floor(sourceCrop.y))
	const right = Math.max(left + 1, Math.ceil(sourceCrop.x + sourceCrop.width))
	const bottom = Math.max(top + 1, Math.ceil(sourceCrop.y + sourceCrop.height))

	return {
		x: left,
		y: top,
		width: right - left,
		height: bottom - top,
	}
}

export function getImageProcessRequestPayload(params: {
	crop: CropConfig | undefined
	sourceDimensions: ImageDimensions
}): {
	size?: string
	crop?: Pick<CropConfig, "width" | "height" | "x" | "y">
} {
	const { crop, sourceDimensions } = params
	const sourceWidth = normalizeDimension(sourceDimensions.width)
	const sourceHeight = normalizeDimension(sourceDimensions.height)

	if (sourceWidth <= 0 || sourceHeight <= 0) {
		return {}
	}

	const normalizedCrop = getNormalizedImageProcessCrop({
		crop,
		sourceDimensions,
	})
	const sizeWidth = normalizedCrop?.width ?? Math.round(sourceWidth)
	const sizeHeight = normalizedCrop?.height ?? Math.round(sourceHeight)
	const hasExplicitCrop =
		!!crop &&
		!!normalizedCrop &&
		(normalizedCrop.x !== 0 ||
			normalizedCrop.y !== 0 ||
			normalizedCrop.width !== Math.round(sourceWidth) ||
			normalizedCrop.height !== Math.round(sourceHeight))

	return {
		size: `${sizeWidth}x${sizeHeight}`,
		...(hasExplicitCrop ? { crop: normalizedCrop } : {}),
	}
}

export function buildReferenceImageOptions(params: {
	filePath?: string
	crop?: Pick<CropConfig, "width" | "height" | "x" | "y">
}): ReferenceImageOptions | undefined {
	const { filePath, crop } = params
	if (!filePath || !crop) return undefined
	const normalizedCrop = {
		x: crop.x,
		y: crop.y,
		width: crop.width,
		height: crop.height,
	}

	return [{ path: filePath, crop: normalizedCrop }]
}

export function getReferenceImageCrop(params: {
	filePath?: string
	referenceImageOptions?: ReferenceImageOptions
}): Pick<CropConfig, "width" | "height" | "x" | "y"> | undefined {
	const { filePath, referenceImageOptions } = params
	if (!filePath || !referenceImageOptions?.length) return undefined
	return referenceImageOptions.find((entry) => entry.path === filePath)?.crop
}

/** 缩略图 / popover 内将整图缩放平移，使源图坐标系中的 crop 矩形铺满目标 box（与画布 drawImage 可视一致） */
export interface ReferenceImageCroppedDisplayLayout {
	position: "absolute"
	left: number
	top: number
	width: number
	height: number
	maxWidth: "none"
	maxHeight: "none"
}

export function computeReferenceImageCroppedDisplayLayout(
	boxW: number,
	boxH: number,
	naturalWidth: number,
	naturalHeight: number,
	crop: CropConfig | Pick<CropConfig, "width" | "height" | "x" | "y">,
): ReferenceImageCroppedDisplayLayout | null {
	if (boxW <= 0 || boxH <= 0 || naturalWidth <= 0 || naturalHeight <= 0) {
		return null
	}
	const persisted = getPersistedSourceCrop(crop, {
		width: naturalWidth,
		height: naturalHeight,
	})
	const { x, y, width: cw, height: ch } = persisted
	if (cw <= 0 || ch <= 0) {
		return null
	}
	const scale = Math.max(boxW / cw, boxH / ch)
	return {
		position: "absolute",
		left: -x * scale,
		top: -y * scale,
		width: naturalWidth * scale,
		height: naturalHeight * scale,
		maxWidth: "none",
		maxHeight: "none",
	}
}

export function getCropDisplaySize(params: {
	crop: CropConfig | undefined
	elementSize: ImageDimensions
	sourceDimensions: ImageDimensions
}): ImageDimensions {
	const { crop, elementSize, sourceDimensions } = params
	const elementWidth = normalizeDimension(elementSize.width)
	const elementHeight = normalizeDimension(elementSize.height)
	const sourceWidth = normalizeDimension(sourceDimensions.width)
	const sourceHeight = normalizeDimension(sourceDimensions.height)

	if (crop?.displayWidth && crop?.displayHeight) {
		return {
			width: normalizeDimension(crop.displayWidth),
			height: normalizeDimension(crop.displayHeight),
		}
	}

	if (
		crop &&
		elementWidth > 0 &&
		elementHeight > 0 &&
		sourceWidth > 0 &&
		sourceHeight > 0 &&
		crop.width > 0 &&
		crop.height > 0
	) {
		return {
			width: (elementWidth * sourceWidth) / crop.width,
			height: (elementHeight * sourceHeight) / crop.height,
		}
	}

	return {
		width: elementWidth,
		height: elementHeight,
	}
}

export function getVisibleCropFromSourceCrop(params: {
	crop: CropConfig | undefined
	sourceDimensions: ImageDimensions
	displaySize: ImageDimensions
}): CropConfig {
	const { crop, sourceDimensions, displaySize } = params
	const displayWidth = normalizeDimension(displaySize.width)
	const displayHeight = normalizeDimension(displaySize.height)
	const sourceWidth = normalizeDimension(sourceDimensions.width)
	const sourceHeight = normalizeDimension(sourceDimensions.height)

	if (!crop || sourceWidth <= 0 || sourceHeight <= 0) {
		return {
			x: 0,
			y: 0,
			width: displayWidth,
			height: displayHeight,
		}
	}

	return getVisibleCropIntersection({
		visibleCrop: {
			x: (crop.x * displayWidth) / sourceWidth,
			y: (crop.y * displayHeight) / sourceHeight,
			width: (crop.width * displayWidth) / sourceWidth,
			height: (crop.height * displayHeight) / sourceHeight,
		},
		displaySize,
	})
}

export function getVisibleCropIntersection(params: {
	visibleCrop: CropConfig
	displaySize: ImageDimensions
}): CropConfig {
	const { visibleCrop, displaySize } = params
	const displayWidth = normalizeDimension(displaySize.width)
	const displayHeight = normalizeDimension(displaySize.height)

	const left = Math.max(visibleCrop.x, 0)
	const top = Math.max(visibleCrop.y, 0)
	const right = Math.min(visibleCrop.x + normalizeDimension(visibleCrop.width), displayWidth)
	const bottom = Math.min(visibleCrop.y + normalizeDimension(visibleCrop.height), displayHeight)

	return {
		x: left,
		y: top,
		width: Math.max(0, right - left),
		height: Math.max(0, bottom - top),
	}
}

export function syncCropConfigOnResize(params: {
	crop: CropConfig
	prevElementSize: ImageDimensions
	nextElementSize: ImageDimensions
	sourceDimensions: ImageDimensions
}): CropConfig {
	const { crop, prevElementSize, nextElementSize, sourceDimensions } = params
	const prevWidth = normalizeDimension(prevElementSize.width)
	const prevHeight = normalizeDimension(prevElementSize.height)
	const nextWidth = normalizeDimension(nextElementSize.width)
	const nextHeight = normalizeDimension(nextElementSize.height)

	const persistedCrop = getPersistedSourceCrop(crop, sourceDimensions)
	const baseDisplayWidth = normalizeDimension(crop.displayWidth) || prevWidth
	const baseDisplayHeight = normalizeDimension(crop.displayHeight) || prevHeight

	const widthRatio = prevWidth > 0 ? nextWidth / prevWidth : 1
	const heightRatio = prevHeight > 0 ? nextHeight / prevHeight : 1
	const prevDisplaySize = {
		width: baseDisplayWidth,
		height: baseDisplayHeight,
	}
	const nextDisplaySize = {
		width: baseDisplayWidth * widthRatio,
		height: baseDisplayHeight * heightRatio,
	}
	const prevVisibleCrop = getVisibleCropFromSourceCrop({
		crop: persistedCrop,
		sourceDimensions,
		displaySize: prevDisplaySize,
	})
	const nextVisibleCrop = getVisibleCropIntersection({
		visibleCrop: {
			x: prevVisibleCrop.x * widthRatio,
			y: prevVisibleCrop.y * heightRatio,
			width: prevVisibleCrop.width * widthRatio,
			height: prevVisibleCrop.height * heightRatio,
		},
		displaySize: nextDisplaySize,
	})

	return composeSourceCropFromVisibleCrop({
		visibleCrop: nextVisibleCrop,
		displaySize: nextDisplaySize,
		sourceDimensions,
	})
}

export function composeSourceCropFromVisibleCrop(params: {
	visibleCrop: CropConfig
	displaySize: ImageDimensions
	sourceDimensions: ImageDimensions
}): CropConfig {
	const { visibleCrop, displaySize, sourceDimensions } = params
	const displayWidth = normalizeDimension(displaySize.width)
	const displayHeight = normalizeDimension(displaySize.height)
	const sourceWidth = normalizeDimension(sourceDimensions.width)
	const sourceHeight = normalizeDimension(sourceDimensions.height)

	if (displayWidth <= 0 || displayHeight <= 0 || sourceWidth <= 0 || sourceHeight <= 0) {
		return {
			...roundSourceCropRect({
				x: 0,
				y: 0,
				width: sourceWidth,
				height: sourceHeight,
			}),
			displayWidth: roundCropScalar(displayWidth),
			displayHeight: roundCropScalar(displayHeight),
		}
	}

	return {
		...roundSourceCropRect({
			x: (visibleCrop.x * sourceWidth) / displayWidth,
			y: (visibleCrop.y * sourceHeight) / displayHeight,
			width: (normalizeDimension(visibleCrop.width) * sourceWidth) / displayWidth,
			height: (normalizeDimension(visibleCrop.height) * sourceHeight) / displayHeight,
		}),
		displayWidth: roundCropScalar(displayWidth),
		displayHeight: roundCropScalar(displayHeight),
	}
}
