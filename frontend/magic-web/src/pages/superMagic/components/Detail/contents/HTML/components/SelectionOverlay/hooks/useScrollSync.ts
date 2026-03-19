import { useEffect, useRef, useState } from "react"
import type { ElementRect, SelectedInfo } from "../types"

interface UseScrollSyncProps {
	containerRef?: React.RefObject<HTMLElement>
	iframeRef: React.RefObject<HTMLIFrameElement>
	isSelectionMode: boolean
	selectedInfoList: SelectedInfo[]
	hoveredRect: ElementRect | null
	setSelectedInfoList: React.Dispatch<React.SetStateAction<SelectedInfo[]>>
	setHoveredRect: React.Dispatch<React.SetStateAction<ElementRect | null>>
}

interface UseScrollSyncResult {
	isScrolling: boolean
}

/**
 * Sync selection highlights on scroll or resize
 * Hides selection boxes during scrolling and shows them when scrolling stops
 * Listens to container and iframe scroll events instead of global window
 */
export function useScrollSync({
	containerRef,
	iframeRef,
	isSelectionMode,
	selectedInfoList,
	hoveredRect,
	setSelectedInfoList,
	setHoveredRect,
}: UseScrollSyncProps): UseScrollSyncResult {
	const finalUpdateTimerRef = useRef<number | null>(null)
	const [isScrolling, setIsScrolling] = useState(false)

	// Use refs to avoid effect re-registration
	const selectedInfoListRef = useRef<SelectedInfo[]>(selectedInfoList)
	const hoveredRectRef = useRef<ElementRect | null>(hoveredRect)
	selectedInfoListRef.current = selectedInfoList
	hoveredRectRef.current = hoveredRect

	useEffect(() => {
		if (!isSelectionMode) {
			setIsScrolling(false)
			return
		}

		const handleUpdate = () => {
			// Scrolling started - hide selection boxes
			setIsScrolling(true)

			// Clear previous final update timer
			if (finalUpdateTimerRef.current) {
				window.clearTimeout(finalUpdateTimerRef.current)
			}

			// Schedule final update after scrolling stops (150ms delay)
			finalUpdateTimerRef.current = window.setTimeout(() => {
				// Scrolling has stopped - show and update selection boxes
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
				setIsScrolling(false)
			}, 150)
		}

		// Get container element
		const container = containerRef?.current
		// Get iframe document for listening to iframe content scroll
		const iframeDoc =
			iframeRef.current?.contentDocument || iframeRef.current?.contentWindow?.document

		// Listen to container scroll if available, otherwise fallback to window
		if (container) {
			container.addEventListener("scroll", handleUpdate, true)
		} else {
			window.addEventListener("scroll", handleUpdate, true)
		}

		// Listen to iframe document scroll (for content scrolling inside iframe)
		if (iframeDoc) {
			iframeDoc.addEventListener("scroll", handleUpdate, true)
		}

		// Listen to window resize (affects layout)
		window.addEventListener("resize", handleUpdate)

		return () => {
			if (container) {
				container.removeEventListener("scroll", handleUpdate, true)
			} else {
				window.removeEventListener("scroll", handleUpdate, true)
			}
			if (iframeDoc) {
				iframeDoc.removeEventListener("scroll", handleUpdate, true)
			}
			window.removeEventListener("resize", handleUpdate)
			if (finalUpdateTimerRef.current) {
				window.clearTimeout(finalUpdateTimerRef.current)
			}
		}
		// Remove selectedInfoList and hoveredRect from dependencies to prevent effect re-registration
		// Use refs instead to access current values
	}, [containerRef, iframeRef, isSelectionMode, setSelectedInfoList, setHoveredRect])

	return { isScrolling }
}
