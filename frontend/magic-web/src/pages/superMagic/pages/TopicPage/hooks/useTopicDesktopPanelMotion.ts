import { useEffect, useMemo, useRef, useState } from "react"

interface UseTopicDesktopPanelMotionOptions {
	isReadOnly: boolean
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
	targetMessagePanelWidth: number
	targetRightHandleWidth: number
	targetDetailPanelWidth: number
}

const RESIZE_HANDLE_WIDTH = 8
const OPENING_DURATION_MS = 380
const CLOSING_DURATION_MS = 300

export function useTopicDesktopPanelMotion({
	isReadOnly,
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
		if (containerWidthPx <= 0) return 0
		const leftHandleWidth = showProjectResizeHandle ? RESIZE_HANDLE_WIDTH : 0
		return Math.max(0, containerWidthPx - projectSiderWidthPx - leftHandleWidth)
	}, [containerWidthPx, projectSiderWidthPx, showProjectResizeHandle])

	const targetMessagePanelWidth = useMemo(() => {
		if (isReadOnly) return 0
		if (!shouldShowDetailPanel) return middleContainerWidth
		const preferredWidth = isConversationPanelCollapsed
			? collapsedMessagePanelWidthPx
			: messagePanelWidthPx
		return Math.min(preferredWidth, middleContainerWidth)
	}, [
		collapsedMessagePanelWidthPx,
		isConversationPanelCollapsed,
		isReadOnly,
		messagePanelWidthPx,
		middleContainerWidth,
		shouldShowDetailPanel,
	])

	const targetRightHandleWidth = useMemo(() => {
		if (isReadOnly || !shouldShowDetailPanel) return 0
		return RESIZE_HANDLE_WIDTH
	}, [isReadOnly, shouldShowDetailPanel])

	const targetDetailPanelWidth = useMemo(() => {
		if (isReadOnly) return middleContainerWidth
		return Math.max(0, middleContainerWidth - targetMessagePanelWidth - targetRightHandleWidth)
	}, [isReadOnly, middleContainerWidth, targetMessagePanelWidth, targetRightHandleWidth])

	return {
		panelResizeTransition,
		messageTransform,
		messageMotionTransition,
		messagePanelTransition,
		detailContentTransform,
		detailContentTransition,
		targetMessagePanelWidth,
		targetRightHandleWidth,
		targetDetailPanelWidth,
	}
}
