import { useLayoutEffect, useMemo, useState } from "react"
import {
	HTML_CODE_BLOCK_PREVIEW_DESKTOP_HEIGHT,
	HTML_CODE_BLOCK_PREVIEW_HEIGHT_SHRINK_THRESHOLD,
	HTML_CODE_BLOCK_PREVIEW_HEIGHT_TO_WIDTH_RATIO,
	HTML_CODE_BLOCK_PREVIEW_MIN_READABLE_SCALE,
} from "../constants"

// 计算预览缩放所需输入：容器宽度、内容宽度，以及可选的高度约束。
interface ResolveHtmlCodeBlockPreviewScaleOptions {
	containerWidth: number
	contentWidth: number
	containerHeight?: number
	contentHeight?: number
	fitHeightWhenBounded?: boolean
	minReadableScale?: number
}

// 计算预览视口高度所需输入。
interface ResolveHtmlCodeBlockPreviewViewportHeightOptions {
	containerWidth: number
	contentHeight?: number
	previewScale: number
	fitHeightWhenBounded?: boolean
	shrinkThreshold?: number
}

// 解析预览缩放比例，优先保证内容可见，并保留最低可读缩放。
export function resolveHtmlCodeBlockPreviewScale(options: ResolveHtmlCodeBlockPreviewScaleOptions) {
	const {
		containerWidth,
		contentWidth,
		containerHeight = 0,
		contentHeight = 0,
		fitHeightWhenBounded = false,
		minReadableScale = HTML_CODE_BLOCK_PREVIEW_MIN_READABLE_SCALE,
	} = options

	if (!containerWidth || !contentWidth) return 1

	// 先按宽度完整放下计算基础缩放。
	const fitPreviewScale = Math.min(1, containerWidth / contentWidth)

	if (
		fitHeightWhenBounded &&
		containerHeight > 0 &&
		contentHeight > 0 &&
		contentHeight > containerHeight
	) {
		// 高度受限时，取宽高约束中更严格的那个。
		const fitHeightScale = Math.min(1, containerHeight / contentHeight)
		return Math.min(1, fitPreviewScale, fitHeightScale)
	}

	// 宽度已放得下时不再缩小。
	if (contentWidth <= containerWidth) return 1

	// 内容过宽时按宽度压缩，但保留最低可读缩放。
	return Math.min(1, Math.max(fitPreviewScale, minReadableScale))
}

// 解析预览视口高度，避免卡片高度频繁跳动。
export function resolveHtmlCodeBlockPreviewViewportHeight(
	options: ResolveHtmlCodeBlockPreviewViewportHeightOptions,
) {
	const {
		containerWidth,
		contentHeight = 0,
		previewScale,
		fitHeightWhenBounded = false,
		shrinkThreshold = HTML_CODE_BLOCK_PREVIEW_HEIGHT_SHRINK_THRESHOLD,
	} = options

	// 基础高度沿用默认值，窄容器里按比例缩小。
	const baseViewportHeight = !containerWidth
		? HTML_CODE_BLOCK_PREVIEW_DESKTOP_HEIGHT
		: Math.min(
				HTML_CODE_BLOCK_PREVIEW_DESKTOP_HEIGHT,
				Math.round(containerWidth * HTML_CODE_BLOCK_PREVIEW_HEIGHT_TO_WIDTH_RATIO),
			)

	// 不按内容高度收缩时，直接返回基础高度。
	if (!fitHeightWhenBounded || !contentHeight || !previewScale) return baseViewportHeight

	const scaledContentHeight = Math.max(1, Math.round(contentHeight * previewScale))
	// 差异太小时不收缩，避免边界值抖动。
	if (baseViewportHeight - scaledContentHeight < shrinkThreshold) return baseViewportHeight

	return Math.min(baseViewportHeight, scaledContentHeight)
}

// 将内容尺寸转换成预览卡片的缩放和视口布局。
export function useHtmlCodeBlockPreviewScale(
	canvasWidth: number,
	options?: {
		contentHeight?: number
		fitHeightWhenBounded?: boolean
		containerWidthOverride?: number
	},
) {
	const [previewHostElement, setPreviewHostElement] = useState<HTMLDivElement | null>(null)
	const [previewScale, setPreviewScale] = useState(1)
	const [previewHostWidth, setPreviewHostWidth] = useState(0)
	const { contentHeight, fitHeightWhenBounded = false, containerWidthOverride } = options ?? {}

	useLayoutEffect(() => {
		// 宿主宽度变化时，重新推导缩放和视口高度。
		function updatePreviewScale(availableWidth: number) {
			if (!availableWidth) return

			setPreviewHostWidth(availableWidth)

			const nextPreviewViewportHeight = Math.min(
				HTML_CODE_BLOCK_PREVIEW_DESKTOP_HEIGHT,
				Math.round(availableWidth * HTML_CODE_BLOCK_PREVIEW_HEIGHT_TO_WIDTH_RATIO),
			)
			const nextPreviewScale = resolveHtmlCodeBlockPreviewScale({
				containerWidth: availableWidth,
				contentWidth: canvasWidth,
				containerHeight: nextPreviewViewportHeight,
				contentHeight,
				fitHeightWhenBounded,
			})

			setPreviewScale((previousScale) =>
				// 避免同值重复 setState。
				previousScale === nextPreviewScale ? previousScale : nextPreviewScale,
			)
		}

		// 父层已给出可用宽度时，直接使用。
		if (containerWidthOverride && containerWidthOverride > 0) {
			updatePreviewScale(containerWidthOverride)
			return
		}

		if (!previewHostElement || typeof ResizeObserver === "undefined") return

		updatePreviewScale(previewHostElement.clientWidth)

		const resizeObserver = new ResizeObserver((entries) => {
			updatePreviewScale(entries[0]?.contentRect.width ?? previewHostElement.clientWidth)
		})

		resizeObserver.observe(previewHostElement)

		return () => {
			resizeObserver.disconnect()
		}
	}, [
		canvasWidth,
		containerWidthOverride,
		contentHeight,
		fitHeightWhenBounded,
		previewHostElement,
	])

	const previewViewportHeight = useMemo(
		() =>
			resolveHtmlCodeBlockPreviewViewportHeight({
				containerWidth: previewHostWidth,
				contentHeight,
				previewScale,
				fitHeightWhenBounded,
			}),
		[contentHeight, fitHeightWhenBounded, previewHostWidth, previewScale],
	)

	const previewCanvasStyle = useMemo(
		() => ({
			height: `${previewViewportHeight / previewScale}px`,
			transform:
				previewScale === 1 ? undefined : `scale3d(${previewScale}, ${previewScale}, 1)`,
		}),
		[previewScale, previewViewportHeight],
	)

	const previewScaledCanvasWidth = useMemo(
		() => Math.round(canvasWidth * previewScale),
		[canvasWidth, previewScale],
	)

	return {
		setPreviewHostElement,
		previewHostWidth,
		previewCanvasStyle,
		previewViewportHeight,
		previewScaledCanvasWidth,
		previewScale,
	}
}
