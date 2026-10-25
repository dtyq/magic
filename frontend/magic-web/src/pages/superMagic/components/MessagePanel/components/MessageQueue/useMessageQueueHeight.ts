import { useLayoutEffect, useRef, useState } from "react"

const DEFAULT_LIST_MAX_HEIGHT = 200

/** 队列只保存本次页面内的高度；输入区的尺寸和持久化仍由会话布局负责。 */
export function useMessageQueueHeight({
	enabled,
	maxListHeight,
}: {
	enabled: boolean
	maxListHeight?: number
}) {
	const viewportRef = useRef<HTMLDivElement>(null)
	const contentRef = useRef<HTMLDivElement>(null)
	const [preferredHeight, setPreferredHeight] = useState<number | null>(null)
	const [previewHeight, setPreviewHeight] = useState<number | null>(null)
	const [bounds, setBounds] = useState({ min: 0, max: DEFAULT_LIST_MAX_HEIGHT })
	const startHeightRef = useRef(0)
	const pendingHeightRef = useRef(0)

	useLayoutEffect(() => {
		if (!enabled) return
		const viewport = viewportRef.current
		const content = contentRef.current
		if (!viewport || !content) return
		const measure = () => {
			const style = getComputedStyle(viewport)
			const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
			const firstRow = content.firstElementChild
			const min = Math.ceil((firstRow?.getBoundingClientRect().height ?? 0) + padding)
			// 剩余空间来自同一会话布局，不能靠增大队列来挤压下面的头像和编辑器。
			const max = Math.max(
				min,
				Math.min(
					content.getBoundingClientRect().height + padding,
					maxListHeight ?? DEFAULT_LIST_MAX_HEIGHT,
				),
			)
			setBounds((previous) =>
				previous.min === min && Math.abs(previous.max - max) < 1 ? previous : { min, max },
			)
		}
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(content)
		observer.observe(viewport)
		return () => observer.disconnect()
	}, [enabled, maxListHeight])

	const height = enabled
		? Math.max(
				bounds.min,
				Math.min(previewHeight ?? preferredHeight ?? DEFAULT_LIST_MAX_HEIGHT, bounds.max),
			)
		: DEFAULT_LIST_MAX_HEIGHT

	return {
		viewportRef,
		contentRef,
		height,
		minHeight: bounds.min,
		maxHeight: bounds.max,
		startResize: () => {
			startHeightRef.current = viewportRef.current?.getBoundingClientRect().height ?? height
			pendingHeightRef.current = startHeightRef.current
		},
		resize: (deltaY: number) => {
			const next = Math.max(bounds.min, Math.min(startHeightRef.current - deltaY, bounds.max))
			pendingHeightRef.current = next
			setPreviewHeight(next)
		},
		finishResize: () => {
			setPreferredHeight(pendingHeightRef.current)
			setPreviewHeight(null)
		},
		onResizeStateChange: (resizing: boolean) => {
			// pointercancel 只清除预览，不写入本次未完成的高度偏好。
			if (!resizing) setPreviewHeight(null)
		},
		restoreAutoHeight: () => {
			setPreferredHeight(null)
			setPreviewHeight(null)
		},
	}
}
