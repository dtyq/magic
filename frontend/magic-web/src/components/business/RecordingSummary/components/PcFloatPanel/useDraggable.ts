import { useCallback, useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import type { DragState } from "../../types"
import { throttle } from "lodash-es"

interface UseDraggableOptions {
	defaultPosition?: { x: number; y: number }
	onPositionChange?: (position: { x: number; y: number }) => void
	onDragEnd?: (position: { x: number; y: number }) => void
	disabled?: boolean
}

export function useDraggable({
	defaultPosition = { x: 100, y: 100 },
	onPositionChange,
	onDragEnd,
	disabled = false,
}: UseDraggableOptions = {}) {
	const [position, setPosition] = useState(defaultPosition)
	const [dragState, setDragState] = useState<DragState>({
		isDragging: false,
		dragOffset: { x: 0, y: 0 },
	})

	const elementRef = useRef<HTMLDivElement>(null)

	// 使用 ref 保存最新的回调和位置，避免作为依赖导致频繁重新创建
	const latestPosition = useRef(position)
	const latestOnPositionChange = useRef(onPositionChange)
	const latestOnDragEnd = useRef(onDragEnd)

	// 保持 refs 与最新值同步
	latestPosition.current = position
	latestOnPositionChange.current = onPositionChange
	latestOnDragEnd.current = onDragEnd

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			if (disabled) return

			e.preventDefault()
			e.stopPropagation()

			const rect = elementRef.current?.getBoundingClientRect()
			if (!rect) return

			const dragOffset = {
				x: e.clientX - rect.left,
				y: e.clientY - rect.top,
			}

			setDragState({
				isDragging: true,
				dragOffset,
			})
		},
		[disabled],
	)

	// 统一的节流mousemove处理函数
	const handleMouseMove = useMemoizedFn((e: MouseEvent) => {
		if (!dragState.isDragging) return

		e.preventDefault()

		const newPosition = {
			x: e.clientX - dragState.dragOffset.x,
			y: e.clientY - dragState.dragOffset.y,
		}

		// 更新位置状态
		setPosition(newPosition)

		// 直接调用回调，不需要类型检查（TypeScript 已确保类型安全）
		latestOnPositionChange.current?.(newPosition)
	})

	// 使用 ref 避免依赖 position，防止频繁重新创建
	const handleMouseUp = useCallback(() => {
		if (dragState.isDragging) {
			setDragState({
				isDragging: false,
				dragOffset: { x: 0, y: 0 },
			})
			// 使用 ref 中的最新位置值
			latestOnDragEnd.current?.(latestPosition.current)
		}
	}, [dragState.isDragging]) // 移除 position 和 onDragEnd 依赖

	useEffect(() => {
		if (dragState.isDragging) {
			// 统一节流策略：16ms ≈ 60fps
			const throttledMouseMove = throttle(handleMouseMove, 16, { trailing: true })

			document.addEventListener("mousemove", throttledMouseMove)
			document.addEventListener("mouseup", handleMouseUp)
			document.body.style.userSelect = "none"

			return () => {
				// 清理节流函数，确保最后一次调用被执行
				throttledMouseMove.flush?.()
				throttledMouseMove.cancel?.()

				document.removeEventListener("mousemove", throttledMouseMove)
				document.removeEventListener("mouseup", handleMouseUp)
				document.body.style.userSelect = ""
			}
		}
	}, [dragState.isDragging, handleMouseMove, handleMouseUp]) // 现在依赖稳定，不会频繁重新执行

	// Update position when defaultPosition changes
	useEffect(() => {
		if (!dragState.isDragging) {
			setPosition(defaultPosition)
		}
	}, [defaultPosition, dragState.isDragging])

	return {
		position,
		isDragging: dragState.isDragging,
		elementRef,
		handleMouseDown,
	}
}
