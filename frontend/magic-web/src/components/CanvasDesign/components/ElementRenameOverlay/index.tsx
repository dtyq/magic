import { useCanvasRenameUI } from "../../context/CanvasUIContext"
import { useCanvasElement } from "../../hooks/useCanvasElement"
import ElementRenameOverlayRender from "./ElementRenameOverlayRender"

export default function ElementRenameOverlay() {
	const { canvasRenamingElementId } = useCanvasRenameUI()
	const element = useCanvasElement(canvasRenamingElementId)

	if (!canvasRenamingElementId || !element || element.id !== canvasRenamingElementId) {
		return null
	}

	return <ElementRenameOverlayRender key={element.id} elementId={canvasRenamingElementId} />
}
