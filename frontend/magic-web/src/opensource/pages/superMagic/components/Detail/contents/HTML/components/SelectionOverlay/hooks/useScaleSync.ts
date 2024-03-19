import { useEffect, useRef, useState } from "react"
import type { ElementRect, SelectedInfo } from "../types"

interface UseScaleSyncProps {
	scaleRatio: number
	isSelectionMode: boolean
	selectedInfoList: SelectedInfo[]
	hoveredRect: ElementRect | null
	setSelectedInfoList: React.Dispatch<React.SetStateAction<SelectedInfo[]>>
	setHoveredRect: React.Dispatch<React.SetStateAction<ElementRect | null>>
}

interface UseScaleSyncResult {
	isScaling: boolean
}

/**
 * Sync selection highlights when scale ratio changes
 * Hides selection boxes during scaling and shows them when scaling stops
 * Ensures final update when scaling completes
 */
export function useScaleSync({
	scaleRatio,
	isSelectionMode,
	selectedInfoList,
	hoveredRect,
	setSelectedInfoList,
	setHoveredRect,
}: UseScaleSyncProps): UseScaleSyncResult {
	const finalUpdateTimerRef = useRef<number | null>(null)
	const lastScaleRef = useRef<number>(scaleRatio)
	const [isScaling, setIsScaling] = useState(false)

	// Use refs to avoid effect re-registration
	const selectedInfoListRef = useRef<SelectedInfo[]>(selectedInfoList)
	const hoveredRectRef = useRef<ElementRect | null>(hoveredRect)
	selectedInfoListRef.current = selectedInfoList
	hoveredRectRef.current = hoveredRect

	useEffect(() => {
		if (!isSelectionMode) {
			setIsScaling(false)
			return
		}

		if (scaleRatio === lastScaleRef.current) return

		// Scale is changing - hide selection boxes
		setIsScaling(true)
		lastScaleRef.current = scaleRatio

		// Clear previous final update timer
		if (finalUpdateTimerRef.current) {
			window.clearTimeout(finalUpdateTimerRef.current)
		}

		// Schedule final update after scaling stops (150ms delay)
		finalUpdateTimerRef.current = window.setTimeout(() => {
			if (lastScaleRef.current === scaleRatio) {
				// Scale has stabilized - show and update selection boxes
				if (selectedInfoListRef.current.length > 0 || hoveredRectRef.current) {
					// Force re-render to update transform calculations
					setSelectedInfoList((prev) => {
						if (prev.length === 0) return prev
						return prev.map((info) => ({
							...info,
							rect: { ...info.rect },
						}))
					})
					setHoveredRect((prev) => (prev ? { ...prev } : null))
				}
				setIsScaling(false)
			}
		}, 150)

		return () => {
			if (finalUpdateTimerRef.current) {
				window.clearTimeout(finalUpdateTimerRef.current)
			}
		}
	}, [scaleRatio, isSelectionMode, setSelectedInfoList, setHoveredRect])

	return { isScaling }
}
