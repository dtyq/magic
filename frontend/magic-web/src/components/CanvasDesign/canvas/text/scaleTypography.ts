import type { RichTextParagraph, TextStyle } from "../types"
import { roundTypographyMetric, TYPOGRAPHY_DECIMAL_PLACES } from "./typographyMetrics"

const SCALE_TOLERANCE = 0.001

function scaleMetric(value: number | undefined, scale: number): number | undefined {
	if (value === undefined) {
		return undefined
	}

	return roundTypographyMetric(value * scale, TYPOGRAPHY_DECIMAL_PLACES)
}

export function resolveTypographyScaleFactor(
	scaleX: number | undefined,
	scaleY: number | undefined,
): number {
	const resolvedScaleX = scaleX ?? 1
	const resolvedScaleY = scaleY ?? 1

	if (Math.abs(resolvedScaleX - resolvedScaleY) <= SCALE_TOLERANCE) {
		return (resolvedScaleX + resolvedScaleY) / 2
	}

	// 字号本质上控制文本的垂直尺寸，兼容旧的非等比 scale 数据时优先保留视觉高度。
	return resolvedScaleY
}

export function resolveTypographyScaleFromTransform(options: {
	currentWidth?: number
	currentHeight?: number
	nextWidth?: number
	nextHeight?: number
	scaleX?: number
	scaleY?: number
}): number {
	const { currentWidth, currentHeight, nextWidth, nextHeight, scaleX, scaleY } = options

	const scaledWidth = nextWidth !== undefined ? nextWidth * (scaleX ?? 1) : undefined
	const scaledHeight = nextHeight !== undefined ? nextHeight * (scaleY ?? 1) : undefined

	const widthRatio =
		currentWidth && currentWidth > 0 && scaledWidth !== undefined
			? scaledWidth / currentWidth
			: undefined
	const heightRatio =
		currentHeight && currentHeight > 0 && scaledHeight !== undefined
			? scaledHeight / currentHeight
			: undefined

	if (widthRatio !== undefined && heightRatio !== undefined) {
		if (Math.abs(widthRatio - heightRatio) <= SCALE_TOLERANCE) {
			return (widthRatio + heightRatio) / 2
		}

		return heightRatio
	}

	if (heightRatio !== undefined) {
		return heightRatio
	}

	if (widthRatio !== undefined) {
		return widthRatio
	}

	return resolveTypographyScaleFactor(scaleX, scaleY)
}

/**
 * 在一次 Transformer 手势内，以缩放开始时的排版盒为基线，根据当前目标视觉盒推导整体字号倍率。
 * 等比缩放下宽高比应一致，取平均以降低单轴抖动。
 */
export function resolveTypographyScaleFromBaselineBox(options: {
	baselineWidth: number
	baselineHeight: number
	targetWidth: number
	targetHeight: number
}): number {
	const bw = Math.max(options.baselineWidth, 1e-6)
	const bh = Math.max(options.baselineHeight, 1e-6)
	const tw = Math.max(options.targetWidth, 1)
	const th = Math.max(options.targetHeight, 1)
	const rx = tw / bw
	const ry = th / bh
	if (Math.abs(rx - ry) <= SCALE_TOLERANCE) {
		return (rx + ry) / 2
	}
	return (rx + ry) / 2
}

export function scaleTextStyle(style: TextStyle | undefined, scale: number): TextStyle | undefined {
	if (!style) {
		return undefined
	}

	return {
		...style,
		fontSize: scaleMetric(style.fontSize, scale),
		letterSpacing: scaleMetric(style.letterSpacing, scale),
	}
}

export function scaleRichTextContent(
	content: RichTextParagraph[] | undefined,
	scale: number,
): RichTextParagraph[] | undefined {
	if (!content) {
		return undefined
	}

	return content.map((paragraph) => ({
		...paragraph,
		style: paragraph.style
			? {
					...paragraph.style,
					paragraphSpacing: scaleMetric(paragraph.style.paragraphSpacing, scale),
				}
			: undefined,
		children: paragraph.children?.map((node) => ({
			...node,
			style: scaleTextStyle(node.style, scale),
		})),
	}))
}
