import { useEffect, useRef, useState } from "react"

interface UsePhoneScalingArgs {
	/** 未启用设备预览时不观察 display:contents 节点；既有调用默认继续观察。 */
	enabled?: boolean
	/** Design width in CSS pixels (e.g. 375 for iPhone) */
	designWidth: number
	/** Design height in CSS pixels (e.g. 812 for iPhone) */
	designHeight: number
	/** Reserved padding inside the container */
	padding?: number
	/** Non-scaled horizontal space that must remain visible beside the scaled shell */
	fixedWidth?: number
	/** Non-scaled vertical space that must remain visible beside the scaled shell */
	fixedHeight?: number
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
	enabled = true,
	designWidth,
	designHeight,
	padding = 16,
	fixedWidth = 0,
	fixedHeight = 0,
	maxScale = 1,
}: UsePhoneScalingArgs): UsePhoneScalingResult<E> {
	const containerRef = useRef<E>(null)
	const [scale, setScale] = useState(1)

	useEffect(() => {
		if (!enabled) return
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
				const scalableW = Math.max(0, availableW - fixedWidth)
				const scalableH = Math.max(0, availableH - fixedHeight)
				const next = Math.min(scalableW / designWidth, scalableH / designHeight, maxScale)
				setScale(Number.isFinite(next) ? next : 1)
			}
		})
		observer.observe(node)
		return () => observer.disconnect()
	}, [enabled, designHeight, designWidth, fixedHeight, fixedWidth, maxScale, padding])

	return { containerRef, scale, width: designWidth, height: designHeight }
}
