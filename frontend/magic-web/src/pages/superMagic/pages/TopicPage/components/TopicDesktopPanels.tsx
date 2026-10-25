import { useLocation } from "react-router"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { projectStore } from "../../../stores/core"
import { getFileReferenceIdentityKey } from "../../../services/userFileReferenceResolver"
import {
	isUploadedFileNavigationTarget,
	type SuperMagicLocateFileContext,
} from "../../../events/files"
import type { FileSidebarControl } from "../../../components/Detail/components/FilesViewer/types"
import {
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
	type RefObject,
} from "react"
import { createPortal } from "react-dom"
import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Tooltip } from "antd"
import { PanelLeftOpen } from "lucide-react"
import { cn } from "@/utils/cn"
import { TOPIC_HISTORY_PANEL_WIDTH, SIDEBAR_TRANSITION_MS } from "../../../constants/resizablePanel"
import { useReducedMotion } from "framer-motion"
import TopicHistorySidebar from "./TopicHistorySidebar"
import TopicResizeHandle from "./TopicResizeHandle"
import { useTopicDesktopLayout } from "../hooks/useTopicDesktopLayout"
import type { ProjectSiderPanelPersistence } from "../stores/TopicLayoutStore"
import { useTopicDesktopPanelMotion } from "../hooks/useTopicDesktopPanelMotion"

// Portal layers bypass BaseLayoutPc padding, so they must consume safe-area variables directly.
const topicHistorySafeAreaPortalClassName =
	"pointer-events-none fixed bottom-[var(--safe-area-inset-bottom)] right-[var(--safe-area-inset-right)] top-[var(--safe-area-inset-top)] z-40"
const topicHistorySafeAreaDrawerClassName =
	"pointer-events-auto absolute bottom-[var(--safe-area-inset-bottom)] right-[var(--safe-area-inset-right)] top-[var(--safe-area-inset-top)]"

export interface TopicDesktopPanelsHistoryLayout {
	isOpen: boolean
	resize?: { width: number; onWidthCommit: (width: number) => void; projectId: string }
	onClose: () => void
	onToggle: () => void
	renderPanel: (params: {
		mode: "full-right" | "fixed" | "drawer"
		isPanelVisible?: boolean
		onCollapse?: () => void
		onClose: () => void
		closeButtonRef?: RefObject<HTMLButtonElement | null>
		isConversationPanelCollapsed: boolean
		onExpandConversationPanel: () => void
	}) => ReactNode
}

interface TopicDesktopPanelsProps {
	containerClassName: string
	detailPanelClassName: string
	/**
	 * Extra classes for the detail panel's rounded surface, applied after its defaults so they can
	 * override them (e.g. the AI canvas frames its canvas with a larger radius and an outline).
	 */
	detailPanelSurfaceClassName?: string
	isDetailPanelFullscreen: boolean
	sidebar:
		ReactNode | ((controller: { onCollapse?: () => void; isCollapsed: boolean }) => ReactNode)
	enableProjectCollapse?: boolean
	detailPanel: ReactNode | ((control?: FileSidebarControl) => ReactNode)
	isReadOnly: boolean
	showProjectSidebar?: boolean
	showProjectResizeHandle?: boolean
	keepDetailMountedWhenHidden?: boolean
	autoExpandConversationWhenDetailVisible?: boolean
	persistConversationPanelState?: boolean
	initialConversationPanelCollapsed?: boolean
	/**
	 * Storage key and first-visit state for the file sidebar collapse preference.
	 * Defaults to the project page's shared preference; the chat page passes its own so the
	 * two never overwrite each other.
	 */
	projectSiderPanelPersistence?: ProjectSiderPanelPersistence
	/** Embedding pages can reserve horizontal padding around the collapsed navigation. */
	collapsedConversationPanelWidth?: number
	/**
	 * Keep the "expand preview" strip in place after the preview is collapsed.
	 * Pages without project-sidebar collapse show it by default; the chat detail page turns it
	 * off so a collapsed preview frees its width like the project page does.
	 */
	showCollapsedDetailEntry?: boolean
	conversationResizeHandleClassName?: string
	/** Keep overlays inside an embedding page instead of anchoring them to the viewport. */
	historyOverlayScope?: "viewport" | "container"
	historyLayout?: TopicDesktopPanelsHistoryLayout
	shouldShowDetailPanel: boolean
	isDetailPanelCollapsed?: boolean
	onExpandDetailPanel?: () => void
	renderMessagePanel: (params: {
		fileSidebarControl?: FileSidebarControl
		historyTriggerRef: RefObject<HTMLButtonElement>
		isConversationPanelCollapsed: boolean
		isDraggingPanel: boolean
		onToggleConversationPanel: () => void
		onExpandConversationPanel: () => void
		historyTriggerMode: "dropdown" | "layout"
		isHistoryPanelOpen: boolean
		onToggleHistoryPanel?: () => void
	}) => ReactNode
	detailResizeHandleClassName?: string
}

function TopicDesktopPanels({
	containerClassName,
	detailPanelClassName,
	detailPanelSurfaceClassName,
	isDetailPanelFullscreen,
	sidebar,
	enableProjectCollapse = false,
	detailPanel,
	isReadOnly,
	showProjectSidebar = true,
	showProjectResizeHandle = !isReadOnly,
	keepDetailMountedWhenHidden = false,
	autoExpandConversationWhenDetailVisible = true,
	persistConversationPanelState = true,
	initialConversationPanelCollapsed = false,
	projectSiderPanelPersistence,
	showCollapsedDetailEntry = true,
	collapsedConversationPanelWidth,
	conversationResizeHandleClassName,
	historyOverlayScope = "viewport",
	historyLayout,
	shouldShowDetailPanel,
	isDetailPanelCollapsed = false,
	onExpandDetailPanel,
	renderMessagePanel,
	detailResizeHandleClassName,
}: TopicDesktopPanelsProps) {
	const { t } = useTranslation("super")
	const reducedMotion = useReducedMotion()
	const projectContentRef = useRef<HTMLDivElement>(null)
	const fileSidebarTriggerRef = useRef<HTMLButtonElement>(null)
	const historyTriggerRef = useRef<HTMLButtonElement>(null)
	const [historyDragMode, setHistoryDragMode] = useState<"full-right" | "fixed" | "drawer">()
	const historyResize = isReadOnly ? undefined : historyLayout?.resize
	const detailPanelSlotRef = useRef<HTMLDivElement>(null)
	const conversationPanelSlotRef = useRef<HTMLDivElement>(null)
	const expandDetailButtonRef = useRef<HTMLButtonElement>(null)
	const previousDetailCollapsedRef = useRef(false)
	const lastDetailWidthRef = useRef(0)
	const showCollapsedDetailPanel =
		showCollapsedDetailEntry &&
		!enableProjectCollapse &&
		!isReadOnly &&
		isDetailPanelCollapsed &&
		Boolean(onExpandDetailPanel)
	const isDetailContentHidden = !isReadOnly && isDetailPanelCollapsed
	const wasDetailCollapsed = previousDetailCollapsedRef.current
	const topicHistoryCloseButtonRef = useRef<HTMLButtonElement>(null)
	const isTopicHistoryPanelOpen = historyLayout?.isOpen ?? false
	const onCloseTopicHistoryPanel = historyLayout?.onClose
	const onToggleTopicHistoryPanel = historyLayout?.onToggle
	const renderTopicHistoryPanel = historyLayout?.renderPanel
	const {
		isProjectSiderCollapsed,
		collapseProjectSider,
		expandProjectSider,
		isDraggingHistoryPanel,
		historyDragWidthPx,
		startDragHistoryPanel,
		cancelDrag,
		collapseProgress,
		isCollapseArmed,
		containerRef,
		containerWidthPx,
		projectSiderWidthPx: storedProjectSiderWidthPx,
		messagePanelWidthPx,
		collapsedMessagePanelWidthPx: defaultCollapsedMessagePanelWidthPx,
		isConversationPanelCollapsed,
		isDraggingProjectSider,
		isDraggingMessagePanel,
		startDragProjectSider,
		startDragMessagePanel,
		toggleConversationPanel,
		expandConversationPanel,
		ensureExpandedWhenDetailVisible,
	} = useTopicDesktopLayout({
		isReadOnly,
		allowProjectSiderResize: showProjectSidebar && showProjectResizeHandle,
		persistConversationPanelState,
		initialConversationPanelCollapsed,
		projectSiderPanelPersistence,
		enableProjectCollapse,
		allowConversationPanelResize:
			!isReadOnly && (!enableProjectCollapse || shouldShowDetailPanel),
		onHistoryDragEnd: (result) => {
			historyResize?.onWidthCommit(result.width)
		},
	})
	const location = useLocation()
	const currentProjectId = projectStore.selectedProject?.id
	useEffect(() => {
		const revealFiles = (_fileId: string, context?: SuperMagicLocateFileContext) => {
			if (context?.projectId === projectStore.selectedProject?.id) expandProjectSider()
		}
		pubsub.subscribe(PubSubEvents.Locate_File_In_Tree, revealFiles)
		return () => pubsub.unsubscribe(PubSubEvents.Locate_File_In_Tree, revealFiles)
	}, [expandProjectSider])
	useEffect(() => {
		const target = location.state?.uploadedFileTarget
		if (
			isUploadedFileNavigationTarget(target) &&
			target.projectId === currentProjectId &&
			target.identityKey === getFileReferenceIdentityKey()
		)
			expandProjectSider()
	}, [location.key, location.state?.uploadedFileTarget, expandProjectSider, currentProjectId])

	const collapsedMessagePanelWidthPx =
		collapsedConversationPanelWidth ?? defaultCollapsedMessagePanelWidthPx
	// Preserve the stored project width while removing both its visual slot and resize affordance.
	const projectSiderWidthPx = showProjectSidebar
		? isProjectSiderCollapsed
			? 0
			: storedProjectSiderWidthPx
		: 0
	const shouldShowProjectResizeHandle =
		showProjectSidebar && showProjectResizeHandle && !isProjectSiderCollapsed
	const showCollapsedProjectDivider =
		showProjectSidebar && isProjectSiderCollapsed && !shouldShowDetailPanel
	const collapsedProjectDividerHost =
		typeof document !== "undefined"
			? document.querySelector<HTMLElement>('[data-testid="base-layout-pc-main-frame"]')
			: null
	const collapsedProjectDivider = (
		<div
			className="pointer-events-none absolute inset-y-0 left-0 z-20 w-px bg-border"
			data-testid="collapsed-project-sidebar-divider"
			aria-hidden="true"
		/>
	)
	const sidebarTransition =
		reducedMotion || isDraggingProjectSider || isDraggingHistoryPanel
			? "none"
			: `width ${SIDEBAR_TRANSITION_MS}ms ease, min-width ${SIDEBAR_TRANSITION_MS}ms ease`
	// 展开入口沿用现有收起栏宽度，先扣除占位，再让原布局分配预览与对话空间。
	const collapsedDetailWidth = showCollapsedDetailPanel ? collapsedMessagePanelWidthPx : 0
	const {
		panelResizeTransition,
		messageTransform,
		messagePanelTransition,
		detailContentTransform,
		detailContentTransition,
		middleContainerWidth,
		topicHistoryMode,
		topicHistoryPanelWidth,
		historyMaxWidth,
		targetMessagePanelWidth,
		targetRightHandleWidth,
		targetDetailPanelWidth,
	} = useTopicDesktopPanelMotion({
		sidebarMotion:
			enableProjectCollapse || historyResize
				? {
						key: `${isProjectSiderCollapsed}:${isTopicHistoryPanelOpen}`,
						transition: sidebarTransition,
						duration: reducedMotion ? 0 : SIDEBAR_TRANSITION_MS,
					}
				: undefined,
		historyResize: historyResize
			? {
					width: isDraggingHistoryPanel ? historyDragWidthPx : historyResize.width,
					lockedMode: isDraggingHistoryPanel ? historyDragMode : undefined,
				}
			: undefined,
		isDraggingHistoryPanel,
		isReadOnly,
		isTopicHistoryPanelOpen,
		showProjectResizeHandle: shouldShowProjectResizeHandle,
		shouldShowDetailPanel,
		containerWidthPx: Math.max(0, containerWidthPx - collapsedDetailWidth),
		projectSiderWidthPx,
		messagePanelWidthPx,
		collapsedMessagePanelWidthPx,
		isConversationPanelCollapsed,
		isDraggingProjectSider,
		isDraggingMessagePanel,
		ensureExpandedWhenDetailVisible: autoExpandConversationWhenDetailVisible
			? (visible) => {
					// 从主动收起恢复时保留原对话栏偏好，不重新执行首次打开的布局选择。
					if (!wasDetailCollapsed) ensureExpandedWhenDetailVisible(visible)
				}
			: () => undefined,
	})

	useLayoutEffect(() => {
		if (shouldShowDetailPanel && targetDetailPanelWidth > 0) {
			lastDetailWidthRef.current = targetDetailPanelWidth
		}
		// 保持挂载的隐藏内容也必须退出键盘导航；body 预览 Portal 由 FilesViewer 隐藏。
		detailPanelSlotRef.current?.toggleAttribute("inert", isDetailContentHidden)
		if (isDetailContentHidden && !wasDetailCollapsed) {
			if (showCollapsedDetailPanel)
				expandDetailButtonRef.current?.focus({ preventScroll: true })
			else
				(
					fileSidebarTriggerRef.current ||
					projectContentRef.current?.querySelector<HTMLButtonElement>(
						'[data-testid="project-card-collapse"]',
					) ||
					// Chat detail has neither the expand strip nor a project-sidebar trigger; the
					// collapse button just became inert, so hand focus to the message input instead
					// of dropping it onto <body>.
					conversationPanelSlotRef.current?.querySelector<HTMLElement>(
						'[contenteditable="true"], textarea',
					)
				)?.focus({ preventScroll: true })
		} else if (wasDetailCollapsed && shouldShowDetailPanel) {
			detailPanelSlotRef.current
				?.querySelector<HTMLButtonElement>("[data-files-viewer-collapse-preview]")
				?.focus({ preventScroll: true })
		}
	}, [
		isDetailContentHidden,
		showCollapsedDetailPanel,
		shouldShowDetailPanel,
		targetDetailPanelWidth,
		wasDetailCollapsed,
	])

	useEffect(() => {
		previousDetailCollapsedRef.current = isDetailContentHidden
	}, [isDetailContentHidden])
	const visibleConversationPanelCollapsed = shouldShowDetailPanel
		? isConversationPanelCollapsed
		: false
	// Collapse should dismiss the history panel first so the right rail does not stay open
	// after the conversation pane shrinks into the collapsed sliver state.
	const handleToggleConversationPanel = useMemo(() => {
		return () => {
			if (enableProjectCollapse && !shouldShowDetailPanel) return
			if (!visibleConversationPanelCollapsed && isTopicHistoryPanelOpen) {
				onCloseTopicHistoryPanel?.()
			}
			toggleConversationPanel()
		}
	}, [
		isTopicHistoryPanelOpen,
		onCloseTopicHistoryPanel,
		enableProjectCollapse,
		shouldShowDetailPanel,
		toggleConversationPanel,
		visibleConversationPanelCollapsed,
	])
	// 与预览工具栏、消息头部共享动作；消费者只展示当前可见的恢复入口。
	const fileSidebarControl = useMemo<FileSidebarControl | undefined>(
		() =>
			enableProjectCollapse && showProjectSidebar
				? {
						isCollapsed: isProjectSiderCollapsed,
						onToggle: isProjectSiderCollapsed
							? expandProjectSider
							: collapseProjectSider,
						triggerRef: fileSidebarTriggerRef,
					}
				: undefined,
		[
			enableProjectCollapse,
			showProjectSidebar,
			isProjectSiderCollapsed,
			expandProjectSider,
			collapseProjectSider,
		],
	)
	const previousMessageCollapsedRef = useRef(isConversationPanelCollapsed)
	useEffect(() => {
		if (
			enableProjectCollapse &&
			!previousMessageCollapsedRef.current &&
			isConversationPanelCollapsed
		)
			onCloseTopicHistoryPanel?.()
		previousMessageCollapsedRef.current = isConversationPanelCollapsed
	}, [enableProjectCollapse, isConversationPanelCollapsed, onCloseTopicHistoryPanel])
	const messagePanel = renderMessagePanel({
		fileSidebarControl: !shouldShowDetailPanel ? fileSidebarControl : undefined,
		historyTriggerRef,
		isConversationPanelCollapsed: visibleConversationPanelCollapsed,
		isDraggingPanel: isDraggingProjectSider || isDraggingMessagePanel || isDraggingHistoryPanel,
		onToggleConversationPanel: handleToggleConversationPanel,
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
	const topicHistoryPanelContent =
		!historyResize &&
		visibleTopicHistoryMode &&
		renderTopicHistoryPanel &&
		onCloseTopicHistoryPanel
			? renderTopicHistoryPanel({
					mode: visibleTopicHistoryMode,
					onClose: onCloseTopicHistoryPanel,
					closeButtonRef: topicHistoryCloseButtonRef,
					isConversationPanelCollapsed: visibleConversationPanelCollapsed,
					onExpandConversationPanel: expandConversationPanel,
				})
			: null
	const previousProjectCollapsed = useRef(isProjectSiderCollapsed)
	useLayoutEffect(() => {
		if (projectContentRef.current) projectContentRef.current.inert = isProjectSiderCollapsed
		if (previousProjectCollapsed.current !== isProjectSiderCollapsed) {
			if (isProjectSiderCollapsed) fileSidebarTriggerRef.current?.focus()
			else
				projectContentRef.current
					?.querySelector<HTMLButtonElement>('[data-testid="project-card-collapse"]')
					?.focus()
		}
		previousProjectCollapsed.current = isProjectSiderCollapsed
	}, [isProjectSiderCollapsed])
	const cancelListDrag = useMemoizedFn(() => {
		if (
			isDraggingHistoryPanel ||
			(enableProjectCollapse && (isDraggingProjectSider || isDraggingMessagePanel))
		)
			cancelDrag()
	})
	useEffect(() => {
		cancelListDrag()
	}, [cancelListDrag, isDetailPanelFullscreen, historyResize?.projectId, shouldShowDetailPanel])

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
				className={cn("flex h-full min-h-0 shrink-0", isDrawer && "z-20")}
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

	const fixedTopicHistory =
		isFixedTopicHistory && visibleTopicHistoryMode ? (
			<div
				className={
					historyOverlayScope === "container"
						? "pointer-events-none absolute inset-y-0 right-0 z-40"
						: topicHistorySafeAreaPortalClassName
				}
			>
				<div className="pointer-events-auto h-full">
					{renderTopicHistoryShell(visibleTopicHistoryMode)}
				</div>
			</div>
		) : null
	const drawerTopicHistory = isDrawerTopicHistory ? (
		<div
			className={cn(
				"pointer-events-none z-50",
				historyOverlayScope === "container" ? "absolute inset-0" : "fixed inset-0",
			)}
		>
			<div
				className="pointer-events-auto absolute inset-0 bg-transparent"
				data-testid="topic-history-panel-dismiss-area"
				onClick={onCloseTopicHistoryPanel}
				aria-hidden="true"
			/>
			<div
				className={
					historyOverlayScope === "container"
						? "pointer-events-auto absolute inset-y-0 right-0"
						: topicHistorySafeAreaDrawerClassName
				}
			>
				{renderTopicHistoryShell("drawer")}
			</div>
		</div>
	) : null

	return (
		<div
			ref={containerRef}
			className={containerClassName}
			data-testid="main-workspace-container"
		>
			<div className="relative flex h-full w-full min-w-0">
				{/* Render in the outer frame so the boundary also covers its desktop top/bottom spacing. */}
				{showCollapsedProjectDivider
					? collapsedProjectDividerHost
						? createPortal(collapsedProjectDivider, collapsedProjectDividerHost)
						: collapsedProjectDivider
					: null}
				{showProjectSidebar ? (
					<div
						className="shrink-0"
						style={{
							width: projectSiderWidthPx,
							transition: enableProjectCollapse ? sidebarTransition : undefined,
							overflow: isProjectSiderCollapsed ? "hidden" : undefined,
							position: "relative",
						}}
						data-testid="topic-project-sidebar-slot"
					>
						<div
							ref={projectContentRef}
							className="h-full"
							aria-hidden={isProjectSiderCollapsed}
							style={{
								width: storedProjectSiderWidthPx,
								visibility: isProjectSiderCollapsed ? "hidden" : undefined,
							}}
						>
							{typeof sidebar === "function"
								? sidebar({
										onCollapse: enableProjectCollapse
											? collapseProjectSider
											: undefined,
										isCollapsed: isProjectSiderCollapsed,
									})
								: sidebar}
						</div>
					</div>
				) : null}

				{shouldShowProjectResizeHandle && (
					<TopicResizeHandle
						dragging={isDraggingProjectSider}
						collapseProgress={isDraggingProjectSider ? collapseProgress : 0}
						collapseArmed={isDraggingProjectSider && isCollapseArmed}
						collapseDirection={-1}
						onResizeStart={(clientX) => {
							startDragProjectSider(clientX)
						}}
						className={cn("shrink-0", isDraggingProjectSider && "before:opacity-100")}
					/>
				)}

				<div
					className="relative flex h-full min-w-0 flex-1 overflow-hidden bg-sidebar"
					data-testid="topic-desktop-main-content"
				>
					{(isReadOnly || shouldShowDetailPanel || keepDetailMountedWhenHidden) && (
						<div
							ref={detailPanelSlotRef}
							data-testid="topic-detail-panel-slot"
							className={cn(
								"relative h-full min-w-0 overflow-hidden",
								!isDetailPanelFullscreen && "isolate z-0",
								isReadOnly && "flex-1",
							)}
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
									detailPanelSurfaceClassName,
								)}
								style={{
									...(!isDetailPanelFullscreen && {
										// 收起和展开动画只裁剪外层，避免内部宽度归零重置阅读位置。
										width:
											onExpandDetailPanel && !isReadOnly
												? shouldShowDetailPanel
													? targetDetailPanelWidth
													: lastDetailWidthRef.current
												: "100%",
										minWidth: 0,
										maxWidth:
											onExpandDetailPanel && !isReadOnly ? undefined : "100%",
									}),
									transform: isDetailPanelFullscreen
										? "none"
										: detailContentTransform,
									transition: detailContentTransition,
								}}
								data-testid="detail-panel-wrapper"
							>
								{typeof detailPanel === "function"
									? detailPanel(
											shouldShowDetailPanel || isReadOnly
												? fileSidebarControl
												: undefined,
										)
									: detailPanel}
							</div>
						</div>
					)}

					{showCollapsedDetailPanel && (
						<div
							className="flex h-full shrink-0 justify-center rounded-lg border border-border bg-background pt-2"
							style={{ width: collapsedDetailWidth }}
							data-testid="collapsed-detail-panel"
						>
							<Tooltip
								title={t("fileViewer.tabs.expandPreview")}
								placement="right"
								trigger={["hover", "focus"]}
							>
								<button
									ref={expandDetailButtonRef}
									type="button"
									className="flex size-7 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									aria-label={t("fileViewer.tabs.expandPreview")}
									aria-expanded={false}
									onClick={onExpandDetailPanel}
								>
									<PanelLeftOpen size={16} />
								</button>
							</Tooltip>
						</div>
					)}

					{!isReadOnly && shouldShowDetailPanel && (
						<div
							data-testid="topic-detail-resize-handle-slot"
							className={cn(
								"relative z-20 shrink-0 overflow-visible",
								detailResizeHandleClassName,
							)}
							style={{
								width: targetRightHandleWidth,
								minWidth: targetRightHandleWidth,
								willChange: isDraggingMessagePanel ? "auto" : "width, opacity",
								transition: isDraggingMessagePanel ? "none" : panelResizeTransition,
							}}
						>
							<TopicResizeHandle
								dragging={isDraggingMessagePanel}
								collapseDirection={1}
								collapseProgress={
									enableProjectCollapse && isDraggingMessagePanel
										? collapseProgress
										: 0
								}
								collapseArmed={
									enableProjectCollapse &&
									isDraggingMessagePanel &&
									isCollapseArmed
								}
								disabled={isConversationPanelCollapsed || !shouldShowDetailPanel}
								onResizeStart={(clientX) => {
									startDragMessagePanel(
										clientX,
										enableProjectCollapse ? targetMessagePanelWidth : undefined,
									)
								}}
								className={cn(
									"h-full w-full shrink-0",
									!isConversationPanelCollapsed &&
										conversationResizeHandleClassName,
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
							ref={conversationPanelSlotRef}
							data-testid="topic-conversation-panel-slot"
							className="relative z-10 h-full min-w-0 shrink-0"
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

					{historyResize && historyLayout && (
						<>
							<div
								className="shrink-0"
								aria-hidden="true"
								style={{
									width: !isTopicHistoryPanelOpen
										? 0
										: isFixedTopicHistory
											? topicHistoryPanelWidth
											: 0,
									transition: sidebarTransition,
								}}
							/>
							<TopicHistorySidebar
								key={historyResize.projectId}
								layout={historyLayout}
								triggerRef={historyTriggerRef}
								mode={topicHistoryMode}
								width={topicHistoryPanelWidth}
								maxWidth={historyMaxWidth}
								isFullscreen={isDetailPanelFullscreen}
								transition={sidebarTransition}
								isDragging={isDraggingHistoryPanel}
								onResizeStart={(clientX, mode) => {
									setHistoryDragMode(mode)
									startDragHistoryPanel(
										clientX,
										topicHistoryPanelWidth,
										historyResize.width,
										historyMaxWidth,
									)
								}}
								isConversationPanelCollapsed={visibleConversationPanelCollapsed}
								onExpandConversationPanel={expandConversationPanel}
							/>
						</>
					)}

					{!historyResize && isFixedTopicHistory && visibleTopicHistoryMode ? (
						<>
							{/* 占位符，用来推开对话区和详情区 */}
							<div
								className="shrink-0 transition-all duration-200"
								style={{ width: TOPIC_HISTORY_PANEL_WIDTH - 8 }}
								aria-hidden="true"
							/>
							{historyOverlayScope === "container"
								? fixedTopicHistory
								: createPortal(fixedTopicHistory, document.body)}
						</>
					) : null}

					{!historyResize && isDrawerTopicHistory
						? historyOverlayScope === "container"
							? drawerTopicHistory
							: createPortal(drawerTopicHistory, document.body)
						: null}
				</div>
			</div>
		</div>
	)
}

export default observer(TopicDesktopPanels)
