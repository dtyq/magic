import { useEffect, useRef, type RefObject } from "react"
import { useMemoizedFn } from "ahooks"
import { TopicLayoutStore } from "../stores/TopicLayoutStore"

interface UseTopicDesktopLayoutOptions {
	isReadOnly: boolean
	allowProjectSiderResize?: boolean
}

interface UseTopicDesktopLayoutReturn {
	containerRef: RefObject<HTMLDivElement>
	containerWidthPx: number
	projectSiderWidthPx: number
	messagePanelWidthPx: number
	collapsedMessagePanelWidthPx: number
	isConversationPanelCollapsed: boolean
	isDraggingProjectSider: boolean
	isDraggingMessagePanel: boolean
	startDragProjectSider: (clientX: number) => void
	startDragMessagePanel: (clientX: number) => void
	toggleConversationPanel: () => void
	expandConversationPanel: () => void
	ensureExpandedWhenDetailVisible: (shouldShowDetailPanel: boolean) => void
}

export function useTopicDesktopLayout({
	isReadOnly,
	allowProjectSiderResize = !isReadOnly,
}: UseTopicDesktopLayoutOptions): UseTopicDesktopLayoutReturn {
	const containerRef = useRef<HTMLDivElement>(null)
	const storeRef = useRef<TopicLayoutStore | null>(null)

	if (!storeRef.current) {
		storeRef.current = new TopicLayoutStore()
	}
	const store = storeRef.current

	const startDragProjectSider = useMemoizedFn((clientX: number) => {
		if (!allowProjectSiderResize) return
		store.startDragProjectSider(clientX)
	})

	const startDragMessagePanel = useMemoizedFn((clientX: number) => {
		if (isReadOnly) return
		store.startDragMessagePanel(clientX)
	})

	const toggleConversationPanel = useMemoizedFn(() => {
		store.toggleConversationPanel()
	})

	const expandConversationPanel = useMemoizedFn(() => {
		store.expandConversationPanel()
	})

	const ensureExpandedWhenDetailVisible = useMemoizedFn((shouldShowDetailPanel: boolean) => {
		store.ensureExpandedWhenDetailVisible(shouldShowDetailPanel)
	})

	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		const updateContainerWidth = () => {
			if (!containerRef.current) return
			store.setContainerWidth(containerRef.current.clientWidth)
		}

		updateContainerWidth()
		const observer = new ResizeObserver(updateContainerWidth)
		observer.observe(container)

		return () => {
			observer.disconnect()
		}
	}, [store])

	useEffect(() => {
		if (!store.isDraggingProjectSider && !store.isDraggingMessagePanel) return

		let rafId: number | null = null
		let nextClientX: number | null = null

		const flushDragPosition = () => {
			rafId = null
			if (nextClientX === null) return
			store.updateDrag(nextClientX)
			nextClientX = null
		}

		const handleMouseMove = (event: MouseEvent) => {
			nextClientX = event.clientX
			if (rafId !== null) return
			rafId = window.requestAnimationFrame(flushDragPosition)
		}

		const handleMouseUp = () => {
			if (rafId !== null) {
				window.cancelAnimationFrame(rafId)
				flushDragPosition()
			}
			store.endDrag()
		}

		document.addEventListener("mousemove", handleMouseMove)
		document.addEventListener("mouseup", handleMouseUp)

		return () => {
			if (rafId !== null) {
				window.cancelAnimationFrame(rafId)
			}
			document.removeEventListener("mousemove", handleMouseMove)
			document.removeEventListener("mouseup", handleMouseUp)
		}
	}, [store, store.isDraggingProjectSider, store.isDraggingMessagePanel])

	useEffect(() => {
		return () => {
			store.endDrag()
		}
	}, [store])

	return {
		containerRef,
		containerWidthPx: store.containerWidthPx,
		projectSiderWidthPx: store.projectSiderWidthPx,
		messagePanelWidthPx: store.messagePanelWidthPx,
		collapsedMessagePanelWidthPx: store.COLLAPSED_MESSAGE_PANEL_WIDTH,
		isConversationPanelCollapsed: store.isConversationPanelCollapsed,
		isDraggingProjectSider: store.isDraggingProjectSider,
		isDraggingMessagePanel: store.isDraggingMessagePanel,
		startDragProjectSider,
		startDragMessagePanel,
		toggleConversationPanel,
		expandConversationPanel,
		ensureExpandedWhenDetailVisible,
	}
}
