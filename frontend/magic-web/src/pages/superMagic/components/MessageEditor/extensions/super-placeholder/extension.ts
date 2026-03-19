import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import type { SuperPlaceholderAttrs, SuperPlaceholderOptions } from "./types"
import { SuperPlaceholderComponent } from "./component"
import {
	getDisplayText,
	sanitizeSuperPlaceholderAttrs,
	navigateToNextSuperPlaceholder,
	navigateToPreviousSuperPlaceholder,
	focusFirstSuperPlaceholder,
} from "./utils"
import { SUPER_PLACEHOLDER_TYPE } from "./const"

// TipTap Super Placeholder 扩展
export const SuperPlaceholderExtension = Node.create<SuperPlaceholderOptions>({
	name: SUPER_PLACEHOLDER_TYPE,
	group: "inline",
	inline: true,
	atom: true,
	selectable: true,
	draggable: false,

	addOptions() {
		return {
			size: "default",
		}
	},

	addStorage() {
		return {
			size: this.options.size,
		}
	},

	addAttributes() {
		return {
			type: {
				default: "input",
				parseHTML: (element) => element.getAttribute("data-input-type") || "input",
				renderHTML: (attributes) => {
					return {
						"data-input-type": attributes.type,
					}
				},
			},
			props: {
				default: {},
				parseHTML: (element) => {
					const propsStr = element.getAttribute("data-props")
					if (propsStr && propsStr !== "[object Object]") {
						try {
							return JSON.parse(propsStr)
						} catch (error) {
							console.warn("Failed to parse props in addAttributes:", error)
						}
					}
					// Fallback to individual attributes
					return {
						placeholder: element.getAttribute("data-placeholder") || "",
						defaultValue: element.getAttribute("data-default-value") || "",
						value: element.getAttribute("data-value") || "",
					}
				},
				renderHTML: (attributes) => {
					const safeProps = {
						placeholder: attributes.props?.placeholder || "",
						defaultValue: attributes.props?.defaultValue || "",
						value: attributes.props?.value || "",
					}
					return {
						"data-props": JSON.stringify(safeProps),
						"data-placeholder": safeProps.placeholder,
						"data-default-value": safeProps.defaultValue,
						"data-value": safeProps.value,
					}
				},
			},
			size: {
				default: this.options.size,
				parseHTML: (element) => {
					const dataSize = element.getAttribute("data-size")
					// Return parsed size if valid, otherwise fall back to extension options
					return ["default", "small", "mobile"].includes(dataSize || "")
						? dataSize
						: this.options.size
				},
				renderHTML: (attributes) => {
					const size = attributes.size || this.options.size
					return {
						"data-size": size,
					}
				},
			},
		}
	},

	parseHTML() {
		return [
			{
				tag: `span[data-type="${this.name}"]`,
			},
			// Fallback for legacy formats or simplified HTML
			{
				tag: "span.super-placeholder",
			},
			// Additional fallback for class-based identification
			{
				tag: `span[class*="super-placeholder"]`,
				getAttrs: (element) => {
					if (typeof element === "string") return false
					// Only parse if it doesn't already have data-type (to avoid conflicts)
					if (element.getAttribute("data-type")) return false
					return {}
				},
			},
		]
	},

	renderHTML({ HTMLAttributes, node }) {
		const attrs = node.attrs as SuperPlaceholderAttrs

		return [
			"span",
			mergeAttributes(
				{
					"data-type": this.name,
					class: "super-placeholder",
				},
				HTMLAttributes,
			),
			getDisplayText(attrs),
		]
	},

	addNodeView() {
		return ReactNodeViewRenderer(SuperPlaceholderComponent)
	},

	addKeyboardShortcuts() {
		return {
			ArrowLeft: ({ editor }) => {
				const { selection } = editor.state
				const { from } = selection

				// Check if cursor is at the start of a text node and next to a super-placeholder
				if (from > 0) {
					const beforeNode = editor.state.doc.nodeAt(from - 1)
					if (beforeNode?.type.name === SUPER_PLACEHOLDER_TYPE) {
						const nodePos = from - 1

						// First update the attribute
						const tr = editor.state.tr
						tr.setNodeMarkup(nodePos, undefined, {
							...beforeNode.attrs,
							_direction: "from-right",
						})
						editor.view.dispatch(tr)

						// Then select the node
						setTimeout(() => {
							editor.commands.setNodeSelection(nodePos)

							// Clear direction after component has time to read it
							setTimeout(() => {
								const tr2 = editor.state.tr
								const currentNode = editor.state.doc.nodeAt(nodePos)
								if (currentNode?.type.name === SUPER_PLACEHOLDER_TYPE) {
									const attrs = { ...currentNode.attrs }
									delete attrs._direction
									tr2.setNodeMarkup(nodePos, undefined, attrs)
									editor.view.dispatch(tr2)
								}
							}, 200)
						}, 10)

						return true // Prevent default behavior
					}
				}
				return false
			},
			ArrowRight: ({ editor }) => {
				const { selection } = editor.state
				const { from } = selection

				// Check if cursor is before a super-placeholder
				const nextNode = editor.state.doc.nodeAt(from)
				if (nextNode?.type.name === SUPER_PLACEHOLDER_TYPE) {
					// First update the attribute
					const tr = editor.state.tr
					tr.setNodeMarkup(from, undefined, {
						...nextNode.attrs,
						_direction: "from-left",
					})
					editor.view.dispatch(tr)

					// Then select the node
					setTimeout(() => {
						editor.commands.setNodeSelection(from)

						// Clear direction after component has time to read it
						setTimeout(() => {
							const tr2 = editor.state.tr
							const currentNode = editor.state.doc.nodeAt(from)
							if (currentNode?.type.name === SUPER_PLACEHOLDER_TYPE) {
								const attrs = { ...currentNode.attrs }
								delete attrs._direction
								tr2.setNodeMarkup(from, undefined, attrs)
								editor.view.dispatch(tr2)
							}
						}, 200)
					}, 10)

					return true // Prevent default behavior
				}
				return false
			},
			Tab: ({ editor }) => {
				// Check if there are multiple SuperPlaceholder nodes
				const doc = editor.state.doc
				let superPlaceholderCount = 0

				doc.descendants((node) => {
					if (node.type.name === SUPER_PLACEHOLDER_TYPE) {
						superPlaceholderCount++
					}
					return superPlaceholderCount < 2
				})

				// Only handle Tab navigation if there are multiple SuperPlaceholders
				if (superPlaceholderCount > 1) {
					const { selection } = editor.state
					const nodeAtSelection = doc.nodeAt(selection.from)

					// Only handle if current selection is within a SuperPlaceholder
					if (nodeAtSelection?.type.name === SUPER_PLACEHOLDER_TYPE) {
						return navigateToNextSuperPlaceholder(editor)
					}
				}

				return false
			},
			"Shift-Tab": ({ editor }) => {
				// Check if there are multiple SuperPlaceholder nodes
				const doc = editor.state.doc
				let superPlaceholderCount = 0

				doc.descendants((node) => {
					if (node.type.name === SUPER_PLACEHOLDER_TYPE) {
						superPlaceholderCount++
					}
					return superPlaceholderCount < 2
				})

				// Only handle Shift+Tab navigation if there are multiple SuperPlaceholders
				if (superPlaceholderCount > 1) {
					const { selection } = editor.state
					const nodeAtSelection = doc.nodeAt(selection.from)

					// Only handle if current selection is within a SuperPlaceholder
					if (nodeAtSelection?.type.name === SUPER_PLACEHOLDER_TYPE) {
						return navigateToPreviousSuperPlaceholder(editor)
					}
				}

				return false
			},
		}
	},

	addCommands() {
		return {
			insertSuperPlaceholder:
				(attrs: Partial<SuperPlaceholderAttrs>) =>
				({ commands }) => {
					// Ensure size is set from attrs or fall back to extension options
					const finalAttrs = {
						...attrs,
						size: attrs.size || this.options.size,
					}
					const sanitizedAttrs = sanitizeSuperPlaceholderAttrs(finalAttrs)

					console.log("Inserting super placeholder with attrs:", sanitizedAttrs)

					return commands.insertContent({
						type: this.name,
						attrs: sanitizedAttrs,
					})
				},
			focusFirstSuperPlaceholder:
				() =>
				({ editor }) => {
					return focusFirstSuperPlaceholder(editor)
				},
			updateSuperPlaceholderSize:
				(size: "default" | "small" | "mobile") =>
				({ editor }) => {
					this.storage.size = size
					this.options.size = size

					// Update all existing super-placeholder nodes with the new size
					const tr = editor.state.tr
					let updated = false

					editor.state.doc.descendants((node, pos) => {
						if (node.type.name === SUPER_PLACEHOLDER_TYPE) {
							tr.setNodeMarkup(pos, undefined, {
								...node.attrs,
								size,
							})
							updated = true
						}
					})

					if (updated) {
						editor.view.dispatch(tr)
					}

					return true
				},
		}
	},

	// Convert to plain text for export
	renderText({ node }) {
		const attrs = node.attrs as SuperPlaceholderAttrs
		return getDisplayText(attrs)
	},
})

export default SuperPlaceholderExtension
