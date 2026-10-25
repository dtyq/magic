import { useEffect, useRef, useState, type RefObject } from "react"
import { flushSync } from "react-dom"
import { useMemoizedFn } from "ahooks"
import type { ImperativePanelHandle } from "react-resizable-panels"
import { getResizeCollapseIntent, type ResizeCollapseIntent } from "@/utils/resizableCollapse"

export interface SidebarResizeDrag extends ResizeCollapseIntent {
	kind: "expand" | "resize"
	pointerId: number
	startX: number
	startWidthPx: number
	startExpandedWidthPx: number
	rawWidthPx: number
	expandActivated: boolean
	shouldExpand: boolean
	minWidthPx: number
	released: boolean
	cancelled: boolean
}

interface UseSidebarResizeDragParams {
	sidebarPanelRef: RefObject<ImperativePanelHandle>
	minSizePercent: number
	enabled: boolean
	collapsed: boolean
	getExpandedWidthPx: () => number
	onExpand: () => void
	onCancel: (drag: SidebarResizeDrag, restorePanel: boolean) => void
}

const EMPTY_INTENT: ResizeCollapseIntent = { progress: 0, armed: false }
const SIDEBAR_EXPAND_DISTANCE_PX = 8

/** 原生分栏负责实际宽度；这里只判断短拉展开、越界收起，并统一处理取消。 */
export default function useSidebarResizeDrag({
	sidebarPanelRef,
	minSizePercent,
	enabled,
	collapsed,
	getExpandedWidthPx,
	onExpand,
	onCancel,
}: UseSidebarResizeDragParams) {
	const pointerDownRef = useRef<{ pointerId: number; clientX: number } | null>(null)
	const dragRef = useRef<SidebarResizeDrag | null>(null)
	const [intent, setIntent] = useState(EMPTY_INTENT)
	const [dragging, setDragging] = useState(false)
	const [cancelled, setCancelled] = useState(false)
	const [expanding, setExpanding] = useState(false)

	const cancelDrag = useMemoizedFn(() => {
		const drag = dragRef.current
		if (!drag || drag.cancelled) return
		drag.cancelled = true
		onCancel(drag, true)
		setIntent(EMPTY_INTENT)
		// disabled 会使原生手柄注销并触发 onDragging(false)，终止后续指针改宽。
		setCancelled(true)
	})

	const updateIntent = useMemoizedFn((event: PointerEvent) => {
		const drag = dragRef.current
		if (!drag || drag.cancelled || event.pointerId !== drag.pointerId) return
		const distance = event.clientX - drag.startX
		drag.rawWidthPx = drag.startWidthPx + distance
		if (drag.kind === "expand") {
			drag.shouldExpand = distance >= SIDEBAR_EXPAND_DISTANCE_PX
			if (drag.shouldExpand && !drag.expandActivated) {
				drag.expandActivated = true
				// 首次展开同步提交 React 拖动约束与 MobX 展示状态，避免分栏先按正常最小宽度撑开。
				// 仅跨阈值时同步一次，后续移动仍由原生分栏处理。
				flushSync(() => {
					setExpanding(true)
					onExpand()
				})
			}
			// 阈值只解除宽度限制，原生起点仍为 48px；回拉也沿同一坐标跟手。
			return
		}
		const next = getResizeCollapseIntent(drag.rawWidthPx, drag.minWidthPx, drag.armed)
		drag.progress = next.progress
		drag.armed = next.armed
		setIntent((previous) =>
			previous.progress === next.progress && previous.armed === next.armed ? previous : next,
		)
	})

	const handleDragging = useMemoizedFn((isDragging: boolean) => {
		if (isDragging) {
			const pointer = pointerDownRef.current
			const panel = sidebarPanelRef.current
			if (!enabled || !pointer || !panel) return null
			const startWidthPx = (panel.getSize() / 100) * window.innerWidth
			dragRef.current = {
				...EMPTY_INTENT,
				kind: collapsed ? "expand" : "resize",
				pointerId: pointer.pointerId,
				startX: pointer.clientX,
				startWidthPx,
				startExpandedWidthPx: getExpandedWidthPx(),
				rawWidthPx: startWidthPx,
				expandActivated: false,
				shouldExpand: false,
				minWidthPx: (minSizePercent / 100) * window.innerWidth,
				released: false,
				cancelled: false,
			}
			setDragging(true)
			return null
		}

		const drag = dragRef.current
		// 卸载、禁用或上下文菜单引起的结束不能当成用户松手提交。
		if (drag && !drag.released) cancelDrag()
		dragRef.current = null
		pointerDownRef.current = null
		setDragging(false)
		setExpanding(false)
		setCancelled(false)
		setIntent(EMPTY_INTENT)
		return drag && !drag.cancelled ? drag : null
	})

	useEffect(() => {
		function handlePointerDown(event: PointerEvent) {
			if (dragRef.current || event.button !== 0 || !event.isPrimary) return
			pointerDownRef.current = { pointerId: event.pointerId, clientX: event.clientX }
		}
		function handlePointerMove(event: PointerEvent) {
			if (dragRef.current?.pointerId !== event.pointerId) return
			if (event.buttons === 0) cancelDrag()
			else updateIntent(event)
		}
		function handlePointerUp(event: PointerEvent) {
			const drag = dragRef.current
			if (!drag || event.pointerId !== drag.pointerId) return
			updateIntent(event)
			drag.released = true
		}
		function handlePointerCancel(event: PointerEvent) {
			if (dragRef.current?.pointerId === event.pointerId) cancelDrag()
		}
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key !== "Escape" || !dragRef.current) return
			event.preventDefault()
			cancelDrag()
		}

		// 原生库在 body 捕获 pointerdown，随后才注册 window 的结束监听。
		// 提前在 window 捕获起点和最后一次 pointerup，覆盖扩大的手柄命中区域。
		window.addEventListener("pointerdown", handlePointerDown, true)
		window.addEventListener("pointermove", handlePointerMove, true)
		window.addEventListener("pointerup", handlePointerUp, true)
		window.addEventListener("pointercancel", handlePointerCancel, true)
		window.addEventListener("keydown", handleKeyDown, true)
		window.addEventListener("resize", cancelDrag)
		window.addEventListener("blur", cancelDrag)
		return () => {
			window.removeEventListener("pointerdown", handlePointerDown, true)
			window.removeEventListener("pointermove", handlePointerMove, true)
			window.removeEventListener("pointerup", handlePointerUp, true)
			window.removeEventListener("pointercancel", handlePointerCancel, true)
			window.removeEventListener("keydown", handleKeyDown, true)
			window.removeEventListener("resize", cancelDrag)
			window.removeEventListener("blur", cancelDrag)
			const drag = dragRef.current
			if (drag && !drag.cancelled) onCancel(drag, false)
			dragRef.current = null
		}
	}, [cancelDrag, onCancel, updateIntent])

	useEffect(() => {
		if (!enabled) cancelDrag()
	}, [cancelDrag, enabled])

	return { ...intent, dragging, expanding, cancelled, dragRef, handleDragging }
}
