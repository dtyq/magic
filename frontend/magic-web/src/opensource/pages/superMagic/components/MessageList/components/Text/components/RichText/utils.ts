import type { JSONContent } from "@tiptap/core"
import { isArray, isObject } from "lodash-es"
import { richTextNode } from "./schemaConfig"

const MAX_RECURSION_DEPTH = 50

/**
 * 递归遍历所有节点，获取所有节点的类型
 * @param data JSONContent数据
 * @param typeArray 类型集合
 * @param depth 递归深度
 * @returns 节点类型集合
 */
export function transformAllNodes(
	data: JSONContent,
	typeArray: Set<string> = new Set(),
	depth = 0,
) {
	if (depth >= MAX_RECURSION_DEPTH) return typeArray
	if (!data) return typeArray

	if (data.type) {
		typeArray.add(data.type)
	}

	if (!data.content) {
		return typeArray
	}

	data.content.forEach((item) => {
		transformAllNodes(item, typeArray, depth + 1)
	})

	return typeArray
}

/**
 * 替换节点内容
 * @param content - 内容
 * @param matcher - 匹配器
 * @param updateContent - 更新内容
 * @returns 替换后的内容
 */
export async function transformJSONContent(
	content: JSONContent | JSONContent[] | undefined,
	matcher: (content: JSONContent) => boolean = () => true,
	updateContent: ((content: JSONContent) => Promise<void> | void) | undefined = undefined,
) {
	if (!content) return content
	if (isArray(content)) {
		await Promise.all(
			content.map(async (node) => {
				await transformJSONContent(node, matcher, updateContent)
			}),
		)
	} else if (isObject(content)) {
		if (matcher(content)) {
			await updateContent?.(content)
		}
		await transformJSONContent(content.content, matcher, updateContent)
	}
	return content
}

/**
 * 检测是否是纯文本
 * @param content 内容
 * @returns 是否是纯文本
 */
export const isOnlyText = (content?: JSONContent) => {
	if (!content) return true

	const typeArray = transformAllNodes(content)
	// 如果包含富文本节点，则认为不是纯文本
	return richTextNode.every((type) => !typeArray.has(type))
}

/**
 * 安全地解析JSON内容
 * @param content 内容字符串或对象
 * @returns 解析后的JSONContent
 */
export const parseContent = (content: JSONContent | string): JSONContent | null => {
	if (typeof content === "string") {
		try {
			return JSON.parse(content) as JSONContent
		} catch {
			// If JSON parsing fails, treat as plain text
			return {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "text", text: content }],
					},
				],
			}
		}
	}
	return content as JSONContent
}

/**
 * 验证JSONContent结构
 * @param content JSONContent对象
 * @returns 是否为有效结构
 */
export const isValidJSONContent = (content: any): content is JSONContent => {
	if (!content || typeof content !== "object") return false
	if (!content.type || typeof content.type !== "string") return false
	return true
}
