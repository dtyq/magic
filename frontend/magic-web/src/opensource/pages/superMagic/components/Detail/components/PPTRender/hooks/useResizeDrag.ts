import { useEffect, useState, type RefObject } from "react"
import { useMemoizedFn } from "ahooks"

interface UseResizeDragInput {
	containerRef: RefObject<HTMLElement>
	onResize: (width: number) => void
}

interface UseResizeDragResult {
	handleResizeDragging: (isDragging: boolean) => void
	isDragging: boolean
}

function useResizeDrag({ containerRef, onResize }: UseResizeDragInput): UseResizeDragResult {
	const [isDragging, setIsDragging] = useState(false)

	const updateWidth = useMemoizedFn(() => {
		const container = containerRef.current
		if (!container) return

		const width = container.getBoundingClientRect().width
		onResize(width)
	})

	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		let animationFrameId: number | null = null
		const resizeObserver = new ResizeObserver(() => {
			if (isDragging) return

			if (animationFrameId) cancelAnimationFrame(animationFrameId)
			animationFrameId = requestAnimationFrame(() => {
				updateWidth()
			})
		})

		resizeObserver.observe(container)
		updateWidth()

		return () => {
			if (animationFrameId) cancelAnimationFrame(animationFrameId)
			resizeObserver.disconnect()
		}
	}, [containerRef, isDragging, updateWidth])

	const handleResizeDragging = useMemoizedFn((nextIsDragging: boolean) => {
		setIsDragging(nextIsDragging)
		if (!nextIsDragging) updateWidth()
	})

	return { handleResizeDragging, isDragging }
}

export { useResizeDrag }
