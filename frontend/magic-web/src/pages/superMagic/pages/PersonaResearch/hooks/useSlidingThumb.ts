import { useLayoutEffect, useRef, useState } from "react"

export interface ThumbRect {
	left: number
	width: number
}

/**
 * Position of the active item in a segmented control, so one thumb can slide between items
 * instead of the highlight jumping. Reads the element marked `data-state="active"` (Radix tabs)
 * inside the container; the container must be the positioned ancestor (`relative`). Re-measures
 * when the container or any item resizes, e.g. when a tab badge count changes.
 */
export function useSlidingThumb<T extends HTMLElement>(activeKey: string) {
	const containerRef = useRef<T>(null)
	const [rect, setRect] = useState<ThumbRect | null>(null)

	useLayoutEffect(() => {
		const container = containerRef.current
		if (!container) return
		const measure = () => {
			const active = container.querySelector<HTMLElement>('[data-state="active"]')
			setRect(active ? { left: active.offsetLeft, width: active.offsetWidth } : null)
		}
		measure()
		if (typeof ResizeObserver === "undefined") return
		const observer = new ResizeObserver(measure)
		observer.observe(container)
		container.querySelectorAll('[role="tab"]').forEach((item) => observer.observe(item))
		return () => observer.disconnect()
	}, [activeKey])

	return { containerRef, rect }
}
