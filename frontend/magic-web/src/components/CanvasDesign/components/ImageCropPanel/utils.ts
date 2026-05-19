import type { PresetOptionItem } from "./options"

/**
 * 按目标宽高比在元素尺寸内计算裁剪宽高，两边均不超出元素（等比缩放至最大内接矩形）
 */
export function fitCommonPresetCropToElement(
	elementWidth: number,
	elementHeight: number,
	ratioWidth: number,
	ratioHeight: number,
): { width: number; height: number } {
	if (elementWidth <= 0 || elementHeight <= 0 || ratioWidth <= 0 || ratioHeight <= 0) {
		return {
			width: Math.max(0, Math.floor(elementWidth)),
			height: Math.max(0, Math.floor(elementHeight)),
		}
	}
	const scale = Math.min(elementWidth / ratioWidth, elementHeight / ratioHeight)
	return {
		width: Math.max(1, Math.floor(scale * ratioWidth)),
		height: Math.max(1, Math.floor(scale * ratioHeight)),
	}
}

/**
 * 裁剪框在显示区域内水平垂直居中（与裁剪编辑态 tempCrop 的显示坐标一致）
 */
export function centerCropRectInDisplayBounds(
	displayWidth: number,
	displayHeight: number,
	cropWidth: number,
	cropHeight: number,
): { x: number; y: number } {
	const maxX = Math.max(0, displayWidth - cropWidth)
	const maxY = Math.max(0, displayHeight - cropHeight)
	const x = Math.min(maxX, Math.max(0, Math.round((displayWidth - cropWidth) / 2)))
	const y = Math.min(maxY, Math.max(0, Math.round((displayHeight - cropHeight) / 2)))
	return { x, y }
}

/**
 * 根据预设像素尺寸和当前图片尺寸计算合适的裁剪宽高
 *
 * 暂时直接设置, 不需要根据图片尺寸计算
 */
export function calculateSizeFromPreset(
	presetWidth: number,
	presetHeight: number,
	currentImageWidth: number,
	currentImageHeight: number,
): { width: number; height: number } {
	// if (presetWidth <= currentImageWidth && presetHeight <= currentImageHeight) {
	// 	return { width: presetWidth, height: presetHeight }
	// }

	// const aspectRatio = presetWidth / presetHeight

	// if (presetWidth >= presetHeight) {
	// 	const targetWidth = Math.min(presetWidth, currentImageWidth)
	// 	const targetHeight = Math.round(targetWidth / aspectRatio)
	// 	if (targetHeight > currentImageHeight) {
	// 		return {
	// 			width: Math.round(currentImageHeight * aspectRatio),
	// 			height: currentImageHeight,
	// 		}
	// 	}
	// 	return { width: targetWidth, height: targetHeight }
	// } else {
	// 	const targetHeight = Math.min(presetHeight, currentImageHeight)
	// 	const targetWidth = Math.round(targetHeight * aspectRatio)
	// 	if (targetWidth > currentImageWidth) {
	// 		return {
	// 			width: currentImageWidth,
	// 			height: Math.round(currentImageWidth / aspectRatio),
	// 		}
	// 	}
	// 	return { width: targetWidth, height: targetHeight }
	// }

	return { width: presetWidth, height: presetHeight }
}

/**
 * 根据预设项计算图标显示尺寸(保持比例,基准 12px)
 */
export function calculatePresetIconSize(child: Required<PresetOptionItem>): {
	iconWidth: number
	iconHeight: number
} {
	const baseSize = 12
	let width: number
	let height: number

	if (child.value && child.value.includes("x")) {
		const [w, h] = child.value.split("x").map(Number)
		if (!isNaN(w) && !isNaN(h)) {
			width = w
			height = h
		} else {
			const ratioMatch = child.label.match(/^(\d+):(\d+)$/)
			if (ratioMatch) {
				width = Number(ratioMatch[1])
				height = Number(ratioMatch[2])
			} else {
				return { iconWidth: baseSize, iconHeight: baseSize }
			}
		}
	} else {
		const ratioMatch = child.label.match(/^(\d+):(\d+)$/)
		if (ratioMatch) {
			width = Number(ratioMatch[1])
			height = Number(ratioMatch[2])
		} else {
			return { iconWidth: baseSize, iconHeight: baseSize }
		}
	}

	const aspectRatio = width / height
	if (aspectRatio >= 1) {
		return {
			iconWidth: baseSize,
			iconHeight: Math.round(baseSize / aspectRatio),
		}
	}
	return {
		iconWidth: Math.round(baseSize * aspectRatio),
		iconHeight: baseSize,
	}
}
