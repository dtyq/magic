import { useMemo } from "react"
import MessageHistoryRender from "./MessageHistoryRender"
import { useCanvasUI } from "../../context/CanvasUIContext"
import { useCanvasElement } from "../../hooks/useCanvasElement"
import { ElementTypeEnum, type ImageElement } from "../../canvas/types"

export default function MessageHistory() {
	const { messageHistoryElementId } = useCanvasUI()

	// 根据 messageHistoryElementId 获取元素数据
	const element = useCanvasElement(messageHistoryElementId)

	// 验证元素类型和是否有生成请求
	const imageElement = useMemo(() => {
		if (!messageHistoryElementId || !element) return null
		if (element.id !== messageHistoryElementId) return null
		if (element.type !== ElementTypeEnum.Image) return null
		if (!element.generateImageRequest) return null
		return element as ImageElement
	}, [messageHistoryElementId, element])

	if (!imageElement) return null

	return <MessageHistoryRender imageElement={imageElement} />
}
