import { useCallback, useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { HTML_CODE_BLOCK_PREVIEW_CONTENT_METRICS_THRESHOLD } from "../constants"
import { useHtmlCodeBlockPreviewScale } from "../hooks/useHtmlCodeBlockPreviewScale"
import type { HtmlCodeBlockPreviewContentMetrics } from "../types"
import { resolveHtmlPreviewCanvasWidth } from "../utils"
import { HtmlPreviewRenderer, type HtmlPreviewRendererMetrics } from "./HtmlPreviewRenderer"
import { HtmlCodeBlockPreviewSkeleton } from "./HtmlCodeBlockPreviewSkeleton"

interface HtmlCodeBlockDesktopPreviewProps {
	resolvedCode: string
	isPreviewLoading: boolean
	onPreviewRenderReady: () => void
	availableWidth?: number
	onSuggestedCardWidthChange?: (nextWidth: number | null) => void
}

export function HtmlCodeBlockDesktopPreview(props: HtmlCodeBlockDesktopPreviewProps) {
	const {
		resolvedCode,
		isPreviewLoading,
		onPreviewRenderReady,
		availableWidth,
		onSuggestedCardWidthChange,
	} = props
	const [contentMetrics, setContentMetrics] = useState<HtmlCodeBlockPreviewContentMetrics | null>(
		null,
	)
	const heuristicCanvasWidth = useMemo(
		() => resolveHtmlPreviewCanvasWidth(resolvedCode),
		[resolvedCode],
	)
	const previewCanvasWidth = contentMetrics?.contentWidth ?? heuristicCanvasWidth
	const hasBoundedContentHeight =
		Boolean(contentMetrics) &&
		contentMetrics?.hasVerticalOverflow !== true &&
		(contentMetrics?.contentHeight ?? 0) > 0

	useEffect(() => {
		setContentMetrics(null)
	}, [resolvedCode])

	const handleContentMetrics = useCallback((nextMetrics: HtmlPreviewRendererMetrics) => {
		const contentWidth = Math.max(1, Math.round(nextMetrics.contentWidth))
		const contentHeight = Math.max(1, Math.round(nextMetrics.contentHeight))

		setContentMetrics((previousMetrics) => {
			if (previousMetrics?.phase === "settled") return previousMetrics

			const shouldKeepPreviousMetrics =
				previousMetrics &&
				Math.abs(previousMetrics.contentWidth - contentWidth) <
					HTML_CODE_BLOCK_PREVIEW_CONTENT_METRICS_THRESHOLD &&
				Math.abs(previousMetrics.contentHeight - contentHeight) <
					HTML_CODE_BLOCK_PREVIEW_CONTENT_METRICS_THRESHOLD

			if (shouldKeepPreviousMetrics) return previousMetrics

			return {
				contentWidth,
				contentHeight,
				phase: nextMetrics.phase,
				hasHorizontalOverflow: nextMetrics.hasHorizontalOverflow === true,
				hasVerticalOverflow: nextMetrics.hasVerticalOverflow === true,
			}
		})
	}, [])

	const {
		setPreviewHostElement,
		previewCanvasStyle,
		previewViewportHeight,
		previewScaledCanvasWidth,
		previewScale,
	} = useHtmlCodeBlockPreviewScale(previewCanvasWidth, {
		contentHeight: contentMetrics?.contentHeight,
		fitHeightWhenBounded: hasBoundedContentHeight,
		containerWidthOverride: availableWidth,
	})

	useEffect(() => {
		if (!onSuggestedCardWidthChange) return

		const nextSuggestedCardWidth =
			availableWidth && previewScaledCanvasWidth < availableWidth
				? previewScaledCanvasWidth
				: null

		onSuggestedCardWidthChange(nextSuggestedCardWidth)
	}, [availableWidth, onSuggestedCardWidthChange, previewScaledCanvasWidth])

	const shouldEnableHorizontalScroll =
		!availableWidth || previewScaledCanvasWidth > availableWidth

	return (
		<div
			ref={setPreviewHostElement}
			className="relative mt-1.5 w-full overflow-hidden overscroll-contain rounded-[10px] bg-muted/60"
			style={{ height: `${previewViewportHeight}px` }}
			data-testid="html-code-block-preview-desktop"
			onMouseDownCapture={(event) => event.stopPropagation()}
			onWheelCapture={(event) => event.stopPropagation()}
		>
			{isPreviewLoading && <HtmlCodeBlockPreviewSkeleton />}
			<div
				className={cn(
					"h-full w-full overflow-y-hidden overscroll-contain rounded-[4px]",
					shouldEnableHorizontalScroll ? "overflow-x-auto" : "overflow-x-hidden",
				)}
				data-testid="html-code-block-preview-viewport"
			>
				<div
					className="shrink-0 overflow-hidden"
					style={{
						width: `${previewScaledCanvasWidth}px`,
						height: `${previewViewportHeight}px`,
					}}
					data-testid="html-code-block-preview-scaled-canvas"
				>
					<div
						className={cn(
							"h-full shrink-0 origin-top-left bg-transparent transition-transform duration-150 ease-out will-change-transform",
							isPreviewLoading && "opacity-0",
						)}
						style={{
							width: `${previewCanvasWidth}px`,
							...previewCanvasStyle,
						}}
						data-testid="html-code-block-preview-canvas"
						data-preview-canvas-width={previewCanvasWidth}
						data-preview-scale={previewScale.toFixed(3)}
					>
						<HtmlPreviewRenderer
							content={resolvedCode}
							onReady={onPreviewRenderReady}
							onMetrics={handleContentMetrics}
						/>
					</div>
				</div>
			</div>
		</div>
	)
}
