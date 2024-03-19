import type { QuickInstruction } from "@/opensource/types/bot"
import type { JSONContent } from "@tiptap/core"
import { ExtensionName } from "./constants"

/** 生成模板指令节点 */
export const genTemplateInstructionNode = (instruction?: QuickInstruction, value?: string) => {
	return {
		type: ExtensionName,
		attrs: {
			instruction,
			value: value ?? "",
		},
	}
}

/**
 * 添加 doc 包裹
 * @param content
 * @returns
 */
export const addDocWrapper = (content: JSONContent[] = []) => {
	return {
		type: "doc",
		content,
	}
}
