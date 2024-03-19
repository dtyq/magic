import { useState, useEffect, useRef, useCallback } from "react"
import { useThrottleFn } from "ahooks"

interface UseTreeHeightOptions {
	/** 从 contentArea 高度中减去的像素值，默认 32px */
	offsetHeight?: number
	/** 节流延迟时间，默认 100ms */
	throttleWait?: number
	/** 最小高度限制，默认 200px */
	minHeight?: number
}

interface UseTreeHeightReturn {
	/** contentArea 元素的 ref */
	contentAreaRef: React.RefObject<HTMLDivElement>
	/** 计算后的树高度 */
	treeHeight: number
	/** 是否正在计算高度 */
	isCalculating: boolean
}

export function useTreeHeight(options: UseTreeHeightOptions = {}): UseTreeHeightReturn {
	const { offsetHeight = 32, throttleWait = 100, minHeight = 200 } = options

	const contentAreaRef = useRef<HTMLDivElement>(null)
	const [treeHeight, setTreeHeight] = useState<number>(minHeight)
	const [isCalculating, setIsCalculating] = useState(false)
	const resizeObserverRef = useRef<ResizeObserver | null>(null)

	// 高度计算函数
	const calculateTreeHeight = useCallback(() => {
		if (!contentAreaRef.current) return

		setIsCalculating(true)

		const contentAreaElement = contentAreaRef.current
		const contentAreaHeight = contentAreaElement.getBoundingClientRect().height

		// 计算树的高度：contentArea 高度 - 偏移量
		const calculatedHeight = Math.max(contentAreaHeight - offsetHeight, minHeight)

		setTreeHeight(calculatedHeight)
		setIsCalculating(false)
	}, [offsetHeight, minHeight])

	// 使用节流优化性能
	const { run: throttledCalculateHeight } = useThrottleFn(calculateTreeHeight, {
		wait: throttleWait,
	})

	// 设置 ResizeObserver 监听 contentArea 尺寸变化
	useEffect(() => {
		const contentAreaElement = contentAreaRef.current
		if (!contentAreaElement) return

		// 创建 ResizeObserver 实例
		resizeObserverRef.current = new ResizeObserver((entries) => {
			for (const entry of entries) {
				// 只有当高度发生变化时才重新计算
				if (entry.contentBoxSize) {
					throttledCalculateHeight()
				}
			}
		})

		// 开始观察 contentArea 元素
		resizeObserverRef.current.observe(contentAreaElement)

		// 初始计算一次
		throttledCalculateHeight()

		// 清理函数
		return () => {
			if (resizeObserverRef.current) {
				resizeObserverRef.current.disconnect()
				resizeObserverRef.current = null
			}
		}
	}, [throttledCalculateHeight])

	// 窗口尺寸变化时也需要重新计算
	useEffect(() => {
		const handleResize = () => {
			throttledCalculateHeight()
		}

		window.addEventListener("resize", handleResize)

		return () => {
			window.removeEventListener("resize", handleResize)
		}
	}, [throttledCalculateHeight])

	return {
		contentAreaRef,
		treeHeight,
		isCalculating,
	}
}
