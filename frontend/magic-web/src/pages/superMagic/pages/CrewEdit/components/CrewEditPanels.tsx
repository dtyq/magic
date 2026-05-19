import {
	cloneElement,
	isValidElement,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type MouseEvent,
	type ReactElement,
	type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/tiptap-utils"
import TopicResizeHandle from "@/pages/superMagic/pages/TopicPage/components/TopicResizeHandle"
import type { TopicDesktopPanelsHistoryLayout } from "@/pages/superMagic/pages/TopicPage/components/TopicDesktopPanels"
import { TOPIC_HISTORY_PANEL_WIDTH } from "@/pages/superMagic/constants/resizablePanel"

const COLLAPSED_MESSAGE_PANEL_WIDTH = 40
const RESIZE_HANDLE_WIDTH = 8
const DETAIL_PANEL_MIN_WIDTH = 400
const COLLAPSE_TRIGGER_DRAG_DISTANCE_RATIO = 0.5
const COLLAPSE_TRIGGER_SIZE_EPSILON = 0.2

type TopicHistoryMode = "hidden" | "full-right" | "fixed" | "drawer"

interface MessagePanelProps {
	onToggleConversationPanel?: () => void
	historyTriggerMode?: "dropdown" | "layout"
	isHistoryPanelOpen?: boolean
	onToggleHistoryPanel?: () => void
}

interface CrewEditPanelsProps {
	/** Left panel: step navigation */
	sidebar: ReactNode
	/** Center panel: step-specific detail content */
	detailPanel: ReactNode
	/** Right panel: AI topic / chat */
	messagePanel: ReactNode
	/** Whether to show the center detail panel */
	showDetailPanel: boolean
	/** Whether the detail panel is in fullscreen mode */
	isDetailPanelFullscreen?: boolean
	/** Whether the right conversation panel is collapsed */
	isConversationPanelCollapsed?: boolean
	/** Whether the right conversation panel is fully hidden (no collapsed sliver) */
	hideMessagePanel?: boolean
	/** Width of the left sidebar in px */
	sidebarWidthPx: number
	/** Width of the center detail panel in px (used when visible) */
	detailPanelWidthPx: number
	/** Width of right conversation panel in px (when expanded) */
	messagePanelWidthPx: number
	/** Called when user starts dragging the sidebar resize handle */
	onSidebarResizeStart?: (e: MouseEvent<HTMLDivElement>) => void
	/** Called when user starts dragging the detail panel resize handle */
	onDetailResizeStart?: (e: MouseEvent<HTMLDivElement>) => void
	/** Whether the sidebar handle is currently being dragged */
	isDraggingSidebar?: boolean
	/** Whether the detail handle is currently being dragged */
	isDraggingDetail?: boolean
	/** Keep detail subtree mounted when hidden to preserve refs */
	keepDetailMountedWhenHidden?: boolean
	/** Optional history topic layout rendered to the right of conversation */
	historyLayout?: TopicDesktopPanelsHistoryLayout
}

/**
 * CrewEditPanels
 *
 * Three-column layout for the crew creation page, mirroring the
 * TopicDesktopPanels pattern:
 *
 *   [ sidebar (fixed) ] [ resize handle ] [ detail panel (animated) ] [ message panel (flex-1) ]
 *
 * The center detail column slides in/out with a CSS transition when
 * `showDetailPanel` changes.
 */
function CrewEditPanels({
	sidebar,
	detailPanel,
	messagePanel,
	showDetailPanel,
	isDetailPanelFullscreen = false,
	isConversationPanelCollapsed = false,
	hideMessagePanel = false,
	sidebarWidthPx,
	detailPanelWidthPx,
	messagePanelWidthPx,
	onSidebarResizeStart,
	onDetailResizeStart,
	isDraggingSidebar = false,
	isDraggingDetail = false,
	keepDetailMountedWhenHidden = false,
	historyLayout,
}: CrewEditPanelsProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const detailPanelWidthRef = useRef(detailPanelWidthPx)
	const minSizeReachedPointerXRef = useRef<number | null>(null)
	const minSizeReachedPanelWidthRef = useRef<number | null>(null)
	const collapseMonitorCleanupRef = useRef<(() => void) | null>(null)
	const topicHistoryCloseButtonRef = useRef<HTMLButtonElement>(null)
	const [containerWidthPx, setContainerWidthPx] = useState(0)
	const onToggleConversationPanel = isValidElement(messagePanel)
		? (messagePanel.props as MessagePanelProps).onToggleConversationPanel
		: undefined
	const onExpandConversationPanel = isValidElement(messagePanel)
		? (messagePanel.props as { onExpandConversationPanel?: () => void })
				.onExpandConversationPanel
		: undefined

	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		function updateContainerWidth() {
			if (!containerRef.current) return
			setContainerWidthPx(containerRef.current.clientWidth)
		}

		updateContainerWidth()
		const observer = new ResizeObserver(updateContainerWidth)
		observer.observe(container)

		return () => {
			observer.disconnect()
		}
	}, [])

	useEffect(() => {
		detailPanelWidthRef.current = detailPanelWidthPx
	}, [detailPanelWidthPx])

	const resetMinSizeReachedTrackers = useCallback(() => {
		minSizeReachedPointerXRef.current = null
		minSizeReachedPanelWidthRef.current = null
	}, [])

	const stopCollapseMonitor = useCallback(() => {
		collapseMonitorCleanupRef.current?.()
		collapseMonitorCleanupRef.current = null
		resetMinSizeReachedTrackers()
	}, [resetMinSizeReachedTrackers])

	function shouldAutoCollapseByDragDistance({
		dragDistancePx,
		panelWidthPx,
	}: {
		dragDistancePx: number
		panelWidthPx: number
	}) {
		if (!Number.isFinite(dragDistancePx) || !Number.isFinite(panelWidthPx)) return false
		if (dragDistancePx <= 0 || panelWidthPx <= 0) return false
		return dragDistancePx >= panelWidthPx * COLLAPSE_TRIGGER_DRAG_DISTANCE_RATIO
	}

	const startCollapseMonitor = useCallback(() => {
		if (
			isConversationPanelCollapsed ||
			hideMessagePanel ||
			!showDetailPanel ||
			typeof onToggleConversationPanel !== "function"
		) {
			stopCollapseMonitor()
			return
		}

		stopCollapseMonitor()

		const handleMouseMove = (event: globalThis.MouseEvent) => {
			const currentDetailWidth = detailPanelWidthRef.current

			if (currentDetailWidth > DETAIL_PANEL_MIN_WIDTH + COLLAPSE_TRIGGER_SIZE_EPSILON) {
				resetMinSizeReachedTrackers()
				return
			}

			if (minSizeReachedPointerXRef.current === null) {
				minSizeReachedPointerXRef.current = event.clientX
				minSizeReachedPanelWidthRef.current = currentDetailWidth
				return
			}

			const dragDistancePx = minSizeReachedPointerXRef.current - event.clientX
			const panelWidthAtMinReached = minSizeReachedPanelWidthRef.current ?? currentDetailWidth
			if (
				!shouldAutoCollapseByDragDistance({
					dragDistancePx,
					panelWidthPx: panelWidthAtMinReached,
				})
			)
				return

			onToggleConversationPanel()
			stopCollapseMonitor()
			document.dispatchEvent(
				new MouseEvent("mouseup", {
					clientX: event.clientX,
					clientY: event.clientY,
					bubbles: true,
					cancelable: true,
				}),
			)
		}

		const handleMouseUp = () => {
			stopCollapseMonitor()
		}

		document.addEventListener("mousemove", handleMouseMove)
		document.addEventListener("mouseup", handleMouseUp)

		collapseMonitorCleanupRef.current = () => {
			document.removeEventListener("mousemove", handleMouseMove)
			document.removeEventListener("mouseup", handleMouseUp)
		}
	}, [
		hideMessagePanel,
		isConversationPanelCollapsed,
		onToggleConversationPanel,
		resetMinSizeReachedTrackers,
		showDetailPanel,
		stopCollapseMonitor,
	])

	useEffect(() => {
		if (!isDraggingDetail) stopCollapseMonitor()
	}, [isDraggingDetail, stopCollapseMonitor])

	useEffect(() => {
		return () => {
			stopCollapseMonitor()
		}
	}, [stopCollapseMonitor])

	const middleContainerWidth = useMemo(() => {
		if (containerWidthPx <= 0) return 0
		return Math.max(0, containerWidthPx - sidebarWidthPx - RESIZE_HANDLE_WIDTH)
	}, [containerWidthPx, sidebarWidthPx])

	const fixedTopicHistoryThreshold = useMemo(() => {
		return (
			DETAIL_PANEL_MIN_WIDTH +
			messagePanelWidthPx +
			TOPIC_HISTORY_PANEL_WIDTH +
			RESIZE_HANDLE_WIDTH
		)
	}, [messagePanelWidthPx])

	const topicHistoryMode = useMemo<TopicHistoryMode>(() => {
		if (!historyLayout || !historyLayout.isOpen || hideMessagePanel) return "hidden"
		if (!showDetailPanel) return "full-right"
		if (middleContainerWidth < fixedTopicHistoryThreshold) return "drawer"
		return "fixed"
	}, [
		fixedTopicHistoryThreshold,
		hideMessagePanel,
		historyLayout,
		middleContainerWidth,
		showDetailPanel,
	])

	const isDrawerTopicHistory = topicHistoryMode === "drawer"
	const isFixedTopicHistory = topicHistoryMode === "fixed" || topicHistoryMode === "full-right"
	const renderedMessagePanel = isValidElement(messagePanel)
		? cloneElement(messagePanel as ReactElement<MessagePanelProps>, {
				historyTriggerMode: historyLayout ? "layout" : "dropdown",
				isHistoryPanelOpen: historyLayout?.isOpen ?? false,
				onToggleHistoryPanel: historyLayout?.onToggle,
			})
		: messagePanel

	useEffect(() => {
		if (!isDrawerTopicHistory) return
		const rafId = window.requestAnimationFrame(() => {
			topicHistoryCloseButtonRef.current?.focus()
		})
		return () => {
			window.cancelAnimationFrame(rafId)
		}
	}, [isDrawerTopicHistory])

	useEffect(() => {
		if (!isDrawerTopicHistory || !historyLayout?.onClose) return
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return
			event.preventDefault()
			historyLayout.onClose()
		}

		document.addEventListener("keydown", handleKeyDown)
		return () => {
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [historyLayout, isDrawerTopicHistory])

	const panelResizeTransition =
		isDraggingSidebar || isDraggingDetail
			? "none"
			: "width 300ms cubic-bezier(0.4, 0, 0.2, 1), min-width 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 220ms ease"
	const messagePanelTransition =
		isDraggingSidebar || isDraggingDetail || isConversationPanelCollapsed || hideMessagePanel
			? panelResizeTransition
			: "opacity 220ms ease"
	const targetRightHandleWidth =
		showDetailPanel && !isConversationPanelCollapsed && !hideMessagePanel
			? RESIZE_HANDLE_WIDTH
			: 0
	const targetMessagePanelWidth = hideMessagePanel
		? 0
		: showDetailPanel
			? isConversationPanelCollapsed
				? COLLAPSED_MESSAGE_PANEL_WIDTH
				: undefined
			: undefined
	const targetMessagePanelFlexBasis =
		showDetailPanel && !isConversationPanelCollapsed && !hideMessagePanel
			? messagePanelWidthPx
			: undefined
	const targetDetailPanelWidth = !showDetailPanel
		? 0
		: hideMessagePanel
			? "100%"
			: isConversationPanelCollapsed
				? `calc(100% - ${COLLAPSED_MESSAGE_PANEL_WIDTH + targetRightHandleWidth}px)`
				: detailPanelWidthPx

	function renderTopicHistoryShell(mode: Exclude<TopicHistoryMode, "hidden">) {
		const isDrawer = mode === "drawer"
		return (
			<div
				className={cn("flex h-full min-h-0 shrink-0 pl-2", isDrawer && "z-20")}
				style={{ width: TOPIC_HISTORY_PANEL_WIDTH }}
			>
				<section
					className={cn(
						"flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-border bg-background",
						isDrawer && "overflow-hidden shadow-2xl",
					)}
					data-testid={
						isDrawer
							? "crew-topic-history-panel-drawer"
							: "crew-topic-history-panel-fixed"
					}
				>
					<div className="min-h-0 flex-1 overflow-hidden">
						{historyLayout?.renderPanel({
							mode,
							onClose: historyLayout.onClose,
							closeButtonRef: topicHistoryCloseButtonRef,
							isConversationPanelCollapsed,
							onExpandConversationPanel:
								onExpandConversationPanel ?? (() => undefined),
						})}
					</div>
				</section>
			</div>
		)
	}

	return (
		<div
			ref={containerRef}
			className="flex h-full w-full overflow-hidden"
			data-testid="crew-edit-panels"
		>
			<div
				className="flex h-full shrink-0 flex-col overflow-hidden"
				style={{ width: sidebarWidthPx }}
				data-testid="crew-edit-sidebar"
			>
				{sidebar}
			</div>

			<TopicResizeHandle
				onMouseDown={(e) => onSidebarResizeStart?.(e)}
				className={cn("shrink-0", isDraggingSidebar && "before:opacity-100")}
			/>

			<div className="relative flex h-full min-w-0 flex-1 overflow-hidden">
				{(showDetailPanel || keepDetailMountedWhenHidden) && (
					<div
						className={cn(
							"h-full min-w-0 overflow-hidden",
							!showDetailPanel &&
								keepDetailMountedWhenHidden &&
								"pointer-events-none",
							isDetailPanelFullscreen && "z-detail-fullscreen",
						)}
						style={{
							width: targetDetailPanelWidth,
							minWidth: 0,
							opacity: showDetailPanel ? 1 : 0,
							willChange: "width, opacity",
							transition: panelResizeTransition,
						}}
						data-testid="crew-edit-detail-panel"
					>
						<div className="h-full w-full min-w-0 overflow-hidden">{detailPanel}</div>
					</div>
				)}

				{!isConversationPanelCollapsed && (
					<div
						className="shrink-0 overflow-hidden"
						style={{
							width: targetRightHandleWidth,
							minWidth: targetRightHandleWidth,
							willChange: "width, opacity",
							transition: panelResizeTransition,
						}}
					>
						<TopicResizeHandle
							disabled={isConversationPanelCollapsed || !showDetailPanel}
							onMouseDown={(e) => {
								resetMinSizeReachedTrackers()
								startCollapseMonitor()
								onDetailResizeStart?.(e)
							}}
							className={cn(
								"h-full w-full shrink-0 transition-opacity duration-150",
								(isConversationPanelCollapsed || !showDetailPanel) &&
									"pointer-events-none",
								isDraggingDetail && "before:opacity-100",
							)}
						/>
					</div>
				)}

				<div
					className={cn(
						"h-full min-w-0 overflow-hidden",
						!showDetailPanel && "flex-1",
						showDetailPanel &&
							!hideMessagePanel &&
							(isConversationPanelCollapsed ? "shrink-0" : "flex-1"),
					)}
					style={{
						width: targetMessagePanelWidth,
						minWidth:
							showDetailPanel && isConversationPanelCollapsed && !hideMessagePanel
								? targetMessagePanelWidth
								: 0,
						flexBasis: targetMessagePanelFlexBasis,
						opacity: showDetailPanel ? 1 : 0.995,
						willChange: "width, opacity",
						transition: messagePanelTransition,
						display: hideMessagePanel ? "none" : undefined,
					}}
					data-testid="crew-edit-message-panel"
				>
					{renderedMessagePanel}
				</div>

				{isFixedTopicHistory ? (
					<>
						{/* 占位符，用来推开对话区和详情区 */}
						<div
							className="shrink-0 transition-all duration-200"
							style={{ width: TOPIC_HISTORY_PANEL_WIDTH - 8 }}
							aria-hidden="true"
						/>
						{createPortal(
							<div className="pointer-events-none fixed inset-y-0 right-0 z-40">
								<div className="pointer-events-auto h-full">
									{renderTopicHistoryShell(topicHistoryMode as any)}
								</div>
							</div>,
							document.body,
						)}
					</>
				) : null}

				{isDrawerTopicHistory
					? createPortal(
							<div className="pointer-events-none fixed inset-0 z-50">
								<div
									className="pointer-events-auto absolute inset-0 bg-transparent"
									data-testid="crew-topic-history-panel-backdrop"
									onClick={historyLayout?.onClose}
								/>
								<div className="pointer-events-auto absolute inset-y-0 right-0">
									{renderTopicHistoryShell("drawer")}
								</div>
							</div>,
							document.body,
						)
					: null}
			</div>
		</div>
	)
}

export default CrewEditPanels
