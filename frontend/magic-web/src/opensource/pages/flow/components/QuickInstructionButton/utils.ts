import type { JSONContent } from "@tiptap/core"

/**
 * 将内容组合成一个 doc 节点
 * @param content - 内容
 * @returns 组合后的内容
 */
export const combindContent = (content: string | undefined) => {
	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: content ? JSON.parse(content) : [],
			},
		],
	}
}

/** 取出需要的子节点 */
export const pickContent = (content: JSONContent) => {
	return content.content?.[0]?.content
}
