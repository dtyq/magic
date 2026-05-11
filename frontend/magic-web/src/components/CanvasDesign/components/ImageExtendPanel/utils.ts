import type { ExtendSession, ImageElement } from "../../canvas/types"

export function createInitialExtendSession(imageElement: ImageElement): ExtendSession {
	return {
		frame: {
			x: 0,
			y: 0,
			width: imageElement.width ?? 0,
			height: imageElement.height ?? 0,
		},
	}
}

export function resizeExtendSessionFrame(options: {
	session: ExtendSession
	imageWidth: number
	imageHeight: number
	targetWidth: number
	targetHeight: number
	/** 与扩展框同一局部坐标系下的点；若提供，新框以此为中心（用于对齐代理图中心） */
	anchorCenter?: { x: number; y: number }
}): ExtendSession {
	const { session, imageWidth, imageHeight, targetWidth, targetHeight, anchorCenter } = options
	const nextWidth = Math.max(targetWidth, imageWidth)
	const nextHeight = Math.max(targetHeight, imageHeight)
	const frameCenterX = anchorCenter ? anchorCenter.x : session.frame.x + session.frame.width / 2
	const frameCenterY = anchorCenter ? anchorCenter.y : session.frame.y + session.frame.height / 2

	return {
		frame: {
			x: frameCenterX - nextWidth / 2,
			y: frameCenterY - nextHeight / 2,
			width: nextWidth,
			height: nextHeight,
		},
	}
}

export function parsePresetAspectRatio(value: string): number | null {
	const ratioMatch = value.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)
	if (!ratioMatch) return null

	const width = Number(ratioMatch[1])
	const height = Number(ratioMatch[2])
	if (!width || !height) return null

	return width / height
}

export function calculateExtendFrameSizeFromRatio(options: {
	imageWidth: number
	imageHeight: number
	targetAspectRatio: number
}): { width: number; height: number } {
	const { imageWidth, imageHeight, targetAspectRatio } = options
	const currentAspectRatio = imageWidth / imageHeight

	if (targetAspectRatio >= currentAspectRatio) {
		return {
			width: Math.round(imageHeight * targetAspectRatio),
			height: imageHeight,
		}
	}

	return {
		width: imageWidth,
		height: Math.round(imageWidth / targetAspectRatio),
	}
}

export function calculateExtendFrameSizeFromControls(options: {
	imageWidth: number
	imageHeight: number
	scale: number
	targetAspectRatio?: number | null
}): { width: number; height: number } {
	const { imageWidth, imageHeight, scale, targetAspectRatio } = options
	const scaledWidth = Math.round(imageWidth * scale)
	const scaledHeight = Math.round(imageHeight * scale)

	if (!targetAspectRatio) {
		return {
			width: scaledWidth,
			height: scaledHeight,
		}
	}

	return calculateExtendFrameSizeFromRatio({
		imageWidth: scaledWidth,
		imageHeight: scaledHeight,
		targetAspectRatio,
	})
}

export function calculateExtendPresetIconSize(ratioLabel: string): {
	iconWidth: number
	iconHeight: number
} {
	const aspectRatio = parsePresetAspectRatio(ratioLabel)
	const baseSize = 12

	if (!aspectRatio) {
		return { iconWidth: baseSize, iconHeight: baseSize }
	}

	if (aspectRatio >= 1) {
		return {
			iconWidth: baseSize,
			iconHeight: Math.max(1, Math.round(baseSize / aspectRatio)),
		}
	}

	return {
		iconWidth: Math.max(1, Math.round(baseSize * aspectRatio)),
		iconHeight: baseSize,
	}
}
