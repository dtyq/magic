import ImageEraserPanelRender from "./ImageEraserPanelRender"
import { useCanvasModeUI } from "../../context/CanvasUIContext"

export default function ImageEraserPanel() {
	const { erasingElementId } = useCanvasModeUI()

	if (!erasingElementId) return null

	return <ImageEraserPanelRender />
}
