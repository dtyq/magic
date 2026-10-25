/**
 * ElementInspectorOverlay
 *
 * Renders a transparent overlay on top of the iframe that displays:
 * 1. A highlight box showing the hovered element's bounding rect
 * 2. A floating info card showing element details (tag, id, class, size)
 *
 * Coordinate translation: the iframe reports element rects relative to its
 * own viewport. This overlay converts them to container-relative positions
 * using live iframe/container geometry. Screenshot mode uses the iframe's
 * already-transformed visual bounds so the picker is not scaled twice.
 */

import {
	Fragment,
	useRef,
	useEffect,
	useState,
	useCallback,
	useMemo,
	useSyncExternalStore,
} from "react"
import { createPortal } from "react-dom"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import { useTranslation } from "react-i18next"
import { Crosshair, X, Copy, Loader2, MessageCircle, MousePointer, Send } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import type {
	HtmlMultiSelectionSubmitState,
	HtmlSelectionScreenshot,
	HtmlSelectionTarget,
	InspectedElementInfo,
	InspectedElementRect,
	InspectorScrollOffset,
} from "./types"
import {
	fromInspectorOverlayRect,
	getInspectorOverlayScale,
	toInspectorOverlayRect,
	toInspectorOverlayVisualRect,
} from "./geometry"
import { buildAgentPromptContent } from "./agentPrompt"
import { formatElementSize, getShortSelector } from "./format"
import { ElementEditPopover } from "./ElementEditPopover"
import { PendingTargetsPanel } from "./PendingTargetsPanel"
import { AiEditingCaptureAuthorizationDialog } from "./AiEditingCaptureAuthorizationDialog"
import {
	ScreenshotSelectionOverlay,
	type ScreenshotCapturePhase,
} from "./ScreenshotSelectionOverlay"
import { createInspectorCaptureStore } from "./inspectorCaptureStore"
import {
	captureIframeRegion,
	supportsCurrentTabCapture,
	toRenderedSelection,
	waitForNextAnimationFrame,
} from "./screenshot"
import { getHtmlSelectionTargetRect } from "./selection"

export { buildAgentPromptContent, buildHtmlMultiSelectionPromptContent } from "./agentPrompt"

function readIframeScrollOffset(iframe: HTMLIFrameElement) {
	try {
		const document = iframe.contentDocument
		const scrollingElement = document?.scrollingElement
		const view = iframe.contentWindow
		return {
			left: view?.scrollX ?? scrollingElement?.scrollLeft ?? 0,
			top: view?.scrollY ?? scrollingElement?.scrollTop ?? 0,
		}
	} catch {
		return { left: 0, top: 0 }
	}
}

function isRectVisibleInContainer(
	box: { left: number; top: number; width: number; height: number },
	container: { width: number; height: number },
) {
	// During the first render a portal host may not have layout measurements yet.
	// Keep the popover mounted until the browser gives us real dimensions.
	if (container.width <= 0 || container.height <= 0) return true
	if (box.width <= 0 || box.height <= 0) {
		return false
	}

	return (
		box.left < container.width &&
		box.top < container.height &&
		box.left + box.width > 0 &&
		box.top + box.height > 0
	)
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface ElementInspectorOverlayProps {
	/** Whether inspector mode is active (show transparent event-capture overlay) */
	active: boolean
	/** Ref to the iframe being inspected */
	iframeRef: React.RefObject<HTMLIFrameElement | null>
	/** The element currently under the cursor (from useElementInspector) */
	hoveredElement: InspectedElementInfo | null
	/** The element that was selected (clicked) */
	selectedElement: InspectedElementInfo | null
	/** Clear the selected element */
	onClearSelection: () => void
	/** Optional: called when user wants to copy element selector */
	onCopySelector?: (selector: string) => void
	/** Optional: called when user wants to insert element info into console */
	onInsertToConsole?: (code: string) => void
	/** Optional: called when user wants to send element info to the agent input */
	onSendToAgent?: (content: JSONContent) => void
	/** When true, suppresses the floating ElementInfoCard after selection (for toolbar-triggered mode) */
	hideInfoCard?: boolean
	/** Keeps the multi-selection collection bar mounted while a selected element is being resolved. */
	multiSelectionActive?: boolean
	/** Current target being edited in the multi-selection flow. */
	activeTarget?: HtmlSelectionTarget | null
	draftInstruction?: string
	onDraftInstructionChange?: (instruction: string) => void
	onConfirmTarget?: () => void
	onCancelTarget?: () => void
	/** Confirmed targets waiting for one structured submission. */
	pendingTargets?: HtmlSelectionTarget[]
	submitState?: HtmlMultiSelectionSubmitState
	submitError?: string | null
	onEditPendingTarget?: (target: HtmlSelectionTarget) => void
	onRemovePendingTarget?: (targetId: string) => void
	onSubmitPendingTargets?: () => void
	selectionMode?: "element" | "screenshot"
	onSelectionModeChange?: (mode: "element" | "screenshot") => void
	screenshotSupported?: boolean
	onCaptureScreenshot?: (
		dataUrl: string,
		rect: InspectedElementRect,
		displaySize?: { width: number; height: number },
		documentRect?: InspectedElementRect,
	) => void
	onCaptureElementScreenshot?: (selector: string, screenshot: HtmlSelectionScreenshot) => void
	onCapturePrewarmReady?: (prewarm: (() => Promise<boolean>) | null) => void
	/** Exact origin used by the cross-origin iframe screenshot bridge. */
	iframeTargetOrigin?: string
	onExitMultiSelection?: () => void
	/** Top distance for the draggable pending-target panel. */
	pendingPanelTopOffset?: number
	/** Stable canvas viewport used to position the pending-target panel outside scaled content. */
	panelContainerRef?: React.RefObject<HTMLDivElement | null>
	/** Scale ratio of the iframe (for coordinate conversion) */
	scaleRatio?: number
	/** 设备尺寸或外观改变时，比例不变也要更新 iframe 的宿主位置。 */
	layoutKey?: string
	/** Latest iframe viewport rects for selected and pending element targets. */
	trackedRects?: Record<string, InspectedElementRect>
	/** Scroll offset reported by a cross-origin iframe runtime. */
	iframeScrollOffset?: InspectorScrollOffset
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ElementInspectorOverlay({
	active,
	iframeRef,
	hoveredElement,
	selectedElement,
	onClearSelection,
	onCopySelector,
	onInsertToConsole,
	onSendToAgent,
	hideInfoCard = false,
	multiSelectionActive = false,
	activeTarget = null,
	draftInstruction = "",
	onDraftInstructionChange,
	onConfirmTarget,
	onCancelTarget,
	pendingTargets = [],
	submitState = "idle",
	submitError = null,
	onEditPendingTarget,
	onRemovePendingTarget,
	onSubmitPendingTargets,
	selectionMode = "element",
	onSelectionModeChange,
	screenshotSupported = supportsCurrentTabCapture(),
	onCaptureScreenshot,
	onCaptureElementScreenshot,
	onCapturePrewarmReady,
	iframeTargetOrigin,
	onExitMultiSelection,
	pendingPanelTopOffset,
	panelContainerRef,
	scaleRatio = 1,
	layoutKey,
	trackedRects = {},
	iframeScrollOffset: reportedIframeScrollOffset,
}: ElementInspectorOverlayProps) {
	const { t } = useTranslation("super")
	const overlayRef = useRef<HTMLDivElement>(null)
	const [iframeRect, setIframeRect] = useState<DOMRect | null>(null)
	const [iframeScrollOffset, setIframeScrollOffset] = useState({ left: 0, top: 0 })
	const [screenshotCapturePhase, setScreenshotCapturePhase] =
		useState<ScreenshotCapturePhase>("idle")
	const [captureUsesCurrentTab, setCaptureUsesCurrentTab] = useState(false)
	const [captureStore] = useState(() => createInspectorCaptureStore())
	const captureSnapshot = useSyncExternalStore(
		captureStore.subscribe,
		captureStore.getSnapshot,
		captureStore.getSnapshot,
	)
	const requestCurrentTabCaptureAuthorization = captureStore.requestAuthorization
	const resolveCaptureAuthorization = captureStore.resolveAuthorization

	useEffect(() => () => captureStore.dispose(), [captureStore])
	const [panelPortalHost, setPanelPortalHost] = useState<HTMLDivElement | null>(null)
	const effectiveSelectionMode = screenshotSupported ? selectionMode : "element"
	const iframeRectFrameRef = useRef<number | null>(null)
	const scrollFrameRef = useRef<number | null>(null)

	useEffect(() => {
		if (!screenshotSupported && selectionMode === "screenshot") {
			onSelectionModeChange?.("element")
		}
	}, [onSelectionModeChange, screenshotSupported, selectionMode])

	useEffect(() => {
		const isInspecting = Boolean(
			active ||
			selectedElement ||
			activeTarget ||
			pendingTargets.length > 0 ||
			multiSelectionActive,
		)
		captureStore.releaseIfIdle(isInspecting)
	}, [
		active,
		activeTarget,
		captureSnapshot.isBusy,
		captureStore,
		multiSelectionActive,
		pendingTargets.length,
		selectedElement,
	])

	// The inspector overlay remains over the scaled content for accurate element geometry,
	// while the collection bar is mounted in the unscaled canvas viewport.
	useEffect(() => {
		setPanelPortalHost(panelContainerRef?.current ?? null)
	}, [panelContainerRef])
	const getOverlaySize = useCallback(() => {
		const overlay = overlayRef.current
		if (!overlay) return { width: 0, height: 0 }
		const bounds = overlay.getBoundingClientRect()
		return {
			width: overlay.clientWidth || bounds.width,
			height: overlay.clientHeight || bounds.height,
		}
	}, [])
	const getPanelSize = useCallback(() => {
		const panel = panelPortalHost
		if (!panel) return { width: 0, height: 0 }
		const bounds = panel.getBoundingClientRect()
		return {
			width: panel.clientWidth || bounds.width,
			height: panel.clientHeight || bounds.height,
		}
	}, [panelPortalHost])

	// Track iframe position for coordinate conversion (ResizeObserver for selected-element case)
	useEffect(() => {
		const iframe = iframeRef.current
		if (!iframe) return

		const readIframeRect = () => {
			const parent = overlayRef.current?.parentElement
			if (!parent || !iframe) return
			const parentRect = parent.getBoundingClientRect()
			const ifRect = iframe.getBoundingClientRect()
			// Make iframe rect relative to the overlay container
			const nextRect = new DOMRect(
				ifRect.left - parentRect.left,
				ifRect.top - parentRect.top,
				ifRect.width,
				ifRect.height,
			)
			setIframeRect((current) => {
				if (
					current &&
					current.x === nextRect.x &&
					current.y === nextRect.y &&
					current.width === nextRect.width &&
					current.height === nextRect.height
				) {
					return current
				}
				return nextRect
			})
		}
		const updateRect = () => {
			if (iframeRectFrameRef.current !== null) return
			iframeRectFrameRef.current = requestAnimationFrame(() => {
				iframeRectFrameRef.current = null
				readIframeRect()
			})
		}

		readIframeRect()

		const ro = new ResizeObserver(updateRect)
		ro.observe(iframe)
		window.addEventListener("scroll", updateRect, true)

		return () => {
			ro.disconnect()
			window.removeEventListener("scroll", updateRect, true)
			if (iframeRectFrameRef.current !== null) {
				cancelAnimationFrame(iframeRectFrameRef.current)
				iframeRectFrameRef.current = null
			}
		}
	}, [iframeRef, active, scaleRatio, layoutKey])

	useEffect(() => {
		// Cross-origin pages can now answer screenshot requests from inside the iframe.
		// Do not pre-authorize display capture merely by entering screenshot mode.
		setCaptureUsesCurrentTab(false)
	}, [iframeRect, iframeRef])

	// Screenshot targets are arbitrary rectangles rather than selectors. Keep
	// their document anchor in sync with the iframe's internal scroll position.
	useEffect(() => {
		const iframe = iframeRef.current
		if (!iframe) return

		const updateScrollOffset = () => {
			if (scrollFrameRef.current !== null) return
			scrollFrameRef.current = requestAnimationFrame(() => {
				scrollFrameRef.current = null
				setIframeScrollOffset(readIframeScrollOffset(iframe))
			})
		}
		const bindDocumentScroll = () => {
			const unbinders: Array<() => void> = []
			try {
				const document = iframe.contentDocument
				if (document) {
					document.addEventListener("scroll", updateScrollOffset, true)
					unbinders.push(() => {
						try {
							document.removeEventListener("scroll", updateScrollOffset, true)
						} catch {
							// The iframe may have navigated away from the same-origin document.
						}
					})
				}
			} catch {
				// Cross-origin iframes do not expose their document.
			}
			try {
				const view = iframe.contentWindow
				view?.addEventListener("scroll", updateScrollOffset, true)
				if (view) {
					unbinders.push(() => {
						try {
							view.removeEventListener("scroll", updateScrollOffset, true)
						} catch {
							// WindowProxy access becomes restricted after a cross-origin navigation.
						}
					})
				}
			} catch {
				// Cross-origin WindowProxy properties can throw during binding.
			}
			if (unbinders.length === 0) return undefined
			updateScrollOffset()
			return () => unbinders.forEach((unbind) => unbind())
		}

		let unbindDocumentScroll = bindDocumentScroll()
		const handleLoad = () => {
			unbindDocumentScroll?.()
			unbindDocumentScroll = bindDocumentScroll()
		}
		iframe.addEventListener("load", handleLoad)
		updateScrollOffset()

		return () => {
			iframe.removeEventListener("load", handleLoad)
			unbindDocumentScroll?.()
			if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current)
			scrollFrameRef.current = null
		}
	}, [iframeRef, active])

	const getOverlayGeometry = useCallback(() => {
		const iframe = iframeRef.current
		const parent = overlayRef.current?.parentElement
		if (!iframe || !parent) return null

		return {
			iframeRect: iframe.getBoundingClientRect(),
			iframeSize: { width: iframe.clientWidth, height: iframe.clientHeight },
			containerRect: parent.getBoundingClientRect(),
			containerSize: { width: parent.clientWidth, height: parent.clientHeight },
			fallbackScale: scaleRatio,
		}
	}, [iframeRef, scaleRatio])

	/**
	 * Convert an iframe-viewport-relative rect to overlay-relative coordinates.
	 * Uses live DOM measurements to handle:
	 * - Dynamic iframe ref changes (multi-iframe inspectors)
	 * - CSS transforms / scaling on the iframe
	 */
	const toOverlayRect = useCallback(
		(rect: InspectedElementRect) => {
			const geometry = getOverlayGeometry()
			return geometry ? toInspectorOverlayRect(rect, geometry) : null
		},
		[getOverlayGeometry],
	)

	/** Get the iframe scale relative to the overlay's coordinate system. */
	const getOverlayScale = useCallback(() => {
		const geometry = getOverlayGeometry()
		return geometry ? getInspectorOverlayScale(geometry) : { x: scaleRatio, y: scaleRatio }
	}, [getOverlayGeometry, scaleRatio])

	const hoverBox = useMemo(
		() => (hoveredElement ? toOverlayRect(hoveredElement.rect) : null),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[hoveredElement, toOverlayRect, iframeRect],
	)

	const selectBox = useMemo(
		() =>
			selectedElement
				? toOverlayRect(trackedRects[selectedElement.selector] ?? selectedElement.rect)
				: null,
		// iframeRect changes after host scrolling and must invalidate this memoized box.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[selectedElement, toOverlayRect, iframeRect, trackedRects],
	)
	const captureRegion = useCallback(
		async (
			overlayRect: InspectedElementRect,
			beforeCurrentTabCapture?: () => Promise<void>,
			selector?: string,
		) => {
			const iframe = iframeRef.current
			if (!iframe) throw new Error("HTML screenshot capture is unavailable")
			const overlay = overlayRef.current
			if (!overlay) throw new Error("HTML screenshot overlay is unavailable")
			const geometry = getOverlayGeometry()
			if (!geometry) throw new Error("HTML screenshot geometry is unavailable")
			const overlayBounds = overlay.getBoundingClientRect()
			const viewportSelection = toRenderedSelection(
				{
					clientWidth: overlay.clientWidth || overlayBounds.width,
					clientHeight: overlay.clientHeight || overlayBounds.height,
				},
				overlayBounds,
				overlayRect,
			)
			const iframeSelection = fromInspectorOverlayRect(overlayRect, geometry)
			const { left: scrollLeft, top: scrollTop } = readIframeScrollOffset(iframe)
			const documentSelection =
				scrollLeft || scrollTop
					? {
							...iframeSelection,
							left: iframeSelection.left + scrollLeft,
							top: iframeSelection.top + scrollTop,
						}
					: undefined
			const dataUrl = await captureIframeRegion({
				iframe,
				selection: iframeSelection,
				viewportSelection,
				iframeTargetOrigin,
				beforeCurrentTabCapture,
				currentTabSession: captureStore.session,
				requestCurrentTabCaptureAuthorization,
				selector,
			})
			const displaySize = {
				width: viewportSelection.width,
				height: viewportSelection.height,
			}
			return {
				dataUrl,
				rect: iframeSelection,
				displaySize,
				documentRect: documentSelection,
			}
		},
		[
			captureStore.session,
			getOverlayGeometry,
			iframeRef,
			iframeTargetOrigin,
			requestCurrentTabCaptureAuthorization,
		],
	)
	const handleCaptureScreenshot = useCallback(
		async (
			overlayRect: InspectedElementRect,
			beforeCurrentTabCapture?: () => Promise<void>,
		) => {
			if (!onCaptureScreenshot) {
				throw new Error("HTML screenshot capture is unavailable")
			}
			const result = await captureRegion(overlayRect, beforeCurrentTabCapture)
			onCaptureScreenshot(
				result.dataUrl,
				result.rect,
				result.displaySize,
				result.documentRect,
			)
		},
		[captureRegion, onCaptureScreenshot],
	)
	const captureElementPreview = useCallback(
		async (overlayRect: InspectedElementRect, selector?: string) => {
			setScreenshotCapturePhase("loading")
			try {
				return await captureRegion(
					overlayRect,
					async () => {
						setScreenshotCapturePhase("capturing")
						await waitForNextAnimationFrame()
					},
					selector,
				)
			} finally {
				setScreenshotCapturePhase("idle")
			}
		},
		[captureRegion],
	)

	const elementScreenshotSelectorRef = useRef<string | null>(null)
	useEffect(() => {
		if (!selectedElement) {
			elementScreenshotSelectorRef.current = null
			return
		}
		if (!screenshotSupported) {
			elementScreenshotSelectorRef.current = null
			return
		}
		if (!onCaptureElementScreenshot || !selectBox) return
		const captureKey =
			selectedElement.tagName.toLowerCase() === "video" ||
			selectedElement.tagName.toLowerCase() === "audio"
				? `${selectedElement.selector}:${Math.round(selectBox.width)}x${Math.round(selectBox.height)}`
				: selectedElement.selector
		if (elementScreenshotSelectorRef.current === captureKey) return

		const selector = selectedElement.selector
		elementScreenshotSelectorRef.current = captureKey
		let cancelled = false
		void captureElementPreview(selectBox, selector)
			.then((result) => {
				if (cancelled || elementScreenshotSelectorRef.current !== captureKey) return
				onCaptureElementScreenshot(selector, {
					dataUrl: result.dataUrl,
					rect: result.rect,
					displaySize: result.displaySize,
					documentRect: result.documentRect,
				})
			})
			.catch(() => {
				if (!cancelled) elementScreenshotSelectorRef.current = null
			})

		return () => {
			// Rect refreshes can rerun this effect while the same capture is pending.
			// Only cancel when the selection itself has changed or was cleared.
			if (elementScreenshotSelectorRef.current !== captureKey) cancelled = true
		}
	}, [
		captureElementPreview,
		onCaptureElementScreenshot,
		screenshotSupported,
		selectBox,
		selectedElement,
	])
	const screenshotSelectionBounds = useMemo(() => {
		const iframe = iframeRef.current
		const parent = overlayRef.current?.parentElement
		if (!iframe || !parent || !iframeRect) return undefined

		const visualIframeRect = iframe.getBoundingClientRect()
		const visualParentRect = parent.getBoundingClientRect()
		const fallbackScale = Math.max(scaleRatio, Number.EPSILON)
		return toInspectorOverlayVisualRect(visualIframeRect, visualParentRect, {
			width: parent.clientWidth || visualParentRect.width / fallbackScale,
			height: parent.clientHeight || visualParentRect.height / fallbackScale,
		})
	}, [iframeRect, iframeRef, scaleRatio])

	/**
	 * Move the editor popover into the stable viewport layer. The inspector overlay
	 * sits inside the scaled/scrolling content container, which can clip a popover
	 * when the selected screenshot is near an edge.
	 */
	const toPanelRect = useCallback(
		(box: InspectedElementRect) => {
			const overlay = overlayRef.current
			const panel = panelPortalHost
			if (!overlay || !panel) return null

			const overlayBounds = overlay.getBoundingClientRect()
			const panelBounds = panel.getBoundingClientRect()
			const overlayWidth = overlay.clientWidth || overlayBounds.width
			const overlayHeight = overlay.clientHeight || overlayBounds.height
			const panelWidth = panel.clientWidth || panelBounds.width
			const panelHeight = panel.clientHeight || panelBounds.height
			const overlayScaleX = overlayWidth > 0 ? overlayBounds.width / overlayWidth : 1
			const overlayScaleY = overlayHeight > 0 ? overlayBounds.height / overlayHeight : 1
			const panelScaleX = panelWidth > 0 ? panelBounds.width / panelWidth : 1
			const panelScaleY = panelHeight > 0 ? panelBounds.height / panelHeight : 1

			return {
				left:
					(overlayBounds.left + box.left * overlayScaleX - panelBounds.left) /
					panelScaleX,
				top: (overlayBounds.top + box.top * overlayScaleY - panelBounds.top) / panelScaleY,
				width: (box.width * overlayScaleX) / panelScaleX,
				height: (box.height * overlayScaleY) / panelScaleY,
			}
		},
		[panelPortalHost],
	)

	const getTargetRect = useCallback(
		(target: HtmlSelectionTarget) => {
			if (target.kind === "element") {
				return trackedRects[target.info.selector] ?? target.info.rect
			}
			return getHtmlSelectionTargetRect(
				target,
				reportedIframeScrollOffset ?? iframeScrollOffset,
			)
		},
		[iframeScrollOffset, reportedIframeScrollOffset, trackedRects],
	)
	const prewarmCurrentTabCapture = useCallback(() => {
		if (!screenshotSupported) return Promise.resolve(true)
		return captureStore.prepare(iframeRef.current, iframeTargetOrigin)
	}, [captureStore, iframeRef, iframeTargetOrigin, screenshotSupported])

	useEffect(() => {
		onCapturePrewarmReady?.(prewarmCurrentTabCapture)
		return () => onCapturePrewarmReady?.(null)
	}, [onCapturePrewarmReady, prewarmCurrentTabCapture])

	const handleSelectionModeChange = useCallback(
		(nextMode: "element" | "screenshot") => {
			if (nextMode === "screenshot" && !screenshotSupported) return
			if (nextMode === "screenshot") {
				void prewarmCurrentTabCapture()
			}
			onSelectionModeChange?.(nextMode)
		},
		[onSelectionModeChange, prewarmCurrentTabCapture, screenshotSupported],
	)

	// Don't render anything if not active and no selection
	if (
		!active &&
		!selectedElement &&
		!activeTarget &&
		pendingTargets.length === 0 &&
		!multiSelectionActive &&
		!captureSnapshot.isBusy
	)
		return null
	const overlayScale = getOverlayScale()
	const overlaySize = getOverlaySize()
	const activeTargetBox = activeTarget
		? toOverlayRect(
				getTargetRect(activeTarget) ?? {
					left: 0,
					top: 0,
					width: 0,
					height: 0,
				},
			)
		: null
	const panelSize = getPanelSize()
	const activeTargetPanelBox = activeTargetBox ? toPanelRect(activeTargetBox) : null
	const editPopoverBox = activeTargetPanelBox ?? activeTargetBox
	const editPopoverContainer = activeTargetPanelBox ? panelSize : overlaySize
	const isEditPopoverTargetVisible = editPopoverBox
		? isRectVisibleInContainer(editPopoverBox, editPopoverContainer)
		: false
	const isEditingPendingTarget =
		activeTarget !== null && pendingTargets.some((target) => target.id === activeTarget.id)
	const editPopover =
		activeTarget &&
		editPopoverBox &&
		isEditPopoverTargetVisible &&
		onDraftInstructionChange &&
		onConfirmTarget &&
		onCancelTarget ? (
			<ElementEditPopover
				targetId={activeTarget.id}
				info={activeTarget.kind === "element" ? activeTarget.info : undefined}
				targetKind={activeTarget.kind}
				screenshotDataUrl={activeTarget.screenshot?.dataUrl}
				box={editPopoverBox}
				containerWidth={activeTargetPanelBox ? panelSize.width : overlaySize.width}
				containerHeight={activeTargetPanelBox ? panelSize.height : overlaySize.height}
				screenshotLoading={
					screenshotCapturePhase !== "idle" &&
					activeTarget.kind === "element" &&
					!activeTarget.screenshot?.dataUrl
				}
				instruction={draftInstruction}
				onInstructionChange={onDraftInstructionChange}
				onConfirm={onConfirmTarget}
				onCancel={onCancelTarget}
				onDelete={
					isEditingPendingTarget && onRemovePendingTarget
						? () => onRemovePendingTarget(activeTarget.id)
						: undefined
				}
			/>
		) : null
	const pendingPanel =
		(pendingTargets.length > 0 || active || activeTarget || multiSelectionActive) &&
		onEditPendingTarget &&
		onRemovePendingTarget &&
		onSubmitPendingTargets ? (
			<PendingTargetsPanel
				targets={pendingTargets}
				submitState={submitState}
				submitError={submitError}
				onEdit={onEditPendingTarget}
				onRemove={onRemovePendingTarget}
				onSubmit={onSubmitPendingTargets}
				selectionMode={effectiveSelectionMode}
				onSelectionModeChange={handleSelectionModeChange}
				screenshotSupported={screenshotSupported}
				onExit={onExitMultiSelection}
				topOffset={pendingPanelTopOffset}
			/>
		) : null
	const screenshotLoading =
		screenshotCapturePhase === "loading" ? (
			<div
				className="pointer-events-none absolute left-4 top-4 z-[100] flex items-center gap-2 rounded-full border border-primary/25 bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-[0_6px_18px_rgb(var(--primary-rgb)/0.28)]"
				data-testid="element-inspector-screenshot-loading"
				role="status"
				aria-live="polite"
			>
				<Loader2 size={14} className="animate-spin" />
				{t("stylePanel.inspector.screenshotProcessing")}
			</div>
		) : null
	const pendingPanelContent = panelContainerRef
		? panelPortalHost
			? createPortal(
					<div
						className="pointer-events-none absolute inset-0 z-40"
						data-element-inspector-panel-portal="true"
						data-testid="element-inspector-panel-portal"
						style={{
							zIndex: screenshotCapturePhase === "loading" ? 100 : 40,
							visibility:
								screenshotCapturePhase === "capturing" ? "hidden" : undefined,
						}}
					>
						{screenshotLoading}
						{editPopover}
						{pendingPanel}
					</div>,
					panelPortalHost,
				)
			: null
		: pendingPanel

	return (
		<div
			ref={overlayRef}
			className="pointer-events-none absolute inset-0 z-40"
			data-element-inspector-overlay="true"
			data-testid="element-inspector-overlay"
			style={{
				overflow: "hidden",
				zIndex: screenshotCapturePhase === "loading" ? 100 : 40,
				visibility: screenshotCapturePhase === "capturing" ? "hidden" : undefined,
			}}
		>
			{!panelPortalHost && screenshotLoading}
			{/* Transparent event-capture layer when active — allows pointer events through to iframe */}
			{active && (
				<div
					className="pointer-events-none absolute inset-0"
					style={{ cursor: "crosshair" }}
				/>
			)}

			{/* Hover highlight box */}
			{active && hoverBox && hoveredElement && (
				<ElementHighlight
					info={hoveredElement}
					box={hoverBox}
					overlayScale={overlayScale}
					containerWidth={overlaySize.width}
					animate={false}
				/>
			)}

			{active && effectiveSelectionMode === "screenshot" && (
				<ScreenshotSelectionOverlay
					containerWidth={overlaySize.width}
					containerHeight={overlaySize.height}
					selectionBounds={screenshotSelectionBounds}
					captureUsesCurrentTab={captureUsesCurrentTab}
					onCapture={handleCaptureScreenshot}
					onCaptureStateChange={(capturing) => {
						if (!capturing) setScreenshotCapturePhase("idle")
					}}
					onCapturePhaseChange={setScreenshotCapturePhase}
				/>
			)}

			{/* Keep every confirmed target highlighted while the picker stays open. The
			    active target is rendered separately so its editor popover can take focus. */}
			{pendingTargets.map((target) => {
				if (target.kind === "element") {
					if (
						target.info.selector === selectedElement?.selector ||
						(activeTarget?.kind === "element" &&
							target.info.selector === activeTarget.info.selector)
					)
						return null

					const box = toOverlayRect(
						trackedRects[target.info.selector] ?? target.info.rect,
					)
					return box ? (
						<Fragment key={target.id}>
							<ElementHighlight
								info={target.info}
								box={box}
								overlayScale={overlayScale}
								containerWidth={overlaySize.width}
								showLabel={false}
							/>
							<CommentMarker
								targetId={target.id}
								box={box}
								containerWidth={overlaySize.width}
								containerHeight={overlaySize.height}
								content={target.instruction}
							/>
							<PendingTargetHighlight
								targetId={target.id}
								box={box}
								onClick={() => onEditPendingTarget?.(target)}
							/>
						</Fragment>
					) : null
				}

				if (target.id === activeTarget?.id) return null
				const box = toOverlayRect(getTargetRect(target))

				return box ? (
					<Fragment key={target.id}>
						<ScreenshotHighlight
							box={box}
							containerWidth={overlaySize.width}
							label={t("stylePanel.inspector.screenshot")}
							size={formatElementSize(
								target.screenshot.displaySize?.width ??
									target.screenshot.rect.width,
								target.screenshot.displaySize?.height ??
									target.screenshot.rect.height,
							)}
							showLabel={false}
						/>
						<CommentMarker
							targetId={target.id}
							box={box}
							containerWidth={overlaySize.width}
							containerHeight={overlaySize.height}
							content={target.instruction}
						/>
						<PendingTargetHighlight
							targetId={target.id}
							box={box}
							onClick={() => onEditPendingTarget?.(target)}
						/>
					</Fragment>
				) : null
			})}

			{/* Selected element highlight */}
			{selectBox && selectedElement && (
				<>
					<ElementHighlight
						info={selectedElement}
						box={selectBox}
						overlayScale={overlayScale}
						containerWidth={overlaySize.width}
						animate={false}
						showLabel={false}
					/>
					<CommentMarker
						targetId={getSelectedElementTargetId(
							selectedElement.selector,
							activeTarget,
							pendingTargets,
						)}
						box={selectBox}
						containerWidth={overlaySize.width}
						containerHeight={overlaySize.height}
						content={getSelectedElementComment(
							selectedElement.selector,
							activeTarget,
							pendingTargets,
							draftInstruction,
						)}
					/>

					{/* Info card */}
					{!hideInfoCard && (
						<ElementInfoCard
							info={selectedElement}
							box={selectBox}
							containerWidth={overlaySize.width}
							containerHeight={overlaySize.height}
							onClose={onClearSelection}
							onCopySelector={onCopySelector}
							onInsertToConsole={onInsertToConsole}
							onSendToAgent={onSendToAgent}
						/>
					)}
				</>
			)}

			{/* A pending target can be edited from the collection bar after the inspector
			    has cleared selectedElement. Keep the target visibly selected in that state. */}
			{activeTarget?.kind === "element" &&
				activeTargetBox &&
				activeTarget.info &&
				activeTarget.info.selector !== selectedElement?.selector && (
					<>
						<ElementHighlight
							info={{
								...activeTarget.info,
								rect:
									trackedRects[activeTarget.info.selector] ??
									activeTarget.info.rect,
							}}
							box={activeTargetBox}
							overlayScale={overlayScale}
							containerWidth={overlaySize.width}
							showLabel={false}
						/>
						<CommentMarker
							targetId={activeTarget.id}
							box={activeTargetBox}
							containerWidth={overlaySize.width}
							containerHeight={overlaySize.height}
							content={draftInstruction || activeTarget.instruction}
						/>
					</>
				)}

			{activeTarget?.kind === "screenshot" && activeTargetBox && (
				<>
					<ScreenshotHighlight
						box={activeTargetBox}
						containerWidth={overlaySize.width}
						label={t("stylePanel.inspector.screenshot")}
						size={formatElementSize(
							activeTarget.screenshot.displaySize?.width ??
								activeTarget.screenshot.rect.width,
							activeTarget.screenshot.displaySize?.height ??
								activeTarget.screenshot.rect.height,
						)}
						showLabel={false}
					/>
					<CommentMarker
						targetId={activeTarget.id}
						box={activeTargetBox}
						containerWidth={overlaySize.width}
						containerHeight={overlaySize.height}
						content={draftInstruction || activeTarget.instruction}
					/>
				</>
			)}

			{!panelPortalHost && editPopover}

			{pendingPanelContent}
			<AiEditingCaptureAuthorizationDialog
				open={captureSnapshot.authorization !== null}
				title={t("stylePanel.inspector.aiEditingCaptureAuthorizationTitle")}
				description={t("stylePanel.inspector.aiEditingCaptureAuthorizationDescription")}
				allowText={t("stylePanel.inspector.aiEditingCaptureAuthorizationAllow")}
				cancelText={t("stylePanel.inspector.cancel")}
				onAllow={() => resolveCaptureAuthorization(true)}
				onCancel={() => resolveCaptureAuthorization(false)}
			/>
		</div>
	)
}

// ─── Shared element highlight ────────────────────────────────────────────────

function ElementHighlight({
	info,
	box,
	overlayScale,
	containerWidth,
	animate = false,
	showLabel = true,
}: {
	info: InspectedElementInfo
	box: { left: number; top: number; width: number; height: number }
	overlayScale: { x: number; y: number }
	containerWidth: number
	/** Tracked rectangles refresh on every animation frame, so retained targets must not ease behind scrolling. */
	animate?: boolean
	/** Selected targets use a comment marker instead of the selector label. */
	showLabel?: boolean
}) {
	return (
		<>
			<div
				className="pointer-events-none absolute border-2 border-primary"
				style={{
					left: box.left,
					top: box.top,
					width: box.width,
					height: box.height,
					backgroundColor: "rgb(var(--primary-rgb) / 0.1)",
					transition: animate
						? "left 50ms ease-out, top 50ms ease-out, width 50ms ease-out, height 50ms ease-out"
						: undefined,
				}}
			/>

			{info.padding && (
				<div
					className="pointer-events-none absolute"
					style={{
						left: box.left - info.padding.left * overlayScale.x,
						top: box.top - info.padding.top * overlayScale.y,
						width:
							box.width + (info.padding.left + info.padding.right) * overlayScale.x,
						height:
							box.height + (info.padding.top + info.padding.bottom) * overlayScale.y,
						backgroundColor: "rgba(147, 196, 125, 0.3)",
						transition: animate
							? "left 50ms ease-out, top 50ms ease-out, width 50ms ease-out, height 50ms ease-out"
							: undefined,
						zIndex: -1,
					}}
				/>
			)}

			{showLabel && <HoverLabel info={info} box={box} containerWidth={containerWidth} />}
		</>
	)
}

function getSelectedElementComment(
	selector: string,
	activeTarget: HtmlSelectionTarget | null,
	pendingTargets: HtmlSelectionTarget[],
	draftInstruction: string,
) {
	if (activeTarget?.kind === "element" && activeTarget.info.selector === selector) {
		return draftInstruction || activeTarget.instruction
	}

	return (
		pendingTargets.find(
			(target) => target.kind === "element" && target.info.selector === selector,
		)?.instruction ?? ""
	)
}

function getSelectedElementTargetId(
	selector: string,
	activeTarget: HtmlSelectionTarget | null,
	pendingTargets: HtmlSelectionTarget[],
): string | undefined {
	if (activeTarget?.kind === "element" && activeTarget.info.selector === selector) {
		return activeTarget.id
	}

	return pendingTargets.find(
		(target) => target.kind === "element" && target.info.selector === selector,
	)?.id
}

function CommentMarker({
	targetId,
	box,
	containerWidth,
	containerHeight,
	content,
}: {
	targetId?: string
	box: { left: number; top: number; width: number; height: number }
	containerWidth: number
	containerHeight: number
	content: string
}) {
	const { t } = useTranslation("super")
	const [expanded, setExpanded] = useState(false)
	const [pinned, setPinned] = useState(false)
	if (!isRectVisibleInContainer(box, { width: containerWidth, height: containerHeight })) {
		return null
	}
	// Keep geometry placement aligned with the 28px visual marker and its button.
	const markerSize = 28
	const panelWidth = 220
	const markerLeft = Math.min(
		Math.max(4, box.left + box.width - markerSize / 2),
		Math.max(4, containerWidth - markerSize - 4),
	)
	const opensLeft = markerLeft + panelWidth > containerWidth
	const text = content.trim() || t("stylePanel.inspector.emptyDescription")
	const markerContainerLeft =
		expanded && opensLeft ? markerLeft - panelWidth + markerSize : markerLeft

	return (
		<div
			className={`pointer-events-auto absolute z-20 flex items-start overflow-visible border shadow-sm backdrop-blur-sm ${
				expanded
					? "w-[220px] rounded-2xl border-border/70 bg-background/95 shadow-[0_14px_36px_hsl(var(--foreground)/0.18)]"
					: "h-[28px] w-[28px] rounded-full border-primary/30 bg-primary text-primary-foreground shadow-[0_4px_12px_rgb(var(--primary-rgb)/0.28)]"
			}`}
			style={{ left: markerContainerLeft, top: Math.max(4, box.top) }}
			onMouseEnter={() => setExpanded(true)}
			onMouseLeave={() => {
				if (!pinned) setExpanded(false)
			}}
			onFocusCapture={() => setExpanded(true)}
			onBlurCapture={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null) && !pinned) {
					setExpanded(false)
				}
			}}
			data-testid="element-inspector-comment-marker"
			data-target-id={targetId}
		>
			<div className={`flex min-w-0 items-start ${opensLeft ? "flex-row-reverse" : ""}`}>
				<button
					data-testid="element-inspector-comment-button"
					data-target-id={targetId}
					type="button"
					className="inspector-comment-marker-button flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-[background-color,transform,box-shadow] duration-150 ease-out hover:scale-[1.04] hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 active:scale-[0.96]"
					aria-label={t("stylePanel.inspector.comment")}
					aria-expanded={expanded}
					onClick={(event) => {
						event.preventDefault()
						event.stopPropagation()
						const nextPinned = !pinned
						setPinned(nextPinned)
						setExpanded(nextPinned)
					}}
				>
					<MessageCircle size={15} />
				</button>
				<div
					className={`min-w-0 overflow-hidden text-xs text-foreground transition-[opacity,transform] duration-150 ease-out ${
						expanded
							? "max-w-[184px] translate-x-0 px-2 py-1.5 opacity-100"
							: "max-w-0 -translate-x-1 px-0 py-0 opacity-0"
					}`}
					aria-hidden={!expanded}
					data-testid="element-inspector-comment-content"
				>
					<div className="mb-0.5 text-[11px] font-semibold text-primary">
						{t("stylePanel.inspector.comment")}
					</div>
					<div className="max-h-20 overflow-y-auto whitespace-pre-wrap break-words leading-5">
						{text}
					</div>
				</div>
			</div>
		</div>
	)
}

function PendingTargetHighlight({
	targetId,
	box,
	onClick,
}: {
	targetId: string
	box: { left: number; top: number; width: number; height: number }
	onClick: () => void
}) {
	return (
		<div
			className="pointer-events-auto absolute cursor-pointer"
			style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
			data-testid="element-inspector-pending-target"
			data-target-id={targetId}
			onClick={(event) => {
				event.preventDefault()
				event.stopPropagation()
				onClick()
			}}
		/>
	)
}

function ScreenshotHighlight({
	box,
	containerWidth,
	label,
	size,
	showLabel = true,
}: {
	box: { left: number; top: number; width: number; height: number }
	containerWidth: number
	label: string
	size: string
	showLabel?: boolean
}) {
	return (
		<>
			<div
				className="pointer-events-none absolute border-2 border-primary"
				style={{
					left: box.left,
					top: box.top,
					width: box.width,
					height: box.height,
					backgroundColor: "rgb(var(--primary-rgb) / 0.1)",
				}}
			/>
			{showLabel && (
				<SelectionLabel
					label={label}
					size={size}
					box={box}
					containerWidth={containerWidth}
				/>
			)}
		</>
	)
}

function HoverLabel({
	info,
	box,
	containerWidth,
}: {
	info: InspectedElementInfo
	box: { left: number; top: number; width: number; height: number }
	containerWidth: number
}) {
	return (
		<SelectionLabel
			label={getShortSelector(info)}
			size={formatElementSize(info.rect.width, info.rect.height)}
			box={box}
			containerWidth={containerWidth}
		/>
	)
}

function SelectionLabel({
	label,
	size,
	box,
	containerWidth,
}: {
	label: string
	size: string
	box: { left: number; top: number; width: number; height: number }
	containerWidth: number
}) {
	const labelWidth = 240

	// Position label above the element if there's space, else below
	const above = box.top > 28
	let left = box.left
	if (left + labelWidth > containerWidth) {
		left = containerWidth - labelWidth - 4
	}
	if (left < 4) left = 4

	return (
		<div
			className="pointer-events-none absolute flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[11px] leading-tight text-white"
			data-testid="element-inspector-selection-label"
			style={{
				left,
				top: above ? box.top - 24 : box.top + box.height + 4,
				backgroundColor: "rgba(37, 99, 235, 0.9)",
				maxWidth: labelWidth,
			}}
		>
			<span className="truncate font-semibold">{label}</span>
			<span className="opacity-70">{size}</span>
		</div>
	)
}

// ─── Element Info Card ───────────────────────────────────────────────────────

function ElementInfoCard({
	info,
	box,
	containerWidth,
	containerHeight,
	onClose,
	onCopySelector,
	onInsertToConsole,
	onSendToAgent,
}: {
	info: InspectedElementInfo
	box: { left: number; top: number; width: number; height: number }
	containerWidth: number
	containerHeight: number
	onClose: () => void
	onCopySelector?: (selector: string) => void
	onInsertToConsole?: (code: string) => void
	onSendToAgent?: (content: JSONContent) => void
}) {
	const { t } = useTranslation("super")
	const cardWidth = 280
	const cardMaxHeight = 260

	// Position card to the right of the element if space permits, else to the left
	let left = box.left + box.width + 8
	if (left + cardWidth > containerWidth) {
		left = box.left - cardWidth - 8
	}
	if (left < 4) left = 4

	// Vertically align with the element, but clamp to viewport
	let top = box.top
	if (top + cardMaxHeight > containerHeight) {
		top = containerHeight - cardMaxHeight - 4
	}
	if (top < 4) top = 4

	const handleCopy = () => {
		onCopySelector?.(info.selector)
		navigator.clipboard.writeText(info.selector)
	}

	const handleInsert = () => {
		onInsertToConsole?.(`document.querySelector('${info.selector}')`)
	}

	const handleSendToAgent = () => {
		onSendToAgent?.(
			buildAgentPromptContent(
				info,
				t("stylePanel.inspector.agentPromptTitle"),
				undefined,
				undefined,
				undefined,
				t,
			),
		)
	}

	const importantStyles = [
		"display",
		"position",
		"width",
		"height",
		"color",
		"backgroundColor",
		"fontSize",
		"fontFamily",
	] as const

	return (
		<div
			className="pointer-events-auto absolute flex flex-col overflow-hidden rounded-lg border bg-popover/95 shadow-lg backdrop-blur-sm"
			style={{ left, top, width: cardWidth, maxHeight: cardMaxHeight }}
			data-testid="element-inspector-info-card"
		>
			{/* Header */}
			<div className="flex items-center justify-between border-b px-2 py-1.5">
				<div className="flex items-center gap-1 truncate text-xs font-semibold">
					<MousePointer size={12} className="flex-shrink-0 text-orange-500" />
					<span className="truncate font-mono">{getShortSelector(info)}</span>
				</div>
				<Button
					data-testid="element-inspector-info-close-button"
					variant="ghost"
					size="icon"
					className="h-5 w-5 flex-shrink-0"
					onClick={onClose}
				>
					<X size={10} />
				</Button>
			</div>

			{/* Body — scrollable */}
			<div className="flex-1 overflow-y-auto p-2 text-[11px]">
				{/* Size */}
				<div className="mb-1.5">
					<span className="text-muted-foreground">{t("stylePanel.inspector.size")}:</span>{" "}
					<span className="font-mono">
						{formatElementSize(info.rect.width, info.rect.height)}
					</span>
				</div>

				{/* Selector */}
				<div className="mb-1.5 flex items-start gap-1">
					<span className="flex-shrink-0 text-muted-foreground">
						{t("stylePanel.inspector.selector")}:
					</span>
					<span className="flex-1 break-all font-mono text-primary">{info.selector}</span>
				</div>

				{/* Box model summary */}
				<div className="mb-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
					<div>
						<span className="text-muted-foreground">{t("stylePanel.margin")}:</span>{" "}
						<span className="font-mono">
							{info.margin.top} {info.margin.right} {info.margin.bottom}{" "}
							{info.margin.left}
						</span>
					</div>
					<div>
						<span className="text-muted-foreground">{t("stylePanel.padding")}:</span>{" "}
						<span className="font-mono">
							{info.padding.top} {info.padding.right} {info.padding.bottom}{" "}
							{info.padding.left}
						</span>
					</div>
				</div>

				{/* Key computed styles */}
				<div className="border-t pt-1.5">
					<div className="mb-0.5 text-muted-foreground">
						{t("stylePanel.inspector.computedStyles")}
					</div>
					{importantStyles.map((prop) => {
						const value = info.computedStyles[prop]
						if (!value) return null
						return (
							<div key={prop} className="flex gap-1 py-px">
								<span className="text-purple-600 dark:text-purple-400">
									{prop}:
								</span>
								<span className="truncate font-mono">{value}</span>
							</div>
						)
					})}
				</div>

				{/* Text content preview */}
				{info.textContent && (
					<div className="mt-1.5 border-t pt-1.5">
						<span className="text-muted-foreground">
							{t("stylePanel.inspector.textContent")}:
						</span>
						<div className="mt-0.5 line-clamp-2 font-mono text-[10px] text-muted-foreground/80">
							{info.textContent}
						</div>
					</div>
				)}
			</div>

			{/* Actions */}
			<div className="flex flex-wrap items-center gap-1 border-t px-2 py-1">
				<Button
					data-testid="element-inspector-copy-selector-button"
					variant="ghost"
					size="sm"
					className="h-5 gap-1 px-1.5 text-[10px]"
					onClick={handleCopy}
				>
					<Copy size={10} />
					{t("stylePanel.inspector.copySelector")}
				</Button>
				{onInsertToConsole && (
					<Button
						data-testid="element-inspector-insert-console-button"
						variant="ghost"
						size="sm"
						className="h-5 gap-1 px-1.5 text-[10px]"
						onClick={handleInsert}
					>
						<Crosshair size={10} />
						{t("stylePanel.inspector.insertToConsole")}
					</Button>
				)}
				{onSendToAgent && (
					<Button
						variant="default"
						size="sm"
						className="h-5 gap-1 px-1.5 text-[10px]"
						onClick={handleSendToAgent}
						data-testid="inspector-send-to-agent-button"
					>
						<Send size={10} />
						{t("stylePanel.inspector.sendToAgent")}
					</Button>
				)}
			</div>
		</div>
	)
}
