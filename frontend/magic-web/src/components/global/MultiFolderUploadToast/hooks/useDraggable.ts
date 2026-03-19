import { useResetState } from "ahooks"
import { useState, useEffect, useRef, useCallback } from "react"

interface Position {
	x: number
	y: number
}

interface UseDraggableOptions {
	defaultPosition?: Position
	disabled?: boolean
}

// 拖拽阈值（像素）- 只有鼠标移动超过此距离才开始拖拽
const DRAG_THRESHOLD = 5

export function useDraggable(options: UseDraggableOptions = {}) {
	const { defaultPosition, disabled = false } = options

	const elementRef = useRef<HTMLDivElement>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [isMouseDown, setIsMouseDown] = useState(false) // 跟踪鼠标按下状态
	const [position, setPosition] = useState<Position>({ x: 0, y: 0 })
	const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 })
	const dragStartPosRef = useRef<Position | null>(null) // 记录鼠标按下时的初始位置
	const [hasBeenDragged, setHasBeenDragged, resetHasBeenDragged] = useResetState(false) // 跟踪是否被用户拖拽过

	// 计算左下角位置的函数
	const getBottomLeftPosition = useCallback(() => {
		if (typeof window === "undefined") {
			return defaultPosition || { x: 10, y: 10 }
		}

		const leftOffset = 10 // 距离左边的距离
		const bottomOffset = 10 // 距离底部的距离
		const componentHeight = 40 // 折叠状态下组件预估高度

		return {
			x: leftOffset,
			y: Math.max(0, window.innerHeight - componentHeight - bottomOffset),
		}
	}, [defaultPosition])

	// 初始化位置 - 每次都固定在左下角
	useEffect(() => {
		setPosition(getBottomLeftPosition())
	}, [getBottomLeftPosition])

	// 鼠标按下事件
	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			if (disabled) return

			e.preventDefault()
			setIsMouseDown(true) // 只设置鼠标按下状态，不立即开始拖拽
			dragStartPosRef.current = { x: e.clientX, y: e.clientY } // 记录初始位置
			setDragStart({
				x: e.clientX - position.x,
				y: e.clientY - position.y,
			})
		},
		[disabled, position],
	)

	// 鼠标移动事件
	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			if (disabled) return

			// 如果鼠标按下但尚未开始拖拽，检查是否超过阈值
			if (isMouseDown && !isDragging && dragStartPosRef.current) {
				const deltaX = Math.abs(e.clientX - dragStartPosRef.current.x)
				const deltaY = Math.abs(e.clientY - dragStartPosRef.current.y)

				// 只有移动距离超过阈值才开始拖拽
				if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
					setIsDragging(true)
				} else {
					return // 还未达到阈值，不更新位置
				}
			}

			// 只有真正在拖拽时才更新位置
			if (!isDragging) return

			const newPosition = {
				x: e.clientX - dragStart.x,
				y: e.clientY - dragStart.y,
			}

			// 限制在屏幕范围内
			const maxX = window.innerWidth - (elementRef.current?.offsetWidth || 300)
			const maxY = window.innerHeight - (elementRef.current?.offsetHeight || 200)

			const boundedPosition = {
				x: Math.max(0, Math.min(newPosition.x, maxX)),
				y: Math.max(0, Math.min(newPosition.y, maxY)),
			}

			setPosition(boundedPosition)
		},
		[isDragging, isMouseDown, disabled, dragStart],
	)

	// 鼠标释放事件
	const handleMouseUp = useCallback(() => {
		if (isDragging) {
			setHasBeenDragged(true) // 标记为已被用户拖拽
			// 不再保存位置
		}
		setIsDragging(false)
		setIsMouseDown(false)
		dragStartPosRef.current = null
	}, [isDragging, setHasBeenDragged])

	// 绑定全局事件
	useEffect(() => {
		if (isMouseDown) {
			document.addEventListener("mousemove", handleMouseMove)
			document.addEventListener("mouseup", handleMouseUp)

			// 只有真正拖拽时才设置 grabbing 光标
			if (isDragging) {
				document.body.style.userSelect = "none"
				document.body.style.cursor = "grabbing"
			}

			return () => {
				document.removeEventListener("mousemove", handleMouseMove)
				document.removeEventListener("mouseup", handleMouseUp)
				document.body.style.userSelect = ""
				document.body.style.cursor = ""
			}
		}
	}, [isMouseDown, isDragging, handleMouseMove, handleMouseUp])

	// 窗口大小改变时调整位置
	useEffect(() => {
		const handleResize = () => {
			if (!hasBeenDragged) {
				// 如果用户从未拖拽过，则重置到默认位置（底部10px）
				setPosition(getBottomLeftPosition())
			} else {
				// 如果用户拖拽过，则保持当前位置但确保不超出边界
				const maxX = window.innerWidth - (elementRef.current?.offsetWidth || 300)
				const maxY = window.innerHeight - (elementRef.current?.offsetHeight || 200)

				setPosition((prev) => ({
					x: Math.max(0, Math.min(prev.x, maxX)),
					y: Math.max(0, Math.min(prev.y, maxY)),
				}))
			}
		}

		window.addEventListener("resize", handleResize)
		return () => window.removeEventListener("resize", handleResize)
	}, [hasBeenDragged, getBottomLeftPosition])

	// 调整位置确保不超出边界的方法
	const adjustPositionToBounds = useCallback(() => {
		if (!elementRef.current) return

		const maxX = window.innerWidth - elementRef.current.offsetWidth
		const maxY = window.innerHeight - elementRef.current.offsetHeight

		const adjustedPosition = {
			x: Math.max(0, Math.min(position.x, maxX)),
			y: Math.max(0, Math.min(position.y, maxY)),
		}

		// 只有当位置需要调整时才更新
		if (adjustedPosition.x !== position.x || adjustedPosition.y !== position.y) {
			setPosition(adjustedPosition)
			// 不再保存位置
		}
	}, [position])

	// 重置位置到左下角的方法
	const resetToBottomLeft = useCallback(() => {
		setPosition(getBottomLeftPosition())
		setHasBeenDragged(false) // 重置拖拽状态
	}, [getBottomLeftPosition, setHasBeenDragged])

	// 检查并调整位置边界（仅在超出边界时调整）
	const checkAndAdjustBounds = useCallback(() => {
		if (!elementRef.current) return

		const element = elementRef.current
		const rect = element.getBoundingClientRect()

		// 检查是否超出边界
		const isOutOfBounds =
			rect.left < 0 ||
			rect.top < 0 ||
			rect.right > window.innerWidth ||
			rect.bottom > window.innerHeight

		// 只有当超出边界时才调整位置
		if (isOutOfBounds) {
			console.log("📍 Position out of bounds, adjusting...")
			adjustPositionToBounds()
		}
	}, [adjustPositionToBounds])

	return {
		elementRef,
		position,
		isDragging,
		handleMouseDown,
		adjustPositionToBounds,
		resetToBottomLeft,
		resetHasBeenDragged,
		checkAndAdjustBounds,
		dragHandleProps: {
			onMouseDown: handleMouseDown,
			style: {
				cursor: disabled ? "default" : isDragging ? "grabbing" : "grab",
			},
		},
		containerProps: {
			ref: elementRef,
			style: {
				position: "fixed" as const,
				left: position.x,
				top: position.y,
				zIndex: 1000,
				transform: "none", // 确保不受其他transform影响
			},
		},
	}
}
