/**
 * Anchor 相关工具 - 统一 anchor 常量与 keep ratio 逻辑
 *
 * 供 TransformManager、SnapGuideManager 共用，保证 boundBoxFunc、applySnapForScaling、
 * getSnappedBox 的 keep ratio 行为一致
 */

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
