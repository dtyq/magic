import { isIos } from "@/utils/devices"
import { useEffect, useRef } from "react"

interface UseIOSHorizontalScrollOptions {
	enabled?: boolean
	selector?: string
}

/**
 * 解决iOS浏览器页面横向滚动滑动失效的问题
 * 基于触摸事件手动管理横向滚动行为
 */
export function useIOSHorizontalScroll(options: UseIOSHorizontalScrollOptions = {}) {
	const { enabled = true, selector = ".table-content" } = options
	const containerRef = useRef<HTMLDivElement>(null)
	const touchStartX = useRef(0)

	useEffect(() => {
		if (!enabled || !containerRef.current || !isIos) return

		const container = containerRef.current
		const scrollableElement = (container.querySelector(selector) as HTMLElement) || container

		const handleTouchStart = (event: TouchEvent) => {
			touchStartX.current = event.changedTouches[0].screenX
		}

		const handleTouchMove = (event: TouchEvent) => {
			// 阻止默认事件以避免滑动失败
			event.preventDefault()

			// 获取触摸移动的坐标
			const touchEndX = event.changedTouches[0].screenX

			// 计算滑动的方向和距离
			const moveX = touchStartX.current - touchEndX

			// 通过改变scrollLeft属性来进行滑动
			if (scrollableElement) {
				scrollableElement.scrollLeft += moveX
			}

			// 更新当前触摸开始位置
			touchStartX.current = touchEndX
		}

		// 添加触摸事件监听器
		scrollableElement.addEventListener("touchstart", handleTouchStart, { passive: true })
		scrollableElement.addEventListener("touchmove", handleTouchMove, { passive: false })

		// 清理函数
		return () => {
			scrollableElement.removeEventListener("touchstart", handleTouchStart)
			scrollableElement.removeEventListener("touchmove", handleTouchMove)
		}
	}, [enabled])

	return containerRef
}
