import { useMemo } from "react"
import ImageExtendPanelRender from "./ImageExtendPanelRender"
import { useCanvasModeUI } from "../../context/CanvasUIContext"
import { useCanvasElement } from "../../hooks/useCanvasElement"
import { ElementTypeEnum, type ImageElement } from "../../canvas/types"

export default function ImageExtendPanel() {
	const { extendingElementId } = useCanvasModeUI()

	const element = useCanvasElement(extendingElementId)

	const imageElement = useMemo(() => {
		if (!extendingElementId || !element) return null
		if (element.id !== extendingElementId) return null
		if (element.type !== ElementTypeEnum.Image) return null
		return element as ImageElement
	}, [extendingElementId, element])

	if (!imageElement) return null

	return <ImageExtendPanelRender imageElement={imageElement} />
}
