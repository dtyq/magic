import { useCallback, useLayoutEffect, useRef } from "react"
import { useCanvas } from "../context/CanvasContext"
import { useCanvasEvents } from "./useCanvasEvent"

export interface UseRenameLabelPositionEffectOptions {
	elementId: string
	inputRef: React.RefObject<HTMLInputElement | null>
	/** 输入内容变化时重新测量宽度 */
	value: string
	/** 当前重命名元素被删除时回调 */
	onTargetDeleted: () => void
}

/**
 * 将重命名输入框定位到画布名称标签（Konva）对应的屏幕坐标，
 * 与 useElementPositionEffect 相同：直接更新 DOM transform，避免无关节点重渲染。
 */
export default function useRenameLabelPositionEffect(options: UseRenameLabelPositionEffectOptions) {
	const { elementId, inputRef, value, onTargetDeleted } = options
	const { canvas } = useCanvas()
	const containerRef = useRef<HTMLDivElement | null>(null)

	const updatePosition = useCallback(() => {
		if (!canvas || !elementId || !containerRef.current || !inputRef.current) {
			return
		}

		const layout = canvas.nameLabelManager.getRenameInputLayout(elementId)
		if (!layout) {
			return
		}

		// 与下方 input 高度公式保持一致：DOM 输入框往往比 Konva Text 更高，若左上角与 layout 对齐会向下压住元素。
		// 向上平移「多出来的高度」，使输入框底边与标签文字底边大致对齐（layout.y + layout.height）。
		const inputHeightPx = Math.max(layout.height + 6, 22)
		const verticalAlignOffset = inputHeightPx - layout.height
		const translateY = layout.y - verticalAlignOffset
		containerRef.current.style.transform = `translate(${layout.x}px, ${translateY}px)`
		inputRef.current.style.width = "1px"
		inputRef.current.style.height = `${inputHeightPx}px`
		inputRef.current.style.fontSize = `${layout.fontSize}px`
		inputRef.current.style.fontFamily = layout.fontFamily
		inputRef.current.style.color = layout.color
		inputRef.current.style.width = `${Math.max(
			inputRef.current.scrollWidth + 16,
			layout.width + 16,
			72,
		)}px`
	}, [canvas, elementId, inputRef])

	useCanvasEvents(
		[
			"viewport:scale",
			"viewport:pan",
			"element:updated",
			"element:rerendered",
			"elements:transform:dragmove",
			"elements:transform:anchorDragmove",
			"element:deleted",
		] as const,
		(
			scaleEvent,
			panEvent,
			updatedEvent,
			rerenderedEvent,
			dragMoveEvent,
			anchorDragMoveEvent,
			deletedEvent,
		) => {
			void scaleEvent
			void panEvent

			if (!elementId) {
				return
			}

			if (deletedEvent?.data.elementId === elementId) {
				onTargetDeleted()
				return
			}

			if (
				updatedEvent &&
				updatedEvent.data.elementId !== elementId &&
				rerenderedEvent === undefined
			) {
				return
			}

			if (
				rerenderedEvent &&
				rerenderedEvent.data.elementId !== elementId &&
				updatedEvent === undefined
			) {
				return
			}

			if (
				dragMoveEvent &&
				!dragMoveEvent.data.elementIds.includes(elementId) &&
				anchorDragMoveEvent === undefined
			) {
				return
			}

			if (
				anchorDragMoveEvent &&
				!anchorDragMoveEvent.data.elementIds.includes(elementId) &&
				dragMoveEvent === undefined
			) {
				return
			}

			updatePosition()
		},
		[elementId, onTargetDeleted, updatePosition],
	)

	useLayoutEffect(() => {
		if (!elementId) {
			return
		}

		updatePosition()
	}, [elementId, value, updatePosition])

	return {
		containerRef,
	}
}
