import { resolveElementDesignMetrics, type ElementDesignMetrics } from "./ElementDesignTokens"

export type { ElementDesignMetrics } from "./ElementDesignTokens"
export { ELEMENT_DESIGN_TOKENS, resolveElementDesignMetrics } from "./ElementDesignTokens"

export interface LayoutSize {
	width: number
	height: number
}

export interface LayoutPoint {
	x: number
	y: number
}

export interface LayoutRect extends LayoutPoint, LayoutSize {}

export type LayoutAlignment = "start" | "center" | "end"

export type ResponsiveScaleStrategy =
	| { type: "width" }
	| { type: "height" }
	| { type: "contain" }
	| { type: "weighted"; inlineWeight: number }

export type ResponsiveLayoutMode = "regular" | "compact" | "condensed"

export interface ResponsiveElementLayoutSpec {
	designSize: LayoutSize
	baseRem: number
	scale: {
		strategy: ResponsiveScaleStrategy
		min: number
		max: number
	}
	mode?: {
		compactBelow: number
		condensedBelow: number
	}
}

export interface UniformFitResult {
	scale: number
	rect: LayoutRect
	fitsPreferredScale: boolean
}

export interface ResponsiveElementLayoutMetrics {
	width: number
	height: number
	bounds: LayoutRect
	widthRatio: number
	heightRatio: number
	preferredScale: number
	scale: number
	remSize: number
	mode: ResponsiveLayoutMode
	/** 共享间距 / 字阶 / 圆角（已乘元素 scale）。 */
	design: ElementDesignMetrics
	designPx(value: number): number
	rem(value: number): number
	clamp(min: number, preferred: number, max: number): number
	insetRect(
		rect: LayoutRect,
		inset: number | Partial<Record<"top" | "right" | "bottom" | "left", number>>,
	): LayoutRect
	alignRect(
		size: LayoutSize,
		container: LayoutRect,
		alignment?: { inline?: LayoutAlignment; block?: LayoutAlignment },
	): LayoutRect
	constrainRect(rect: LayoutRect, container: LayoutRect): LayoutRect
	fitUniform(
		intrinsicSize: LayoutSize,
		container: LayoutRect,
		options?: {
			preferredScale?: number
			inline?: LayoutAlignment
			block?: LayoutAlignment
		},
	): UniformFitResult
}

function clamp(min: number, preferred: number, max: number): number {
	const lower = Math.min(min, max)
	const upper = Math.max(min, max)
	return Math.max(lower, Math.min(upper, preferred))
}

function normalizeDimension(value: number): number {
	return Number.isFinite(value) ? Math.max(0, value) : 0
}

function resolveAxisPosition(
	containerStart: number,
	containerSize: number,
	itemSize: number,
	alignment: LayoutAlignment,
): number {
	switch (alignment) {
		case "end":
			return containerStart + containerSize - itemSize
		case "center":
			return containerStart + containerSize / 2 - itemSize / 2
		default:
			return containerStart
	}
}

function resolvePreferredScale(
	widthRatio: number,
	heightRatio: number,
	strategy: ResponsiveScaleStrategy,
): number {
	switch (strategy.type) {
		case "width":
			return widthRatio
		case "height":
			return heightRatio
		case "contain":
			return Math.min(widthRatio, heightRatio)
		case "weighted": {
			const inlineWeight = clamp(0, strategy.inlineWeight, 1)
			return Math.pow(widthRatio, inlineWeight) * Math.pow(heightRatio, 1 - inlineWeight)
		}
	}
}

/**
 * 创建元素逻辑坐标内的响应式布局上下文。
 *
 * 这里故意不接收 viewport scale：元素尺寸决定排版，画布缩放只负责把最终
 * Konva 节点整体等比显示。所有不可变形控件只使用单一 scale；横向或纵向
 * 可伸展区域应继续使用 bounds/rect 的真实宽高。
 */
export function resolveResponsiveElementLayout(
	size: LayoutSize,
	spec: ResponsiveElementLayoutSpec,
): ResponsiveElementLayoutMetrics {
	const width = normalizeDimension(size.width)
	const height = normalizeDimension(size.height)
	const designWidth = Math.max(0.0001, normalizeDimension(spec.designSize.width))
	const designHeight = Math.max(0.0001, normalizeDimension(spec.designSize.height))
	const widthRatio = width / designWidth
	const heightRatio = height / designHeight
	const preferredScale = resolvePreferredScale(widthRatio, heightRatio, spec.scale.strategy)
	const scale = clamp(spec.scale.min, preferredScale, spec.scale.max)
	const mode = spec.mode
		? preferredScale < spec.mode.condensedBelow
			? "condensed"
			: preferredScale < spec.mode.compactBelow
				? "compact"
				: "regular"
		: "regular"
	const bounds = { x: 0, y: 0, width, height }

	const alignRect: ResponsiveElementLayoutMetrics["alignRect"] = (
		itemSize,
		container,
		alignment,
	) => {
		const itemWidth = Math.min(normalizeDimension(itemSize.width), container.width)
		const itemHeight = Math.min(normalizeDimension(itemSize.height), container.height)
		return {
			x: resolveAxisPosition(
				container.x,
				container.width,
				itemWidth,
				alignment?.inline ?? "start",
			),
			y: resolveAxisPosition(
				container.y,
				container.height,
				itemHeight,
				alignment?.block ?? "start",
			),
			width: itemWidth,
			height: itemHeight,
		}
	}

	const designPx = (value: number) => value * scale

	const metrics: ResponsiveElementLayoutMetrics = {
		width,
		height,
		bounds,
		widthRatio,
		heightRatio,
		preferredScale,
		scale,
		remSize: spec.baseRem * scale,
		mode,
		design: resolveElementDesignMetrics(designPx),
		designPx,
		rem: (value) => value * spec.baseRem * scale,
		clamp,
		insetRect: (rect, inset) => {
			const insets =
				typeof inset === "number"
					? { top: inset, right: inset, bottom: inset, left: inset }
					: {
							top: inset.top ?? 0,
							right: inset.right ?? 0,
							bottom: inset.bottom ?? 0,
							left: inset.left ?? 0,
						}
			return {
				x: rect.x + insets.left,
				y: rect.y + insets.top,
				width: Math.max(0, rect.width - insets.left - insets.right),
				height: Math.max(0, rect.height - insets.top - insets.bottom),
			}
		},
		alignRect,
		constrainRect: (rect, container) => {
			const constrainedWidth = Math.min(normalizeDimension(rect.width), container.width)
			const constrainedHeight = Math.min(normalizeDimension(rect.height), container.height)
			return {
				x: clamp(container.x, rect.x, container.x + container.width - constrainedWidth),
				y: clamp(container.y, rect.y, container.y + container.height - constrainedHeight),
				width: constrainedWidth,
				height: constrainedHeight,
			}
		},
		fitUniform: (intrinsicSize, container, options) => {
			const intrinsicWidth = normalizeDimension(intrinsicSize.width)
			const intrinsicHeight = normalizeDimension(intrinsicSize.height)
			const requestedScale = Math.max(0, options?.preferredScale ?? scale)
			const widthScale =
				intrinsicWidth > 0 ? container.width / intrinsicWidth : requestedScale
			const heightScale =
				intrinsicHeight > 0 ? container.height / intrinsicHeight : requestedScale
			const fittedScale = Math.max(0, Math.min(requestedScale, widthScale, heightScale))
			const rect = alignRect(
				{
					width: intrinsicWidth * fittedScale,
					height: intrinsicHeight * fittedScale,
				},
				container,
				{
					inline: options?.inline ?? "center",
					block: options?.block ?? "center",
				},
			)
			return {
				scale: fittedScale,
				rect,
				fitsPreferredScale: fittedScale >= requestedScale - 0.0001,
			}
		},
	}

	return metrics
}
