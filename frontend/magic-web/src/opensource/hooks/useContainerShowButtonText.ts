import { useEffect, useRef, useState, type RefObject } from "react"

/**
 * Custom hook for deciding whether action buttons should show labels.
 * - When `minWidth` is provided: fixed threshold mode.
 * - When `minWidth` is omitted: auto mode based on container overflow.
 *
 * @param containerRef - React ref object pointing to the container element
 * @param minWidth - Optional fixed threshold; omit to enable auto mode.
 * @returns boolean indicating whether button text should be shown
 */
export function useContainerShowButtonText(
	containerRef: RefObject<HTMLElement>,
	minWidth?: number,
): boolean {
	const HIDE_TOLERANCE = 1
	const SHOW_RECOVERY_GAP = 8
	const SHOW_STABLE_MS = 180
	const INTERNAL_TOGGLE_MUTE_MS = 220
	const [showButtonText, setShowButtonText] = useState(true)
	const showButtonTextRef = useRef(true)
	const requiredWidthRef = useRef(0)
	const reopenAtWidthRef = useRef(0)
	const rafIdRef = useRef<number | null>(null)
	const debounceTimerRef = useRef<number | null>(null)
	const lastInternalToggleAtRef = useRef(0)
	const showEligibleSinceRef = useRef(0)

	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		const getAvailableWidth = () => {
			const style = window.getComputedStyle(container)
			const paddingLeft = Number.parseFloat(style.paddingLeft) || 0
			const paddingRight = Number.parseFloat(style.paddingRight) || 0
			return Math.max(0, container.clientWidth - paddingLeft - paddingRight)
		}

		const getRequiredWidth = () => {
			const measureIntrinsicWidth = (node: HTMLElement): number => {
				const children = Array.from(node.children) as HTMLElement[]
				const rectWidth = Math.ceil(node.getBoundingClientRect().width)
				const scrollWidth = Math.ceil(node.scrollWidth)

				if (children.length === 0) {
					return Math.max(rectWidth, scrollWidth)
				}

				const nodeStyle = window.getComputedStyle(node)
				const gapValue = nodeStyle.columnGap || nodeStyle.gap
				const gap = Number.parseFloat(gapValue) || 0
				const paddingLeft = Number.parseFloat(nodeStyle.paddingLeft) || 0
				const paddingRight = Number.parseFloat(nodeStyle.paddingRight) || 0
				const isRowFlex =
					nodeStyle.display.includes("flex") &&
					!nodeStyle.flexDirection.startsWith("column")
				const childrenWidth = children.reduce((sum, child) => {
					const childStyle = window.getComputedStyle(child)
					const marginLeft = Number.parseFloat(childStyle.marginLeft) || 0
					const marginRight = Number.parseFloat(childStyle.marginRight) || 0
					return sum + measureIntrinsicWidth(child) + marginLeft + marginRight
				}, 0)
				const totalGap = isRowFlex ? gap * Math.max(0, children.length - 1) : 0
				const intrinsicWidth = Math.ceil(
					childrenWidth + totalGap + paddingLeft + paddingRight,
				)

				// Avoid stretched width (e.g. w-full) causing sticky hidden text.
				if (intrinsicWidth > 0) {
					return intrinsicWidth
				}

				return Math.max(rectWidth, scrollWidth)
			}

			const contentNode = container.firstElementChild as HTMLElement | null
			if (contentNode) {
				const width = measureIntrinsicWidth(contentNode)
				if (width > 0) return width
			}
			return Math.ceil(container.scrollWidth)
		}

		const hasVisualOverflow = () => {
			const contentNode = container.firstElementChild as HTMLElement | null
			if (!contentNode) {
				return container.scrollWidth > container.clientWidth + 1
			}
			const containerRect = container.getBoundingClientRect()
			const contentRect = contentNode.getBoundingClientRect()
			return (
				container.scrollWidth > container.clientWidth + 1 ||
				contentRect.left < containerRect.left - 0.5 ||
				contentRect.right > containerRect.right + 0.5
			)
		}

		const updateShowText = (nextValue: boolean) => {
			if (showButtonTextRef.current === nextValue) return
			lastInternalToggleAtRef.current = performance.now()
			showButtonTextRef.current = nextValue
			setShowButtonText(nextValue)
		}

		const evaluate = () => {
			const availableWidth = getAvailableWidth()
			if (!availableWidth) return

			// Fixed threshold mode
			if (typeof minWidth === "number") {
				updateShowText(availableWidth >= minWidth)
				return
			}

			// Auto mode: always detect regardless of current state.
			const measuredRequiredWidth = getRequiredWidth()
			if (showButtonTextRef.current || requiredWidthRef.current <= 0) {
				requiredWidthRef.current = measuredRequiredWidth
			}

			const requiredWidth = requiredWidthRef.current || measuredRequiredWidth
			const overflow = hasVisualOverflow()
			const shouldHide =
				overflow || (requiredWidth > 0 && requiredWidth > availableWidth + HIDE_TOLERANCE)

			if (shouldHide) {
				const reopenBase = requiredWidth > 0 ? requiredWidth : availableWidth
				reopenAtWidthRef.current = Math.max(
					reopenAtWidthRef.current,
					reopenBase + SHOW_RECOVERY_GAP,
				)
				showEligibleSinceRef.current = 0
				updateShowText(false)
				return
			}

			if (showButtonTextRef.current) {
				reopenAtWidthRef.current = 0
				showEligibleSinceRef.current = 0
				return
			}

			const reopenThreshold = Math.max(
				reopenAtWidthRef.current,
				requiredWidth > 0 ? requiredWidth + SHOW_RECOVERY_GAP : 0,
			)
			const shouldShow = reopenThreshold > 0 && availableWidth >= reopenThreshold

			if (shouldShow) {
				const now = performance.now()
				if (showEligibleSinceRef.current <= 0) {
					showEligibleSinceRef.current = now
					scheduleEvaluate()
					return
				}

				if (now - showEligibleSinceRef.current >= SHOW_STABLE_MS) {
					reopenAtWidthRef.current = 0
					showEligibleSinceRef.current = 0
					updateShowText(true)
					return
				}

				scheduleEvaluate()
				return
			}

			showEligibleSinceRef.current = 0
		}

		const scheduleEvaluate = () => {
			if (debounceTimerRef.current !== null) {
				window.clearTimeout(debounceTimerRef.current)
			}
			if (rafIdRef.current !== null) {
				cancelAnimationFrame(rafIdRef.current)
				rafIdRef.current = null
			}

			debounceTimerRef.current = window.setTimeout(() => {
				rafIdRef.current = requestAnimationFrame(() => {
					evaluate()
					rafIdRef.current = null
				})
				debounceTimerRef.current = null
			}, 80)
		}

		evaluate()

		const resizeObserver = new ResizeObserver(() => {
			scheduleEvaluate()
		})
		resizeObserver.observe(container)
		if (container.parentElement) {
			resizeObserver.observe(container.parentElement)
		}

		let contentResizeObserver: ResizeObserver | undefined
		const observeContentNode = () => {
			const contentNode = container.firstElementChild as HTMLElement | null
			if (!contentNode) return
			contentResizeObserver?.disconnect()
			contentResizeObserver = new ResizeObserver(() => {
				scheduleEvaluate()
			})
			contentResizeObserver.observe(contentNode)
		}
		observeContentNode()

		let mutationObserver: MutationObserver | undefined
		if (typeof minWidth !== "number") {
			mutationObserver = new MutationObserver((records) => {
				// Ignore mutations caused by internal text show/hide toggles.
				if (performance.now() - lastInternalToggleAtRef.current < INTERNAL_TOGGLE_MUTE_MS) {
					return
				}

				const hasStructureChange = records.some(
					(record) =>
						record.type === "childList" &&
						(record.addedNodes.length > 0 || record.removedNodes.length > 0),
				)

				// Re-probe on real structure changes only.
				if (hasStructureChange && showButtonTextRef.current) {
					requiredWidthRef.current = 0
					reopenAtWidthRef.current = 0
					showEligibleSinceRef.current = 0
				}

				observeContentNode()
				scheduleEvaluate()
			})
			mutationObserver.observe(container, {
				childList: true,
				subtree: true,
			})
		}

		return () => {
			if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
			if (debounceTimerRef.current !== null) window.clearTimeout(debounceTimerRef.current)
			resizeObserver.disconnect()
			contentResizeObserver?.disconnect()
			mutationObserver?.disconnect()
		}
	}, [containerRef, minWidth])

	return showButtonText
}
