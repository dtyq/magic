import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react"
import { createPortal } from "react-dom"
import { observer } from "mobx-react-lite"
import { cn } from "@/lib/tiptap-utils"
import { TOPIC_HISTORY_PANEL_WIDTH } from "../../../constants/resizablePanel"
import TopicResizeHandle from "./TopicResizeHandle"
import { useTopicDesktopLayout } from "../hooks/useTopicDesktopLayout"
import { useTopicDesktopPanelMotion } from "../hooks/useTopicDesktopPanelMotion"

export interface TopicDesktopPanelsHistoryLayout {
	isOpen: boolean
	onClose: () => void
	onToggle: () => void
	renderPanel: (params: {
		mode: "full-right" | "fixed" | "drawer"
		onClose: () => void
		closeButtonRef?: RefObject<HTMLButtonElement | null>
		isConversationPanelCollapsed: boolean
		onExpandConversationPanel: () => void
	}) => ReactNode
}

interface TopicDesktopPanelsProps {
	containerClassName: string
	detailPanelClassName: string
	isDetailPanelFullscreen: boolean
	sidebar: ReactNode
	detailPanel: ReactNode
	isReadOnly: boolean
	showProjectResizeHandle?: boolean
	keepDetailMountedWhenHidden?: boolean
	historyLayout?: TopicDesktopPanelsHistoryLayout
	shouldShowDetailPanel: boolean
	renderMessagePanel: (params: {
		isConversationPanelCollapsed: boolean
		isDraggingPanel: boolean
		onToggleConversationPanel: () => void
		onExpandConversationPanel: () => void
		historyTriggerMode: "dropdown" | "layout"
		isHistoryPanelOpen: boolean
		onToggleHistoryPanel?: () => void
	}) => ReactNode
}

function TopicDesktopPanels({
	containerClassName,
	detailPanelClassName,
	isDetailPanelFullscreen,
	sidebar,
	detailPanel,
	isReadOnly,
	showProjectResizeHandle = !isReadOnly,
	keepDetailMountedWhenHidden = false,
	historyLayout,
	shouldShowDetailPanel,
	renderMessagePanel,
}: TopicDesktopPanelsProps) {
	const topicHistoryCloseButtonRef = useRef<HTMLButtonElement>(null)
	const isTopicHistoryPanelOpen = historyLayout?.isOpen ?? false
	const onCloseTopicHistoryPanel = historyLayout?.onClose
	const onToggleTopicHistoryPanel = historyLayout?.onToggle
	const renderTopicHistoryPanel = historyLayout?.renderPanel
	const {
		containerRef,
		containerWidthPx,
		projectSiderWidthPx,
		messagePanelWidthPx,
		collapsedMessagePanelWidthPx,
		isConversationPanelCollapsed,
		isDraggingProjectSider,
		isDraggingMessagePanel,
		startDragProjectSider,
		startDragMessagePanel,
		toggleConversationPanel,
		expandConversationPanel,
		ensureExpandedWhenDetailVisible,
	} = useTopicDesktopLayout({ isReadOnly, allowProjectSiderResize: showProjectResizeHandle })
	const {
		panelResizeTransition,
		messageTransform,
		messagePanelTransition,
		detailContentTransform,
		detailContentTransition,
		middleContainerWidth,
		topicHistoryMode,
		targetMessagePanelWidth,
		targetRightHandleWidth,
		targetDetailPanelWidth,
	} = useTopicDesktopPanelMotion({
		isReadOnly,
		isTopicHistoryPanelOpen,
		showProjectResizeHandle,
		shouldShowDetailPanel,
		containerWidthPx,
		projectSiderWidthPx,
		messagePanelWidthPx,
		collapsedMessagePanelWidthPx,
		isConversationPanelCollapsed,
		isDraggingProjectSider,
		isDraggingMessagePanel,
		ensureExpandedWhenDetailVisible,
	})
	const visibleConversationPanelCollapsed = shouldShowDetailPanel
		? isConversationPanelCollapsed
		: false
	const messagePanel = renderMessagePanel({
		isConversationPanelCollapsed: visibleConversationPanelCollapsed,
		isDraggingPanel: isDraggingProjectSider || isDraggingMessagePanel,
		onToggleConversationPanel: toggleConversationPanel,
		onExpandConversationPanel: expandConversationPanel,
		historyTriggerMode: historyLayout ? "layout" : "dropdown",
		isHistoryPanelOpen: isTopicHistoryPanelOpen,
		onToggleHistoryPanel: onToggleTopicHistoryPanel,
	})
	const isTopicHistoryReady =
		!isReadOnly &&
		containerWidthPx > 0 &&
		middleContainerWidth > 0 &&
		topicHistoryMode !== "hidden"
	const visibleTopicHistoryMode = isTopicHistoryReady ? topicHistoryMode : null
	const isDrawerTopicHistory = isTopicHistoryReady && topicHistoryMode === "drawer"
	const isFixedTopicHistory =
		isTopicHistoryReady && (topicHistoryMode === "fixed" || topicHistoryMode === "full-right")
	const topicHistoryPanelContent = useMemo(() => {
		if (!visibleTopicHistoryMode || !renderTopicHistoryPanel || !onCloseTopicHistoryPanel)
			return null
		return renderTopicHistoryPanel({
			mode: visibleTopicHistoryMode,
			onClose: onCloseTopicHistoryPanel,
			closeButtonRef: topicHistoryCloseButtonRef,
			isConversationPanelCollapsed: visibleConversationPanelCollapsed,
			onExpandConversationPanel: expandConversationPanel,
		})
	}, [
		expandConversationPanel,
		onCloseTopicHistoryPanel,
		renderTopicHistoryPanel,
		visibleConversationPanelCollapsed,
		visibleTopicHistoryMode,
	])

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
		if (!isDrawerTopicHistory || !onCloseTopicHistoryPanel) return
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return
			event.preventDefault()
			onCloseTopicHistoryPanel()
		}

		document.addEventListener("keydown", handleKeyDown)
		return () => {
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [isDrawerTopicHistory, onCloseTopicHistoryPanel])

	function renderTopicHistoryShell(mode: "full-right" | "fixed" | "drawer") {
		const isDrawer = mode === "drawer"

		return (
			<div
				className={cn("flex h-full min-h-0 shrink-0 pl-2", isDrawer && "z-20")}
				style={{ width: TOPIC_HISTORY_PANEL_WIDTH }}
			>
				<section
					className={cn(
						"flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-border bg-background",
						isDrawer &&
							"overflow-hidden shadow-2xl duration-200 animate-in fade-in slide-in-from-right-4",
					)}
					data-testid={
						isDrawer ? "topic-history-panel-drawer" : "topic-history-panel-fixed"
					}
					role={isDrawer ? "dialog" : "complementary"}
					aria-modal={isDrawer ? false : undefined}
				>
					{topicHistoryPanelContent}
				</section>
			</div>
		)
	}

	return (
		<div
			ref={containerRef}
			className={containerClassName}
			data-testid="main-workspace-container"
		>
			<div className="flex h-full w-full min-w-0">
				<div className="shrink-0" style={{ width: projectSiderWidthPx }}>
					{sidebar}
				</div>

				{showProjectResizeHandle && (
					<TopicResizeHandle
						onMouseDown={(event) => {
							startDragProjectSider(event.clientX)
						}}
						className={cn("shrink-0", isDraggingProjectSider && "before:opacity-100")}
					/>
				)}

				<div
					className="relative flex h-full min-w-0 flex-1 overflow-hidden"
					data-testid="topic-desktop-main-content"
				>
					{(isReadOnly || shouldShowDetailPanel || keepDetailMountedWhenHidden) && (
						<div
							data-testid="topic-detail-panel-slot"
							className={cn("h-full min-w-0 overflow-hidden", isReadOnly && "flex-1")}
							aria-hidden={!isReadOnly && !shouldShowDetailPanel}
							style={
								isReadOnly
									? undefined
									: {
											width: targetDetailPanelWidth,
											minWidth: 0,
											opacity: shouldShowDetailPanel ? 1 : 0,
											pointerEvents:
												shouldShowDetailPanel ||
												!keepDetailMountedWhenHidden
													? "auto"
													: "none",
											willChange: isDetailPanelFullscreen
												? "auto"
												: "width, opacity",
											transition: panelResizeTransition,
										}
							}
						>
							<div
								className={cn(
									detailPanelClassName,
									"h-full overflow-hidden rounded-lg bg-background",
									shouldShowDetailPanel && "opacity-100",
								)}
								style={{
									transform: isDetailPanelFullscreen
										? "none"
										: detailContentTransform,
									transition: detailContentTransition,
								}}
								data-testid="detail-panel-wrapper"
							>
								{detailPanel}
							</div>
						</div>
					)}

					{!isReadOnly && shouldShowDetailPanel && (
						<div
							data-testid="topic-detail-resize-handle-slot"
							className="shrink-0 overflow-hidden"
							style={{
								width: targetRightHandleWidth,
								minWidth: targetRightHandleWidth,
								willChange: isDraggingMessagePanel ? "auto" : "width, opacity",
								transition: isDraggingMessagePanel ? "none" : panelResizeTransition,
							}}
						>
							<TopicResizeHandle
								disabled={isConversationPanelCollapsed || !shouldShowDetailPanel}
								onMouseDown={(event) => {
									startDragMessagePanel(event.clientX)
								}}
								className={cn(
									"h-full w-full shrink-0",
									!isDraggingMessagePanel && "transition-opacity duration-150",
									(isConversationPanelCollapsed || !shouldShowDetailPanel) &&
										"pointer-events-none",
									isDraggingMessagePanel && "before:opacity-100",
								)}
							/>
						</div>
					)}

					{!isReadOnly && (
						<div
							data-testid="topic-conversation-panel-slot"
							className="h-full min-w-0 shrink-0"
							style={{
								width: targetMessagePanelWidth,
								minWidth: targetMessagePanelWidth,
								transform: messageTransform,
								opacity: shouldShowDetailPanel ? 1 : 0.995,
								willChange: "width, transform, opacity",
								transition: messagePanelTransition,
							}}
						>
							{messagePanel}
						</div>
					)}

					{isFixedTopicHistory && visibleTopicHistoryMode ? (
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
										{renderTopicHistoryShell(visibleTopicHistoryMode)}
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
										data-testid="topic-history-panel-dismiss-area"
										onClick={onCloseTopicHistoryPanel}
										aria-hidden="true"
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
		</div>
	)
}

export default observer(TopicDesktopPanels)
