import type { LayerElement } from "../../document/types"

export type ConnectionCreateOriginSide = "left" | "right"

export const CREATE_ELEMENT_GAP_MIN_CANVAS_PX = 1024
const CREATE_ELEMENT_GAP_MAX_CANVAS_PX = 2048
const CREATE_ELEMENT_GAP_SIZE_RATIO = 0.7

export function clampCreateElementGap(gap: number): number {
	return Math.min(
		CREATE_ELEMENT_GAP_MAX_CANVAS_PX,
		Math.max(CREATE_ELEMENT_GAP_MIN_CANVAS_PX, gap),
	)
}

export function getConnectionMenuTriggerAxisSize(
	element: LayerElement | undefined,
	side: ConnectionCreateOriginSide,
): number | null {
	const size = side === "left" || side === "right" ? element?.width : element?.height
	const scale = side === "left" || side === "right" ? element?.scaleX : element?.scaleY
	const scaledSize = Math.abs((size ?? 0) * (scale ?? 1))
	return Number.isFinite(scaledSize) && scaledSize > 0 ? scaledSize : null
}

/** 将视觉锚点在连线方向上的尺寸换算为右/左侧创建间距。 */
export function resolveConnectionCreateGapForAxisSize(axisSize: number | null | undefined): number {
	if (!axisSize || !Number.isFinite(axisSize) || axisSize <= 0) {
		return CREATE_ELEMENT_GAP_MIN_CANVAS_PX
	}
	return clampCreateElementGap(axisSize * CREATE_ELEMENT_GAP_SIZE_RATIO)
}

/**
 * 连接 handle 新增元素使用的横向间距。
 *
 * 这个间距同时用于连接菜单创建节点和分镜输出 Frame，避免两套“右侧留白”规则漂移。
 */
export function resolveConnectionCreateGapForElement(
	element: LayerElement | undefined,
	side: ConnectionCreateOriginSide | undefined,
): number {
	if (!side) return CREATE_ELEMENT_GAP_MIN_CANVAS_PX

	const triggerAxisSize = getConnectionMenuTriggerAxisSize(element, side)
	return resolveConnectionCreateGapForAxisSize(triggerAxisSize)
}
