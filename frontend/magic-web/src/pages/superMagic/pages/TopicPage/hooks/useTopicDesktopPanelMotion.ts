import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
	FIXED_TOPIC_HISTORY_REQUIRED_WIDTH,
	DEFAULT_MIN_WIDTH,
	TOPIC_HISTORY_RESIZE,
	MIN_DETAIL_PANEL_WIDTH_FOR_FIXED_TOPIC_HISTORY,
	RESIZABLE_PANEL_HANDLE_WIDTH,
	TOPIC_HISTORY_PANEL_WIDTH,
} from "../../../constants/resizablePanel"

interface UseTopicDesktopPanelMotionOptions {
	isReadOnly: boolean
	historyResize?: { width: number; lockedMode?: "full-right" | "fixed" | "drawer" }
	isDraggingHistoryPanel?: boolean
	sidebarMotion?: { key: string; transition: string; duration: number }
	isTopicHistoryPanelOpen?: boolean
	showProjectResizeHandle?: boolean
	shouldShowDetailPanel: boolean
	containerWidthPx: number
	projectSiderWidthPx: number
	messagePanelWidthPx: number
	collapsedMessagePanelWidthPx: number
	isConversationPanelCollapsed: boolean
	isDraggingProjectSider: boolean
	isDraggingMessagePanel: boolean
	ensureExpandedWhenDetailVisible: (shouldShowDetailPanel: boolean) => void
}

interface UseTopicDesktopPanelMotionReturn {
	historyMaxWidth: number
	panelResizeTransition: string
	messageTransform: string
	messageMotionTransition: string
	messagePanelTransition: string
	detailContentTransform: string
	detailContentTransition: string
	middleContainerWidth: number
	canShowFixedTopicHistory: boolean
	topicHistoryMode: TopicHistoryMode
	topicHistoryPanelWidth: number
	targetMessagePanelWidth: number
	targetRightHandleWidth: number
	targetDetailPanelWidth: number
}

const OPENING_DURATION_MS = 380
const CLOSING_DURATION_MS = 300

type TopicHistoryMode = "hidden" | "full-right" | "fixed" | "drawer"

function getMiddleContainerWidth({
	containerWidthPx,
	projectSiderWidthPx,
	showProjectResizeHandle,
}: {
	containerWidthPx: number
	projectSiderWidthPx: number
	showProjectResizeHandle: boolean
}) {
	if (containerWidthPx <= 0) return 0
	const leftHandleWidth = showProjectResizeHandle ? RESIZABLE_PANEL_HANDLE_WIDTH : 0
	return Math.max(0, containerWidthPx - projectSiderWidthPx - leftHandleWidth)
}

function getTopicHistoryMode({
	isReadOnly,
	isTopicHistoryPanelOpen,
	shouldShowDetailPanel,
	canShowFixedTopicHistory,
}: {
	isReadOnly: boolean
	isTopicHistoryPanelOpen: boolean
	shouldShowDetailPanel: boolean
	canShowFixedTopicHistory: boolean
}): TopicHistoryMode {
	if (isReadOnly || !isTopicHistoryPanelOpen) return "hidden"
	if (!shouldShowDetailPanel) return "full-right"
	if (!canShowFixedTopicHistory) return "drawer"
	return "fixed"
}

function getReservedTopicHistoryPanelWidth(topicHistoryMode: TopicHistoryMode) {
	if (topicHistoryMode === "fixed" || topicHistoryMode === "full-right") {
		return TOPIC_HISTORY_PANEL_WIDTH
	}
	return 0
}

export function useTopicDesktopPanelMotion({
	isReadOnly,
	historyResize,
	isDraggingHistoryPanel = false,
	sidebarMotion,
	isTopicHistoryPanelOpen = false,
	showProjectResizeHandle = !isReadOnly,
	shouldShowDetailPanel,
	containerWidthPx,
	projectSiderWidthPx,
	messagePanelWidthPx,
	collapsedMessagePanelWidthPx,
	isConversationPanelCollapsed,
	isDraggingProjectSider,
	isDraggingMessagePanel,
	ensureExpandedWhenDetailVisible,
}: UseTopicDesktopPanelMotionOptions): UseTopicDesktopPanelMotionReturn {
	const [isSidebarAnimating, setIsSidebarAnimating] = useState(false)
	const sidebarMotionKeyRef = useRef(sidebarMotion?.key)
	useLayoutEffect(() => {
		if (sidebarMotionKeyRef.current === sidebarMotion?.key) return
		sidebarMotionKeyRef.current = sidebarMotion?.key
		setIsSidebarAnimating(true)
		const timer = window.setTimeout(
			() => setIsSidebarAnimating(false),
			sidebarMotion?.duration ?? 0,
		)
		return () => window.clearTimeout(timer)
	}, [sidebarMotion?.key, sidebarMotion?.duration])
	const prevShouldShowDetailPanelRef = useRef(shouldShowDetailPanel)
	const [layoutMotionPhase, setLayoutMotionPhase] = useState<"idle" | "opening" | "closing">(
		"idle",
	)
	const [isMessageTransitionReady, setIsMessageTransitionReady] = useState(false)

	useEffect(() => {
		if (isMessageTransitionReady || containerWidthPx <= 0) return
		const rafId = window.requestAnimationFrame(() => {
			setIsMessageTransitionReady(true)
		})
		return () => {
			window.cancelAnimationFrame(rafId)
		}
	}, [containerWidthPx, isMessageTransitionReady])

	useEffect(() => {
		if (!prevShouldShowDetailPanelRef.current && shouldShowDetailPanel && !isReadOnly) {
			ensureExpandedWhenDetailVisible(true)
		}
		if (prevShouldShowDetailPanelRef.current !== shouldShowDetailPanel) {
			setLayoutMotionPhase(shouldShowDetailPanel ? "opening" : "closing")
		}
		prevShouldShowDetailPanelRef.current = shouldShowDetailPanel
	}, [ensureExpandedWhenDetailVisible, isReadOnly, shouldShowDetailPanel])

	useEffect(() => {
		if (
			layoutMotionPhase === "idle" ||
			isDraggingProjectSider ||
			isDraggingMessagePanel ||
			isDraggingHistoryPanel
		) {
			return
		}
		const timeout = window.setTimeout(
			() => {
				setLayoutMotionPhase("idle")
			},
			layoutMotionPhase === "opening" ? OPENING_DURATION_MS : CLOSING_DURATION_MS,
		)
		return () => {
			window.clearTimeout(timeout)
		}
	}, [isDraggingMessagePanel, isDraggingProjectSider, isDraggingHistoryPanel, layoutMotionPhase])

	const panelResizeTransition = useMemo(() => {
		const isDragging =
			isDraggingProjectSider || isDraggingMessagePanel || isDraggingHistoryPanel
		if (isDragging) return "none"
		if (isSidebarAnimating && sidebarMotion) return sidebarMotion.transition
		return layoutMotionPhase === "opening"
			? `width ${OPENING_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1), min-width ${OPENING_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1), opacity 280ms ease`
			: `width ${CLOSING_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), min-width ${CLOSING_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity 220ms ease`
	}, [
		isDraggingMessagePanel,
		isDraggingProjectSider,
		isDraggingHistoryPanel,
		layoutMotionPhase,
		isSidebarAnimating,
		sidebarMotion,
	])

	const messageTransform = useMemo(() => {
		if (!shouldShowDetailPanel) return "none"
		if (layoutMotionPhase === "opening") return "translateX(3px)"
		return "none"
	}, [layoutMotionPhase, shouldShowDetailPanel])

	const messageMotionTransition = useMemo(
		() =>
			isDraggingProjectSider || isDraggingMessagePanel || isDraggingHistoryPanel
				? "none"
				: layoutMotionPhase === "opening"
					? "transform 420ms cubic-bezier(0.22, 1.35, 0.3, 1), opacity 280ms ease"
					: "transform 220ms cubic-bezier(0.4, 0, 0.2, 1), opacity 220ms ease",
		[isDraggingMessagePanel, isDraggingProjectSider, isDraggingHistoryPanel, layoutMotionPhase],
	)

	const messagePanelTransition = useMemo(() => {
		if (!isMessageTransitionReady) return "none"
		return `${panelResizeTransition}, ${messageMotionTransition}`
	}, [isMessageTransitionReady, messageMotionTransition, panelResizeTransition])

	const detailContentTransform = useMemo(() => {
		if (!shouldShowDetailPanel) return "translateX(12px)"
		if (layoutMotionPhase === "opening") return "translateX(-3px)"
		return "none"
	}, [layoutMotionPhase, shouldShowDetailPanel])

	const detailContentTransition = useMemo(
		() =>
			isDraggingProjectSider || isDraggingMessagePanel || isDraggingHistoryPanel
				? "none"
				: layoutMotionPhase === "opening"
					? "transform 420ms cubic-bezier(0.22, 1.35, 0.3, 1), opacity 300ms ease, box-shadow 280ms ease"
					: "transform 220ms cubic-bezier(0.4, 0, 0.2, 1), opacity 220ms ease, box-shadow 220ms ease",
		[isDraggingMessagePanel, isDraggingProjectSider, isDraggingHistoryPanel, layoutMotionPhase],
	)

	const middleContainerWidth = useMemo(() => {
		return getMiddleContainerWidth({
			containerWidthPx,
			projectSiderWidthPx,
			showProjectResizeHandle,
		})
	}, [containerWidthPx, projectSiderWidthPx, showProjectResizeHandle])

	// 固定列按实际宽度保留详情 688、对话 360 和分隔线；窗口适配不写入用户偏好。
	const historyFixedMaxWidth =
		middleContainerWidth -
		DEFAULT_MIN_WIDTH.MESSAGE_PANEL -
		(shouldShowDetailPanel
			? MIN_DETAIL_PANEL_WIDTH_FOR_FIXED_TOPIC_HISTORY + RESIZABLE_PANEL_HANDLE_WIDTH
			: 0)
	const canShowFixedTopicHistory =
		!isReadOnly &&
		isTopicHistoryPanelOpen &&
		(!shouldShowDetailPanel || middleContainerWidth >= FIXED_TOPIC_HISTORY_REQUIRED_WIDTH)
	// 调宽只改变列宽，不改变原显示模式：无预览时始终独立成列，有预览时沿用原断点。
	const topicHistoryMode: TopicHistoryMode =
		(!isReadOnly && isTopicHistoryPanelOpen && historyResize?.lockedMode) ||
		getTopicHistoryMode({
			isReadOnly,
			isTopicHistoryPanelOpen,
			shouldShowDetailPanel,
			canShowFixedTopicHistory,
		})
	const historyMaxWidth = Math.max(
		0,
		Math.min(
			TOPIC_HISTORY_RESIZE.max,
			middleContainerWidth,
			topicHistoryMode === "drawer"
				? middleContainerWidth
				: topicHistoryMode === "full-right"
					? Math.max(TOPIC_HISTORY_PANEL_WIDTH, historyFixedMaxWidth)
					: historyFixedMaxWidth,
		),
	)
	const topicHistoryPanelWidth =
		topicHistoryMode === "hidden"
			? 0
			: historyResize
				? Math.min(historyResize.width, historyMaxWidth)
				: TOPIC_HISTORY_PANEL_WIDTH
	const reservedTopicHistoryPanelWidth =
		historyResize && !isReadOnly
			? !isTopicHistoryPanelOpen
				? 0
				: topicHistoryMode === "drawer"
					? 0
					: topicHistoryPanelWidth
			: getReservedTopicHistoryPanelWidth(topicHistoryMode)

	const availablePanelWidth = useMemo(
		() => Math.max(0, middleContainerWidth - reservedTopicHistoryPanelWidth),
		[middleContainerWidth, reservedTopicHistoryPanelWidth],
	)

	const targetMessagePanelWidth = useMemo(() => {
		if (isReadOnly) return 0
		if (!shouldShowDetailPanel) return availablePanelWidth
		const preferredWidth = isConversationPanelCollapsed
			? collapsedMessagePanelWidthPx
			: messagePanelWidthPx
		if (topicHistoryMode !== "fixed") return Math.min(preferredWidth, availablePanelWidth)
		const maxWidthForFixedTopicHistory = Math.max(
			0,
			availablePanelWidth -
				MIN_DETAIL_PANEL_WIDTH_FOR_FIXED_TOPIC_HISTORY -
				RESIZABLE_PANEL_HANDLE_WIDTH,
		)
		return Math.min(preferredWidth, maxWidthForFixedTopicHistory)
	}, [
		availablePanelWidth,
		collapsedMessagePanelWidthPx,
		isConversationPanelCollapsed,
		isReadOnly,
		messagePanelWidthPx,
		shouldShowDetailPanel,
		topicHistoryMode,
	])

	const targetRightHandleWidth = useMemo(() => {
		if (isReadOnly || !shouldShowDetailPanel) return 0
		return RESIZABLE_PANEL_HANDLE_WIDTH
	}, [isReadOnly, shouldShowDetailPanel])

	const targetDetailPanelWidth = useMemo(() => {
		if (isReadOnly) return middleContainerWidth
		if (!shouldShowDetailPanel) return 0
		return Math.max(0, availablePanelWidth - targetMessagePanelWidth - targetRightHandleWidth)
	}, [
		availablePanelWidth,
		isReadOnly,
		middleContainerWidth,
		shouldShowDetailPanel,
		targetMessagePanelWidth,
		targetRightHandleWidth,
	])

	return {
		historyMaxWidth,
		panelResizeTransition,
		messageTransform,
		messageMotionTransition,
		messagePanelTransition,
		detailContentTransform,
		detailContentTransition,
		middleContainerWidth,
		canShowFixedTopicHistory,
		topicHistoryMode,
		topicHistoryPanelWidth,
		targetMessagePanelWidth,
		targetRightHandleWidth,
		targetDetailPanelWidth,
	}
}
