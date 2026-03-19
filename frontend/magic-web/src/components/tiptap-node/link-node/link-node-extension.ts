import { Link as TiptapLink } from "@tiptap/extension-link"
import { mergeAttributes } from "@tiptap/core"
import { Plugin, TextSelection } from "@tiptap/pm/state"
import { parseAnchorLink, scrollToAnchor } from "@/utils/slug"

export interface LinkNodeOptions {
	/**
	 * HTML attributes to add to the link element
	 */
	HTMLAttributes?: Record<string, string | number | boolean | undefined>
	/**
	 * Whether to open links on click
	 * @default false
	 */
	openOnClick?: boolean
	/**
	 * Whether to enable click selection
	 * @default true
	 */
	enableClickSelection?: boolean
}

/**
 * Enhanced Link extension with markdown syntax support
 * Supports standard markdown link formats:
 * - [text](url)
 * - [text](url "title")
 * - [text][ref]
 */
export const LinkNode = TiptapLink.extend<LinkNodeOptions>({
	addOptions() {
		return {
			...this.parent?.(),
			openOnClick: false,
			enableClickSelection: true,
			HTMLAttributes: {
				target: "_blank",
				rel: "noopener noreferrer",
			},
		}
	},

	addAttributes() {
		return {
			...this.parent?.(),
			href: {
				default: null,
				parseHTML: (element) => element.getAttribute("href"),
				renderHTML: (attributes) => {
					if (!attributes.href) return {}
					return { href: attributes.href }
				},
			},
			target: {
				default: this.options.HTMLAttributes?.target || "_blank",
				parseHTML: (element) => element.getAttribute("target"),
				renderHTML: (attributes) => {
					if (!attributes.target) return {}
					return { target: attributes.target }
				},
			},
			rel: {
				default: this.options.HTMLAttributes?.rel || "noopener noreferrer",
				parseHTML: (element) => element.getAttribute("rel"),
				renderHTML: (attributes) => {
					if (!attributes.rel) return {}
					return { rel: attributes.rel }
				},
			},
			title: {
				default: null,
				parseHTML: (element) => element.getAttribute("title"),
				renderHTML: (attributes) => {
					// Always include title attribute if it exists, even if empty string
					// This ensures the preview tooltip works correctly
					if (attributes.title === null || attributes.title === undefined) return {}
					return { title: String(attributes.title) }
				},
			},
		}
	},

	parseHTML() {
		return [
			{
				tag: "a[href]",
				getAttrs: (element) => {
					if (typeof element === "string") return false
					const href = element.getAttribute("href")
					if (!href) return false
					return {
						href,
						title: element.getAttribute("title"),
						target: element.getAttribute("target"),
						rel: element.getAttribute("rel"),
					}
				},
			},
		]
	},

	renderHTML({ HTMLAttributes }) {
		// Ensure title attribute is properly included for preview tooltip
		const mergedAttributes = mergeAttributes(this.options.HTMLAttributes || {}, HTMLAttributes)
		return ["a", mergedAttributes, 0]
	},

	addProseMirrorPlugins() {
		return [
			new Plugin({
				props: {
					handleDOMEvents: {
						click: (view, event) => {
							const target = event.target as HTMLElement
							const linkElement = target.closest("a")

							if (!linkElement) return false

							const href = linkElement.getAttribute("href")
							if (!href) return false

							// Handle readonly mode (preview mode)
							if (!view.editable) {
								// Check if it's an anchor link
								const { filePath, anchor } = parseAnchorLink(href)

								// Pure anchor link (e.g., #heading)
								if (!filePath && anchor) {
									event.preventDefault()
									event.stopPropagation()
									scrollToAnchor(anchor, 80) // 80px offset for fixed headers
									return true
								}

								// Link with anchor (e.g., file.md#heading or http://example.com#section)
								// If it's a pure file path with anchor but no protocol, let custom handler deal with it
								// For external URLs with anchors, let default browser behavior handle it
								if (filePath && anchor && !filePath.startsWith("http")) {
									// Let the link navigate normally or be handled by parent components
									// The anchor will be processed after navigation
									return false
								}

								// For all other cases in readonly mode, allow default link behavior
								return false
							}

							// Editable mode: select link for editing
							event.preventDefault()
							event.stopPropagation()

							// Select the link text for editing
							const pos = view.posAtDOM(linkElement, 0)
							if (pos !== null) {
								const { state } = view
								const $pos = state.doc.resolve(pos)
								const linkMark = state.schema.marks.link

								if (linkMark && this.options.enableClickSelection) {
									// Find the range of the link mark
									const from = $pos.start()
									const to = $pos.end()

									// Extend selection to cover the entire link
									// This will trigger selectionUpdate event which updates link state
									const transaction = state.tr.setSelection(
										TextSelection.create(state.doc, from, to),
									)
									view.dispatch(transaction)
								}
							}

							return true
						},
					},
				},
			}),
		]
	},

	addCommands() {
		return {
			...this.parent?.(),
			setLink:
				(attributes) =>
					({ chain }) => {
						return chain().extendMarkRange("link").setMark(this.name, attributes).run()
					},
			toggleLink:
				(attributes) =>
					({ chain }) => {
						return chain()
							.extendMarkRange("link")
							.toggleMark(this.name, attributes, { extendEmptyMarkRange: true })
							.run()
					},
			unsetLink:
				() =>
					({ chain }) => {
						return chain().extendMarkRange("link").unsetMark(this.name).run()
					},
		}
	},
})

export default LinkNode
