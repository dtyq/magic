import { useEffect, useLayoutEffect, useRef, type RefObject } from "react"
import { useMemoizedFn } from "ahooks"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	getHomeOnboardingAnchor,
	HomeOnboardingAnchor,
	HOME_ONBOARDING_ANCHOR_EVENT,
} from "@/pages/superMagic/components/LazyGuideTour/GuideTourManager"
import {
	TopicLayoutStore,
	type HistoryDragResult,
	type ProjectSiderPanelPersistence,
} from "../stores/TopicLayoutStore"

interface UseTopicDesktopLayoutOptions {
	isReadOnly: boolean
	allowProjectSiderResize?: boolean
	enableProjectCollapse?: boolean
	onHistoryDragEnd?: (result: HistoryDragResult) => void
	allowConversationPanelResize?: boolean
	/** Controls whether conversation collapse state survives remounts. */
	persistConversationPanelState?: boolean
	/** Initial state used when a page owns a temporary conversation layout. */
	initialConversationPanelCollapsed?: boolean
	/** Pages with their own sider preference (e.g. chat) pass a separate key and default. */
	projectSiderPanelPersistence?: ProjectSiderPanelPersistence
}

interface UseTopicDesktopLayoutReturn {
	isProjectSiderCollapsed: boolean
	collapseProjectSider: () => void
	expandProjectSider: () => void
	isDraggingHistoryPanel: boolean
	historyDragWidthPx: number
	collapseProgress: number
	isCollapseArmed: boolean
	startDragHistoryPanel: (
		clientX: number,
		width: number,
		preferredWidth: number,
		maxWidth: number,
	) => void
	cancelDrag: () => void
	containerRef: RefObject<HTMLDivElement>
	containerWidthPx: number
	projectSiderWidthPx: number
	messagePanelWidthPx: number
	collapsedMessagePanelWidthPx: number
	isConversationPanelCollapsed: boolean
	isDraggingProjectSider: boolean
	isDraggingMessagePanel: boolean
	startDragProjectSider: (clientX: number) => void
	startDragMessagePanel: (clientX: number, visibleWidth?: number) => void
	toggleConversationPanel: () => void
	expandConversationPanel: () => void
	collapseConversationPanel: () => void
	ensureExpandedWhenDetailVisible: (shouldShowDetailPanel: boolean) => void
}

export function useTopicDesktopLayout({
	isReadOnly,
	allowProjectSiderResize = !isReadOnly,
	persistConversationPanelState = true,
	initialConversationPanelCollapsed = false,
	projectSiderPanelPersistence,
	enableProjectCollapse = false,
	onHistoryDragEnd,
	allowConversationPanelResize = !isReadOnly,
}: UseTopicDesktopLayoutOptions): UseTopicDesktopLayoutReturn {
	const containerRef = useRef<HTMLDivElement>(null)
	const storeRef = useRef<TopicLayoutStore | null>(null)

	if (!storeRef.current) {
		storeRef.current = new TopicLayoutStore({
			projectSiderPanelPersistence,
			persistConversationPanelState,
			initialConversationPanelCollapsed,
			bufferedMessageCollapse: enableProjectCollapse,
			allowConversationPanelResize,
		})
	}
	const store = storeRef.current
	useLayoutEffect(() => {
		store.setConversationPanelResizeAllowed(allowConversationPanelResize)
	}, [store, allowConversationPanelResize])

	const startDragProjectSider = useMemoizedFn((clientX: number) => {
		if (!allowProjectSiderResize) return
		store.startDragProjectSider(clientX, enableProjectCollapse)
	})

	const finishHistoryDrag = useMemoizedFn((result: HistoryDragResult) =>
		onHistoryDragEnd?.(result),
	)

	const startDragMessagePanel = useMemoizedFn((clientX: number, visibleWidth?: number) => {
		if (isReadOnly || !allowConversationPanelResize) return
		store.startDragMessagePanel(clientX, visibleWidth)
	})

	const toggleConversationPanel = useMemoizedFn(() => {
		if (!allowConversationPanelResize && !store.isConversationPanelCollapsed) return
		store.toggleConversationPanel()
	})

	const expandConversationPanel = useMemoizedFn(() => {
		store.expandConversationPanel()
	})

	/** Collapses the conversation panel while preserving its last expanded width. */
	const collapseConversationPanel = useMemoizedFn(() => {
		if (!allowConversationPanelResize) return
		store.collapseConversationPanel()
	})

	const ensureExpandedWhenDetailVisible = useMemoizedFn((shouldShowDetailPanel: boolean) => {
		store.ensureExpandedWhenDetailVisible(shouldShowDetailPanel)
	})

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Expand_Topic_Conversation_Panel, expandConversationPanel)
		pubsub.subscribe(PubSubEvents.Collapse_Topic_Conversation_Panel, collapseConversationPanel)
		return () => {
			pubsub.unsubscribe(
				PubSubEvents.Expand_Topic_Conversation_Panel,
				expandConversationPanel,
			)
			pubsub.unsubscribe(
				PubSubEvents.Collapse_Topic_Conversation_Panel,
				collapseConversationPanel,
			)
		}
	}, [collapseConversationPanel, expandConversationPanel])

	/**
	 * The project panel can be asked to open from outside this layout, as the conversation panel can
	 * above. The one caller today is the new-user guide: both of its steps that frame the project
	 * files area frame the panel itself, and a panel the user has collapsed answers with a
	 * zero-width box at the left edge — so the step would draw its highlight on a sliver while the
	 * copy beside it describes a file tree that is not on screen.
	 *
	 * The panel cannot be opened from the guide's side, because the collapse state belongs to this
	 * layout, which keeps one instance per mount — see `HOME_ONBOARDING_ANCHOR_EVENT`. So the step
	 * announces the region it is about to frame and the panel is opened here.
	 *
	 * Read once as well as followed, because the entry navigates to the page and the two may mount in
	 * either order. Only a layout that can collapse the panel answers: on the others it is always
	 * open, and expanding it would be a write to the user's stored preference by a layout that has
	 * no control over it.
	 */
	useEffect(() => {
		if (!enableProjectCollapse) return
		const openProjectSiderForGuide = () => {
			if (getHomeOnboardingAnchor() !== HomeOnboardingAnchor.ProjectSider) return
			store.expandProjectSider()
		}
		openProjectSiderForGuide()
		window.addEventListener(HOME_ONBOARDING_ANCHOR_EVENT, openProjectSiderForGuide)
		return () =>
			window.removeEventListener(HOME_ONBOARDING_ANCHOR_EVENT, openProjectSiderForGuide)
	}, [store, enableProjectCollapse])

	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		const updateContainerWidth = () => {
			if (!containerRef.current) return
			if (
				store.containerWidthPx !== containerRef.current.clientWidth &&
				(store.isDraggingHistoryPanel ||
					(enableProjectCollapse &&
						(store.isDraggingProjectSider || store.isDraggingMessagePanel)))
			)
				store.cancelDrag()
			store.setContainerWidth(containerRef.current.clientWidth)
		}

		updateContainerWidth()
		const observer = new ResizeObserver(updateContainerWidth)
		observer.observe(container)

		return () => {
			observer.disconnect()
		}
	}, [store, enableProjectCollapse])

	useEffect(() => {
		if (
			!store.isDraggingProjectSider &&
			!store.isDraggingMessagePanel &&
			!store.isDraggingHistoryPanel
		)
			return

		let rafId: number | null = null
		let nextClientX: number | null = null

		const flushDragPosition = () => {
			rafId = null
			if (nextClientX === null) return
			store.updateDrag(nextClientX)
			nextClientX = null
		}

		/** Queues pointer movement so touch and mouse resizing share the same throttled update path. */
		const handlePointerMove = (event: PointerEvent) => {
			nextClientX = event.clientX
			if (rafId !== null) return
			rafId = window.requestAnimationFrame(flushDragPosition)
		}

		/** Finalizes drag and persists the latest width when the pointer completes normally. */
		const handlePointerUp = (event: PointerEvent) => {
			nextClientX = event.clientX
			if (rafId !== null) {
				window.cancelAnimationFrame(rafId)
			}
			flushDragPosition()
			const result = store.endDrag()
			if (result) finishHistoryDrag(result)
		}

		/** Cancels drag without persisting widths from a browser-aborted touch gesture. */
		const handlePointerCancel = () => {
			if (rafId !== null) {
				window.cancelAnimationFrame(rafId)
				rafId = null
			}
			nextClientX = null
			store.cancelDrag()
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				event.key !== "Escape" ||
				(!(
					enableProjectCollapse &&
					(store.isDraggingProjectSider || store.isDraggingMessagePanel)
				) &&
					!store.isDraggingHistoryPanel)
			)
				return
			event.preventDefault()
			event.stopImmediatePropagation()
			handlePointerCancel()
		}
		document.addEventListener("keydown", handleKeyDown, true)
		document.addEventListener("pointermove", handlePointerMove)
		document.addEventListener("pointerup", handlePointerUp)
		document.addEventListener("pointercancel", handlePointerCancel)

		return () => {
			if (rafId !== null) {
				window.cancelAnimationFrame(rafId)
			}
			document.removeEventListener("keydown", handleKeyDown, true)
			document.removeEventListener("pointermove", handlePointerMove)
			document.removeEventListener("pointerup", handlePointerUp)
			document.removeEventListener("pointercancel", handlePointerCancel)
		}
	}, [
		store,
		store.isDraggingProjectSider,
		store.isDraggingMessagePanel,
		store.isDraggingHistoryPanel,
		enableProjectCollapse,
		finishHistoryDrag,
	])

	useEffect(() => {
		return () => {
			store.cancelDrag()
		}
	}, [store])

	return {
		isProjectSiderCollapsed: enableProjectCollapse && store.isProjectSiderCollapsed,
		collapseProjectSider: store.collapseProjectSider,
		expandProjectSider: store.expandProjectSider,
		isDraggingHistoryPanel: store.isDraggingHistoryPanel,
		historyDragWidthPx: store.historyDragWidthPx,
		collapseProgress: store.collapseProgress,
		isCollapseArmed: store.isCollapseArmed,
		startDragHistoryPanel: store.startDragHistoryPanel,
		cancelDrag: store.cancelDrag,
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
		collapseConversationPanel,
		ensureExpandedWhenDetailVisible,
	}
}
