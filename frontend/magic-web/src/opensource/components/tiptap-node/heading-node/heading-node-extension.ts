import { Heading as TiptapHeading } from "@tiptap/extension-heading"
import { mergeAttributes } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import type { EditorView } from "@tiptap/pm/view"
import { generateUniqueSlug } from "@/opensource/utils/slug"

/**
 * Enhanced Heading extension with automatic anchor ID generation
 * Supports GitHub-style anchor links for headings
 *
 * Strategy: Avoid using appendTransaction during composition
 * Instead, queue updates and apply them after composition ends
 */
const pluginKey = new PluginKey("headingAnchorId")

// Debug logging flag (set to false to disable logs)
const DEBUG = false

interface HeadingEditorState {
	isComposing: boolean
	pendingUpdate: boolean
	updateTimer: NodeJS.Timeout | null
	initTimer: NodeJS.Timeout | null
	compositionTimer: NodeJS.Timeout | null
}

// Store state per editor view
const editorStates = new Map<EditorView, HeadingEditorState>()

function debugLog(...args: unknown[]) {
	if (DEBUG) {
		console.log("[HeadingNode]", ...args)
	}
}

/**
 * Generate or update heading IDs in the document
 * @param view - Editor view
 */
function updateHeadingIds(view: EditorView): void {
	const state = view.state
	const { tr } = state
	const idSet = new Set<string>()
	let modified = false
	const headingNodes: Array<{
		pos: number
		text: string
		oldId: string | null
		newId: string
	}> = []

	// Iterate through all nodes in the document
	state.doc.descendants((node: ProseMirrorNode, pos: number) => {
		// Only process heading nodes
		if (node.type.name !== "heading") {
			return
		}

		// Get heading text content
		const textContent = node.textContent

		if (!textContent) {
			// If heading is empty, remove ID if it exists
			if (node.attrs.id) {
				tr.setNodeMarkup(pos, undefined, {
					...node.attrs,
					id: null,
				})
				modified = true
				debugLog("Removed ID from empty heading at pos", pos)
			}
			return
		}

		// Generate unique ID from text content
		const generatedId = generateUniqueSlug(textContent, idSet)

		// Update node if ID changed or doesn't exist
		if (node.attrs.id !== generatedId) {
			headingNodes.push({
				pos,
				text: textContent,
				oldId: node.attrs.id || null,
				newId: generatedId,
			})
			tr.setNodeMarkup(pos, undefined, {
				...node.attrs,
				id: generatedId,
			})
			modified = true
		}
	})

	if (modified) {
		if (headingNodes.length > 0) {
			debugLog("Updating heading IDs:", headingNodes)
		}
		// Prevent this transaction from being added to history
		tr.setMeta("addToHistory", false)
		view.dispatch(tr)
	}
}

export const HeadingNode = TiptapHeading.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			id: {
				default: null,
				parseHTML: (element) => element.getAttribute("id"),
				renderHTML: (attributes) => {
					if (!attributes.id) return {}
					return { id: attributes.id }
				},
			},
		}
	},

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: pluginKey,
				state: {
					init: () => ({ initialized: false }),
					apply: (tr, value) => {
						if (tr.getMeta("headingAnchorId-initialized")) {
							return { initialized: true }
						}
						return value
					},
				},
				view: (editorView) => {
					const dom = editorView.dom

					// Initialize state for this editor
					const state: HeadingEditorState = {
						isComposing: false,
						pendingUpdate: false,
						updateTimer: null,
						initTimer: null,
						compositionTimer: null,
					}
					editorStates.set(editorView, state)

					// Schedule an update with debounce
					const scheduleUpdate = () => {
						if (state.isComposing) {
							debugLog("scheduleUpdate: skipped - composing")
							state.pendingUpdate = true
							return
						}

						// Clear existing timer
						if (state.updateTimer) {
							clearTimeout(state.updateTimer)
						}

						// Schedule update after a short delay
						state.updateTimer = setTimeout(() => {
							if (!state.isComposing) {
								debugLog("Executing scheduled update")
								updateHeadingIds(editorView)
								state.pendingUpdate = false
							}
						}, 100)
					}

					// Composition event handlers
					const handleCompositionStart = () => {
						state.isComposing = true
						debugLog("Composition started")
					}

					const handleCompositionEnd = () => {
						debugLog("Composition ended")
						// Clear any existing composition timer
						if (state.compositionTimer) {
							clearTimeout(state.compositionTimer)
						}
						// Use setTimeout to ensure composition fully completes
						state.compositionTimer = setTimeout(() => {
							state.isComposing = false
							state.compositionTimer = null
							// If there was a pending update, execute it now
							if (state.pendingUpdate) {
								debugLog("Executing pending update after composition")
								updateHeadingIds(editorView)
								state.pendingUpdate = false
							}
						}, 50)
					}

					dom.addEventListener("compositionstart", handleCompositionStart)
					dom.addEventListener("compositionend", handleCompositionEnd)

					// Initialize IDs on first render
					state.initTimer = setTimeout(() => {
						const pluginState = pluginKey.getState(editorView.state)
						if (!pluginState?.initialized) {
							updateHeadingIds(editorView)
							const tr = editorView.state.tr
							tr.setMeta("headingAnchorId-initialized", true)
							editorView.dispatch(tr)
						}
						state.initTimer = null
					}, 100)

					return {
						update: (view, prevState) => {
							// Only update if document changed
							if (view.state.doc !== prevState.doc) {
								scheduleUpdate()
							}
						},
						destroy: () => {
							if (state.updateTimer) {
								clearTimeout(state.updateTimer)
							}
							if (state.initTimer) {
								clearTimeout(state.initTimer)
							}
							if (state.compositionTimer) {
								clearTimeout(state.compositionTimer)
							}
							dom.removeEventListener("compositionstart", handleCompositionStart)
							dom.removeEventListener("compositionend", handleCompositionEnd)
							editorStates.delete(editorView)
						},
					}
				},
			}),
		]
	},

	renderHTML({ node, HTMLAttributes }) {
		const hasLevel = this.options.levels.includes(node.attrs.level)
		const level = hasLevel ? node.attrs.level : this.options.levels[0]

		return [
			`h${level}`,
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
				id: node.attrs.id || undefined,
			}),
			0,
		]
	},
})

export default HeadingNode
