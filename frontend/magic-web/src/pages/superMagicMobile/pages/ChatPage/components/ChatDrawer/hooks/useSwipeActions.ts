import { useState, useRef, useEffect } from "react"
import type { TouchEvent } from "react"
import { useMemoizedFn } from "ahooks"

const DEFAULT_ACTION_BUTTON_WIDTH = 192
const DEFAULT_SNAP_THRESHOLD_RATIO = 0.35

interface UseSwipeActionsOptions {
	/** 所有操作按钮的总宽度（px），默认 192 */
	actionButtonWidth?: number
	/** 触发 snap-open 所需的滑动比例，默认 0.35 */
	snapThresholdRatio?: number
	/**
	 * 外部同步开关：
	 * - 变为 false → 自动收起
	 * - 变为 true  → 自动展开
	 * - undefined  → 不同步（仅由内部手势控制）
	 */
	syncOpen?: boolean
	/** item 展开（true）或收起（false）时的回调 */
	onSwipeChange?: (isOpen: boolean) => void
	/** 用户手指触碰到 item 时立即触发（用于互斥收起其他 item） */
	onDragStart?: () => void
}

interface UseSwipeActionsReturn {
	offsetX: number
	isDragging: boolean
	touchHandlers: {
		onTouchStart: (e: TouchEvent) => void
		onTouchMove: (e: TouchEvent) => void
		onTouchEnd: () => void
	}
	/** 强制收起（不触发 onSwipeChange） */
	close: () => void
}

export function useSwipeActions({
	actionButtonWidth = DEFAULT_ACTION_BUTTON_WIDTH,
	snapThresholdRatio = DEFAULT_SNAP_THRESHOLD_RATIO,
	syncOpen,
	onSwipeChange,
	onDragStart,
}: UseSwipeActionsOptions = {}): UseSwipeActionsReturn {
	const snapThreshold = actionButtonWidth * snapThresholdRatio

	const [offsetX, setOffsetX] = useState(0)
	const [isDragging, setIsDragging] = useState(false)

	const offsetXRef = useRef(0)
	const startXRef = useRef(0)
	const startOffsetRef = useRef(0)
	const startTimeRef = useRef(0)
	const lastTouchXRef = useRef(0)

	const updateOffsetX = useMemoizedFn((val: number) => {
		offsetXRef.current = val
		setOffsetX(val)
	})

	// 根据外部 syncOpen 同步展开/收起状态
	useEffect(() => {
		if (syncOpen !== undefined) {
			updateOffsetX(syncOpen ? -actionButtonWidth : 0)
		}
	}, [syncOpen, actionButtonWidth, updateOffsetX])

	const close = useMemoizedFn(() => {
		updateOffsetX(0)
	})

	const onTouchStart = useMemoizedFn((e: TouchEvent) => {
		const touch = e.touches[0]
		startXRef.current = touch.clientX
		lastTouchXRef.current = touch.clientX
		startOffsetRef.current = offsetXRef.current
		startTimeRef.current = Date.now()
		setIsDragging(true)
		onDragStart?.()
	})

	const onTouchMove = useMemoizedFn((e: TouchEvent) => {
		const touch = e.touches[0]
		const deltaX = touch.clientX - startXRef.current
		let newOffset = startOffsetRef.current + deltaX

		// 橡皮筋阻尼：超出边界时产生阻力
		if (newOffset > 0) {
			newOffset = newOffset * 0.2
		} else if (newOffset < -actionButtonWidth) {
			const excess = newOffset + actionButtonWidth
			newOffset = -actionButtonWidth + excess * 0.2
		}

		lastTouchXRef.current = touch.clientX
		updateOffsetX(newOffset)
	})

	const onTouchEnd = useMemoizedFn(() => {
		setIsDragging(false)

		const elapsed = Math.max(Date.now() - startTimeRef.current, 1)
		// px/ms，负值表示向左滑
		const velocity = (lastTouchXRef.current - startXRef.current) / elapsed

		// 快速向左滑 → 强制展开；快速向右滑 → 强制收起；慢速 → 按阈值判断
		let shouldOpen: boolean
		if (velocity < -0.3) {
			shouldOpen = true
		} else if (velocity > 0.3) {
			shouldOpen = false
		} else {
			shouldOpen = offsetXRef.current < -snapThreshold
		}

		updateOffsetX(shouldOpen ? -actionButtonWidth : 0)
		onSwipeChange?.(shouldOpen)
	})

	return {
		offsetX,
		isDragging,
		touchHandlers: { onTouchStart, onTouchMove, onTouchEnd },
		close,
	}
}
