import { useEffect, useMemo, useRef, useState } from "react"
import {
	FIXED_TOPIC_HISTORY_REQUIRED_WIDTH,
	MIN_DETAIL_PANEL_WIDTH_FOR_FIXED_TOPIC_HISTORY,
	RESIZABLE_PANEL_HANDLE_WIDTH,
	TOPIC_HISTORY_PANEL_WIDTH,
} from "../../../constants/resizablePanel"

interface UseTopicDesktopPanelMotionOptions {
	isReadOnly: boolean
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
		if (layoutMotionPhase === "idle" || isDraggingProjectSider || isDraggingMessagePanel) {
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
	}, [isDraggingMessagePanel, isDraggingProjectSider, layoutMotionPhase])

	const panelResizeTransition = useMemo(() => {
		const isDragging = isDraggingProjectSider || isDraggingMessagePanel
		if (isDragging) return "none"
		return layoutMotionPhase === "opening"
			? `width ${OPENING_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1), min-width ${OPENING_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1), opacity 280ms ease`
			: `width ${CLOSING_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), min-width ${CLOSING_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity 220ms ease`
	}, [isDraggingMessagePanel, isDraggingProjectSider, layoutMotionPhase])

	const messageTransform = useMemo(() => {
		if (!shouldShowDetailPanel) return "none"
		if (layoutMotionPhase === "opening") return "translateX(3px)"
		return "none"
	}, [layoutMotionPhase, shouldShowDetailPanel])

	const messageMotionTransition = useMemo(
		() =>
			isDraggingProjectSider || isDraggingMessagePanel
				? "none"
				: layoutMotionPhase === "opening"
					? "transform 420ms cubic-bezier(0.22, 1.35, 0.3, 1), opacity 280ms ease"
					: "transform 220ms cubic-bezier(0.4, 0, 0.2, 1), opacity 220ms ease",
		[isDraggingMessagePanel, isDraggingProjectSider, layoutMotionPhase],
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
			isDraggingProjectSider || isDraggingMessagePanel
				? "none"
				: layoutMotionPhase === "opening"
					? "transform 420ms cubic-bezier(0.22, 1.35, 0.3, 1), opacity 300ms ease, box-shadow 280ms ease"
					: "transform 220ms cubic-bezier(0.4, 0, 0.2, 1), opacity 220ms ease, box-shadow 220ms ease",
		[isDraggingMessagePanel, isDraggingProjectSider, layoutMotionPhase],
	)

	const middleContainerWidth = useMemo(() => {
		return getMiddleContainerWidth({
			containerWidthPx,
			projectSiderWidthPx,
			showProjectResizeHandle,
		})
	}, [containerWidthPx, projectSiderWidthPx, showProjectResizeHandle])

	const canShowFixedTopicHistory = useMemo(() => {
		if (isReadOnly || !isTopicHistoryPanelOpen) return false
		if (!shouldShowDetailPanel) return true
		return middleContainerWidth >= FIXED_TOPIC_HISTORY_REQUIRED_WIDTH
	}, [isReadOnly, isTopicHistoryPanelOpen, middleContainerWidth, shouldShowDetailPanel])

	const topicHistoryMode = useMemo(
		() =>
			getTopicHistoryMode({
				isReadOnly,
				isTopicHistoryPanelOpen,
				shouldShowDetailPanel,
				canShowFixedTopicHistory,
			}),
		[canShowFixedTopicHistory, isReadOnly, isTopicHistoryPanelOpen, shouldShowDetailPanel],
	)

	const topicHistoryPanelWidth = useMemo(() => {
		if (topicHistoryMode === "hidden") return 0
		return TOPIC_HISTORY_PANEL_WIDTH
	}, [topicHistoryMode])

	const reservedTopicHistoryPanelWidth = useMemo(
		() => getReservedTopicHistoryPanelWidth(topicHistoryMode),
		[topicHistoryMode],
	)

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
