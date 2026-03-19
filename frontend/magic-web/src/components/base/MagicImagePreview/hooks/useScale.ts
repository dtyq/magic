import { useMemoizedFn, useThrottle } from "ahooks"
import type { RefObject } from "react"
import { useState, useEffect } from "react"

interface Options {
	step?: number
	maxScale?: number
}

/**
 * 图片缩放
 */
const useScale = (
	imageRef: RefObject<HTMLElement>,
	{ step = 0.1, maxScale = 5 }: Options = { step: 0.1, maxScale: 5 },
) => {
	// 根据滚动缩放图片
	const [scale, setScale] = useState(1)
	useEffect(() => {
		const imageDom = imageRef.current
		let rafId: number | null = null
		const callback = (e: WheelEvent) => {
			if (rafId) {
				cancelAnimationFrame(rafId)
			}
			rafId = requestAnimationFrame(() => {
				const delta = e.deltaY > 0 ? -0.1 : 0.1
				setScale((s) => Math.max(0.1, Math.min(s + delta, maxScale)))
				rafId = null
			})
		}

		imageDom?.addEventListener("wheel", callback)
		return () => {
			imageDom?.removeEventListener("wheel", callback)
		}
	}, [imageRef, maxScale])

	const addTenPercent = useMemoizedFn(() => {
		setScale((s) => Math.min(s + step, maxScale))
	})

	const subTenPercent = useMemoizedFn(() => {
		setScale((s) => Math.max(s - step, 0.1))
	})

	return {
		scale: useThrottle(scale, { wait: 16.67 }),
		addTenPercent,
		subTenPercent,
		setScale,
	}
}

export default useScale
