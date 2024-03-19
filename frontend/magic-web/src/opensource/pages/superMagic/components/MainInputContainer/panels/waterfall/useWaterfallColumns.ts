import { useEffect, useRef, useState } from "react"

/** Minimum px width each column must have before reducing column count. */
const COLUMN_MIN_WIDTH = 240
/** Gap between columns in px (matches Tailwind gap-2 = 8px). */
const GAP = 8

function calcColumns(containerWidth: number, maxColumns: number): number {
	if (containerWidth <= 0) return maxColumns
	const cols = Math.floor((containerWidth + GAP) / (COLUMN_MIN_WIDTH + GAP))
	return Math.max(1, Math.min(cols, maxColumns))
}

/**
 * Observes a container element and returns the optimal column count
 * based on its current width and the provided maximum.
 */
export function useWaterfallColumns(maxColumns = 3) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [columns, setColumns] = useState(maxColumns)

	useEffect(() => {
		const el = containerRef.current
		if (!el) return

		const observer = new ResizeObserver(([entry]) => {
			setColumns(calcColumns(entry.contentRect.width, maxColumns))
		})

		observer.observe(el)
		setColumns(calcColumns(el.getBoundingClientRect().width, maxColumns))

		return () => observer.disconnect()
	}, [maxColumns])

	return { containerRef, columns }
}
