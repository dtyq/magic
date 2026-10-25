import { useCallback, useState } from "react"
import { useCanvas } from "../../providers/CanvasProvider"
import type { MediaReplacementState } from "../../../runtime/interaction/media/MediaReplaceController"
import { useCanvasEvent } from "./useCanvasEvent"

/**
 * 订阅指定媒体元素的运行时替换状态。
 *
 * 状态以 MediaReplaceController 为准，因此取消选中后重新挂载仍能恢复当前任务。
 */
export function useMediaReplacementState(elementId?: string | null): MediaReplacementState | null {
	const { canvas } = useCanvas()
	const readState = useCallback(() => {
		if (!canvas || !elementId) return null
		return canvas.mediaReplaceController?.getReplacementState?.(elementId) ?? null
	}, [canvas, elementId])
	const [, setRevision] = useState(0)

	useCanvasEvent(
		"element:media:replaceStateChanged",
		useCallback(
			({ data }) => {
				if (data.elementId !== elementId) return
				setRevision((revision) => revision + 1)
			},
			[elementId],
		),
		[elementId],
	)

	return readState()
}

export function useIsMediaReplacing(elementId?: string | null): boolean {
	return useMediaReplacementState(elementId) !== null
}
