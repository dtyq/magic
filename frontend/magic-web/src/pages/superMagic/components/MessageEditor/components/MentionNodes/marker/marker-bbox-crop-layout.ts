import type { CSSProperties } from "react"

export interface MarkerBbox {
	x: number
	y: number
	width: number
	height: number
}

export interface MarkerBboxCropLayout {
	outerContainerStyle: CSSProperties
	cropContainerStyle: CSSProperties
	imageStyle: CSSProperties
	/** 在 crop 容器坐标系下高亮 bbox，需配合 `position: relative` 的 crop 容器 */
	highlightRectStyle: CSSProperties | null
}

interface GetMarkerBboxCropLayoutParams {
	bbox?: MarkerBbox
	containerSize: number
	imageAspectRatio: number | null
	elementWidth?: number
	elementHeight?: number
}

/**
 * 按 bbox 在固定方形容器内居中裁剪展示原图（与 MarkerDropdown 缩略图同一套几何）。
 * elementWidth/elementHeight 与 bbox 同一像素坐标系时，可得到 highlightRectStyle 用于框选区域。
 */
export function getMarkerBboxCropLayout({
	bbox,
	containerSize,
	imageAspectRatio,
	elementWidth,
	elementHeight,
}: GetMarkerBboxCropLayoutParams): MarkerBboxCropLayout {
	if (!bbox || bbox.width === 0 || bbox.height === 0) {
		return {
			outerContainerStyle: {
				width: containerSize,
				height: containerSize,
				border: "1px solid rgb(229, 229, 229)",
				borderRadius: "8px",
			},
			cropContainerStyle: {
				width: containerSize,
				height: containerSize,
				overflow: "hidden" as const,
			},
			imageStyle: {
				width: containerSize,
				height: containerSize,
				objectFit: "cover" as const,
			},
			highlightRectStyle: null,
		}
	}

	const bboxAspectRatio = bbox.width / bbox.height

	let cropContainerWidth: number
	let cropContainerHeight: number

	if (bboxAspectRatio >= 1) {
		cropContainerWidth = containerSize
		cropContainerHeight = containerSize / bboxAspectRatio
	} else {
		cropContainerHeight = containerSize
		cropContainerWidth = containerSize * bboxAspectRatio
	}

	const centerX = bbox.x + bbox.width / 2
	const centerY = bbox.y + bbox.height / 2

	let scaledWidth: number
	let scaledHeight: number

	if (imageAspectRatio && imageAspectRatio > 0) {
		const scaleX = cropContainerWidth / bbox.width
		const scaleY = cropContainerHeight / bbox.height
		const scaledHeightFromX = scaleX / imageAspectRatio
		const meetsY = scaledHeightFromX * bbox.height >= cropContainerHeight

		if (meetsY) {
			scaledWidth = scaleX
			scaledHeight = scaledHeightFromX
		} else {
			scaledHeight = scaleY
			scaledWidth = scaledHeight * imageAspectRatio
		}
	} else {
		const scaleX = cropContainerWidth / bbox.width
		const scaleY = cropContainerHeight / bbox.height
		const scale = Math.max(scaleX, scaleY)
		scaledWidth = scale
		scaledHeight = scale
	}

	const offsetX = cropContainerWidth / 2 - centerX * scaledWidth
	const offsetY = cropContainerHeight / 2 - centerY * scaledHeight

	const ew = elementWidth ?? 0
	const eh = elementHeight ?? 0
	let highlightRectStyle: CSSProperties | null = null
	if (ew > 0 && eh > 0) {
		highlightRectStyle = {
			position: "absolute" as const,
			left: offsetX + (bbox.x / ew) * scaledWidth,
			top: offsetY + (bbox.y / eh) * scaledHeight,
			width: (bbox.width / ew) * scaledWidth,
			height: (bbox.height / eh) * scaledHeight,
			boxSizing: "border-box" as const,
			border: "2px solid rgb(var(--primary-rgb))",
			borderRadius: 4,
			pointerEvents: "none" as const,
			boxShadow: "0 0 0 1px rgb(255 255 255 / 0.6) inset",
		}
	}

	return {
		outerContainerStyle: {
			width: containerSize,
			height: containerSize,
			border: "1px solid rgb(229, 229, 229)",
			borderRadius: "8px",
			overflow: "hidden" as const,
		},
		cropContainerStyle: {
			width: cropContainerWidth,
			height: cropContainerHeight,
			position: "relative" as const,
		},
		imageStyle: {
			maxWidth: "unset !important",
			maxHeight: "unset !important",
			width: scaledWidth,
			height: scaledHeight,
			transform: `translate(${offsetX}px, ${offsetY}px)`,
			transformOrigin: "top left",
		},
		highlightRectStyle,
	}
}
