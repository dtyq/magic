import { useEffect } from "react"
import { useCanvas } from "../../providers/CanvasProvider"
import {
	pickContentElementIdAtStagePointer,
	resolveManagedElementIdFromKonvaNode,
} from "../../../runtime/interaction/transform/elementNodeUtils"

/**
 * Closes a canvas-owned floating panel when the panel's element is clicked again.
 * DOM surfaces do not participate in the Canvas input stream, so clicks inside a
 * panel cannot be mistaken for clicks on its anchored element.
 */
export default function useCloseOnCanvasElementClick(
	elementId: string | null,
	onClose: (() => void) | undefined,
) {
	const { canvas } = useCanvas()

	useEffect(() => {
		if (!canvas || !elementId || !onClose) return

		return canvas.inputManager.on("down", (input) => {
			if (input.button !== 0 || input.activePointerCount > 1) return
			if (Object.values(input.modifiers).some(Boolean)) return

			let node: typeof input.target | null = input.target
			while (node && node !== canvas.stage) {
				if (node.name().startsWith("decorator-")) return
				node = node.getParent()
			}

			const clickedElementId =
				resolveManagedElementIdFromKonvaNode(input.target, canvas) ??
				pickContentElementIdAtStagePointer(canvas, input.stage)
			if (clickedElementId === elementId) onClose()
		})
	}, [canvas, elementId, onClose])
}
