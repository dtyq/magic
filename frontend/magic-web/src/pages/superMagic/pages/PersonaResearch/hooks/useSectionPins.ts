import { useEffect, useState, type RefObject } from "react"
import { useMemoizedFn } from "ahooks"

export interface SectionPin {
	/** Matches the `data-pin-id` attribute on the section's heading inside the scroller. */
	id: string
	title: string
	hint?: string
}

export type SectionPosition = "above" | "visible" | "below"

/** Height of one pinned bar; jump targets leave room for the bars that will sit above them. */
export const SECTION_PIN_HEIGHT = 40

/**
 * Tells, for each section heading in a scroller, whether it is scrolled past (above), on screen,
 * or not reached yet (below), so the page can pin it to the matching edge and offer a jump.
 * Positions are measured from the headings' real boxes on scroll and resize.
 */
export function useSectionPins(
	viewportRef: RefObject<HTMLElement>,
	sections: SectionPin[],
	enabled: boolean,
) {
	const [positions, setPositions] = useState<Record<string, SectionPosition>>({})

	const measure = useMemoizedFn(() => {
		const viewport = viewportRef.current
		if (!viewport) return
		const box = viewport.getBoundingClientRect()
		const next: Record<string, SectionPosition> = {}
		for (const section of sections) {
			const heading = viewport.querySelector<HTMLElement>(`[data-pin-id="${section.id}"]`)
			if (!heading) {
				next[section.id] = "visible"
				continue
			}
			const rect = heading.getBoundingClientRect()
			next[section.id] =
				rect.bottom <= box.top ? "above" : rect.top >= box.bottom ? "below" : "visible"
		}
		setPositions((prev) =>
			Object.keys(next).length === Object.keys(prev).length &&
			Object.keys(next).every((id) => prev[id] === next[id])
				? prev
				: next,
		)
	})

	useEffect(() => {
		const viewport = viewportRef.current
		if (!enabled || !viewport) return
		let frame = 0
		const schedule = () => {
			cancelAnimationFrame(frame)
			frame = requestAnimationFrame(measure)
		}
		viewport.addEventListener("scroll", schedule, { passive: true })
		// Content above a heading can change height (list loading, filters), moving it without a scroll.
		const observer = new ResizeObserver(schedule)
		observer.observe(viewport)
		if (viewport.firstElementChild) observer.observe(viewport.firstElementChild)
		measure()
		return () => {
			cancelAnimationFrame(frame)
			viewport.removeEventListener("scroll", schedule)
			observer.disconnect()
		}
	}, [enabled, measure, viewportRef])

	const jump = useMemoizedFn((id: string) => {
		const viewport = viewportRef.current
		const heading = viewport?.querySelector<HTMLElement>(`[data-pin-id="${id}"]`)
		if (!heading) return
		const index = sections.findIndex((section) => section.id === id)
		// Earlier sections end up pinned above the target, so stop below them.
		heading.style.scrollMarginTop = `${Math.max(index, 0) * SECTION_PIN_HEIGHT + 8}px`
		heading.scrollIntoView({
			behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
				? "auto"
				: "smooth",
			block: "start",
		})
	})

	return { positions, jump }
}
