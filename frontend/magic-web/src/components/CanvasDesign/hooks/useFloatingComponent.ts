import { useEffect, useRef } from "react"
import { useFloatingUI } from "../context/FloatingUIContext"

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
				// 转发 wheel 事件到 ViewportController
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
