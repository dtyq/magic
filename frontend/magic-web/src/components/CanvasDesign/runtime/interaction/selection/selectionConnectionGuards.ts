import type { Canvas } from "../../core/Canvas"
import { ElementTypeEnum } from "../../document/types"

/** Group 没有单元素 Handle，但作为多选根仍可参与文档连接。 */
export function canSelectionRootConnect(canvas: Canvas, elementId: string): boolean {
	if (!canvas.elementManager.hasElement(elementId)) return false
	if (!canvas.elementManager.isElementVisibleInDataTree(elementId)) return false

	const element = canvas.elementManager.getElementData(elementId)
	if (!element) return false
	if (element.type !== ElementTypeEnum.Group) {
		return canvas.permissionManager.canConnect(element)
	}

	return (
		(canvas.elementManager.canParticipateInDocumentRelations?.(elementId) ?? true) &&
		element.interactionConfig?.connectable !== false
	)
}
