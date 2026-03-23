import { type ReactNode } from "react"
import { observer } from "mobx-react-lite"
import { cn } from "@/lib/tiptap-utils"
import TopicResizeHandle from "./TopicResizeHandle"
import { useTopicDesktopLayout } from "../hooks/useTopicDesktopLayout"
import { useTopicDesktopPanelMotion } from "../hooks/useTopicDesktopPanelMotion"

interface TopicDesktopPanelsProps {
	containerClassName: string
	detailPanelClassName: string
	isDetailPanelFullscreen: boolean
	sidebar: ReactNode
	detailPanel: ReactNode
	isReadOnly: boolean
	showProjectResizeHandle?: boolean
	shouldShowDetailPanel: boolean
	renderMessagePanel: (params: {
		isConversationPanelCollapsed: boolean
		isDraggingPanel: boolean
		onToggleConversationPanel: () => void
		onExpandConversationPanel: () => void
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
	shouldShowDetailPanel,
	renderMessagePanel,
}: TopicDesktopPanelsProps) {
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
		targetMessagePanelWidth,
		targetRightHandleWidth,
		targetDetailPanelWidth,
	} = useTopicDesktopPanelMotion({
		isReadOnly,
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
	})

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

				<div className="flex h-full min-w-0 flex-1 overflow-hidden">
					<div
						className={cn(
							"h-full min-w-0 overflow-hidden",
							isReadOnly && "flex-1",
							!shouldShowDetailPanel && "pointer-events-none",
						)}
						style={
							isReadOnly
								? undefined
								: {
										width: targetDetailPanelWidth,
										minWidth: 0,
										opacity: shouldShowDetailPanel ? 1 : 0,
										// Remove willChange when fullscreen to avoid creating stacking context
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
								shouldShowDetailPanel ? "opacity-100" : "opacity-0 shadow-none",
							)}
							style={{
								// Remove transform when fullscreen to avoid creating stacking context
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

					{!isReadOnly && (
						<div
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
				</div>
			</div>
		</div>
	)
}

export default observer(TopicDesktopPanels)
