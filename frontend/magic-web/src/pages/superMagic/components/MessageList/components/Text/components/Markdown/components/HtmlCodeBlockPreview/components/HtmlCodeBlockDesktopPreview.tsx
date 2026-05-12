import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ComponentType,
	type Dispatch,
	type SetStateAction,
} from "react"
import { cn } from "@/lib/utils"
import {
	HTML_CODE_BLOCK_PREVIEW_CONTENT_METRICS_THRESHOLD,
	HTML_CODE_BLOCK_PREVIEW_DESKTOP_DESIGN_WIDTH,
	HTML_CODE_BLOCK_PREVIEW_PHONE_CARD_CHROME_WIDTH,
	HTML_CODE_BLOCK_PREVIEW_PHONE_VIEWPORT_WIDTH,
	HTML_CODE_BLOCK_PREVIEW_VIEWPORT_ASPECT_RATIO,
} from "../constants"
import { useHtmlCodeBlockPreviewScale } from "../hooks/useHtmlCodeBlockPreviewScale"
import type { HtmlCodeBlockPreviewContentMetrics } from "../types"
import {
	resolveHtmlPreviewCanvasWidth,
	resolveHtmlPreviewIntrinsicWidthHint,
} from "../preview-width"
import {
	HtmlPreviewRenderer,
	type HtmlPreviewRendererMetrics,
	type HtmlPreviewRendererProps,
} from "./HtmlPreviewRenderer"
import { HtmlCodeBlockPreviewSkeleton } from "./HtmlCodeBlockPreviewSkeleton"

interface HtmlCodeBlockDesktopPreviewProps {
	resolvedCode: string
	isPreviewLoading: boolean
	onPreviewRenderReady: () => void
	availableWidth?: number
	initialDesktopViewportWidth?: number
	onSuggestedCardWidthChange?: (nextWidth: number | null) => void
	/** desktop：按内容宽缩放；phone：优先拟合聊天区宽度，保留手机预览语义。 */
	previewLayout?: "desktop" | "phone"
	resetMetricsOnCodeChange?: boolean
	containIframeOverscroll?: boolean
	hideVerticalScroll?: boolean
	PreviewRendererComponent?: ComponentType<HtmlPreviewRendererProps>
}

export function HtmlCodeBlockDesktopPreview(props: HtmlCodeBlockDesktopPreviewProps) {
	const {
		resolvedCode,
		isPreviewLoading,
		onPreviewRenderReady,
		availableWidth,
		initialDesktopViewportWidth,
		onSuggestedCardWidthChange,
		previewLayout = "desktop",
		resetMetricsOnCodeChange = true,
		containIframeOverscroll = true,
		hideVerticalScroll = true,
		PreviewRendererComponent = HtmlPreviewRenderer,
	} = props
	const [desktopContentMetrics, setDesktopContentMetrics] =
		useState<HtmlCodeBlockPreviewContentMetrics | null>(null)
	const [phoneContentMetrics, setPhoneContentMetrics] =
		useState<HtmlCodeBlockPreviewContentMetrics | null>(null)
	const [phoneRuntimeContentWidth, setPhoneRuntimeContentWidth] = useState<number | null>(null)
	const [isLayoutTransitioning, setIsLayoutTransitioning] = useState(false)
	const hasInitialDesktopViewportWidth =
		typeof initialDesktopViewportWidth === "number" && initialDesktopViewportWidth > 0
	const [shouldUseInitialDesktopViewportWidth, setShouldUseInitialDesktopViewportWidth] =
		useState(previewLayout === "desktop" && hasInitialDesktopViewportWidth)
	const previousPreviewLayoutRef = useRef(previewLayout)
	const layoutTransitionTimerRef = useRef<number | null>(null)
	const desktopInitialAvailableWidthRef = useRef<number | null>(null)
	const heuristicCanvasWidth = useMemo(
		() => resolveHtmlPreviewCanvasWidth(resolvedCode),
		[resolvedCode],
	)
	const intrinsicContentWidthHint = useMemo(
		() => resolveHtmlPreviewIntrinsicWidthHint(resolvedCode),
		[resolvedCode],
	)
	const desktopViewportAvailableWidth =
		availableWidth && availableWidth > 0
			? Math.max(1, availableWidth - HTML_CODE_BLOCK_PREVIEW_PHONE_CARD_CHROME_WIDTH)
			: 0
	const desktopInitialViewportWidth =
		shouldUseInitialDesktopViewportWidth && hasInitialDesktopViewportWidth
			? initialDesktopViewportWidth
			: 0
	const desktopLogicalContentWidth = useMemo(() => {
		const measuredContentWidth =
			typeof desktopContentMetrics?.contentWidth === "number" &&
			desktopContentMetrics.contentWidth > 0
				? desktopContentMetrics.contentWidth
				: null
		const desktopBaseCanvasWidth = intrinsicContentWidthHint
			? Math.max(heuristicCanvasWidth, intrinsicContentWidthHint)
			: heuristicCanvasWidth
		const resolvedDesktopCanvasWidth = measuredContentWidth
			? Math.max(intrinsicContentWidthHint ?? 0, measuredContentWidth)
			: desktopBaseCanvasWidth

		// desktop 预览需要随消息面板宽度动态铺满，至少保证逻辑画布宽度覆盖当前可用视口。
		const widenedDesktopCanvasWidth = Math.max(
			resolvedDesktopCanvasWidth,
			desktopViewportAvailableWidth,
		)

		return Math.min(widenedDesktopCanvasWidth, HTML_CODE_BLOCK_PREVIEW_DESKTOP_DESIGN_WIDTH)
	}, [
		desktopContentMetrics?.contentWidth,
		desktopViewportAvailableWidth,
		heuristicCanvasWidth,
		intrinsicContentWidthHint,
	])
	// PC 端和手机端一样，当 iframe 出现真实滚动条 gutter 时，需要把可视宽度补回来，
	// 否则缩小时右侧会被滚动条吃掉一截，看起来像内容被裁减。
	const desktopScrollbarCompensationWidth =
		desktopContentMetrics?.hasVerticalOverflow === true &&
		(desktopContentMetrics?.verticalScrollbarWidth ?? 0) > 0
			? Math.max(0, desktopContentMetrics.verticalScrollbarWidth ?? 0)
			: 0
	const desktopPreviewCanvasWidth = desktopLogicalContentWidth + desktopScrollbarCompensationWidth
	const desktopViewportWidthOverride =
		!shouldUseInitialDesktopViewportWidth && desktopViewportAvailableWidth > 0
			? desktopViewportAvailableWidth
			: undefined
	const phoneBaseContentWidth = Math.max(
		intrinsicContentWidthHint ?? 0,
		HTML_CODE_BLOCK_PREVIEW_PHONE_VIEWPORT_WIDTH,
	)
	const phoneLogicalContentWidth = phoneRuntimeContentWidth ?? phoneBaseContentWidth
	// 只有当确实有垂直溢出且滚动条宽度大于0时，才计算滚动条补偿宽度，
	// 避免在 overlay scrollbar 等场景里平白把容器再撑宽一截。
	const phoneScrollbarCompensationWidth =
		phoneContentMetrics?.hasVerticalOverflow === true &&
		(phoneContentMetrics?.verticalScrollbarWidth ?? 0) > 0
			? Math.max(0, phoneContentMetrics?.verticalScrollbarWidth ?? 0)
			: 0
	const phonePreviewCanvasWidth = phoneLogicalContentWidth + phoneScrollbarCompensationWidth
	const activeContentMetrics =
		previewLayout === "phone" ? phoneContentMetrics : desktopContentMetrics
	const hasBoundedDesktopContentHeight =
		desktopContentMetrics?.phase === "settled" &&
		(desktopContentMetrics?.contentHeight ?? 0) > 0
	const hasBoundedPhoneContentHeight =
		!isPreviewLoading &&
		phoneContentMetrics?.phase === "settled" &&
		phoneContentMetrics?.hasVerticalOverflow !== true &&
		(phoneContentMetrics?.contentHeight ?? 0) > 0

	useEffect(() => {
		if (!resetMetricsOnCodeChange) return
		setDesktopContentMetrics(null)
		setPhoneContentMetrics(null)
		setPhoneRuntimeContentWidth(null)
		desktopInitialAvailableWidthRef.current = null
		setShouldUseInitialDesktopViewportWidth(
			previewLayout === "desktop" && hasInitialDesktopViewportWidth,
		)
	}, [hasInitialDesktopViewportWidth, previewLayout, resetMetricsOnCodeChange, resolvedCode])

	useEffect(() => {
		return () => {
			if (layoutTransitionTimerRef.current) {
				window.clearTimeout(layoutTransitionTimerRef.current)
				layoutTransitionTimerRef.current = null
			}
		}
	}, [])

	useEffect(() => {
		if (previousPreviewLayoutRef.current === previewLayout) return

		previousPreviewLayoutRef.current = previewLayout
		setIsLayoutTransitioning(true)

		if (layoutTransitionTimerRef.current) {
			window.clearTimeout(layoutTransitionTimerRef.current)
		}

		layoutTransitionTimerRef.current = window.setTimeout(() => {
			setIsLayoutTransitioning(false)
			layoutTransitionTimerRef.current = null
		}, 120)
	}, [previewLayout])

	useEffect(() => {
		if (previewLayout !== "desktop") return
		if (!availableWidth || availableWidth <= 0) return

		if (desktopInitialAvailableWidthRef.current === null) {
			desktopInitialAvailableWidthRef.current = availableWidth
			return
		}

		if (
			shouldUseInitialDesktopViewportWidth &&
			Math.abs(availableWidth - desktopInitialAvailableWidthRef.current) > 1
		) {
			// 首次从手机切到 desktop 时先沿用手机可见宽度；
			// 一旦消息面板宽度变化，就切回 desktop 的实时宽度驱动。
			setShouldUseInitialDesktopViewportWidth(false)
		}
	}, [availableWidth, previewLayout, shouldUseInitialDesktopViewportWidth])

	useEffect(() => {
		const nextContentWidth =
			typeof phoneContentMetrics?.contentWidth === "number" &&
			phoneContentMetrics.contentWidth > 0
				? phoneContentMetrics.contentWidth
				: null

		if (!nextContentWidth || nextContentWidth <= phoneBaseContentWidth) return

		setPhoneRuntimeContentWidth((previousWidth) => {
			const nextStableWidth = Math.max(
				previousWidth ?? phoneBaseContentWidth,
				nextContentWidth,
			)
			return previousWidth === nextStableWidth ? previousWidth : nextStableWidth
		})
	}, [phoneBaseContentWidth, phoneContentMetrics?.contentWidth])

	const commitLayoutMetrics = useCallback(
		(
			setMetrics: Dispatch<SetStateAction<HtmlCodeBlockPreviewContentMetrics | null>>,
			nextMetrics: HtmlPreviewRendererMetrics,
		) => {
			const contentWidth = Math.max(1, Math.round(nextMetrics.contentWidth))
			const contentHeight = Math.max(1, Math.round(nextMetrics.contentHeight))

			const nextLayoutMetrics = {
				contentWidth,
				contentHeight,
				phase: nextMetrics.phase,
				hasHorizontalOverflow: nextMetrics.hasHorizontalOverflow === true,
				hasVerticalOverflow: nextMetrics.hasVerticalOverflow === true,
				verticalScrollbarWidth: Math.max(0, nextMetrics.verticalScrollbarWidth ?? 0),
			} satisfies HtmlCodeBlockPreviewContentMetrics

			setMetrics((previousMetrics) => {
				const hasOverflowStateChanged =
					Boolean(previousMetrics) &&
					(previousMetrics?.hasHorizontalOverflow !==
						nextLayoutMetrics.hasHorizontalOverflow ||
						previousMetrics?.hasVerticalOverflow !==
							nextLayoutMetrics.hasVerticalOverflow)
				const hasScrollbarWidthChanged =
					Boolean(previousMetrics) &&
					(previousMetrics?.verticalScrollbarWidth ?? 0) !==
						(nextLayoutMetrics.verticalScrollbarWidth ?? 0)
				const shouldKeepPreviousMetrics =
					previousMetrics &&
					!hasOverflowStateChanged &&
					!hasScrollbarWidthChanged &&
					Math.abs(previousMetrics.contentWidth - contentWidth) <
						HTML_CODE_BLOCK_PREVIEW_CONTENT_METRICS_THRESHOLD &&
					Math.abs(previousMetrics.contentHeight - contentHeight) <
						HTML_CODE_BLOCK_PREVIEW_CONTENT_METRICS_THRESHOLD

				// settled 之后仍然允许显著的内容尺寸变化继续更新，
				// 否则 PC 端会沿用旧画布宽高，出现内容无法铺满容器的问题。
				if (shouldKeepPreviousMetrics) return previousMetrics
				return nextLayoutMetrics
			})
		},
		[],
	)

	const handlePhoneContentMetrics = useCallback(
		(nextMetrics: HtmlPreviewRendererMetrics) => {
			commitLayoutMetrics(setPhoneContentMetrics, nextMetrics)
		},
		[commitLayoutMetrics],
	)

	const handleDesktopContentMetrics = useCallback(
		(nextMetrics: HtmlPreviewRendererMetrics) => {
			commitLayoutMetrics(setDesktopContentMetrics, nextMetrics)
		},
		[commitLayoutMetrics],
	)

	const desktopPreviewScaleState = useHtmlCodeBlockPreviewScale(desktopPreviewCanvasWidth, {
		contentHeight: desktopContentMetrics?.contentHeight,
		fitHeightWhenBounded: hasBoundedDesktopContentHeight,
		containerWidthOverride: desktopViewportWidthOverride,
		initialContainerWidthOverride: desktopInitialViewportWidth,
		extrinsicContentWidth: null,
		unitScale: false,
		minReadableScale: 0,
		preferWidthFit: true,
	})
	const phonePreviewScaleState = useHtmlCodeBlockPreviewScale(phonePreviewCanvasWidth, {
		contentHeight: phoneContentMetrics?.contentHeight,
		// 手机预览现在和桌面端统一采用 1:1 基线；内容稳定后继续按实际内容高度收敛。
		fitHeightWhenBounded: hasBoundedPhoneContentHeight,
		extrinsicContentWidth: phonePreviewCanvasWidth,
		unitScale: false,
		minReadableScale: 0,
	})

	const {
		setPreviewHostElement,
		previewCanvasStyle,
		previewViewportHeight,
		previewScaledCanvasWidth,
		previewScale,
		logicalCanvasWidth,
	} = previewLayout === "phone" ? phonePreviewScaleState : desktopPreviewScaleState

	useEffect(() => {
		if (!onSuggestedCardWidthChange) return

		if (previewLayout !== "phone") return

		if (
			phoneContentMetrics?.hasVerticalOverflow === true &&
			phoneScrollbarCompensationWidth > 0
		) {
			onSuggestedCardWidthChange(phonePreviewCanvasWidth)
			return
		}

		if (!availableWidth) {
			onSuggestedCardWidthChange(null)
			return
		}

		const nextSuggestedCardWidth = Math.max(
			HTML_CODE_BLOCK_PREVIEW_PHONE_VIEWPORT_WIDTH,
			Math.min(availableWidth, phoneLogicalContentWidth),
		)
		onSuggestedCardWidthChange(nextSuggestedCardWidth)
	}, [
		availableWidth,
		onSuggestedCardWidthChange,
		previewLayout,
		phoneLogicalContentWidth,
		phoneScrollbarCompensationWidth,
		phonePreviewCanvasWidth,
		phoneContentMetrics?.hasVerticalOverflow,
	])

	const shouldEnableHorizontalScroll =
		previewLayout === "phone"
			? false
			: !desktopViewportWidthOverride ||
				previewScaledCanvasWidth > desktopViewportWidthOverride
	const shouldContainIframeOverscroll =
		previewLayout === "desktop"
			? containIframeOverscroll
			: activeContentMetrics?.hasVerticalOverflow === true

	const previewCore = (
		<div
			ref={setPreviewHostElement}
			className={cn(
				"relative w-full overflow-hidden bg-muted/60",
				previewLayout === "phone" ? "rounded-[8px]" : "rounded-[10px]",
			)}
			style={{
				height: `${previewViewportHeight}px`,
				aspectRatio: HTML_CODE_BLOCK_PREVIEW_VIEWPORT_ASPECT_RATIO,
			}}
			data-testid="html-code-block-preview-desktop"
		>
			{isPreviewLoading && <HtmlCodeBlockPreviewSkeleton />}
			<div
				className={cn(
					"h-full w-full overflow-y-hidden rounded-[4px]",
					shouldEnableHorizontalScroll
						? "overflow-x-auto overscroll-x-contain"
						: "overflow-x-hidden",
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
						className="h-full w-full origin-top-left"
						style={{
							transition: "transform 120ms ease-out, opacity 120ms ease-out",
							transform: isLayoutTransitioning ? "scale(0.992)" : undefined,
							opacity: isLayoutTransitioning ? 0.95 : undefined,
						}}
						data-testid="html-code-block-preview-canvas-motion"
					>
						<div
							className={cn(
								"h-full shrink-0 origin-top-left bg-transparent will-change-transform",
								isPreviewLoading && "opacity-0",
							)}
							style={{
								width: `${logicalCanvasWidth}px`,
								...previewCanvasStyle,
							}}
							data-testid="html-code-block-preview-canvas"
							data-preview-canvas-width={logicalCanvasWidth}
							data-preview-scale={previewScale.toFixed(3)}
						>
							<PreviewRendererComponent
								key={previewLayout}
								content={resolvedCode}
								onReady={onPreviewRenderReady}
								onMetrics={
									previewLayout === "phone"
										? handlePhoneContentMetrics
										: handleDesktopContentMetrics
								}
								containIframeOverscroll={shouldContainIframeOverscroll}
								hideVerticalScroll={hideVerticalScroll}
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	)

	if (previewLayout !== "phone") {
		return <div className="mt-1.5">{previewCore}</div>
	}

	return (
		<div
			className="mt-1.5 flex justify-start"
			data-testid="html-code-block-preview-phone-frame"
		>
			<div
				className="w-full overflow-hidden"
				data-testid="html-code-block-preview-phone-frame-inner"
			>
				{previewCore}
			</div>
		</div>
	)
}
