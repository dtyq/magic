import { useEffect, useRef } from "react"
import { useFloatingUI } from "../context/FloatingUIContext"

const OVERFLOW_SCROLL_VALUES = new Set(["auto", "scroll", "overlay"])

function isAxisScrollable(overflow: string, scrollSize: number, clientSize: number): boolean {
	return OVERFLOW_SCROLL_VALUES.has(overflow) && scrollSize > clientSize + 1
}

/**
 * 滚轮是否应由该元素做默认滚动（不转发画布）；用于常见 overflow 区域（如 MessageEditor），顶/底仍可穿透画布
 */
function elementShouldConsumeWheel(el: HTMLElement, e: WheelEvent): boolean {
	const style = getComputedStyle(el)
	const canY = isAxisScrollable(style.overflowY, el.scrollHeight, el.clientHeight)
	const canX = isAxisScrollable(style.overflowX, el.scrollWidth, el.clientWidth)
	const absY = Math.abs(e.deltaY)
	const absX = Math.abs(e.deltaX)

	if (canY && (absY >= absX || !canX)) {
		const atTop = el.scrollTop <= 0
		const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
		if (e.deltaY < 0 && !atTop) return true
		if (e.deltaY > 0 && !atBottom) return true
	}

	if (canX && (absX > absY || !canY)) {
		const atLeft = el.scrollLeft <= 0
		const atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
		if (e.deltaX < 0 && !atLeft) return true
		if (e.deltaX > 0 && !atRight) return true
	}

	return false
}

/** 显式标记：滚轮始终留在 DOM 内、顶/底也不穿透（见 MessageHistory 展开提示词） */
function wheelInsideHardTrapRegion(container: HTMLElement, e: WheelEvent): boolean {
	const path = typeof e.composedPath === "function" ? (e.composedPath() as EventTarget[]) : []
	for (const node of path) {
		if (!(node instanceof HTMLElement)) continue
		if (node.dataset.wheelTrap === "hard") {
			return true
		}
		if (node === container) {
			break
		}
	}
	return false
}

function wheelShouldDeferToDomScroll(container: HTMLElement, e: WheelEvent): boolean {
	const path = typeof e.composedPath === "function" ? (e.composedPath() as EventTarget[]) : []
	for (const node of path) {
		if (!(node instanceof HTMLElement)) continue
		if (elementShouldConsumeWheel(node, e)) {
			return true
		}
		if (node === container) {
			break
		}
	}
	return false
}

interface UseFloatingComponentOptions {
	// 组件唯一标识
	id: string
	// 是否启用 wheel 事件转发（默认 true）
	enableWheelForwarding?: boolean
}

/**
 * 悬浮组件专用 Hook
 * 自动注册组件并处理 wheel 事件转发
 */
export function useFloatingComponent(options: UseFloatingComponentOptions) {
	const { id, enableWheelForwarding = true } = options
	const { registerFloatingComponent, unregisterFloatingComponent, handleWheel } = useFloatingUI()

	const containerRef = useRef<HTMLDivElement | null>(null)
	const wheelHandlerRef = useRef<((e: WheelEvent) => void) | null>(null)

	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		// 注册组件
		registerFloatingComponent(id, container)

		// 如果启用 wheel 转发，添加事件监听
		if (enableWheelForwarding) {
			const wheelHandler = (e: WheelEvent) => {
				if (wheelInsideHardTrapRegion(container, e)) {
					e.stopPropagation()
					return
				}
				if (wheelShouldDeferToDomScroll(container, e)) {
					return
				}
				handleWheel(e)
			}

			wheelHandlerRef.current = wheelHandler
			container.addEventListener("wheel", wheelHandler, { passive: false })
		}

		return () => {
			// 注销组件
			unregisterFloatingComponent(id)

			// 移除事件监听
			if (wheelHandlerRef.current && container) {
				container.removeEventListener("wheel", wheelHandlerRef.current)
				wheelHandlerRef.current = null
			}
		}
	}, [
		id,
		enableWheelForwarding,
		registerFloatingComponent,
		unregisterFloatingComponent,
		handleWheel,
	])

	return {
		containerRef,
	}
}
