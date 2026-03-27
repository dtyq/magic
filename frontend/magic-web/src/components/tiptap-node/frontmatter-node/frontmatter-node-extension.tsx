import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import MarkdownFrontmatterNodeView from "./frontmatter-node-view"
import {
	decodeMarkdownFrontmatterRaw,
	encodeMarkdownFrontmatterRaw,
	MARKDOWN_FRONTMATTER_DATA_TYPE,
	MARKDOWN_FRONTMATTER_NODE_NAME,
	parseEditableMarkdownFrontmatter,
	serializeMarkdownFrontmatter,
} from "./frontmatter-node-utils"

declare module "@tiptap/react" {
	interface Commands<ReturnType> {
		markdownFrontmatter: {
			toggleFrontmatterAtStart: (raw?: string) => ReturnType
		}
	}
}

export const MarkdownFrontmatterNode = Node.create({
	name: MARKDOWN_FRONTMATTER_NODE_NAME,

	group: "block",

	atom: true,

	draggable: false,

	selectable: true,

	defining: true,

	isolating: true,

	addAttributes() {
		return {
			raw: {
				default: "",
				parseHTML: (element: HTMLElement) =>
					decodeMarkdownFrontmatterRaw(element.getAttribute("data-frontmatter-raw")),
				renderHTML: (attributes: { raw?: string }) => ({
					"data-frontmatter-raw": encodeMarkdownFrontmatterRaw(attributes.raw ?? ""),
				}),
			},
		}
	},

	parseHTML() {
		return [{ tag: `div[data-type="${MARKDOWN_FRONTMATTER_DATA_TYPE}"]` }]
	},

	renderHTML({ HTMLAttributes }) {
		return [
			"div",
			mergeAttributes(HTMLAttributes, {
				"data-type": MARKDOWN_FRONTMATTER_DATA_TYPE,
			}),
		]
	},

	addNodeView() {
		return ReactNodeViewRenderer(MarkdownFrontmatterNodeView)
	},

	addCommands() {
		return {
			toggleFrontmatterAtStart:
				(raw = "") =>
				({ state, dispatch }) => {
					const tr = state.tr
					const firstNode = state.doc.firstChild

					if (firstNode?.type.name === this.name) {
						tr.delete(0, firstNode.nodeSize)

						if (tr.doc.childCount === 0) {
							const paragraphNode = state.schema.nodes.paragraph?.create()
							if (paragraphNode) tr.insert(0, paragraphNode)
						}

						dispatch?.(tr.scrollIntoView())
						return true
					}

					tr.insert(
						0,
						this.type.create({
							raw: parseEditableMarkdownFrontmatter(raw),
						}),
					)
					dispatch?.(tr.scrollIntoView())
					return true
				},
		}
	},

	addStorage() {
		return {
			markdown: {
				serialize(
					state: {
						write: (content: string) => void
						closeBlock: (node: unknown) => void
					},
					node: { attrs?: { raw?: string } },
				) {
					state.write(serializeMarkdownFrontmatter(node.attrs?.raw ?? ""))
					state.closeBlock(node)
				},
			},
		}
	},
})

export default MarkdownFrontmatterNode
