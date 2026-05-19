/**
 * Anchor 相关工具 - 统一 anchor 常量与 keep ratio 逻辑
 *
 * 供 TransformManager、SnapGuideManager、CropRenderer 共用，保证 boundBoxFunc、applySnapForScaling、
 * getSnappedBox 的 keep ratio 行为一致
 */

/**
 * 吸附阈值常量（像素）
 * 统一管理吸附阈值，避免在多个文件中重复定义
 */
export const SNAP_THRESHOLD = 8

/**
 * 计算考虑缩放后的吸附阈值
 * @param scale 缩放比例（通常来自 stage.scaleX() 或 overlayGroup.scaleX()）
 * @returns 缩放后的吸附阈值
 */
export function calculateSnapThreshold(scale: number): number {
	return SNAP_THRESHOLD / scale
}

export const EDGE_ANCHORS = ["top-center", "bottom-center", "middle-left", "middle-right"] as const

export type EdgeAnchor = (typeof EDGE_ANCHORS)[number]

export function isEdgeAnchor(anchor: string | null): anchor is EdgeAnchor {
	return EDGE_ANCHORS.includes(anchor as EdgeAnchor)
}

/**
 * 获取 keep ratio 时的目标宽高比
 * 与 TransformManager.boundBoxFunc、getSnappedBox 的 ratio 计算保持一致
 */
export function getKeepRatioAspectRatio(
	initialAspectRatio: number | null,
	fallbackBox: { width: number; height: number },
): number {
	if (initialAspectRatio != null && initialAspectRatio > 0) return initialAspectRatio
	const { width, height } = fallbackBox
	return height !== 0 ? width / height : 1
}

export interface Rect {
	x: number
	y: number
	width: number
	height: number
}

/**
 * 将 rect 约束到指定宽高比
 * 固定点由 anchor 决定：拖动哪边，对边/对角保持不变
 *
 * 与 TransformManager.boundBoxFunc、applySnapForScaling 的 keep ratio 逻辑保持一致
 * @param rect - 待约束的 rect（通常为吸附后的 rect）
 * @param targetRect - 约束前的参考 rect，用于角点时选择变化较大的维度作为 driver
 */
export function constrainRectToAspectRatio(
	rect: Rect,
	targetRect: Rect,
	activeAnchor: string,
	aspectRatio: number,
): Rect {
	const ratio = aspectRatio

	if (isEdgeAnchor(activeAnchor)) {
		if (activeAnchor === "middle-left") {
			const width = rect.width
			const height = rect.width / ratio
			return {
				x: rect.x,
				y: rect.y + rect.height - height,
				width,
				height,
			}
		}
		if (activeAnchor === "middle-right") {
			const width = rect.width
			const height = rect.width / ratio
			return {
				x: rect.x,
				y: rect.y,
				width,
				height,
			}
		}
		if (activeAnchor === "top-center") {
			const height = rect.height
			const width = rect.height * ratio
			return {
				x: rect.x + rect.width - width,
				y: rect.y,
				width,
				height,
			}
		}
		const height = rect.height
		const width = rect.height * ratio
		return {
			x: rect.x,
			y: rect.y,
			width,
			height,
		}
	}

	// 角点：选变化较大的维度作为 driver，固定对顶点
	const refW = targetRect.width || 1
	const refH = targetRect.height || 1
	const widthRatio = rect.width / refW
	const heightRatio = rect.height / refH
	const useWidth = Math.abs(widthRatio - 1) >= Math.abs(heightRatio - 1)
	const scale = useWidth ? widthRatio : heightRatio
	const width = refW * scale
	const height = refH * scale

	let x = targetRect.x
	let y = targetRect.y
	if (activeAnchor.includes("left")) x = targetRect.x + targetRect.width - width
	if (activeAnchor.includes("top")) y = targetRect.y + targetRect.height - height
	return { x, y, width, height }
}

/** Konva Transformer boundBox 基础类型（x, y, width, height） */
export interface BoundBoxRect {
	x: number
	y: number
	width: number
	height: number
}

/**
 * 将 boundBox 约束到指定宽高比（供 boundBoxFunc 使用）
 * 与 TransformManager 的边 anchor 逻辑保持一致，角点使用 constrainRectToAspectRatio
 * 返回结果会保留输入 newBox 的额外属性（如 rotation）
 *
 * @param oldBox - 变换前的 box
 * @param newBox - 变换后的 box（来自 Konva）
 * @param activeAnchor - 当前拖拽的 anchor 名称
 * @param initialAspectRatio - 变换开始时的初始宽高比
 * @returns 约束后的 box
 */
export function applyAspectRatioToBoundBox<T extends BoundBoxRect>(
	oldBox: T,
	newBox: T,
	activeAnchor: string,
	initialAspectRatio: number | null,
): T {
	const ratio = getKeepRatioAspectRatio(initialAspectRatio, oldBox)

	if (isEdgeAnchor(activeAnchor)) {
		// 边 anchor：与 TransformManager 内联逻辑一致
		if (activeAnchor === "middle-left") {
			const newHeight = newBox.width / ratio
			const heightDiff = newHeight - oldBox.height
			return { ...newBox, height: newHeight, y: newBox.y - heightDiff } as T
		}
		if (activeAnchor === "middle-right") {
			const newHeight = newBox.width / ratio
			return { ...newBox, height: newHeight } as T
		}
		if (activeAnchor === "top-center") {
			const newWidth = newBox.height * ratio
			const widthDiff = newWidth - oldBox.width
			return { ...newBox, width: newWidth, x: newBox.x - widthDiff } as T
		}
		if (activeAnchor === "bottom-center") {
			const newWidth = newBox.height * ratio
			return { ...newBox, width: newWidth } as T
		}
	}

	// 角点：使用 constrainRectToAspectRatio
	const constrained = constrainRectToAspectRatio(newBox, oldBox, activeAnchor, ratio)
	return { ...newBox, ...constrained } as T
}
