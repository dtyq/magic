import { type ReactNode, type RefObject } from "react"
import { cn } from "@/lib/tiptap-utils"
import TopicResizeHandle from "./TopicResizeHandle"

interface TopicDesktopPanelsProps {
	containerRef: RefObject<HTMLDivElement>
	containerClassName: string
	detailPanelClassName: string
	isDetailPanelFullscreen: boolean
	sidebar: ReactNode
	detailPanel: ReactNode
	messagePanel: ReactNode
	isReadOnly: boolean
	showProjectResizeHandle?: boolean
	shouldShowDetailPanel: boolean
	isConversationPanelCollapsed: boolean
	isDraggingProjectSider: boolean
	isDraggingMessagePanel: boolean
	projectSiderWidthPx: number
	targetDetailPanelWidth: number
	targetRightHandleWidth: number
	targetMessagePanelWidth: number
	panelResizeTransition: string
	detailContentTransform: string
	detailContentTransition: string
	messageTransform: string
	messagePanelTransition: string
	onProjectResizeStart: (clientX: number) => void
	onMessageResizeStart: (clientX: number) => void
}

function TopicDesktopPanels({
	containerRef,
	containerClassName,
	detailPanelClassName,
	isDetailPanelFullscreen,
	sidebar,
	detailPanel,
	messagePanel,
	isReadOnly,
	showProjectResizeHandle = !isReadOnly,
	shouldShowDetailPanel,
	isConversationPanelCollapsed,
	isDraggingProjectSider,
	isDraggingMessagePanel,
	projectSiderWidthPx,
	targetDetailPanelWidth,
	targetRightHandleWidth,
	targetMessagePanelWidth,
	panelResizeTransition,
	detailContentTransform,
	detailContentTransition,
	messageTransform,
	messagePanelTransition,
	onProjectResizeStart,
	onMessageResizeStart,
}: TopicDesktopPanelsProps) {
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
							onProjectResizeStart(event.clientX)
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
									onMessageResizeStart(event.clientX)
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

export default TopicDesktopPanels
