import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import i18next from "i18next"
import { SUPER_PLACEHOLDER_TYPE } from "../super-placeholder/const"
import { isWechatInstruction } from "./parser"
import { WECHAT_CHAT_HISTORY } from "./types"

const END = "</magic-wechat-chat-history>"
const INSTRUCTION_PREFIX = "Instructions for this chat: "
const START =
	/^<magic-wechat-chat-history id="([a-f\d-]{36})" source-count="(\d+)" instruction-count="(\d+)">$/i
const paragraph = (text: string): JSONContent => ({
	type: "paragraph",
	content: [{ type: "text", text }],
})
const paragraphText = (node: JSONContent): string | undefined =>
	node.type === "paragraph" && node.content?.every((child) => child.type === "text")
		? node.content.map((child) => child.text ?? "").join("")
		: undefined

export function wechatInstruction(placeholder: string, value = ""): JSONContent {
	return {
		type: "paragraph",
		attrs: { wechatInstruction: true },
		content: [
			{
				type: SUPER_PLACEHOLDER_TYPE,
				attrs: { type: "input", props: { placeholder, value, defaultValue: "" } },
			},
		],
	}
}

export function createWechatChat(content: JSONContent[], placeholder: string): JSONContent {
	return {
		type: WECHAT_CHAT_HISTORY,
		attrs: { id: crypto.randomUUID() },
		content: [...content, wechatInstruction(placeholder)],
	}
}

/** 只展开微信自身的可选引导，原有模板的必填校验仍由发送流程执行。 */
export function serializeWechatInstruction(node: JSONContent): JSONContent {
	if (node.type === SUPER_PLACEHOLDER_TYPE) {
		const props = node.attrs?.props as { value?: string; defaultValue?: string } | undefined
		const text = props?.value ?? props?.defaultValue ?? ""
		return text ? { type: "text", text } : { type: "text", text: "" }
	}
	return {
		...node,
		...(node.content
			? {
					content: node.content
						.map(serializeWechatInstruction)
						.filter((child) => child.type !== "text" || child.text),
				}
			: {}),
	}
}

/** 数量按原生段落计算，来源正文里的类似标签不会截断区块。服务端只收到已有节点。 */
export function serializeWechatChatContent(doc: JSONContent): JSONContent {
	if (!doc.content) return doc
	return {
		...doc,
		content: doc.content.flatMap((node) => {
			if (node.type !== WECHAT_CHAT_HISTORY) return [serializeWechatChatContent(node)]
			const children = node.content ?? []
			const hasInstruction = isWechatInstruction(children.at(-1) ?? {})
			const source = hasInstruction ? children.slice(0, -1) : children
			const instruction = hasInstruction
				? [serializeWechatInstruction(children[children.length - 1])]
				: []
			const nonempty = instruction
				.filter((item) => item.content?.length)
				.map((item) => ({
					...item,
					content: [{ type: "text", text: INSTRUCTION_PREFIX }, ...(item.content ?? [])],
				}))
			return [
				paragraph(
					`<magic-wechat-chat-history id="${node.attrs?.id}" source-count="${source.length}" instruction-count="${nonempty.length}">`,
				),
				...source,
				...nonempty,
				paragraph(END),
			]
		}),
	}
}

export function restoreWechatChatContent(
	doc: JSONContent,
	placeholder = i18next.t("wechatChat.instructionPlaceholder", { ns: "super" }),
): JSONContent {
	if (!doc.content) return doc
	const nodes = doc.content.map((node) => restoreWechatChatContent(node, placeholder))
	const content: JSONContent[] = []
	for (let index = 0; index < nodes.length; index++) {
		const match = paragraphText(nodes[index])?.match(START)
		if (!match) {
			content.push(nodes[index])
			continue
		}
		const sourceCount = Number(match[2])
		const instructionCount = Number(match[3])
		const end = index + sourceCount + instructionCount + 1
		if (
			!Number.isSafeInteger(end) ||
			end >= nodes.length ||
			sourceCount < 1 ||
			instructionCount > 1 ||
			paragraphText(nodes[end]) !== END ||
			nodes.slice(index + 1, end).some((node) => node.type !== "paragraph")
		) {
			content.push(nodes[index])
			continue
		}
		const source = nodes.slice(index + 1, index + 1 + sourceCount)
		// 处理要求继续是同一区块内的原生输入节点；保留周围的普通正文及 mention 属性。
		const instruction = instructionCount ? nodes[index + 1 + sourceCount] : undefined
		const inline = [...(instruction?.content ?? [])]
		if (inline[0]?.type === "text" && inline[0].text?.startsWith(INSTRUCTION_PREFIX))
			inline[0] = { ...inline[0], text: inline[0].text.slice(INSTRUCTION_PREFIX.length) }
		const value = inline.map((node) => node.text ?? "").join("")
		const restoredInstruction = inline.some((node) => node.type !== "text")
			? {
					type: "paragraph",
					attrs: { wechatInstruction: true },
					content: [
						...inline.filter((node) => node.text || node.type !== "text"),
						...(wechatInstruction(placeholder).content ?? []),
					],
				}
			: wechatInstruction(placeholder, value)
		content.push({
			type: WECHAT_CHAT_HISTORY,
			attrs: { id: match[1] },
			content: [...source, restoredInstruction],
		})
		index = end
	}
	return { ...doc, content }
}
