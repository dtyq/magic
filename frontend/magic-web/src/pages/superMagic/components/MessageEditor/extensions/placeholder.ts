import { Editor, Extension, isNodeEmpty } from "@tiptap/core"
import { Node as ProsemirrorNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		placeholder: {
			/**
			 * Update placeholder text dynamically without losing focus
			 */
			updatePlaceholder: (
				newPlaceholder: string | ((props: PlaceholderProps) => string),
			) => ReturnType
		}
	}
}

export interface PlaceholderOptions {
	/**
	 * **The class name for the empty editor**
	 * @default 'is-editor-empty'
	 */
	emptyEditorClass: string

	/**
	 * **The class name for empty nodes**
	 * @default 'is-empty'
	 */
	emptyNodeClass: string

	/**
	 * **The placeholder content**
	 *
	 * You can use a function to return a dynamic placeholder or a string.
	 * @default 'Write something …'
	 */
	placeholder: string | ((props: PlaceholderProps) => string)

	/**
	 * See https://github.com/ueberdosis/tiptap/pull/5278 for more information.
	 * @deprecated This option is no longer respected and this type will be removed in the next major version.
	 */
	considerAnyAsEmpty?: boolean

	/**
	 * **Checks if the placeholder should be only shown when the editor is editable.**
	 *
	 * If true, the placeholder will only be shown when the editor is editable.
	 * If false, the placeholder will always be shown.
	 * @default true
	 */
	showOnlyWhenEditable: boolean

	/**
	 * **Checks if the placeholder should be only shown when the current node is empty.**
	 *
	 * If true, the placeholder will only be shown when the current node is empty.
	 * If false, the placeholder will be shown when any node is empty.
	 * @default true
	 */
	showOnlyCurrent: boolean

	/**
	 * **Controls if the placeholder should be shown for all descendents.**
	 *
	 * If true, the placeholder will be shown for all descendents.
	 * If false, the placeholder will only be shown for the current node.
	 * @default false
	 */
	includeChildren: boolean
}

interface PlaceholderProps {
	editor: Editor
	node: ProsemirrorNode
	pos: number
	hasAnchor: boolean
}

/**
 * This extension allows you to add a placeholder to your editor.
 * A placeholder is a text that appears when the editor or a node is empty.
 * Enhanced version with dynamic placeholder updating without losing focus.
 * @see https://www.tiptap.dev/api/extensions/placeholder
 */
export const Placeholder = Extension.create<
	PlaceholderOptions,
	{
		currentPlaceholderValue: string | ((props: PlaceholderProps) => string) | null
	}
>({
	name: "placeholder",

	addOptions() {
		return {
			emptyEditorClass: "is-editor-empty",
			emptyNodeClass: "is-empty",
			placeholder: "Write something …",
			showOnlyWhenEditable: true,
			showOnlyCurrent: true,
			includeChildren: false,
		}
	},

	addStorage() {
		return {
			currentPlaceholderValue: null as string | ((props: PlaceholderProps) => string) | null,
		}
	},

	onCreate() {
		// Initialize the current placeholder value for this editor instance
		this.storage.currentPlaceholderValue = this.options.placeholder
	},

	addCommands() {
		return {
			updatePlaceholder:
				(newPlaceholder: string | ((props: PlaceholderProps) => string)) =>
				({ editor }) => {
					// Update the storage for this editor instance
					this.storage.currentPlaceholderValue = newPlaceholder

					// Check if editor view is ready before dispatching transaction
					if (!editor.view || editor.isDestroyed) {
						return true
					}

					// Use requestAnimationFrame to ensure the view is fully initialized
					// and avoid race conditions with other state updates
					requestAnimationFrame(() => {
						if (editor.isDestroyed || !editor.view) {
							return
						}

						try {
							// iOS Safari doesn't re-evaluate attr(data-placeholder) in ::before content
							// when the attribute changes. Force a CSS repaint by toggling a class.
							const { view } = editor
							const { dom } = view

							// The dom IS the ProseMirror element itself (with class 'ProseMirror')
							// Find the first empty paragraph that would display the placeholder
							const emptyNode = dom.querySelector(
								".is-editor-empty",
							) as HTMLElement | null

							if (emptyNode) {
								// Force CSS recalculation by temporarily removing and re-adding the class
								// This makes iOS Safari re-evaluate the ::before content with the new data-placeholder
								const originalClassName = emptyNode.className
								emptyNode.className = ""
								// Force a synchronous layout recalculation
								void emptyNode.offsetHeight
								emptyNode.className = originalClassName
								// Force another layout recalculation
								void emptyNode.offsetHeight
							}
						} catch (error) {
							console.warn("Failed to update placeholder decoration:", error)
						}
					})

					return true
				},
		}
	},

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey("placeholder"),
				props: {
					decorations: ({ doc, selection }) => {
						const active = this.editor.isEditable || !this.options.showOnlyWhenEditable
						const { anchor } = selection
						const decorations: Decoration[] = []

						if (!active) {
							return null
						}

						let isEmptyDoc = this.editor.isEmpty

						if (
							(this.editor.storage as { markdown?: { getMarkdown: () => string } })
								?.markdown
						) {
							const mdContent =
								(
									this.editor.storage as {
										markdown?: { getMarkdown: () => string }
									}
								).markdown?.getMarkdown() ?? ""
							isEmptyDoc = isEmptyDoc && !mdContent.length
						}

						// Only show placeholder when editor is completely empty
						if (!isEmptyDoc) {
							return null
						}

						// Use current placeholder value from storage if available, otherwise fall back to options
						const placeholderValue =
							this.storage.currentPlaceholderValue ?? this.options.placeholder

						doc.descendants((node, pos) => {
							const hasAnchor = anchor >= pos && anchor <= pos + node.nodeSize
							const isEmpty = !node.isLeaf && isNodeEmpty(node)

							if ((hasAnchor || !this.options.showOnlyCurrent) && isEmpty) {
								const classes = [
									this.options.emptyNodeClass,
									this.options.emptyEditorClass,
								]

								const decoration = Decoration.node(pos, pos + node.nodeSize, {
									class: classes.join(" "),
									"data-placeholder":
										typeof placeholderValue === "function"
											? placeholderValue({
													editor: this.editor,
													node,
													pos,
													hasAnchor,
												})
											: placeholderValue,
								})

								decorations.push(decoration)
							}

							return this.options.includeChildren
						})

						return DecorationSet.create(doc, decorations)
					},
				},
			}),
		]
	},
})
