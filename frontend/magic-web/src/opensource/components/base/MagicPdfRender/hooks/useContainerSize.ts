import { useState, useEffect } from "react"

interface UseContainerSizeProps {
	containerRef: React.RefObject<HTMLDivElement>
}

export function useContainerSize({ containerRef }: UseContainerSizeProps) {
	const [containerWidth, setContainerWidth] = useState<number>(0)

	// Listen for container size changes
	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width } = entry.contentRect
				setContainerWidth(width)
			}
		})

		resizeObserver.observe(container)

		// Initial container width setting
		setContainerWidth(container.clientWidth)

		return () => {
			resizeObserver.disconnect()
		}
	}, [containerRef])

	// Determine if compact mode should be used based on container width
	const isCompactMode = containerWidth > 0 && containerWidth < 600 // Use compact mode when container width is less than 600px

	return {
		containerWidth,
		isCompactMode,
	}
}
