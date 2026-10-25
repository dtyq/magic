import { Node, mergeAttributes } from "@/infrastructure/editors/tiptap/core"
import { ReactNodeViewRenderer } from "@/infrastructure/editors/tiptap/react"
import {
	PROMPT_PRESET_VALUE_NODE_NAME,
	PROMPT_PRESET_VALUE_TOKEN,
} from "@/pages/superMagic/components/MainInputContainer/panels/promptRichText"
import PromptPresetValueNodeView from "./PromptPresetValueNodeView"

declare module "@/infrastructure/editors/tiptap/core" {
	interface Commands<ReturnType> {
		promptPresetValue: {
			insertPromptPresetValue: () => ReturnType
		}
	}
}

export const PromptPresetValueExtension = Node.create({
	name: PROMPT_PRESET_VALUE_NODE_NAME,
	group: "inline",
	inline: true,
	atom: true,
	selectable: true,

	addAttributes() {
		return {
			token: {
				default: PROMPT_PRESET_VALUE_TOKEN,
			},
		}
	},

	parseHTML() {
		return [{ tag: "span[data-prompt-preset-value]" }]
	},

	renderHTML({ HTMLAttributes }) {
		return [
			"span",
			mergeAttributes(HTMLAttributes, {
				"data-prompt-preset-value": HTMLAttributes.token ?? PROMPT_PRESET_VALUE_TOKEN,
			}),
			PROMPT_PRESET_VALUE_TOKEN,
		]
	},

	renderText({ node }) {
		return node.attrs.token ?? PROMPT_PRESET_VALUE_TOKEN
	},

	addCommands() {
		return {
			insertPromptPresetValue:
				() =>
				({ commands }) =>
					commands.insertContent({
						type: this.name,
						attrs: { token: PROMPT_PRESET_VALUE_TOKEN },
					}),
		}
	},

	addNodeView() {
		return ReactNodeViewRenderer(PromptPresetValueNodeView)
	},
})
