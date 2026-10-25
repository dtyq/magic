import { Extension, Mark, Node, mergeAttributes } from "@/infrastructure/editors/tiptap/core"
import { isSafeInlineStyle } from "../../../utils"

function parseSafeStyle(element: HTMLElement): string | null {
	const style = element.getAttribute("style")
	return style && isSafeInlineStyle(style) ? style : null
}

/**
 * Attributes can enter the editor through ProseMirror JSON, bypassing
 * parseHTML. Re-check style at serialization time so persisted or
 * collaborative content cannot inject unsafe CSS into the preview DOM.
 */
function getSafeStyleAttributes(attributes: Record<string, unknown>) {
	const style = attributes.style
	return typeof style === "string" && isSafeInlineStyle(style) ? { style } : {}
}

/**
 * ProseMirror unwraps unknown div/span elements while parsing Markdown's raw
 * HTML. These extensions retain presentation-only inline styles after the
 * Markdown safety pass, without making arbitrary CSS part of the schema.
 */
export const SafeHtmlDiv = Node.create({
	name: "safeHtmlDiv",
	priority: 110,
	group: "block",
	content: "block+",
	defining: true,

	addAttributes() {
		return {
			style: {
				default: null,
				parseHTML: (element) => parseSafeStyle(element),
			},
		}
	},

	parseHTML() {
		return [
			{
				tag: "div[style]",
				getAttrs: (node) => {
					if (!(node instanceof HTMLElement) || node.querySelector("img")) return false
					return parseSafeStyle(node) ? null : false
				},
			},
		]
	},

	renderHTML({ HTMLAttributes }) {
		return [
			"div",
			mergeAttributes(getSafeStyleAttributes(HTMLAttributes as Record<string, unknown>)),
			0,
		]
	},
})

export const SafeHtmlSpan = Mark.create({
	name: "safeHtmlSpan",

	addAttributes() {
		return {
			style: {
				default: null,
				parseHTML: (element) => parseSafeStyle(element),
			},
		}
	},

	parseHTML() {
		return [
			{
				tag: "span[style]",
				getAttrs: (node) =>
					node instanceof HTMLElement && parseSafeStyle(node) ? null : false,
			},
		]
	},

	renderHTML({ HTMLAttributes }) {
		return [
			"span",
			mergeAttributes(getSafeStyleAttributes(HTMLAttributes as Record<string, unknown>)),
			0,
		]
	},
})

export const SafeHtmlTextBlockStyles = Extension.create({
	name: "safeHtmlTextBlockStyles",

	addGlobalAttributes() {
		return [
			{
				types: [
					"paragraph",
					"heading",
					"bulletList",
					"orderedList",
					"listItem",
					"blockquote",
				],
				attributes: {
					style: {
						default: null,
						parseHTML: (element) => parseSafeStyle(element),
						renderHTML: (attributes) =>
							getSafeStyleAttributes(attributes as Record<string, unknown>),
					},
				},
			},
		]
	},
})
