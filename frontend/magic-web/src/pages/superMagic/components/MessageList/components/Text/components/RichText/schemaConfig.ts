// Schema configuration for ProseMirror RichText rendering
// Based on the reference implementation in chatNew

import { getMentionDisplayName } from "@/components/business/MentionPanel/tiptap-plugin/types"
import { SuperPlaceholderExtension } from "@/pages/superMagic/components/MessageEditor/extensions"
import { getDisplayText } from "@/pages/superMagic/components/MessageEditor/extensions/super-placeholder/utils"
import { MentionItemType } from "@/components/business/MentionPanel/types"

export default {
	nodes: {
		doc: {
			content: "block+",
		},
		paragraph: {
			group: "block",
			content: "inline*",
			parseDOM: [{ tag: "p" }],
			toDOM: () => ["p", 0],
		},
		text: {
			group: "inline",
		},
		mention: {
			inline: true,
			group: "inline",
			attrs: {
				type: {
					default: "",
				},
				data: {
					default: null,
				},
			},
			parseDOM: [
				{
					tag: "span.magic-mention",
					getAttrs: (dom: HTMLElement) => ({
						type: dom.getAttribute("data-type"),
						data: JSON.parse(dom.getAttribute("data-data") || "{}"),
					}),
				},
			],
			toDOM: (node: any) => {
				const { type } = node.attrs
				let label = getMentionDisplayName(node.attrs)

				if (type === MentionItemType.FOLDER) {
					label = `${label}/`
				}
				return [
					"span",
					{
						class: "magic-mention",
						"data-type": type,
						"data-data": JSON.stringify(node.attrs.data),
					},
					`@${label}`,
				]
			},
		},
		hardBreak: {
			inline: true,
			group: "inline",
			selectable: false,
			parseDOM: [{ tag: "br" }],
			toDOM: () => ["br"],
		},
		[SuperPlaceholderExtension.name]: {
			inline: true,
			group: "inline",
			atom: true,
			selectable: true,
			attrs: {
				type: {
					default: "input",
				},
				props: {
					default: {},
				},
				_direction: {
					default: null,
				},
			},
			parseDOM: [
				// Primary parsing rule - matches the extension's main format
				{
					tag: `span[data-type="${SuperPlaceholderExtension.name}"]`,
					getAttrs: (dom: HTMLElement) => {
						const propsStr = dom.getAttribute("data-props")
						let props = {}

						if (propsStr && propsStr !== "[object Object]") {
							try {
								props = JSON.parse(propsStr)
							} catch (error) {
								console.warn("Failed to parse props in parseDOM:", error)
							}
						}

						// Fallback to individual attributes if props parsing fails
						if (!props || Object.keys(props).length === 0) {
							props = {
								placeholder: dom.getAttribute("data-placeholder") || "",
								defaultValue: dom.getAttribute("data-default-value") || "",
								value: dom.getAttribute("data-value") || "",
							}
						}

						return {
							type: dom.getAttribute("data-input-type") || "input",
							props,
						}
					},
				},
				// Fallback for legacy formats or simplified HTML
				{
					tag: "span.super-placeholder",
					getAttrs: (dom: HTMLElement) => {
						// Only parse if it doesn't already have data-type (to avoid conflicts)
						if (dom.getAttribute("data-type")) return false

						return {
							type: "input",
							props: {
								placeholder: dom.getAttribute("data-placeholder") || "",
								defaultValue: dom.getAttribute("data-default-value") || "",
								value: dom.getAttribute("data-value") || "",
							},
						}
					},
				},
				// Additional fallback for class-based identification
				{
					tag: `span[class*="super-placeholder"]`,
					getAttrs: (dom: HTMLElement) => {
						// Only parse if it doesn't already have data-type (to avoid conflicts)
						if (dom.getAttribute("data-type")) return false

						return {
							type: "input",
							props: {
								placeholder: dom.getAttribute("data-placeholder") || "",
								defaultValue: dom.getAttribute("data-default-value") || "",
								value: dom.getAttribute("data-value") || "",
							},
						}
					},
				},
			],
			toDOM: (node: any) => {
				const { type, props } = node.attrs

				const safeProps = {
					placeholder: props?.placeholder || "",
					defaultValue: props?.defaultValue || "",
					value: props?.value || "",
				}

				return [
					"span",
					{
						"data-type": SuperPlaceholderExtension.name,
						class: "super-placeholder",
						"data-input-type": type,
						"data-props": JSON.stringify(safeProps),
						"data-placeholder": safeProps.placeholder,
						"data-default-value": safeProps.defaultValue,
						"data-value": safeProps.value,
					},
					getDisplayText(node.attrs),
				]
			},
		},
	},
	marks: {
		// Add any text formatting marks here if needed
	},
}

export const richTextNode = ["mention", SuperPlaceholderExtension.name]
