import { useLayoutEffect, useState, type RefObject } from "react"

/** Read the stable canvas origin, never a row whose position changes when it becomes sticky. */
export function measureVirtualListStartMargin(viewport: HTMLElement, canvas: HTMLElement) {
	return (
		canvas.getBoundingClientRect().top -
		viewport.getBoundingClientRect().top -
		viewport.clientTop +
		viewport.scrollTop
	)
}

/** CSS owns spacing; virtua and sticky handoff consume the same measured content origin. */
export function useVirtualListStartMargin(
	viewport: HTMLElement | null,
	canvasRef: RefObject<HTMLDivElement>,
) {
	const [startMargin, setStartMargin] = useState(0)

	useLayoutEffect(() => {
		const canvas = canvasRef.current
		if (!viewport || !canvas || !viewport.contains(canvas)) return

		const measure = () => {
			const next = measureVirtualListStartMargin(viewport, canvas)
			setStartMargin((previous) => (Math.abs(previous - next) < 0.5 ? previous : next))
		}
		measure()

		// Observe layout boxes and preceding siblings so padding, an inserted banner, and
		// container resizing all update the origin without doing layout reads on scroll.
		const resizeObserver = new ResizeObserver(measure)
		const mutationObserver = new MutationObserver(measure)
		let element: HTMLElement | null = canvas
		while (element) {
			resizeObserver.observe(element)
			if (element !== canvas) {
				mutationObserver.observe(element, {
					attributes: true,
					attributeFilter: ["class", "style", "hidden"],
					childList: true,
				})
			}
			if (element === viewport) break
			for (const sibling of Array.from(element.parentElement?.children ?? [])) {
				if (sibling === element) break
				resizeObserver.observe(sibling)
			}
			element = element.parentElement
		}
		window.addEventListener("resize", measure)
		return () => {
			resizeObserver.disconnect()
			mutationObserver.disconnect()
			window.removeEventListener("resize", measure)
		}
	}, [viewport, canvasRef])

	return startMargin
}
