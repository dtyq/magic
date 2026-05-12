import { useCallback, useEffect, useRef, useState } from "react"
import { HTML_CODE_BLOCK_PREVIEW_SKELETON_MIN_VISIBLE_DURATION } from "../constants"
import type { HtmlCodeBlockPreviewMode } from "../types"

type HtmlCodeBlockPreviewLayout = "desktop" | "phone"

interface UseHtmlCodeBlockPreviewControllerOptions {
	isStreaming: boolean
	hasResolvedCode: boolean
	hasVisiblePreviewContent: boolean
}

interface UseHtmlCodeBlockPreviewControllerResult {
	viewMode: HtmlCodeBlockPreviewMode
	isExpanded: boolean
	isPreviewLoading: boolean
	shouldAnimatePreviewCardWidth: boolean
	phonePreviewCardWidth: number | null
	previewRenderKey: number
	mountedPreviewLayouts: Record<HtmlCodeBlockPreviewLayout, boolean>
	shouldRenderCodeView: boolean
	shouldRenderPreview: boolean
	activePreviewLayout: HtmlCodeBlockPreviewLayout
	handlePreviewRenderReady: (layout: HtmlCodeBlockPreviewLayout) => void
	handleSuggestedCardWidthChange: (nextWidth: number | null) => void
	handleViewModeChange: (mode: string) => void
	handleToggleExpanded: () => void
}

export function useHtmlCodeBlockPreviewController(
	options: UseHtmlCodeBlockPreviewControllerOptions,
): UseHtmlCodeBlockPreviewControllerResult {
	const { isStreaming, hasResolvedCode, hasVisiblePreviewContent } = options
	const [viewMode, setViewMode] = useState<HtmlCodeBlockPreviewMode>("phone")
	const [isExpanded, setIsExpanded] = useState(true)
	const [isPreviewLoading, setIsPreviewLoading] = useState(false)
	const [shouldAnimatePreviewCardWidth, setShouldAnimatePreviewCardWidth] = useState(false)
	const [phonePreviewCardWidth, setPhonePreviewCardWidth] = useState<number | null>(null)
	const [previewRenderKey, setPreviewRenderKey] = useState(0)
	const [mountedPreviewLayouts, setMountedPreviewLayouts] = useState<
		Record<HtmlCodeBlockPreviewLayout, boolean>
	>({
		phone: true,
		desktop: false,
	})
	const [previewRenderedLayouts, setPreviewRenderedLayouts] = useState<
		Record<HtmlCodeBlockPreviewLayout, boolean>
	>({
		phone: false,
		desktop: false,
	})
	const previewLoadingStartedAtRef = useRef<Record<HtmlCodeBlockPreviewLayout, number>>({
		phone: 0,
		desktop: 0,
	})
	const previewLoadingTimerRef = useRef<Record<HtmlCodeBlockPreviewLayout, number | null>>({
		phone: null,
		desktop: null,
	})
	const previewCardWidthAnimationTimerRef = useRef<number | null>(null)
	const pendingPreferPhonePreviewAfterStreamRef = useRef(false)
	const previousIsStreamingRef = useRef(isStreaming)
	const activePreviewLayoutRef = useRef<HtmlCodeBlockPreviewLayout>("phone")
	const hasAutoAppliedNonRenderablePreviewModeRef = useRef(false)

	const activePreviewLayout = viewMode === "desktop" ? "desktop" : "phone"
	activePreviewLayoutRef.current = activePreviewLayout

	const clearPreviewLoadingTimer = useCallback((layout?: HtmlCodeBlockPreviewLayout) => {
		if (layout) {
			const timerId = previewLoadingTimerRef.current[layout]
			if (timerId) {
				window.clearTimeout(timerId)
				previewLoadingTimerRef.current[layout] = null
			}
			return
		}

		for (const previewLayout of ["phone", "desktop"] as const) {
			const timerId = previewLoadingTimerRef.current[previewLayout]
			if (timerId) {
				window.clearTimeout(timerId)
				previewLoadingTimerRef.current[previewLayout] = null
			}
		}
	}, [])

	useEffect(() => {
		return () => {
			clearPreviewLoadingTimer()
			if (previewCardWidthAnimationTimerRef.current) {
				window.clearTimeout(previewCardWidthAnimationTimerRef.current)
				previewCardWidthAnimationTimerRef.current = null
			}
		}
	}, [clearPreviewLoadingTimer])

	useEffect(() => {
		if (isStreaming) {
			pendingPreferPhonePreviewAfterStreamRef.current = true
			setViewMode((currentViewMode) =>
				currentViewMode === "code" ? currentViewMode : "phone",
			)
			setShouldAnimatePreviewCardWidth(false)
			setPhonePreviewCardWidth(null)
			setMountedPreviewLayouts({
				phone: true,
				desktop: false,
			})
			setPreviewRenderedLayouts({
				phone: false,
				desktop: false,
			})
			setIsPreviewLoading(false)
			clearPreviewLoadingTimer()
		}
	}, [clearPreviewLoadingTimer, isStreaming])

	useEffect(() => {
		if (isStreaming || !hasResolvedCode) return
		if (!pendingPreferPhonePreviewAfterStreamRef.current) return

		pendingPreferPhonePreviewAfterStreamRef.current = false
		setViewMode((currentViewMode) => (currentViewMode === "code" ? currentViewMode : "phone"))
		setIsExpanded(true)
	}, [hasResolvedCode, isStreaming])

	useEffect(() => {
		if (hasVisiblePreviewContent) {
			hasAutoAppliedNonRenderablePreviewModeRef.current = false
			return
		}

		if (hasAutoAppliedNonRenderablePreviewModeRef.current) return

		hasAutoAppliedNonRenderablePreviewModeRef.current = true

		// 非渲染标签不会产出真正可见的 iframe 预览，这里直接回退成默认展开的源码卡片，
		// 既保留复制能力，也避免 header 里出现无意义的预览模式切换和全屏入口。
		clearPreviewLoadingTimer()
		setViewMode("code")
		setIsExpanded(true)
		setIsPreviewLoading(false)
	}, [clearPreviewLoadingTimer, hasVisiblePreviewContent])

	useEffect(() => {
		const wasStreaming = previousIsStreamingRef.current
		previousIsStreamingRef.current = isStreaming

		if (isStreaming || !wasStreaming) return

		setShouldAnimatePreviewCardWidth(false)
		setMountedPreviewLayouts({
			phone: true,
			desktop: false,
		})
		setPreviewRenderedLayouts({
			phone: false,
			desktop: false,
		})
		setIsPreviewLoading(false)
		setPhonePreviewCardWidth(null)
		setPreviewRenderKey((previousRenderKey) => previousRenderKey + 1)
		clearPreviewLoadingTimer()
	}, [clearPreviewLoadingTimer, isStreaming])

	useEffect(() => {
		if (isStreaming) return
		if (viewMode !== "desktop" && viewMode !== "phone") return

		setMountedPreviewLayouts((previousLayouts) => {
			if (previousLayouts[activePreviewLayout]) return previousLayouts

			return {
				...previousLayouts,
				[activePreviewLayout]: true,
			}
		})

		if (previewRenderedLayouts[activePreviewLayout]) {
			setIsPreviewLoading(false)
			return
		}

		previewLoadingStartedAtRef.current[activePreviewLayout] = Date.now()
		setIsPreviewLoading(true)
	}, [activePreviewLayout, isStreaming, previewRenderedLayouts, viewMode])

	const handlePreviewRenderReady = useCallback(
		(layout: HtmlCodeBlockPreviewLayout) => {
			const elapsed = Date.now() - previewLoadingStartedAtRef.current[layout]
			const remainingDuration = Math.max(
				0,
				HTML_CODE_BLOCK_PREVIEW_SKELETON_MIN_VISIBLE_DURATION - elapsed,
			)

			clearPreviewLoadingTimer(layout)

			const markLayoutAsRendered = () => {
				setPreviewRenderedLayouts((previousLayouts) => {
					if (previousLayouts[layout]) return previousLayouts

					return {
						...previousLayouts,
						[layout]: true,
					}
				})

				if (activePreviewLayoutRef.current === layout) {
					setIsPreviewLoading(false)
				}
			}

			if (remainingDuration === 0) {
				markLayoutAsRendered()
				return
			}

			previewLoadingTimerRef.current[layout] = window.setTimeout(() => {
				markLayoutAsRendered()
				previewLoadingTimerRef.current[layout] = null
			}, remainingDuration)
		},
		[clearPreviewLoadingTimer],
	)

	const handleSuggestedCardWidthChange = useCallback((nextWidth: number | null) => {
		setPhonePreviewCardWidth((previousWidth) => {
			if (typeof nextWidth === "number" && Number.isFinite(nextWidth) && nextWidth > 0) {
				const normalizedWidth = Math.round(nextWidth)
				return previousWidth === normalizedWidth ? previousWidth : normalizedWidth
			}

			return previousWidth === null ? previousWidth : null
		})
	}, [])

	const handleViewModeChange = useCallback(
		(mode: string) => {
			if (mode !== "code" && mode !== "desktop" && mode !== "phone") return

			if (
				mode === "code" &&
				!isStreaming &&
				(viewMode === "phone" || viewMode === "desktop")
			) {
				clearPreviewLoadingTimer()
				setPreviewRenderedLayouts({
					phone: false,
					desktop: false,
				})
				setIsPreviewLoading(false)
				setPreviewRenderKey((previousRenderKey) => previousRenderKey + 1)
			}

			if (mode === "code") {
				if (previewCardWidthAnimationTimerRef.current) {
					window.clearTimeout(previewCardWidthAnimationTimerRef.current)
					previewCardWidthAnimationTimerRef.current = null
				}
				setShouldAnimatePreviewCardWidth(false)
			}

			if (viewMode === "code" && (mode === "phone" || mode === "desktop")) {
				if (previewCardWidthAnimationTimerRef.current) {
					window.clearTimeout(previewCardWidthAnimationTimerRef.current)
				}
				setShouldAnimatePreviewCardWidth(true)
				previewCardWidthAnimationTimerRef.current = window.setTimeout(() => {
					setShouldAnimatePreviewCardWidth(false)
					previewCardWidthAnimationTimerRef.current = null
				}, 220)
			}

			setViewMode(mode)
			setIsExpanded(true)
		},
		[clearPreviewLoadingTimer, isStreaming, viewMode],
	)

	const handleToggleExpanded = useCallback(() => {
		setIsExpanded((currentExpanded) => !currentExpanded)
	}, [])

	const shouldRenderCodeView = viewMode === "code"
	const shouldRenderPreview = hasResolvedCode && !shouldRenderCodeView

	return {
		viewMode,
		isExpanded,
		isPreviewLoading,
		shouldAnimatePreviewCardWidth,
		phonePreviewCardWidth,
		previewRenderKey,
		mountedPreviewLayouts,
		shouldRenderCodeView,
		shouldRenderPreview,
		activePreviewLayout,
		handlePreviewRenderReady,
		handleSuggestedCardWidthChange,
		handleViewModeChange,
		handleToggleExpanded,
	}
}
