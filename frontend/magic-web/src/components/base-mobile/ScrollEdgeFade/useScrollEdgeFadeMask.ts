import { useCallback, useEffect, useRef, useState } from "react"

const SCROLL_EDGE_THRESHOLD_PX = 4

interface UseScrollEdgeFadeMaskOptions {
	/** Re-run mask measurement when list/content size changes. */
	contentDeps?: readonly unknown[]
}

interface UseScrollEdgeFadeMaskResult {
	scrollRef: React.RefObject<HTMLDivElement | null>
	showTopMask: boolean
	showBottomMask: boolean
	/** Attach to the scroll container's onScroll when not using ScrollEdgeFadeContainer. */
	onScroll: () => void
}

/**
 * Builds a stable effect dependency key from contentDeps so callers may pass inline arrays.
 */
function buildContentDepsSignature(contentDeps: readonly unknown[]): string {
	return contentDeps.map((dep) => String(dep)).join("\0")
}

/**
 * Tracks scroll position and exposes top/bottom fade mask visibility for mobile list pages.
 */
export function useScrollEdgeFadeMask(
	options: UseScrollEdgeFadeMaskOptions = {},
): UseScrollEdgeFadeMaskResult {
	const { contentDeps = [] } = options
	const scrollRef = useRef<HTMLDivElement | null>(null)
	const [showTopMask, setShowTopMask] = useState(false)
	const [showBottomMask, setShowBottomMask] = useState(true)
	const showTopMaskRef = useRef(false)
	const showBottomMaskRef = useRef(true)
	const pendingFrameRef = useRef<number | null>(null)
	// Primitive signature avoids re-subscribing when callers pass a new inline array each render.
	const contentDepsSignature = buildContentDepsSignature(contentDeps)

	const updateMasksImmediately = useCallback(() => {
		const el = scrollRef.current
		if (!el) return

		const nextShowTopMask = el.scrollTop > SCROLL_EDGE_THRESHOLD_PX
		const nextShowBottomMask =
			el.scrollTop + el.clientHeight < el.scrollHeight - SCROLL_EDGE_THRESHOLD_PX

		if (showTopMaskRef.current !== nextShowTopMask) {
			showTopMaskRef.current = nextShowTopMask
			setShowTopMask(nextShowTopMask)
		}
		if (showBottomMaskRef.current !== nextShowBottomMask) {
			showBottomMaskRef.current = nextShowBottomMask
			setShowBottomMask(nextShowBottomMask)
		}
	}, [])

	const updateMasks = useCallback(() => {
		// Coalesce high-frequency scroll events into one update per frame.
		if (pendingFrameRef.current !== null) return
		pendingFrameRef.current = requestAnimationFrame(() => {
			pendingFrameRef.current = null
			updateMasksImmediately()
		})
	}, [updateMasksImmediately])

	useEffect(() => {
		const el = scrollRef.current
		if (!el) return

		updateMasksImmediately()
		el.addEventListener("scroll", updateMasks, { passive: true })

		let resizeObserver: ResizeObserver | undefined
		if (typeof ResizeObserver !== "undefined") {
			resizeObserver = new ResizeObserver(() => {
				updateMasks()
			})
			resizeObserver.observe(el)
		}

		return () => {
			if (pendingFrameRef.current !== null) {
				cancelAnimationFrame(pendingFrameRef.current)
				pendingFrameRef.current = null
			}
			el.removeEventListener("scroll", updateMasks)
			resizeObserver?.disconnect()
		}
	}, [updateMasksImmediately, updateMasks, contentDepsSignature])

	return {
		scrollRef,
		showTopMask,
		showBottomMask,
		onScroll: updateMasks,
	}
}
