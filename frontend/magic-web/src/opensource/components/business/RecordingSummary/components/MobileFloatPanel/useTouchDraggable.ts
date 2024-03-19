import { useCallback, useEffect, useRef, useState } from "react"

interface UseDraggableOptions {
	defaultPosition?: { x: number; y: number }
	onPositionChange?: (position: { x: number; y: number }) => void
	onDragEnd?: (position: { x: number; y: number }) => void
	disabled?: boolean
}

export function useTouchDraggable({
	defaultPosition = { x: 100, y: 100 },
	onPositionChange,
	onDragEnd,
	disabled = false,
}: UseDraggableOptions = {}) {
	const [position, setPosition] = useState(defaultPosition)
	const [isDragging, setIsDragging] = useState(false)
	const [isSnapping, setIsSnapping] = useState(false) // 控制磁吸动画

	const elementRef = useRef<HTMLDivElement>(null)
	const dragStateRef = useRef({
		isDragging: false,
		dragOffset: { x: 0, y: 0 },
		currentPosition: defaultPosition,
		startTime: 0,
	})
	const animationFrameRef = useRef<number>()

	// Update position using RAF for smooth animation
	const updatePosition = useCallback(
		(newPosition: { x: number; y: number }) => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current)
			}

			animationFrameRef.current = requestAnimationFrame(() => {
				dragStateRef.current.currentPosition = newPosition
				setPosition(newPosition)
				if (dragStateRef.current.isDragging) onPositionChange?.(newPosition)
			})
		},
		[onPositionChange],
	)

	const handleTouchDown = useCallback(
		(e: React.TouchEvent) => {
			if (disabled || !e.touches.length) return

			// Only prevent default if the event is cancelable
			if (e.cancelable) {
				try {
					e.preventDefault()
					e.stopPropagation()
				} catch (error) {
					// Ignore if preventDefault fails
				}
			}

			const rect = elementRef.current?.getBoundingClientRect()
			if (!rect) return

			const dragOffset = {
				x: e.touches[0].clientX - rect.left,
				y: e.touches[0].clientY - rect.top,
			}

			dragStateRef.current = {
				isDragging: true,
				dragOffset,
				currentPosition: position,
				startTime: Date.now(),
			}

			setIsDragging(true)
		},
		[disabled, position],
	)

	const handleTouchMove = useCallback(
		(e: TouchEvent) => {
			if (!dragStateRef.current.isDragging || !e.touches.length) return

			// Only prevent default if the event is cancelable
			if (e.cancelable) {
				try {
					e.preventDefault()
				} catch (error) {
					// Ignore if preventDefault fails
				}
			}

			const newPosition = {
				x: e.touches[0].clientX - dragStateRef.current.dragOffset.x,
				y: e.touches[0].clientY - dragStateRef.current.dragOffset.y,
			}

			dragStateRef.current.currentPosition = newPosition
			// Use RAF for smooth updates
			updatePosition(newPosition)
		},
		[updatePosition],
	)

	const handleTouchEnd = useCallback(() => {
		if (!dragStateRef.current.isDragging) return

		if (animationFrameRef.current) {
			cancelAnimationFrame(animationFrameRef.current)
			animationFrameRef.current = undefined
		}

		const currentPos = dragStateRef.current.currentPosition

		dragStateRef.current.isDragging = false
		setIsDragging(false)

		// 触发磁吸动画
		setIsSnapping(true)

		setPosition(currentPos)

		// Call onDragEnd with final position
		onDragEnd?.(currentPos)

		// 动画结束后重置状态
		setTimeout(() => {
			setIsSnapping(false)
		}, 300) // 与 CSS 动画时长一致
	}, [onDragEnd])

	// Event listeners with improved passive handling
	useEffect(() => {
		if (isDragging) {
			// More aggressive passive: false setting and better error handling
			const touchMoveOptions = { passive: false, capture: true }
			const touchEndOptions = { passive: false, capture: true }

			document.addEventListener("touchmove", handleTouchMove, touchMoveOptions)
			document.addEventListener("touchend", handleTouchEnd, touchEndOptions)
			document.addEventListener("touchcancel", handleTouchEnd, touchEndOptions)
			document.body.style.userSelect = "none"
			document.body.style.webkitUserSelect = "none"
			document.body.style.touchAction = "none"

			return () => {
				document.removeEventListener("touchmove", handleTouchMove, touchMoveOptions)
				document.removeEventListener("touchend", handleTouchEnd, touchEndOptions)
				document.removeEventListener("touchcancel", handleTouchEnd, touchEndOptions)
				document.body.style.userSelect = ""
				document.body.style.webkitUserSelect = ""
				document.body.style.touchAction = ""
			}
		}
	}, [isDragging, handleTouchMove, handleTouchEnd])

	// Update position when defaultPosition changes
	useEffect(() => {
		if (!isDragging) {
			setPosition(defaultPosition)
			dragStateRef.current.currentPosition = defaultPosition
		}
	}, [defaultPosition, isDragging])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current)
			}
		}
	}, [])

	return {
		position,
		isDragging,
		isSnapping,
		elementRef,
		handleTouchDown,
	}
}
