import type Konva from "konva"

export const NAME_LABEL_GROUP_PREFIX = "name-label-"
export const NAME_LABEL_HIT_NAME = "name-label-hit"
export const NAME_LABEL_TEXT_NAME = "name-label-text"
export const NAME_LABEL_SUFFIX_NAME = "name-label-suffix"
export const NAME_LABEL_ICON_NAME = "name-label-icon"
export const NAME_LABEL_COMPLIANCE_HIT_NAME = "name-label-compliance-hit"
export const NAME_LABEL_RENAME_ICON_NAME = "name-label-rename-icon"
export const NAME_LABEL_RENAME_HIT_NAME = "name-label-rename-hit"

/**
 * 从 Konva 命中节点沿父链解析名称标签对应的元素 ID。
 * overlay 上的名称标签不在元素 Group 内，不能走元素节点的 id 反查。
 */
export function getNameLabelElementIdFromNode(node: Konva.Node | null | undefined): string | null {
	let current: Konva.Node | null | undefined = node
	while (current) {
		const name = current.name()
		if (name.startsWith(NAME_LABEL_GROUP_PREFIX)) {
			const elementId = name.slice(NAME_LABEL_GROUP_PREFIX.length)
			return elementId || null
		}
		current = current.getParent()
	}
	return null
}
