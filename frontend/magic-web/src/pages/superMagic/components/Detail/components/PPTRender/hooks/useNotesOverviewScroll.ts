import { useLayoutEffect, useRef } from "react"

export function useNotesOverviewScroll(enabled: boolean, slideKey: string, slideIndex: number) {
	const viewportRef = useRef<HTMLDivElement>(null)
	const currentNoteRef = useRef<HTMLDivElement>(null)

	useLayoutEffect(() => {
		const viewport = viewportRef.current
		const note = currentNoteRef.current
		if (!enabled || !viewport || !note) return
		const scrollToNote = () => {
			// Scroll only the notes viewport, leaving the slide canvas and outer page still.
			const offset = note.getBoundingClientRect().top - viewport.getBoundingClientRect().top
			if (Math.abs(offset) > 1) viewport.scrollTop += offset
		}
		scrollToNote()
		// Earlier notes load asynchronously and can move the selected note after navigation.
		const observer = new ResizeObserver(scrollToNote)
		observer.observe(viewport)
		if (viewport.firstElementChild) observer.observe(viewport.firstElementChild)
		const stopTracking = () => observer.disconnect()
		const root = viewport.parentElement ?? viewport
		const events = ["wheel", "touchstart", "pointerdown", "keydown"] as const
		// Once the user takes over (including the scrollbar), preserve their reading position.
		for (const event of events) root.addEventListener(event, stopTracking, { passive: true })
		return () => {
			observer.disconnect()
			for (const event of events) root.removeEventListener(event, stopTracking)
		}
	}, [enabled, slideKey, slideIndex])

	return { viewportRef, currentNoteRef }
}
