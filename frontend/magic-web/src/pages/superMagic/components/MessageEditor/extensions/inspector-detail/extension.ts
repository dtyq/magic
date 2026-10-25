import { getClipboardPlainText } from "@/pages/superMagic/components/MessageList/utils/mentionClipboard"
import { Node, mergeAttributes } from "@/infrastructure/editors/tiptap/core"
import { ReactNodeViewRenderer } from "@/infrastructure/editors/tiptap/react"
import { INSPECTOR_DETAIL_TYPE } from "./const"
import type { InspectorDetailOptions } from "./types"
import { InspectorDetailComponent } from "./component"
import { createMagicNodeDragPlugin } from "../node-drag"

/**
 * Renders a compact inline selection chip; details open in an independent popover.
 */
export const InspectorDetailExtension = Node.create<InspectorDetailOptions>({
	name: INSPECTOR_DETAIL_TYPE,
	group: "inline",
	inline: true,
	atom: true,
	selectable: true,
	// Pointer Events handles custom node dragging; native draggable would show a
	// browser/system drag cursor and can be mistaken for a file upload.
	draggable: false,

	addAttributes() {
		return {
			sourceType: {
				default: "html",
				parseHTML: (el) =>
					el.getAttribute("data-source-type") === "markdown" ? "markdown" : "html",
				renderHTML: (attrs) => ({ "data-source-type": attrs.sourceType }),
			},
			markdownSource: {
				default: null,
				parseHTML: (el) => {
					const raw = el.getAttribute("data-markdown-source")
					if (!raw) return null
					try {
						return JSON.parse(raw)
					} catch {
						return null
					}
				},
				renderHTML: (attrs) =>
					attrs.markdownSource
						? { "data-markdown-source": JSON.stringify(attrs.markdownSource) }
						: {},
			},
			title: {
				default: "",
				parseHTML: (el) => el.getAttribute("data-title") ?? "",
				renderHTML: (attrs) => ({ "data-title": attrs.title }),
			},
			selector: {
				default: "",
				parseHTML: (el) => el.getAttribute("data-selector") ?? "",
				renderHTML: (attrs) => ({ "data-selector": attrs.selector }),
			},
			tagName: {
				default: "",
				parseHTML: (el) => el.getAttribute("data-tag-name") ?? "",
				renderHTML: (attrs) => ({ "data-tag-name": attrs.tagName }),
			},
			size: {
				default: "",
				parseHTML: (el) => el.getAttribute("data-size") ?? "",
				renderHTML: (attrs) => ({ "data-size": attrs.size }),
			},
			computedStyles: {
				default: "{}",
				parseHTML: (el) => el.getAttribute("data-computed-styles") ?? "{}",
				renderHTML: (attrs) => ({ "data-computed-styles": attrs.computedStyles }),
			},
			styleCount: {
				default: 0,
				parseHTML: (el) => Number(el.getAttribute("data-style-count")) || 0,
				renderHTML: (attrs) => ({ "data-style-count": String(attrs.styleCount) }),
			},
			textContent: {
				default: "",
				parseHTML: (el) => el.getAttribute("data-text-content") ?? "",
				renderHTML: (attrs) => ({ "data-text-content": attrs.textContent }),
			},
			elementAttributes: {
				default: "{}",
				parseHTML: (el) => el.getAttribute("data-element-attributes") ?? "{}",
				renderHTML: (attrs) => ({ "data-element-attributes": attrs.elementAttributes }),
			},
			resource: {
				default: "",
				parseHTML: (el) => el.getAttribute("data-resource") ?? "",
				renderHTML: (attrs) => ({ "data-resource": attrs.resource }),
			},
			domContext: {
				default: "{}",
				parseHTML: (el) => el.getAttribute("data-dom-context") ?? "{}",
				renderHTML: (attrs) => ({ "data-dom-context": attrs.domContext }),
			},
			elementHtml: {
				default: "",
				parseHTML: (el) => el.getAttribute("data-element-html") ?? "",
				renderHTML: (attrs) => ({ "data-element-html": attrs.elementHtml }),
			},
			selectorMatchCount: {
				default: -1,
				parseHTML: (el) => {
					const value = el.getAttribute("data-selector-match-count")
					return value === null ? -1 : Number(value)
				},
				renderHTML: (attrs) => ({
					"data-selector-match-count": String(attrs.selectorMatchCount),
				}),
			},
			fileMention: {
				default: null,
				parseHTML: (el) => {
					const raw = el.getAttribute("data-file-mention")
					if (!raw) return null
					try {
						return JSON.parse(raw)
					} catch {
						return null
					}
				},
				renderHTML: (attrs) =>
					attrs.fileMention
						? { "data-file-mention": JSON.stringify(attrs.fileMention) }
						: {},
			},
			screenshotMention: {
				default: null,
				parseHTML: (el) => {
					const raw = el.getAttribute("data-screenshot-mention")
					if (!raw) return null
					try {
						return JSON.parse(raw)
					} catch {
						return null
					}
				},
				renderHTML: (attrs) =>
					attrs.screenshotMention
						? { "data-screenshot-mention": JSON.stringify(attrs.screenshotMention) }
						: {},
			},
			captureId: {
				default: null,
				parseHTML: (el) =>
					el.getAttribute("data-capture-id") ?? el.getAttribute("data-target-id"),
				renderHTML: (attrs) =>
					attrs.captureId ? { "data-capture-id": attrs.captureId } : {},
			},
		}
	},

	parseHTML() {
		return [{ tag: `[data-type="${this.name}"]` }]
	},

	renderHTML({ HTMLAttributes }) {
		return [
			"span",
			mergeAttributes({ "data-type": this.name }, HTMLAttributes),
			"[Element Inspector Detail]",
		]
	},

	renderText({ node }) {
		return getClipboardPlainText({ type: "doc", content: [node.toJSON()] })
	},

	addNodeView() {
		return ReactNodeViewRenderer(InspectorDetailComponent)
	},

	addProseMirrorPlugins() {
		return [createMagicNodeDragPlugin(this.options)]
	},

	addCommands() {
		return {
			insertInspectorDetail:
				(attrs) =>
				({ commands }) => {
					return commands.insertContent({
						type: this.name,
						attrs,
					})
				},
		}
	},
})
