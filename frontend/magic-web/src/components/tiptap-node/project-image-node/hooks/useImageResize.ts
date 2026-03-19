import * as React from "react"
import { IMAGE_LOADING_CONFIG } from "../constants"

export type ResizeDirection = "se" | "sw" | "ne" | "nw"

interface Dimensions {
	width: number | null
	height: number | null
}

interface UseImageResizeOptions {
	/** Initial dimensions */
	initialDimensions: Dimensions
	/** Aspect ratio ref to maintain during resize */
	aspectRatioRef: React.RefObject<number>
	/** Callback when resize is complete */
	onResizeComplete?: (dimensions: Dimensions) => void
	/** Minimum image size in pixels */
	minSize?: number
	/**
	 * Modifier key to enable non-proportional resize
	 * default: "shift"
	 */
	proportionalModifier?: "shift" | "alt" | "ctrl"
}

interface UseImageResizeResult {
	/** Current dimensions */
	dimensions: Dimensions
	/** Whether currently resizing */
	isResizing: boolean
	/** Start resize handler */
	handleResizeStart: (e: React.MouseEvent, direction: ResizeDirection) => void
	/** Update dimensions */
	setDimensions: React.Dispatch<React.SetStateAction<Dimensions>>
}

/**
 * Custom hook for image resize functionality.
 * Default: non-proportional resize
 * Hold modifier key (Shift by default): proportional resize (maintain aspect ratio)
 */
export function useImageResize(options: UseImageResizeOptions): UseImageResizeResult {
	const {
		initialDimensions,
		aspectRatioRef,
		onResizeComplete,
		minSize = IMAGE_LOADING_CONFIG.MIN_IMAGE_SIZE,
		proportionalModifier = "shift",
	} = options

	const [dimensions, setDimensions] = React.useState<Dimensions>(initialDimensions)
	const [isResizing, setIsResizing] = React.useState(false)

	const getModifierState = React.useCallback(
		(event: MouseEvent): boolean => {
			switch (proportionalModifier) {
				case "shift":
					return event.shiftKey
				case "alt":
					return event.altKey
				case "ctrl":
					return event.ctrlKey
				default:
					return event.shiftKey
			}
		},
		[proportionalModifier],
	)

	const handleResizeStart = React.useCallback(
		(e: React.MouseEvent, direction: ResizeDirection) => {
			e.preventDefault()
			e.stopPropagation()

			const startX = e.clientX
			const startY = e.clientY
			const startWidth = dimensions.width || 0
			const startHeight = dimensions.height || 0

			if (!startWidth || !startHeight) return

			setIsResizing(true)

			let latestWidth = startWidth
			let latestHeight = startHeight

			const handleMouseMove = (moveEvent: MouseEvent) => {
				const deltaX = moveEvent.clientX - startX
				const deltaY = moveEvent.clientY - startY

				// Check if modifier key is pressed for proportional resize
				const isProportional = true
				// const isProportional = getModifierState(moveEvent)

				let newWidth = startWidth
				let newHeight = startHeight

				// Calculate new width based on resize direction
				switch (direction) {
					case "se": // bottom-right
					case "ne": // top-right
						newWidth = startWidth + deltaX
						break
					case "sw": // bottom-left
					case "nw": // top-left
						newWidth = startWidth - deltaX
						break
				}

				// Calculate new height
				if (isProportional) {
					// Proportional resize: maintain aspect ratio
					newHeight = newWidth / (aspectRatioRef.current || 1)
				} else {
					// Non-proportional resize: height changes independently
					switch (direction) {
						case "se": // bottom-right
						case "sw": // bottom-left
							newHeight = startHeight + deltaY
							break
						case "ne": // top-right
						case "nw": // top-left
							newHeight = startHeight - deltaY
							break
					}
				}

				// Enforce minimum size constraint
				if (newWidth < minSize) {
					newWidth = minSize
					if (isProportional) {
						newHeight = minSize / (aspectRatioRef.current || 1)
					}
				}

				if (newHeight < minSize) {
					newHeight = minSize
					if (isProportional) {
						newWidth = minSize * (aspectRatioRef.current || 1)
					}
				}

				latestWidth = Math.round(newWidth)
				latestHeight = Math.round(newHeight)

				setDimensions({
					width: latestWidth,
					height: latestHeight,
				})
			}

			const handleMouseUp = () => {
				setIsResizing(false)

				// Notify resize complete
				if (latestWidth && latestHeight) {
					onResizeComplete?.({
						width: latestWidth,
						height: latestHeight,
					})
				}

				document.removeEventListener("mousemove", handleMouseMove)
				document.removeEventListener("mouseup", handleMouseUp)
			}

			document.addEventListener("mousemove", handleMouseMove)
			document.addEventListener("mouseup", handleMouseUp)
		},
		[dimensions, aspectRatioRef, onResizeComplete, minSize, getModifierState],
	)

	return {
		dimensions,
		isResizing,
		handleResizeStart,
		setDimensions,
	}
}
