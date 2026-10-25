import { useCallback, useLayoutEffect, useRef, useState } from "react"

/**
 * Edge fade for a horizontally scrolling strip whose scrollbar is hidden, so clipped items are
 * visibly "more to the side". Returns the scroller ref and a `mask-image` style (undefined while
 * everything fits). `activeKey` re-runs the scroll that brings the active item
 * (`[data-state="active"]`) into view, so a tab picked elsewhere is never left off-screen.
 */
export function useScrollFade<T extends HTMLElement>(activeKey: string) {
	const ref = useRef<T>(null)
	const [edges, setEdges] = useState({ start: false, end: false })

	const measure = useCallback(() => {
		const el = ref.current
		if (!el) return
		const start = el.scrollLeft > 1
		const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
		setEdges((current) =>
			current.start === start && current.end === end ? current : { start, end },
		)
	}, [])

	useLayoutEffect(() => {
		const el = ref.current
		if (!el) return
		el.querySelector<HTMLElement>('[data-state="active"]')?.scrollIntoView({
			inline: "nearest",
			block: "nearest",
		})
		measure()
		el.addEventListener("scroll", measure, { passive: true })
		if (typeof ResizeObserver === "undefined") {
			return () => el.removeEventListener("scroll", measure)
		}
		const observer = new ResizeObserver(measure)
		observer.observe(el)
		if (el.firstElementChild) observer.observe(el.firstElementChild)
		return () => {
			el.removeEventListener("scroll", measure)
			observer.disconnect()
		}
	}, [activeKey, measure])

	const fade = `linear-gradient(to right, ${edges.start ? "transparent, #000 24px" : "#000, #000"}, ${edges.end ? "#000 calc(100% - 24px), transparent" : "#000, #000"})`
	const maskStyle =
		edges.start || edges.end ? { maskImage: fade, WebkitMaskImage: fade } : undefined

	return { ref, maskStyle }
}
