import { useEffect, useRef, useState } from "react"

interface UsePhoneScalingArgs {
	/** Design width in CSS pixels (e.g. 375 for iPhone) */
	designWidth: number
	/** Design height in CSS pixels (e.g. 812 for iPhone) */
	designHeight: number
	/** Reserved padding inside the container */
	padding?: number
	/** Maximum scale */
	maxScale?: number
}

interface UsePhoneScalingResult<E extends HTMLElement> {
	containerRef: React.RefObject<E>
	scale: number
	width: number
	height: number
}

/**
 * Compute a scale factor so a fixed-size phone shell fits its container.
 * Uses ResizeObserver and updates as the container resizes.
 */
export function usePhoneScaling<E extends HTMLElement = HTMLDivElement>({
	designWidth,
	designHeight,
	padding = 24,
	maxScale = 1,
}: UsePhoneScalingArgs): UsePhoneScalingResult<E> {
	const containerRef = useRef<E>(null)
	const [scale, setScale] = useState(1)

	useEffect(() => {
		const node = containerRef.current
		if (!node) return
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect
				const availableW = Math.max(0, width - padding * 2)
				const availableH = Math.max(0, height - padding * 2)
				if (availableW <= 0 || availableH <= 0) {
					setScale(0)
					continue
				}
				const next = Math.min(availableW / designWidth, availableH / designHeight, maxScale)
				setScale(Number.isFinite(next) ? next : 1)
			}
		})
		observer.observe(node)
		return () => observer.disconnect()
	}, [designHeight, designWidth, maxScale, padding])

	return { containerRef, scale, width: designWidth, height: designHeight }
}
