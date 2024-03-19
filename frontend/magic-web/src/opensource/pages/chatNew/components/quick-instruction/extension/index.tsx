import type { JSONContent } from "@tiptap/core"
import { mergeAttributes, Node } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import type { HTMLAttributes } from "react"
import { InstructionType } from "@/opensource/types/bot"
import { jsonParse } from "@/opensource/utils/string"
import { addDocWrapper } from "./utils"
import QuickInstructionSelectorNodeRender from "./QuickInstructionSelectorNodeRender"
import { ExtensionName } from "./constants"
import { transformQuickInstruction } from "../utils"
import { generateRichText } from "../../ChatSubSider/utils"

type Options = {
	inSubSider?: boolean
	templateMode?: boolean
	disabled?: boolean
	HTMLAttributes: HTMLAttributes<HTMLImageElement>
}

const QuickInstructionNodeExtension = Node.create<Options>({
	name: ExtensionName,
	group: "inline",
	inline: true,
	atom: true,
	selectable: true,
	addAttributes() {
		return {
			value: {
				default: "",
				isRequired: true,
			},
			instruction: {
				default: null,
			},
		}
	},
	parseHTML() {
		return [
			{
				tag: `span[data-type="${ExtensionName}"]`,
			},
		]
	},
	renderHTML({ HTMLAttributes }) {
		return [
			"span",
			mergeAttributes(HTMLAttributes, {
				"data-type": ExtensionName,
			}),
		]
	},

	addNodeView() {
		return ReactNodeViewRenderer(QuickInstructionSelectorNodeRender)
	},
	renderText({ node }) {
		switch (node.attrs.instruction?.type) {
			case InstructionType.SINGLE_CHOICE:
				return node.attrs.value ?? ""
			case InstructionType.SWITCH:
				const richText = transformQuickInstruction(
					jsonParse<JSONContent>(
						JSON.stringify(
							addDocWrapper(
								jsonParse<JSONContent[]>(node.attrs.instruction.content, []),
							),
						),
						{
							type: "doc",
							content: [],
						},
					),
					(n) => {
						n.type = "text"
						n.text =
							node.attrs?.instruction?.[node.attrs?.value] ??
							node.attrs?.value ??
							"on"
						n.attrs = {}
					},
				)
				return generateRichText(JSON.stringify(richText), "text")
			case InstructionType.TEXT:
				return generateRichText(
					JSON.stringify(
						addDocWrapper(jsonParse<JSONContent[]>(node.attrs.instruction.content, [])),
					),
					"text",
				)
			default:
				return node.attrs.value ?? ""
		}
	},
})

/** 模板模式 */
export const QuickInstructionNodeTemplateExtension = QuickInstructionNodeExtension.configure({
	templateMode: true,
})

/** 禁用模式 */
export const QuickInstructionNodeDisabledExtension = QuickInstructionNodeExtension.configure({
	disabled: true,
})

/** 聊天列表中渲染 */
export const QuickInstructionNodeChatSubSiderExtension = QuickInstructionNodeExtension.configure({
	disabled: true,
	inSubSider: true,
})

export default QuickInstructionNodeExtension
