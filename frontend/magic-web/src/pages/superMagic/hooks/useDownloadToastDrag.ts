import { useCallback, useEffect, useRef, useState } from "react"
import type { DraggableData, DraggableEvent } from "react-draggable"

interface Position {
	x: number
	y: number
}

const VIEWPORT_MARGIN = 12

/** 位移只属于当前下载浮层，进度更新保留位置，卸载后不留全局状态。 */
export function useDownloadToastDrag() {
	const anchorRef = useRef<HTMLDivElement>(null)
	const nodeRef = useRef<HTMLDivElement>(null)
	const positionRef = useRef<Position>({ x: 0, y: 0 })
	const movedRef = useRef(false)
	const [position, setPosition] = useState<Position>(positionRef.current)
	const [dragging, setDragging] = useState(false)

	const move = useCallback((next: Position) => {
		const anchor = anchorRef.current
		const node = nodeRef.current
		if (!anchor || !node) return
		// 外层保留 Sonner 的布局与动画，内层单独移动；原位置不留下可点击的透明区域。
		const rect = anchor.getBoundingClientRect()
		const { clientWidth, clientHeight } = document.documentElement
		const minX = VIEWPORT_MARGIN - rect.left
		const minY = VIEWPORT_MARGIN - rect.top
		const maxX = Math.max(minX, clientWidth - VIEWPORT_MARGIN - rect.left - node.offsetWidth)
		const maxY = Math.max(minY, clientHeight - VIEWPORT_MARGIN - rect.top - node.offsetHeight)
		const bounded = {
			x: Math.min(Math.max(next.x, minX), maxX),
			y: Math.min(Math.max(next.y, minY), maxY),
		}
		positionRef.current = bounded
		setPosition((previous) =>
			previous.x === bounded.x && previous.y === bounded.y ? previous : bounded,
		)
	}, [])

	useEffect(() => {
		const keepVisible = () => {
			if (movedRef.current) move(positionRef.current)
		}
		const observer = new ResizeObserver(keepVisible)
		if (nodeRef.current) observer.observe(nodeRef.current)
		window.addEventListener("resize", keepVisible)
		return () => {
			observer.disconnect()
			window.removeEventListener("resize", keepVisible)
		}
	}, [move])

	const onStart = useCallback((event: DraggableEvent) => {
		event.stopPropagation()
		setDragging(true)
	}, [])

	const onDrag = useCallback(
		(_event: DraggableEvent, data: DraggableData) => {
			movedRef.current = true
			move({ x: positionRef.current.x + data.deltaX, y: positionRef.current.y + data.deltaY })
		},
		[move],
	)

	const onStop = useCallback(() => setDragging(false), [])

	return { anchorRef, nodeRef, position, dragging, onStart, onDrag, onStop }
}
