import React, { useCallback, useEffect, useRef, useState } from "react"
import type { TouchPosition, GestureType, GestureState } from "../types"

interface UsePressAndHoldOptions {
	onPressStart?: () => void
	onPressEnd?: (gestureType: GestureType) => void
	onGestureChange?: (gesture: GestureState) => void
	gestureThreshold?: number
	disabled?: boolean
}

export const usePressAndHold = ({
	onPressStart,
	onPressEnd,
	onGestureChange,
	gestureThreshold = 100,
	disabled = false,
}: UsePressAndHoldOptions = {}) => {
	const [isPressed, setIsPressed] = useState(false)
	const [touchPosition, setTouchPosition] = useState<TouchPosition>({
		x: 0,
		y: 0,
		startX: 0,
		startY: 0,
		deltaX: 0,
		deltaY: 0,
	})
	const [gestureState, setGestureState] = useState<GestureState>({
		type: "none",
		progress: 0,
		isActive: false,
	})

	const pressTimerRef = useRef<NodeJS.Timeout>()
	const isLongPressRef = useRef(false)

	const calculateGesture = useCallback(
		(position: TouchPosition): GestureState => {
			const { deltaX, deltaY } = position
			const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

			if (distance < gestureThreshold) {
				return { type: "none", progress: 0, isActive: false }
			}

			const progress = Math.min(distance / (gestureThreshold * 2), 1)

			// 简化手势识别：支持左滑/左上滑 和 右滑/右上滑
			const absX = Math.abs(deltaX)
			const absY = Math.abs(deltaY)

			// 左侧手势：取消 (左滑或左上滑)
			if (deltaX < -gestureThreshold / 2) {
				// 支持纯左滑或带上滑分量的左滑
				if (absX >= absY * 0.5 || deltaY <= 0) {
					// 左滑优先或向上滑动
					return { type: "cancel", progress, isActive: true }
				}
			}

			// 右侧手势：转文字 (右滑或右上滑)
			if (deltaX > gestureThreshold / 2) {
				// 支持纯右滑或带上滑分量的右滑
				if (absX >= absY * 0.5 || deltaY <= 0) {
					// 右滑优先或向上滑动
					return { type: "send-text", progress, isActive: true }
				}
			}

			// 默认为语音发送
			return { type: "send-voice", progress: 0, isActive: false }
		},
		[gestureThreshold],
	)

	const handleTouchStart = useCallback(
		(event: React.TouchEvent | React.MouseEvent) => {
			if (disabled) return

			const touch = "touches" in event ? event.touches[0] : event
			const startPosition = {
				x: touch.clientX,
				y: touch.clientY,
				startX: touch.clientX,
				startY: touch.clientY,
				deltaX: 0,
				deltaY: 0,
			}

			setTouchPosition(startPosition)
			setIsPressed(true)
			isLongPressRef.current = false

			// 设置长按定时器
			pressTimerRef.current = setTimeout(() => {
				isLongPressRef.current = true
				onPressStart?.()
			}, 200) // 200ms 后触发长按
		},
		[disabled, onPressStart],
	)

	const handleTouchMove = useCallback(
		(event: React.TouchEvent | React.MouseEvent) => {
			if (!isPressed || disabled) return

			const touch = "touches" in event ? event.touches[0] : event

			const newPosition: TouchPosition = {
				x: touch.clientX,
				y: touch.clientY,
				startX: touchPosition.startX,
				startY: touchPosition.startY,
				deltaX: touch.clientX - touchPosition.startX,
				deltaY: touch.clientY - touchPosition.startY,
			}

			setTouchPosition(newPosition)

			if (isLongPressRef.current) {
				const gesture = calculateGesture(newPosition)
				setGestureState(gesture)
				onGestureChange?.(gesture)
			}
		},
		[
			isPressed,
			disabled,
			touchPosition.startX,
			touchPosition.startY,
			calculateGesture,
			onGestureChange,
		],
	)

	const handleTouchEnd = useCallback(() => {
		if (!isPressed) return
		setIsPressed(false)

		if (pressTimerRef.current) {
			clearTimeout(pressTimerRef.current)
		}

		if (isLongPressRef.current) {
			// 长按结束，触发相应的手势动作
			const finalGestureType = gestureState.isActive ? gestureState.type : "send-voice"
			onPressEnd?.(finalGestureType)
		}

		// 重置状态
		setGestureState({ type: "none", progress: 0, isActive: false })
		setTouchPosition({
			x: 0,
			y: 0,
			startX: 0,
			startY: 0,
			deltaX: 0,
			deltaY: 0,
		})
		isLongPressRef.current = false
	}, [isPressed, gestureState, onPressEnd])

	// 禁用右键菜单
	const handleContextMenu = useCallback((event: React.MouseEvent) => {
		event.preventDefault()
	}, [])

	// 强制重置所有状态 - 用于组件关闭时的彻底清空
	const resetStates = useCallback(() => {
		// 清理定时器
		if (pressTimerRef.current) {
			clearTimeout(pressTimerRef.current)
			pressTimerRef.current = undefined
		}

		// 重置所有状态
		setIsPressed(false)
		setGestureState({ type: "none", progress: 0, isActive: false })
		setTouchPosition({
			x: 0,
			y: 0,
			startX: 0,
			startY: 0,
			deltaX: 0,
			deltaY: 0,
		})
		isLongPressRef.current = false
	}, [])

	// 组件卸载时清理定时器
	useEffect(() => {
		return () => {
			if (pressTimerRef.current) {
				clearTimeout(pressTimerRef.current)
			}
		}
	}, [])

	return {
		isPressed,
		isLongPress: isLongPressRef.current,
		touchPosition,
		gestureState,
		resetStates,
		handlers: {
			onTouchStart: handleTouchStart,
			onTouchMove: handleTouchMove,
			onTouchEnd: handleTouchEnd,
			onMouseDown: handleTouchStart,
			onMouseMove: handleTouchMove,
			onMouseUp: handleTouchEnd,
			onMouseLeave: handleTouchEnd,
			onContextMenu: handleContextMenu,
		},
	}
}
