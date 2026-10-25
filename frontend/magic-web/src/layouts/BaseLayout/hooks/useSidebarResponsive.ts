import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type KeyboardEvent,
	type RefObject,
} from "react"
import type { ImperativePanelHandle } from "react-resizable-panels"
import { sidebarStore } from "@/stores/layout"
import useSidebarResizeDrag, { type SidebarResizeDrag } from "./useSidebarResizeDrag"

const SIDEBAR_RESIZE_KEYS = new Set([
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"ArrowUp",
	"End",
	"Home",
])

function convertPercentToPx(sizePercent: number): number {
	return (sizePercent / 100) * window.innerWidth
}

function convertPxToPercentByViewWidth(sizePx: number, viewWidth: number): number {
	if (!viewWidth) return sidebarStore.MIN_WIDTH_PERCENT
	return (sizePx / viewWidth) * 100
}

function getNarrowViewportMinSidebarWidthPx(viewWidth: number): number {
	const narrowMax = 1000
	const narrowMin = 768
	const minWidthAtNarrowMax = 220
	const minWidthAtNarrowMin = 196

	// Keep continuity at 1000px to avoid flicker/jump.
	// Above 1000px we still enforce a 220px floor and let percentage
	// naturally decrease as viewport grows.
	if (viewWidth >= narrowMax) return minWidthAtNarrowMax
	if (viewWidth <= narrowMin) return minWidthAtNarrowMin

	const ratio = (viewWidth - narrowMin) / (narrowMax - narrowMin)
	return minWidthAtNarrowMin + ratio * (minWidthAtNarrowMax - minWidthAtNarrowMin)
}

function getMinSidebarSizePercent(viewWidth: number): number {
	const narrowViewportMinSidebarPercent = convertPxToPercentByViewWidth(
		getNarrowViewportMinSidebarWidthPx(viewWidth),
		viewWidth,
	)
	// 极宽窗口的百分比下限可能超过像素上限，先保证分栏的 min 不大于 max。
	return Math.min(
		sidebarStore.getMaxWidthPercent(viewWidth),
		Math.max(sidebarStore.MIN_WIDTH_PERCENT, narrowViewportMinSidebarPercent),
	)
}

interface UseSidebarResponsiveParams {
	sidebarPanelRef: RefObject<ImperativePanelHandle>
	initialWidth: number
	enabled?: boolean
	projectPage?: boolean
	busy?: boolean
}

function useSidebarResponsive({
	sidebarPanelRef,
	initialWidth,
	enabled = true,
	projectPage = false,
	busy = false,
}: UseSidebarResponsiveParams) {
	const collapsed = sidebarStore.collapsed
	const busyRef = useRef(busy)
	busyRef.current = busy
	const isUserResizingRef = useRef(false)
	const hasPendingUserResizeRef = useRef(false)
	const keyboardResizeTimerRef = useRef<number>()
	const expandedSidebarWidthPxRef = useRef(convertPercentToPx(initialWidth))
	const expandedSidebarSizePercentRef = useRef(initialWidth)
	const overlayMode =
		enabled &&
		projectPage &&
		sidebarStore.windowWidth <=
			sidebarStore.getAutoCollapseThresholdPx(
				sidebarStore.windowWidth,
				expandedSidebarWidthPxRef.current,
			) &&
		(collapsed || !busy)
	const pendingLayoutSizeRef = useRef<number>()
	const prevWindowWidthRef = useRef(window.innerWidth)
	const [minSidebarSizePercent, setMinSidebarSizePercent] = useState(() =>
		getMinSidebarSizePercent(window.innerWidth),
	)
	const restoreSidebarWidth = useCallback(
		(widthPx: number, restorePanel: boolean) => {
			// 取消或弹性收起恢复拖动起始宽度，不能把停留过的最小宽度写成新偏好。
			isUserResizingRef.current = false
			hasPendingUserResizeRef.current = false
			expandedSidebarWidthPxRef.current = widthPx
			const sizePercent = convertPxToPercentByViewWidth(widthPx, window.innerWidth)
			expandedSidebarSizePercentRef.current = sizePercent
			sidebarStore.setWidth(sizePercent)
			if (restorePanel && !sidebarStore.collapsed)
				sidebarPanelRef.current?.resize(sizePercent)
		},
		[sidebarPanelRef],
	)
	const restoreCancelledDrag = useCallback(
		(drag: SidebarResizeDrag, restorePanel: boolean) => {
			if (drag.kind === "expand") {
				// 折叠状态先恢复，动画仍由活动手势抑制；48px 只恢复显示，不保存为偏好。
				sidebarStore.setCollapsed(true)
				if (restorePanel) pendingLayoutSizeRef.current = sidebarStore.collapsedSizePercent
				restoreSidebarWidth(drag.startExpandedWidthPx, false)
			} else restoreSidebarWidth(drag.startWidthPx, restorePanel)
		},
		[restoreSidebarWidth],
	)
	const getExpandedWidthPx = useCallback(() => expandedSidebarWidthPxRef.current, [])
	const handleDragExpand = useCallback(() => sidebarStore.setCollapsed(false), [])
	const resizeDrag = useSidebarResizeDrag({
		sidebarPanelRef,
		minSizePercent: minSidebarSizePercent,
		enabled: enabled && !overlayMode,
		collapsed,
		getExpandedWidthPx,
		onExpand: handleDragExpand,
		onCancel: restoreCancelledDrag,
	})
	const { handleDragging: handleResizeDragging, dragRef } = resizeDrag
	useLayoutEffect(() => {
		// 进入窄项目页只收起常驻栏；浮层仍由用户主动打开，首页和宽屏保留原拖动逻辑。
		if (overlayMode && !collapsed && !busy) sidebarStore.setCollapsed(true)
	}, [overlayMode, collapsed, busy])

	useLayoutEffect(() => {
		let sizePercent = pendingLayoutSizeRef.current
		const drag = dragRef.current
		if (sizePercent === undefined && resizeDrag.expanding && drag && !drag.cancelled) {
			sizePercent = Math.max(
				sidebarStore.collapsedSizePercent,
				Math.min(
					sidebarStore.getMaxWidthPercent(window.innerWidth),
					convertPxToPercentByViewWidth(drag.rawWidthPx, window.innerWidth),
				),
			)
		}
		if (sizePercent === undefined) return
		// 只在展开约束切换或手势结束后应用一次；后续位移仍由原生分栏按原起点计算。
		pendingLayoutSizeRef.current = undefined
		sidebarPanelRef.current?.resize(sizePercent)
	}, [
		dragRef,
		resizeDrag.expanding,
		resizeDrag.dragging,
		resizeDrag.cancelled,
		collapsed,
		sidebarPanelRef,
	])

	const getExpandedSidebarSizePercent = useCallback((viewWidth: number) => {
		const minMainPx = sidebarStore.getMinMainContentWidthPx(viewWidth)
		const maxSidebarPercent = Math.max(
			sidebarStore.MIN_WIDTH_PERCENT,
			100 - (minMainPx / viewWidth) * 100,
		)
		const minSidebarPercent = getMinSidebarSizePercent(viewWidth)
		const desiredPercent = convertPxToPercentByViewWidth(
			expandedSidebarWidthPxRef.current,
			viewWidth,
		)
		return Math.max(
			minSidebarPercent,
			Math.min(maxSidebarPercent, sidebarStore.getMaxWidthPercent(viewWidth), desiredPercent),
		)
	}, [])

	const syncSidebarByViewport = useCallback(
		(isShrinking: boolean) => {
			const viewWidth = window.innerWidth
			const autoCollapseThreshold = sidebarStore.getAutoCollapseThresholdPx(
				viewWidth,
				expandedSidebarWidthPxRef.current,
			)
			if (viewWidth <= autoCollapseThreshold) {
				// Only auto-collapse when the window is shrinking, not when expanding
				if (isShrinking && !busyRef.current && !sidebarStore.collapsed)
					sidebarStore.setCollapsed(true)
				return
			}
			if (sidebarStore.collapsed || !sidebarPanelRef.current) return

			const nextSizePercent = getExpandedSidebarSizePercent(viewWidth)
			sidebarPanelRef.current.resize(nextSizePercent)
			sidebarStore.setWidth(nextSizePercent)
		},
		[getExpandedSidebarSizePercent, sidebarPanelRef],
	)

	useEffect(() => {
		function handleResize() {
			const currentWidth = window.innerWidth
			const isShrinking = currentWidth < prevWindowWidthRef.current
			prevWindowWidthRef.current = currentWidth
			setMinSidebarSizePercent(getMinSidebarSizePercent(currentWidth))
			syncSidebarByViewport(isShrinking)
		}

		// A narrow desktop must start in the compact navigation state. The sidebar
		// can still be expanded manually afterwards; we only run this automatic
		// collapse when the layout is first mounted or the viewport shrinks.
		syncSidebarByViewport(true)
		window.addEventListener("resize", handleResize)

		return () => {
			window.removeEventListener("resize", handleResize)
		}
	}, [syncSidebarByViewport])

	useEffect(() => {
		return () => {
			if (keyboardResizeTimerRef.current) {
				window.clearTimeout(keyboardResizeTimerRef.current)
			}
			if (hasPendingUserResizeRef.current) {
				sidebarStore.setWidth(expandedSidebarSizePercentRef.current)
			}
			sidebarStore.persistWidth()
		}
	}, [])

	const commitPendingUserResize = useCallback(() => {
		if (!hasPendingUserResizeRef.current) return

		sidebarStore.setWidth(expandedSidebarSizePercentRef.current)
		hasPendingUserResizeRef.current = false
	}, [])

	const scheduleKeyboardResizeCommit = useCallback(() => {
		if (keyboardResizeTimerRef.current) {
			window.clearTimeout(keyboardResizeTimerRef.current)
		}

		keyboardResizeTimerRef.current = window.setTimeout(() => {
			commitPendingUserResize()
			isUserResizingRef.current = false
			keyboardResizeTimerRef.current = undefined
		}, 100)
	}, [commitPendingUserResize])

	const handleSidebarResize = useCallback(
		(sizePercent: number) => {
			if (sidebarStore.collapsed || !isUserResizingRef.current) return
			// 拖开中的窄尺寸仅供展示；松手后统一提交正常范围内的最终宽度。
			if (dragRef.current?.kind === "expand") return

			expandedSidebarSizePercentRef.current = sizePercent
			expandedSidebarWidthPxRef.current = convertPercentToPx(sizePercent)
			hasPendingUserResizeRef.current = true

			// Pointer dragging has an explicit end event. Keyboard resizing uses a
			// short debounce because the panel library does not expose a key-resize end event.
			if (keyboardResizeTimerRef.current) {
				scheduleKeyboardResizeCommit()
				isUserResizingRef.current = false
			}
		},
		[dragRef, scheduleKeyboardResizeCommit],
	)

	const handleSidebarDragging = useCallback(
		(isDragging: boolean) => {
			if (keyboardResizeTimerRef.current) {
				window.clearTimeout(keyboardResizeTimerRef.current)
				keyboardResizeTimerRef.current = undefined
			}

			if (isDragging) isUserResizingRef.current = true
			const completedDrag = handleResizeDragging(isDragging)
			if (!isDragging) {
				if (completedDrag?.kind === "expand") {
					if (!completedDrag.shouldExpand) restoreCancelledDrag(completedDrag, true)
					else {
						const sizePercent = Math.max(
							minSidebarSizePercent,
							Math.min(
								sidebarStore.getMaxWidthPercent(window.innerWidth),
								convertPxToPercentByViewWidth(
									completedDrag.rawWidthPx,
									window.innerWidth,
								),
							),
						)
						expandedSidebarWidthPxRef.current = convertPercentToPx(sizePercent)
						expandedSidebarSizePercentRef.current = sizePercent
						pendingLayoutSizeRef.current = sizePercent
						hasPendingUserResizeRef.current = false
						sidebarStore.setWidth(sizePercent)
					}
				} else if (completedDrag?.armed) {
					restoreSidebarWidth(completedDrag.startWidthPx, false)
					sidebarStore.setCollapsed(true)
				} else commitPendingUserResize()
				isUserResizingRef.current = false
			}
		},
		[
			handleResizeDragging,
			commitPendingUserResize,
			minSidebarSizePercent,
			restoreCancelledDrag,
			restoreSidebarWidth,
		],
	)

	const handleSidebarResizeKeyDown = useCallback(
		(event: KeyboardEvent<HTMLElement>) => {
			if (!SIDEBAR_RESIZE_KEYS.has(event.key)) return false
			if (sidebarStore.collapsed) {
				event.preventDefault()
				event.stopPropagation()
				if (enabled && event.key === "ArrowRight") sidebarStore.setCollapsed(false)
				// 返回 false 保留展开动画；不能被调用方当成普通键盘调宽后立即取消。
				return false
			}

			isUserResizingRef.current = true
			scheduleKeyboardResizeCommit()
			return true
		},
		[enabled, scheduleKeyboardResizeCommit],
	)

	return {
		overlayMode,
		resizeDrag,
		isUserResizingRef,
		getExpandedSidebarSizePercent,
		handleSidebarDragging,
		handleSidebarResize,
		handleSidebarResizeKeyDown,
		minSidebarSizePercent,
	}
}

export default useSidebarResponsive
