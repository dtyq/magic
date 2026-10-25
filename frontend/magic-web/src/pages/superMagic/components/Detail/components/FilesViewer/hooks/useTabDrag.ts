import { useLayoutEffect, useRef, useState, type DragEvent, type RefObject } from "react"
import { useMemoizedFn } from "ahooks"
import { clearProjectAttachmentDragHoverPlainText } from "@/components/CanvasDesign/ui/editors/message/reference-assets/projectAttachmentDragHoverBridge"
import type { TabItem } from "../types"
import { TabDragSession } from "../utils/tabDragSession"

interface UseTabDragOptions {
	tabs: TabItem[]
	containerRef: RefObject<HTMLDivElement>
	onReorder: (sourceId: string, targetId: string) => void
}

export function useTabDrag({ tabs, containerRef, onReorder }: UseTabDragOptions) {
	const sessionRef = useRef<TabDragSession | null>(null)
	const [isDragging, setIsDragging] = useState(false)
	const orderKey = tabs.map((tab) => tab.id).join("\u0000")
	const commit = useMemoizedFn(onReorder)
	const handleDragStart = useMemoizedFn((event: DragEvent, tab: TabItem) => {
		const container = containerRef.current
		if (!container || sessionRef.current || !(event.currentTarget instanceof HTMLElement)) {
			event.preventDefault()
			return
		}
		event.dataTransfer.effectAllowed = "copyMove"
		event.dataTransfer.setData("text/plain", tab.id)
		sessionRef.current = new TabDragSession({
			container,
			source: event.currentTarget,
			event: event.nativeEvent,
			onCommit: commit,
			onFinish: () => {
				sessionRef.current = null
				clearProjectAttachmentDragHoverPlainText()
				setIsDragging(false)
			},
		})
		setIsDragging(true)
	})
	const handleDragEnd = useMemoizedFn(() => sessionRef.current?.finish(false))

	// 标签集合变化或查看器离开时，废弃旧几何；不能把拖动前的顺序写回新话题。
	useLayoutEffect(() => () => sessionRef.current?.dispose(), [orderKey, containerRef])

	return { isDragging, handleDragStart, handleDragEnd }
}
