import { useState, useCallback, useRef, useEffect } from "react"
import { useMemoizedFn, useMount } from "ahooks"

interface UseResizablePanelOptions {
	minWidth: number
	maxWidth: number
	defaultWidth: number
	storageKey: string
	/**
	 * 拖拽方向
	 * - "left": 向左拖拽增加宽度（用于右侧边框，如 ProjectSider）
	 * - "right": 向右拖拽增加宽度（用于左侧边框，如消息区域）
	 */
	direction?: "left" | "right"
}

interface UseResizablePanelReturn {
	width: number
	isDragging: boolean
	handleMouseDown: (e: React.MouseEvent) => void
}

function useResizablePanel({
	minWidth,
	maxWidth,
	defaultWidth,
	storageKey,
	direction = "right",
}: UseResizablePanelOptions): UseResizablePanelReturn {
	// 从 localStorage 读取保存的宽度，如果没有则使用默认值
	const getInitialWidth = useCallback(() => {
		try {
			const savedWidth = localStorage.getItem(storageKey)
			if (savedWidth) {
				const width = parseInt(savedWidth, 10)
				// 确保读取的值在有效范围内
				if (!isNaN(width) && width >= minWidth && width <= maxWidth) {
					return width
				}
			}
		} catch (error) {
			console.error("Failed to read from localStorage:", error)
		}
		return defaultWidth
	}, [storageKey, minWidth, maxWidth, defaultWidth])

	const [width, setWidth] = useState<number>(getInitialWidth)
	const [isDragging, setIsDragging] = useState(false)
	// 使用 ref 追踪最新的宽度值，避免闭包陷阱
	const widthRef = useRef<number>(getInitialWidth())

	// 同步 width 到 ref
	useEffect(() => {
		widthRef.current = width
	}, [width])

	// 组件挂载后从 localStorage 初始化宽度
	useMount(() => {
		const initialWidth = getInitialWidth()
		setWidth(initialWidth)
		widthRef.current = initialWidth
	})

	// 保存宽度到 localStorage
	const saveWidth = useMemoizedFn((newWidth: number) => {
		try {
			localStorage.setItem(storageKey, newWidth.toString())
		} catch (error) {
			console.error("Failed to save to localStorage:", error)
		}
	})

	// 鼠标按下事件
	const handleMouseDown = useMemoizedFn((e: React.MouseEvent) => {
		e.preventDefault()
		setIsDragging(true)

		const startX = e.clientX
		const startWidth = widthRef.current // 使用 ref 获取最新值

		const handleMouseMove = (moveEvent: MouseEvent) => {
			const deltaX = moveEvent.clientX - startX
			// direction="left": 向左拖拽增加宽度（用于右侧边框，如 ProjectSider）
			// direction="right": 向右拖拽增加宽度（用于左侧边框，如消息区域）
			const newWidth =
				direction === "left"
					? Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX))
					: Math.max(minWidth, Math.min(maxWidth, startWidth - deltaX))
			setWidth(newWidth)
			widthRef.current = newWidth // 实时更新 ref
		}

		const handleMouseUp = () => {
			setIsDragging(false)
			// 使用 ref 获取最新的宽度值并保存
			const finalWidth = widthRef.current
			saveWidth(finalWidth)
			document.removeEventListener("mousemove", handleMouseMove)
			document.removeEventListener("mouseup", handleMouseUp)
		}

		document.addEventListener("mousemove", handleMouseMove)
		document.addEventListener("mouseup", handleMouseUp)
	})

	return {
		width,
		isDragging,
		handleMouseDown,
	}
}

export default useResizablePanel
