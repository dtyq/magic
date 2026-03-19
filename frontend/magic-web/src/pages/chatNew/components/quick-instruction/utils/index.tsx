import type { JSONContent } from "@tiptap/core"
import { isArray, isObject } from "lodash-es"
import { ExtensionName } from "../extension/constants"

/**
 * 替换快捷指令节点
 * @param content - 内容
 * @param quickInstructionNodeAttrs - 快捷指令节点
 * @returns 替换后的内容
 */
export function transformQuickInstruction(
	content: JSONContent | JSONContent[] | undefined,
	updateQuickInstructionNode: (content: JSONContent) => void,
) {
	if (!content) return content
	if (isArray(content)) {
		content.forEach((node) => {
			transformQuickInstruction(node, updateQuickInstructionNode)
		})
	} else if (isObject(content)) {
		if (content.type === ExtensionName) {
			updateQuickInstructionNode(content)
		}
		transformQuickInstruction(content.content, updateQuickInstructionNode)
	}
	return content
}

/**
 * 替换已存在的快捷指令
 * @param content - 内容
 * @param quickInstructionName - 快捷指令名称
 * @param quickInstructionValue - 快捷指令值
 * @returns 替换后的内容
 */
export function replaceExistQuickInstruction(
	content: JSONContent | JSONContent[] | undefined,
	compareFn: (attrs?: Record<string, unknown>) => boolean,
	newValue: string,
): boolean {
	let found = false

	// 处理数组类型
	if (Array.isArray(content)) {
		content.forEach((item) => {
			if (replaceExistQuickInstruction(item, compareFn, newValue)) {
				found = true
			}
		})
		return found
	}

	// 处理对象类型
	if (content?.type === ExtensionName && content.attrs && compareFn(content.attrs)) {
		content.attrs.value = newValue
		found = true
	}

	// 递归处理子节点
	if (content?.content && Array.isArray(content.content)) {
		content.content.forEach?.((child: JSONContent) => {
			if (replaceExistQuickInstruction(child, compareFn, newValue)) {
				found = true
			}
		})
	}

	return found
}
