import { useMemo } from "react"
import ImageCropPanelRender from "./ImageCropPanelRender"
import { useCanvasModeUI } from "../../context/CanvasUIContext"
import { useCanvasElement } from "../../hooks/useCanvasElement"
import { ElementTypeEnum, type ImageElement } from "../../canvas/types"

export default function ImageCropPanel() {
	const { croppingElementId } = useCanvasModeUI()

	// 根据 croppingElementId 获取元素数据
	const element = useCanvasElement(croppingElementId)

	// 验证元素类型
	const imageElement = useMemo(() => {
		if (!croppingElementId || !element) return null
		if (element.id !== croppingElementId) return null
		if (element.type !== ElementTypeEnum.Image) return null
		return element as ImageElement
	}, [croppingElementId, element])

	if (!imageElement) return null

	return <ImageCropPanelRender imageElement={imageElement} />
}
