import { useEffect, useState } from "react"

interface UseContainerSizeProps {
	containerRef: React.RefObject<HTMLDivElement>
}

export function useContainerSize({ containerRef }: UseContainerSizeProps) {
	const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
	const [isCompactMode, setIsCompactMode] = useState(false)

	useEffect(() => {
		if (!containerRef.current) return

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect
				setContainerSize({ width, height })

				// Determine if we should use compact mode
				// Use compact mode when width is less than 800px
				setIsCompactMode(width < 460)
			}
		})

		resizeObserver.observe(containerRef.current)

		return () => {
			resizeObserver.disconnect()
		}
	}, [containerRef])

	return {
		containerSize,
		isCompactMode,
	}
}
