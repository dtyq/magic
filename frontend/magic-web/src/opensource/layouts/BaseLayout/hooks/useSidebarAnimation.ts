import { useEffect, type RefObject } from "react"
import { reaction } from "mobx"
import type { ImperativePanelHandle } from "react-resizable-panels"
import { sidebarStore } from "@/opensource/stores/layout"

/**
 * Easing functions for sidebar animations
 */
const easingFunctions = {
	// Ease-out quad: Smooth fast start, gentle end (for expanding)
	easeOutQuad: (t: number): number => {
		return 1 - (1 - t) * (1 - t)
	},
	// Ease-in-out quad: Smooth acceleration and deceleration (for collapsing)
	easeInOutQuad: (t: number): number => {
		return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
	},
}

/**
 * Hook to handle smooth sidebar collapse/expand animation
 * @param sidebarPanelRef - Reference to the resizable panel
 */
function useSidebarAnimation(sidebarPanelRef: RefObject<ImperativePanelHandle>) {
	useEffect(() => {
		let animationFrame: number | null = null
		let startTime: number | null = null
		let startSize = 0
		let isExpanding = false
		let isAnimating = false

		const animateResize = (targetSize: number) => {
			if (!sidebarPanelRef.current || isAnimating) return

			// Get current size
			const currentSize = sidebarPanelRef.current.getSize()

			// If already at target, no animation needed
			if (Math.abs(currentSize - targetSize) < 0.1) {
				return
			}

			// Determine if expanding or collapsing
			isExpanding = targetSize > currentSize
			isAnimating = true

			// Ultra-fast animation for snappy feel
			const duration = 150 // 150ms animation
			startTime = null
			startSize = currentSize

			const animate = (timestamp: number) => {
				if (!startTime) startTime = timestamp
				if (!sidebarPanelRef.current) {
					isAnimating = false
					animationFrame = null
					return
				}

				const elapsed = timestamp - startTime
				const progress = Math.min(elapsed / duration, 1)

				// Choose easing function based on expand/collapse
				const easingFn = isExpanding
					? easingFunctions.easeOutQuad
					: easingFunctions.easeInOutQuad
				const easedProgress = easingFn(progress)

				const newSize = startSize + (targetSize - startSize) * easedProgress

				sidebarPanelRef.current.resize(newSize)

				if (progress < 1) {
					animationFrame = requestAnimationFrame(animate)
				} else {
					animationFrame = null
					startTime = null
					isAnimating = false
				}
			}

			if (animationFrame) {
				cancelAnimationFrame(animationFrame)
			}
			animationFrame = requestAnimationFrame(animate)
		}

		const dispose = reaction(
			() => ({
				collapsed: sidebarStore.collapsed,
				collapsedSizePercent: sidebarStore.collapsedSizePercent,
			}),
			({ collapsed, collapsedSizePercent }) => {
				// Only animate when collapse state changes via button click
				// Manual dragging is handled entirely by react-resizable-panels
				const targetSize = collapsed ? collapsedSizePercent : sidebarStore.width
				animateResize(targetSize)
			},
			{
				// Don't fire immediately to avoid initial animation
				fireImmediately: false,
			},
		)

		return () => {
			dispose()
			if (animationFrame) {
				cancelAnimationFrame(animationFrame)
			}
		}
	}, [sidebarPanelRef])
}

export default useSidebarAnimation
