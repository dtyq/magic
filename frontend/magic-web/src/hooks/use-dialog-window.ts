import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react"
import { useMemoizedFn } from "ahooks"

export interface DialogWindowSize {
	width: number
	height: number
}

export interface DialogWindowOptions {
	/** 与所属 Dialog 使用同一个开关；保留挂载的窗口也能在重开时居中。 */
	open: boolean
	draggable?: boolean
	resizable?: boolean
	defaultSize: DialogWindowSize
	minSize: DialogWindowSize
	sizeStorageKey?: string
	dragHandleSelector?: string
	/** 递增时恢复默认尺寸；初次挂载和存储身份变化不会清除已有偏好。 */
	resetSizeKey?: number
	/** 仅实际改变宽高且未取消的手势完成时调用。 */
	onResizeEnd?: (size: DialogWindowSize) => void
}

export type DialogResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"
type WindowGesture = DialogResizeDirection | "move"
interface WindowRect extends DialogWindowSize {
	left: number
	top: number
}
interface Gesture {
	direction: WindowGesture
	pointerId: number
	x: number
	y: number
	start: WindowRect
	target: HTMLElement
}

const VIEWPORT_MARGIN = 16
const INTERACTIVE_SELECTOR =
	"button, input, textarea, select, a, [role=button], [contenteditable]:not([contenteditable=false]), [data-dialog-resize-handle]"

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), Math.max(min, max))
}

function getViewport(): WindowRect {
	const viewport = window.visualViewport
	const left = Math.round(viewport?.offsetLeft ?? 0)
	const top = Math.round(viewport?.offsetTop ?? 0)
	const width = Math.round(viewport?.width ?? window.innerWidth)
	const height = Math.round(viewport?.height ?? window.innerHeight)
	return {
		left: left + VIEWPORT_MARGIN,
		top: top + VIEWPORT_MARGIN,
		width: Math.max(1, width - VIEWPORT_MARGIN * 2),
		height: Math.max(1, height - VIEWPORT_MARGIN * 2),
	}
}

function constrainRect(rect: WindowRect, minSize: DialogWindowSize): WindowRect {
	const viewport = getViewport()
	const width = Math.round(
		clamp(rect.width, Math.min(minSize.width, viewport.width), viewport.width),
	)
	const height = Math.round(
		clamp(rect.height, Math.min(minSize.height, viewport.height), viewport.height),
	)
	return {
		width,
		height,
		left: Math.round(clamp(rect.left, viewport.left, viewport.left + viewport.width - width)),
		top: Math.round(clamp(rect.top, viewport.top, viewport.top + viewport.height - height)),
	}
}

function readSize(key: string | undefined, fallback: DialogWindowSize): DialogWindowSize {
	if (!key) return fallback
	try {
		const raw = localStorage.getItem(key)
		const value: unknown = raw ? JSON.parse(raw) : null
		if (
			value &&
			typeof value === "object" &&
			"width" in value &&
			typeof value.width === "number" &&
			Number.isFinite(value.width) &&
			value.width > 0 &&
			"height" in value &&
			typeof value.height === "number" &&
			Number.isFinite(value.height) &&
			value.height > 0
		)
			return { width: value.width, height: value.height }
	} catch {
		// 尺寸只是偏好；损坏或不可用的本地存储不应阻止窗口打开。
	}
	return fallback
}

export interface DialogWindowInteraction {
	style: CSSProperties | undefined
	activeGesture: WindowGesture | null
	isInteracting: boolean
	isDragging: boolean
	startGesture: (event: PointerEvent<HTMLElement>, direction: WindowGesture) => void
	onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
	onPointerMove: (event: PointerEvent<HTMLDivElement>) => void
	onPointerUp: (event: PointerEvent<HTMLDivElement>) => void
	onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void
	onEscapeKeyDown: (event: KeyboardEvent) => void
}

/** 只管理当前弹窗的矩形；业务数据、焦点与浮层层级仍由调用方和 Radix 管理。 */
export function useDialogWindow(options?: DialogWindowOptions): DialogWindowInteraction {
	const [rect, setRect] = useState<WindowRect | null>(null)
	const rectRef = useRef<WindowRect | null>(null)
	const gestureRef = useRef<Gesture | null>(null)
	const frameRef = useRef<number | null>(null)
	const [activeGesture, setActiveGesture] = useState<WindowGesture | null>(null)
	const preferredSizeRef = useRef<DialogWindowSize | null>(null)
	const lastStorageKeyRef = useRef(options?.sizeStorageKey)
	const open = options?.open ?? false
	const storageKey = options?.sizeStorageKey
	const resetSizeKey = options?.resetSizeKey
	const lastResetRequestRef = useRef({ storageKey, resetSizeKey })

	const cancelFrame = useMemoizedFn(() => {
		if (frameRef.current === null) return
		cancelAnimationFrame(frameRef.current)
		frameRef.current = null
	})
	const updateRect = useMemoizedFn((next: WindowRect, deferred = false) => {
		rectRef.current = next
		if (!deferred) {
			cancelFrame()
			setRect(next)
			return
		}
		// 连续移动只保留最新矩形，每帧提交一次；打开和取消手势仍立即更新。
		if (frameRef.current !== null) return
		frameRef.current = requestAnimationFrame(() => {
			frameRef.current = null
			setRect(rectRef.current)
		})
	})
	const endGesture = useMemoizedFn((cancel: boolean, render = true) => {
		cancelFrame()
		const gesture = gestureRef.current
		if (!gesture) return false
		gestureRef.current = null
		setActiveGesture(null)
		let resizedSize: DialogWindowSize | undefined
		if (cancel) {
			// 仅在明确取消（如 Esc 按键）时恢复起点坐标
			if (options) rectRef.current = constrainRect(gesture.start, options.minSize)
		} else if (
			gesture.direction !== "move" &&
			rectRef.current &&
			(rectRef.current.width !== gesture.start.width ||
				rectRef.current.height !== gesture.start.height)
		) {
			const { width, height } = rectRef.current
			const size = { width, height }
			preferredSizeRef.current = size
			resizedSize = size
			if (storageKey) {
				try {
					localStorage.setItem(storageKey, JSON.stringify(size))
				} catch {
					// 保存失败仍保留本次挂载期间的尺寸，拖动位置从不持久化。
				}
			}
		}
		// 松手提交最后坐标；取消恢复起点；关闭或卸载只清理，不触发新的渲染。
		if (render && rectRef.current) setRect(rectRef.current)
		try {
			if (gesture.target.hasPointerCapture(gesture.pointerId)) {
				gesture.target.releasePointerCapture(gesture.pointerId)
			}
		} catch {
			// 释放异常不中断交互完成
		}
		if (resizedSize) options?.onResizeEnd?.(resizedSize)
		return true
	})

	const resetWindow = useMemoizedFn((restoreDefault = false) => {
		if (!options) return
		if (lastStorageKeyRef.current !== storageKey) preferredSizeRef.current = null
		lastStorageKeyRef.current = storageKey
		if (restoreDefault && storageKey) {
			try {
				localStorage.removeItem(storageKey)
			} catch {
				// 本地存储不可用时仍立即恢复窗口，本次挂载不再沿用旧尺寸。
			}
		}
		const size = restoreDefault
			? options.defaultSize
			: readSize(storageKey, preferredSizeRef.current ?? options.defaultSize)
		preferredSizeRef.current = size
		const viewport = getViewport()
		const next = constrainRect(
			{ ...size, left: viewport.left, top: viewport.top },
			options.minSize,
		)
		updateRect({
			...next,
			left: Math.round(viewport.left + (viewport.width - next.width) / 2),
			top: Math.round(viewport.top + (viewport.height - next.height) / 2),
		})
	})

	useLayoutEffect(() => {
		if (!open) return
		resetWindow()
		const constrain = () => {
			// 手势进行中禁止中断或回跳，保证拖拽跟手稳定
			if (gestureRef.current) return
			if (options && rectRef.current)
				updateRect(constrainRect(rectRef.current, options.minSize))
		}
		// 自动适配小屏只改变显示矩形，不把临时缩小后的尺寸写回偏好。
		window.addEventListener("resize", constrain)
		window.visualViewport?.addEventListener("resize", constrain)
		return () => {
			endGesture(false, false)
			window.removeEventListener("resize", constrain)
			window.visualViewport?.removeEventListener("resize", constrain)
		}
		// 配置对象每次 render 可重新创建；仅开关和存储身份改变时重置位置。
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, storageKey])

	useLayoutEffect(() => {
		const previous = lastResetRequestRef.current
		lastResetRequestRef.current = { storageKey, resetSizeKey }
		if (
			!open ||
			resetSizeKey === undefined ||
			previous.storageKey !== storageKey ||
			previous.resetSizeKey === resetSizeKey
		)
			return
		// 显式恢复只更新几何和尺寸偏好，不重挂窗口内的搜索、列表及业务状态。
		endGesture(true)
		resetWindow(true)
	}, [endGesture, open, resetSizeKey, resetWindow, storageKey])

	const startGesture = useMemoizedFn(
		(event: PointerEvent<HTMLElement>, direction: WindowGesture) => {
			if (!open || !options || event.button !== 0 || !event.isPrimary || gestureRef.current)
				return
			if (direction === "move" ? !options.draggable : !options.resizable) return
			const start = rectRef.current
			if (!start) return
			event.preventDefault()
			gestureRef.current = {
				direction,
				pointerId: event.pointerId,
				x: event.clientX,
				y: event.clientY,
				start,
				target: event.currentTarget,
			}
			setActiveGesture(direction)
			try {
				event.currentTarget.setPointerCapture(event.pointerId)
			} catch {
				// 容错处理
			}
		},
	)

	// 全局监听移动与松手，即便鼠标移出弹窗边界或滑过 iframe 也能持续平滑跟手
	useLayoutEffect(() => {
		if (!activeGesture) return

		const handlePointerMove = (event: globalThis.PointerEvent) => {
			const gesture = gestureRef.current
			if (!gesture || !options || gesture.pointerId !== event.pointerId) return
			const { start, direction } = gesture
			const dx = event.clientX - gesture.x
			const dy = event.clientY - gesture.y
			if (direction === "move") {
				updateRect(
					constrainRect(
						{
							...start,
							left: start.left + dx,
							top: start.top + dy,
						},
						options.minSize,
					),
					true,
				)
				return
			}
			const viewport = getViewport()
			const minWidth = Math.min(options.minSize.width, viewport.width)
			const minHeight = Math.min(options.minSize.height, viewport.height)
			let { left, top } = start
			let right = left + start.width
			let bottom = top + start.height
			// 拖左／上边时固定对边；窗口不会因为尺寸变化再次居中。
			if (direction.includes("e"))
				right = clamp(right + dx, left + minWidth, viewport.left + viewport.width)
			if (direction.includes("w")) left = clamp(left + dx, viewport.left, right - minWidth)
			if (direction.includes("s"))
				bottom = clamp(bottom + dy, top + minHeight, viewport.top + viewport.height)
			if (direction.includes("n")) top = clamp(top + dy, viewport.top, bottom - minHeight)
			updateRect(
				{
					left: Math.round(left),
					top: Math.round(top),
					width: Math.round(right - left),
					height: Math.round(bottom - top),
				},
				true,
			)
		}

		const handlePointerUp = (event: globalThis.PointerEvent) => {
			if (gestureRef.current?.pointerId === event.pointerId) {
				handlePointerMove(event)
				endGesture(false)
			}
		}

		const handlePointerCancel = (event: globalThis.PointerEvent) => {
			if (gestureRef.current?.pointerId === event.pointerId) {
				// 意外中断时保留当前位置，绝不回跳；仅 Esc 按键才回跳
				endGesture(false)
			}
		}

		window.addEventListener("pointermove", handlePointerMove, { passive: true })
		window.addEventListener("pointerup", handlePointerUp)
		window.addEventListener("pointercancel", handlePointerCancel)

		return () => {
			window.removeEventListener("pointermove", handlePointerMove)
			window.removeEventListener("pointerup", handlePointerUp)
			window.removeEventListener("pointercancel", handlePointerCancel)
		}
	}, [activeGesture, endGesture, options, updateRect])

	const onPointerDown = useMemoizedFn((event: PointerEvent<HTMLDivElement>) => {
		if (!(event.target instanceof Element) || event.target.closest(INTERACTIVE_SELECTOR)) return
		const handle = event.target.closest(
			options?.dragHandleSelector ?? "[data-dialog-drag-handle]",
		)
		if (handle && event.currentTarget.contains(handle)) startGesture(event, "move")
	})
	const onPointerMove = useMemoizedFn((event: PointerEvent<HTMLDivElement>) => {
		// 全局 window 监听器已处理实际位置更新，保留此回调保证与 React 属性透传兼容
		if (gestureRef.current?.pointerId !== event.pointerId) return
	})
	const onPointerUp = useMemoizedFn((event: PointerEvent<HTMLDivElement>) => {
		if (gestureRef.current?.pointerId === event.pointerId) endGesture(false)
	})
	const onPointerCancel = useMemoizedFn((event: PointerEvent<HTMLDivElement>) => {
		if (gestureRef.current?.pointerId === event.pointerId) endGesture(false)
	})
	const onEscapeKeyDown = useMemoizedFn((event: KeyboardEvent) => {
		if (endGesture(true)) event.preventDefault()
	})
	const style: CSSProperties | undefined =
		options && rect
			? {
					...rect,
					right: "auto",
					bottom: "auto",
					maxWidth: "none",
					maxHeight: "none",
					transform: "none",
					translate: "none",
				}
			: undefined

	return {
		style,
		activeGesture,
		isInteracting: activeGesture !== null,
		isDragging: activeGesture === "move",
		startGesture,
		onPointerDown,
		onPointerMove,
		onPointerUp,
		onPointerCancel,
		onEscapeKeyDown,
	}
}
