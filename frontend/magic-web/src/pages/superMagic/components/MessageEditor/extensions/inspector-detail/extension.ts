import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { INSPECTOR_DETAIL_TYPE } from "./const"
import type { InspectorDetailAttrs, InspectorDetailOptions } from "./types"
import { InspectorDetailComponent } from "./component"

/**
 * Renders element-inspector context (selector, size, styles, text preview)
 * as a collapsible block inside the message editor.
 */
export const InspectorDetailExtension = Node.create<InspectorDetailOptions>({
	name: INSPECTOR_DETAIL_TYPE,
	group: "block",
	atom: true,
	selectable: true,
	draggable: false,

	addAttributes() {
		return {
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
		}
	},

	parseHTML() {
		return [{ tag: `div[data-type="${this.name}"]` }]
	},

	renderHTML({ HTMLAttributes }) {
		return [
			"div",
			mergeAttributes({ "data-type": this.name }, HTMLAttributes),
			"[Element Inspector Detail]",
		]
	},

	renderText({ node }) {
		const attrs = node.attrs as InspectorDetailAttrs
		const lines: string[] = []

		if (attrs.title) lines.push(attrs.title)
		if (attrs.selector) lines.push(`selector: ${attrs.selector}`)
		if (attrs.size) lines.push(`size: ${attrs.size}`)

		if (attrs.computedStyles && attrs.computedStyles !== "{}") {
			try {
				const styles = JSON.parse(attrs.computedStyles) as Record<string, string>
				const pairs = Object.entries(styles).map(([k, v]) => `${k}: ${v}`)
				if (pairs.length > 0) lines.push(`computedStyles: ${pairs.join("; ")}`)
			} catch {
				// Fallback: raw value
				lines.push(`computedStyles: ${attrs.computedStyles}`)
			}
		}

		if (attrs.textContent) lines.push(`textContent: "${attrs.textContent}"`)

		return lines.length > 0 ? `${lines.join("\n")}\n` : ""
	},

	addNodeView() {
		return ReactNodeViewRenderer(InspectorDetailComponent)
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
