// Schema configuration for ProseMirror RichText rendering
// Based on the reference implementation in chatNew

import {
	getMentionDisplayName,
	type TiptapMentionAttributes,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import { SuperPlaceholderExtension } from "@/pages/superMagic/components/MessageEditor/extensions"
import { getDisplayText } from "@/pages/superMagic/components/MessageEditor/extensions/super-placeholder/utils"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { INSPECTOR_DETAIL_TYPE } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/const"
import type { MarkdownSelectionSource } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/types"
import { WECHAT_CHAT_HISTORY } from "@/pages/superMagic/components/MessageEditor/extensions/wechat-chat-history/types"

function safeParseJsonAttr(value: string | null) {
	if (!value) return null
	try {
		return JSON.parse(value)
	} catch {
		return null
	}
}

interface SchemaNodeWithAttrs<TAttrs> {
	attrs: TAttrs
}

interface SuperPlaceholderSchemaAttrs extends Record<string, unknown> {
	type?: string
	props?: {
		placeholder?: string
		defaultValue?: string
		value?: string
	}
}

interface InspectorDetailSchemaAttrs extends Record<string, unknown> {
	sourceType?: "html" | "markdown"
	markdownSource?: MarkdownSelectionSource | null
	title?: string
	selector?: string
	tagName?: string
	size?: string
	computedStyles?: string
	styleCount?: number
	textContent?: string
	fileMention?: TiptapMentionAttributes | null
	screenshotMention?: TiptapMentionAttributes | null
	captureId?: string | null
	elementAttributes?: string
	resource?: string
	domContext?: string
	elementHtml?: string
	selectorMatchCount?: number
}

export default {
	nodes: {
		[WECHAT_CHAT_HISTORY]: {
			group: "block",
			content: "paragraph+",
			attrs: { id: { default: null } },
			parseDOM: [
				{
					tag: `section[data-type="${WECHAT_CHAT_HISTORY}"]`,
					getAttrs: (dom: HTMLElement) => ({ id: dom.getAttribute("data-chat-id") }),
				},
			],
			toDOM: (node: SchemaNodeWithAttrs<{ id: string }>) => [
				"section",
				{ "data-type": WECHAT_CHAT_HISTORY, "data-chat-id": node.attrs.id },
				0,
			],
		},
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
			toDOM: (node: SchemaNodeWithAttrs<TiptapMentionAttributes>) => {
				const { type } = node.attrs
				let label = getMentionDisplayName(node.attrs)

				if (
					type === MentionItemType.FOLDER ||
					type === MentionItemType.MEMORY_DIRECTORY ||
					type === MentionItemType.USER_DIRECTORY
				) {
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
			toDOM: (node: SchemaNodeWithAttrs<SuperPlaceholderSchemaAttrs>) => {
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
		[INSPECTOR_DETAIL_TYPE]: {
			inline: true,
			group: "inline",
			atom: true,
			selectable: true,
			attrs: {
				sourceType: { default: "html" },
				markdownSource: { default: null },
				title: { default: "" },
				selector: { default: "" },
				tagName: { default: "" },
				size: { default: "" },
				computedStyles: { default: "{}" },
				styleCount: { default: 0 },
				textContent: { default: "" },
				fileMention: { default: null },
				screenshotMention: { default: null },
				captureId: { default: null },
				elementAttributes: { default: "{}" },
				resource: { default: "" },
				domContext: { default: "{}" },
				elementHtml: { default: "" },
				selectorMatchCount: { default: -1 },
			},
			parseDOM: [
				{
					tag: `[data-type="${INSPECTOR_DETAIL_TYPE}"]`,
					getAttrs: (dom: HTMLElement) => ({
						sourceType:
							dom.getAttribute("data-source-type") === "markdown"
								? "markdown"
								: "html",
						markdownSource: safeParseJsonAttr(dom.getAttribute("data-markdown-source")),
						title: dom.getAttribute("data-title") || "",
						selector: dom.getAttribute("data-selector") || "",
						tagName: dom.getAttribute("data-tag-name") || "",
						size: dom.getAttribute("data-size") || "",
						computedStyles: dom.getAttribute("data-computed-styles") || "{}",
						styleCount: Number(dom.getAttribute("data-style-count")) || 0,
						textContent: dom.getAttribute("data-text-content") || "",
						fileMention: safeParseJsonAttr(dom.getAttribute("data-file-mention")),
						screenshotMention: safeParseJsonAttr(
							dom.getAttribute("data-screenshot-mention"),
						),
						captureId:
							dom.getAttribute("data-capture-id") ||
							dom.getAttribute("data-target-id") ||
							null,
						elementAttributes: dom.getAttribute("data-element-attributes") || "{}",
						resource: dom.getAttribute("data-resource") || "",
						domContext: dom.getAttribute("data-dom-context") || "{}",
						elementHtml: dom.getAttribute("data-element-html") || "",
						selectorMatchCount: Number(
							dom.getAttribute("data-selector-match-count") ?? -1,
						),
					}),
				},
			],
			toDOM: (node: SchemaNodeWithAttrs<InspectorDetailSchemaAttrs>) => {
				return [
					"span",
					{
						"data-type": INSPECTOR_DETAIL_TYPE,
						"data-source-type": node.attrs.sourceType,
						"data-markdown-source": node.attrs.markdownSource
							? JSON.stringify(node.attrs.markdownSource)
							: undefined,
						"data-title": node.attrs.title,
						"data-selector": node.attrs.selector,
						"data-tag-name": node.attrs.tagName,
						"data-size": node.attrs.size,
						"data-computed-styles": node.attrs.computedStyles,
						"data-style-count": String(node.attrs.styleCount),
						"data-text-content": node.attrs.textContent,
						"data-file-mention": node.attrs.fileMention
							? JSON.stringify(node.attrs.fileMention)
							: undefined,
						"data-screenshot-mention": node.attrs.screenshotMention
							? JSON.stringify(node.attrs.screenshotMention)
							: undefined,
						"data-capture-id": node.attrs.captureId || undefined,
						"data-element-attributes": node.attrs.elementAttributes,
						"data-resource": node.attrs.resource,
						"data-dom-context": node.attrs.domContext,
						"data-element-html": node.attrs.elementHtml,
						"data-selector-match-count": String(node.attrs.selectorMatchCount ?? -1),
						class: "inspector-detail-node",
					},
					"[Element Inspector Detail]",
				]
			},
		},
	},
	marks: {
		// Add any text formatting marks here if needed
	},
}

export const richTextNode = ["mention", SuperPlaceholderExtension.name, INSPECTOR_DETAIL_TYPE]
