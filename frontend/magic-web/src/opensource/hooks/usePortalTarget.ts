import { useEffect, useRef, useState } from "react"

interface UsePortalTargetOptions {
	/** Portal ID to target */
	portalId: string
	/** Whether to enable portal (defaults to true) */
	enabled?: boolean
}

/**
 * Hook to get a portal target element by ID
 * Automatically updates when enabled state changes
 *
 * @example
 * ```tsx
 * const portalTarget = usePortalTarget({
 *   portalId: PORTAL_IDS.SUPER_MAGIC_MOBILE_HEADER_RIGHT,
 *   enabled: isMobile
 * })
 *
 * return portalTarget && createPortal(<Component />, portalTarget)
 * ```
 */
function usePortalTarget({ portalId, enabled = true }: UsePortalTargetOptions) {
	const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
	const hasFoundTargetRef = useRef(false)

	useEffect(() => {
		if (!enabled) {
			setPortalTarget(null)
			hasFoundTargetRef.current = false
			return
		}

		let isMounted = true
		let retryTimeoutId: ReturnType<typeof setTimeout> | null = null

		// Update portal target element
		const updateTarget = () => {
			if (!isMounted) return

			// Use querySelectorAll to get all elements with this ID and take the last one
			// This handles cases where React hasn't fully cleaned up old elements yet
			const allTargets = document.querySelectorAll(`#${portalId}`)
			const target =
				allTargets.length > 0 ? (allTargets[allTargets.length - 1] as HTMLElement) : null

			if (target) {
				hasFoundTargetRef.current = true
				setPortalTarget((prev) => (prev !== target ? target : prev))
			} else {
				hasFoundTargetRef.current = false
				setPortalTarget((prev) => (prev !== null ? null : prev))
				// Retry after a short delay if target not found
				retryTimeoutId = setTimeout(updateTarget, 50)
			}
		}

		// Try to get the target element using requestAnimationFrame
		// This ensures DOM is painted before we query
		const rafId = requestAnimationFrame(() => {
			updateTarget()
		})

		// Create MutationObserver to watch for DOM changes
		const observer = new MutationObserver((mutations) => {
			// Check if any mutation affects the portal target
			for (const mutation of mutations) {
				// Check if target element was added or removed
				if (mutation.type === "childList") {
					const addedNodes = Array.from(mutation.addedNodes)
					const removedNodes = Array.from(mutation.removedNodes)

					// Check if our target element was added/removed or is a descendant
					const hasRelevantChange =
						addedNodes.some((node) => {
							if (node instanceof HTMLElement) {
								return node.id === portalId || node.querySelector(`#${portalId}`)
							}
							return false
						}) ||
						removedNodes.some((node) => {
							if (node instanceof HTMLElement) {
								return node.id === portalId || node.querySelector(`#${portalId}`)
							}
							return false
						})

					if (hasRelevantChange) {
						updateTarget()
						break
					}
				}
				// Check if target element's id was changed
				else if (mutation.type === "attributes" && mutation.attributeName === "id") {
					updateTarget()
					break
				}
			}
		})

		// Start observing the document body for changes
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["id"],
		})

		// Cleanup observer on unmount or when dependencies change
		return () => {
			isMounted = false
			cancelAnimationFrame(rafId)
			if (retryTimeoutId) clearTimeout(retryTimeoutId)
			observer.disconnect()
		}
	}, [portalId, enabled])

	return portalTarget
}

export default usePortalTarget
