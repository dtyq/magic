import type { Canvas } from "../../core/Canvas"
import type { LayerElement } from "../../document/types"
import type { BaseElement } from "../../elements/core/BaseElement"

/**
 * 返回可编辑的元素名称。
 *
 * 名称标签可以把生成状态等运行时后缀拼到展示文本中，但这些后缀不属于 DSL
 * 的 data.name，不能作为重命名输入的初始值或提交值。
 */
export function getEditableElementName(
	element: LayerElement | undefined,
	elementInstance?: BaseElement,
): string {
	return (
		element?.name ||
		elementInstance?.getNameLabelContent().primaryText ||
		elementInstance?.getRenderName() ||
		""
	)
}

export function getEditableElementNameById(canvas: Canvas, elementId: string): string {
	return getEditableElementName(
		canvas.elementManager.getElementData(elementId),
		canvas.elementManager.getElementInstance(elementId),
	)
}

export function normalizeElementName(value: string): string {
	return value.trim()
}
