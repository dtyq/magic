import {
	isValidElement,
	useCallback,
	useEffect,
	useRef,
	type MouseEvent,
	type ReactNode,
} from "react"
import { cn } from "@/lib/tiptap-utils"
import TopicResizeHandle from "@/pages/superMagic/pages/TopicPage/components/TopicResizeHandle"

const COLLAPSED_MESSAGE_PANEL_WIDTH = 40
const RESIZE_HANDLE_WIDTH = 8
const DETAIL_PANEL_MIN_WIDTH = 400
const COLLAPSE_TRIGGER_DRAG_DISTANCE_RATIO = 0.5
const COLLAPSE_TRIGGER_SIZE_EPSILON = 0.2

interface MessagePanelProps {
	onToggleConversationPanel?: () => void
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
	isConversationPanelCollapsed = false,
	hideMessagePanel = false,
	sidebarWidthPx,
	detailPanelWidthPx,
	messagePanelWidthPx,
	onSidebarResizeStart,
	onDetailResizeStart,
	isDraggingSidebar = false,
	isDraggingDetail = false,
}: CrewEditPanelsProps) {
	const detailPanelWidthRef = useRef(detailPanelWidthPx)
	const minSizeReachedPointerXRef = useRef<number | null>(null)
	const minSizeReachedPanelWidthRef = useRef<number | null>(null)
	const collapseMonitorCleanupRef = useRef<(() => void) | null>(null)
	const onToggleConversationPanel = isValidElement(messagePanel)
		? (messagePanel.props as MessagePanelProps).onToggleConversationPanel
		: undefined

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

	return (
		<div className="flex h-full w-full overflow-hidden" data-testid="crew-edit-panels">
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

			<div className="flex h-full min-w-0 flex-1 overflow-hidden">
				<div
					className={cn(
						"h-full min-w-0 overflow-hidden",
						!showDetailPanel && "pointer-events-none",
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
					{messagePanel}
				</div>
			</div>
		</div>
	)
}

export default CrewEditPanels
