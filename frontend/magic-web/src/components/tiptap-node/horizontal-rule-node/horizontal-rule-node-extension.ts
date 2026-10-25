import { mergeAttributes } from "@/infrastructure/editors/tiptap/react"
import TiptapHorizontalRule from "@/infrastructure/editors/tiptap/extension-horizontal-rule"

export const HorizontalRule = TiptapHorizontalRule.extend({
	renderHTML() {
		return [
			"div",
			mergeAttributes(this.options.HTMLAttributes, { "data-type": this.name }),
			["hr"],
		]
	},
})

export default HorizontalRule
