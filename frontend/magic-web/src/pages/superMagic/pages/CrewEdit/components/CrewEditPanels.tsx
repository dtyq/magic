import {
	cloneElement,
	isValidElement,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactElement,
	type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { cn } from "@/utils/cn"
import TopicResizeHandle from "@/pages/superMagic/pages/TopicPage/components/TopicResizeHandle"
import type { TopicDesktopPanelsHistoryLayout } from "@/pages/superMagic/pages/TopicPage/components/TopicDesktopPanels"
import {
	DEFAULT_MIN_WIDTH,
	TOPIC_HISTORY_PANEL_WIDTH,
} from "@/pages/superMagic/constants/resizablePanel"

const COLLAPSED_MESSAGE_PANEL_WIDTH = 40
const RESIZE_HANDLE_WIDTH = 8
const DETAIL_PANEL_MIN_WIDTH = 400
const COLLAPSE_TRIGGER_DRAG_DISTANCE_RATIO = 0.5
const COLLAPSE_TRIGGER_SIZE_EPSILON = 0.2
// Portal layers bypass BaseLayoutPc padding, so they must consume safe-area variables directly.
const topicHistorySafeAreaPortalClassName =
	"pointer-events-none fixed bottom-[var(--safe-area-inset-bottom)] right-[var(--safe-area-inset-right)] top-[var(--safe-area-inset-top)] z-40"
const topicHistorySafeAreaDrawerClassName =
	"pointer-events-auto absolute bottom-[var(--safe-area-inset-bottom)] right-[var(--safe-area-inset-right)] top-[var(--safe-area-inset-top)]"

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
	/** Width of right conversation panel in px (when expanded) */
	messagePanelWidthPx: number
	/** Called when user starts dragging the sidebar resize handle */
	onSidebarResizeStart?: (clientX: number) => void
	/** Called when user starts dragging the conversation panel resize handle */
	onMessagePanelResizeStart?: (clientX: number) => void
	/** Whether the sidebar handle is currently being dragged */
	isDraggingSidebar?: boolean
	/** Whether the conversation panel handle is currently being dragged */
	isDraggingMessagePanel?: boolean
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
	messagePanelWidthPx,
	onSidebarResizeStart,
	onMessagePanelResizeStart,
	isDraggingSidebar = false,
	isDraggingMessagePanel = false,
	keepDetailMountedWhenHidden = false,
	historyLayout,
}: CrewEditPanelsProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const messagePanelWidthRef = useRef(messagePanelWidthPx)
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
		messagePanelWidthRef.current = messagePanelWidthPx
	}, [messagePanelWidthPx])

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

		/** Tracks pointer movement after the conversation panel reaches its minimum width. */
		const handlePointerMove = (event: PointerEvent) => {
			const currentMessageWidth = messagePanelWidthRef.current

			if (
				currentMessageWidth >
				DEFAULT_MIN_WIDTH.MESSAGE_PANEL + COLLAPSE_TRIGGER_SIZE_EPSILON
			) {
				resetMinSizeReachedTrackers()
				return
			}

			if (minSizeReachedPointerXRef.current === null) {
				minSizeReachedPointerXRef.current = event.clientX
				minSizeReachedPanelWidthRef.current = currentMessageWidth
				return
			}

			const dragDistancePx = event.clientX - minSizeReachedPointerXRef.current
			const panelWidthAtMinReached =
				minSizeReachedPanelWidthRef.current ?? currentMessageWidth
			if (
				!shouldAutoCollapseByDragDistance({
					dragDistancePx,
					panelWidthPx: panelWidthAtMinReached,
				})
			)
				return

			/** Ends the active resize with a semantic pointer event when the panel auto-collapses. */
			const createPointerEndEvent = () => {
				const init = {
					clientX: event.clientX,
					clientY: event.clientY,
					bubbles: true,
					cancelable: true,
				}
				return typeof PointerEvent === "function"
					? new PointerEvent("pointerup", init)
					: new MouseEvent("pointerup", init)
			}

			onToggleConversationPanel()
			stopCollapseMonitor()
			document.dispatchEvent(createPointerEndEvent())
		}

		/** Stops the collapse monitor when the active resize pointer completes or is cancelled. */
		const handlePointerEnd = () => {
			stopCollapseMonitor()
		}

		document.addEventListener("pointermove", handlePointerMove)
		document.addEventListener("pointerup", handlePointerEnd)
		document.addEventListener("pointercancel", handlePointerEnd)

		collapseMonitorCleanupRef.current = () => {
			document.removeEventListener("pointermove", handlePointerMove)
			document.removeEventListener("pointerup", handlePointerEnd)
			document.removeEventListener("pointercancel", handlePointerEnd)
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
		if (!isDraggingMessagePanel) stopCollapseMonitor()
	}, [isDraggingMessagePanel, stopCollapseMonitor])

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
	// Collapse should dismiss the history panel first so the shared desktop pattern matches
	// TopicPage and SkillEdit instead of leaving the history rail stranded on the right.
	const handleToggleConversationPanel = useCallback(() => {
		if (!isConversationPanelCollapsed && historyLayout?.isOpen) {
			historyLayout.onClose()
		}
		onToggleConversationPanel?.()
	}, [historyLayout, isConversationPanelCollapsed, onToggleConversationPanel])
	const renderedMessagePanel = isValidElement(messagePanel)
		? cloneElement(messagePanel as ReactElement<MessagePanelProps>, {
				historyTriggerMode: historyLayout ? "layout" : "dropdown",
				isHistoryPanelOpen: historyLayout?.isOpen ?? false,
				onToggleConversationPanel: handleToggleConversationPanel,
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
		isDraggingSidebar || isDraggingMessagePanel
			? "none"
			: "width 300ms cubic-bezier(0.4, 0, 0.2, 1), min-width 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 220ms ease"
	const messagePanelTransition =
		isDraggingSidebar ||
		isDraggingMessagePanel ||
		isConversationPanelCollapsed ||
		hideMessagePanel
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
				: Math.min(
						messagePanelWidthPx,
						Math.max(0, middleContainerWidth - RESIZE_HANDLE_WIDTH),
					)
			: undefined
	const targetDetailPanelWidth = !showDetailPanel
		? 0
		: hideMessagePanel
			? "100%"
			: isConversationPanelCollapsed
				? `calc(100% - ${COLLAPSED_MESSAGE_PANEL_WIDTH + targetRightHandleWidth}px)`
				: `calc(100% - ${targetRightHandleWidth + (targetMessagePanelWidth ?? 0)}px)`
	// Safari 会用 overflow:hidden 裁剪详情区内的 fixed 全屏层，全屏期间需解除祖先裁剪。
	const detailPanelOverflowClassName = isDetailPanelFullscreen
		? "overflow-visible"
		: "overflow-hidden"

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
			className={cn("flex h-full w-full", detailPanelOverflowClassName)}
			data-testid="crew-edit-panels"
		>
			<div
				className="flex h-full shrink-0 flex-col overflow-hidden"
				style={{
					width: sidebarWidthPx,
					transition: panelResizeTransition,
				}}
				data-testid="crew-edit-sidebar"
			>
				{sidebar}
			</div>

			<TopicResizeHandle
				onResizeStart={(clientX) => onSidebarResizeStart?.(clientX)}
				className={cn("shrink-0", isDraggingSidebar && "before:opacity-100")}
			/>

			<div
				className={cn("relative flex h-full min-w-0 flex-1", detailPanelOverflowClassName)}
			>
				{(showDetailPanel || keepDetailMountedWhenHidden) && (
					<div
						className={cn(
							"h-full min-w-0",
							detailPanelOverflowClassName,
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
						<div className={cn("h-full w-full min-w-0", detailPanelOverflowClassName)}>
							{detailPanel}
						</div>
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
							onResizeStart={(clientX) => {
								resetMinSizeReachedTrackers()
								startCollapseMonitor()
								onMessagePanelResizeStart?.(clientX)
							}}
							className={cn(
								"h-full w-full shrink-0 transition-opacity duration-150",
								(isConversationPanelCollapsed || !showDetailPanel) &&
									"pointer-events-none",
								isDraggingMessagePanel && "before:opacity-100",
							)}
						/>
					</div>
				)}

				<div
					className={cn(
						"h-full min-w-0 overflow-hidden",
						!showDetailPanel && "flex-1",
						showDetailPanel && !hideMessagePanel && "shrink-0",
					)}
					style={{
						width: targetMessagePanelWidth,
						minWidth:
							showDetailPanel && !hideMessagePanel ? targetMessagePanelWidth : 0,
						flexBasis:
							showDetailPanel && !hideMessagePanel
								? targetMessagePanelWidth
								: undefined,
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
							<div className={topicHistorySafeAreaPortalClassName}>
								<div className="pointer-events-auto h-full">
									{renderTopicHistoryShell(
										topicHistoryMode as Exclude<TopicHistoryMode, "hidden">,
									)}
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
								<div className={topicHistorySafeAreaDrawerClassName}>
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
