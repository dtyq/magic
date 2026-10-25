import { useCanvasRenameUI } from "../../../app/providers/CanvasUIProvider"
import { useCanvasElement } from "../../../app/hooks/canvas"
import ImageRenamePanel from "./ImageRenamePanel"
import { isImageElementContent } from "../../../runtime/document/elementContent"
import SingleImageRenamePanel from "./SingleImageRenamePanel"
import ElementRenamePanel from "./ElementRenamePanel"

export default function ElementRenameOverlay() {
	const { canvasRenamingElementId } = useCanvasRenameUI()
	const element = useCanvasElement(canvasRenamingElementId)

	if (!canvasRenamingElementId || !element || element.id !== canvasRenamingElementId) {
		return null
	}

	if (isImageElementContent(element)) {
		return element.contents.length > 1 ? (
			<ImageRenamePanel key={element.id} element={element} />
		) : (
			<SingleImageRenamePanel key={element.id} element={element} />
		)
	}
	return <ElementRenamePanel key={element.id} element={element} />
}
