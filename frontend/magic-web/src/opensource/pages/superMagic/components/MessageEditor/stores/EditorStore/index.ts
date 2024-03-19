import { makeAutoObservable } from "mobx"
import { Editor, JSONContent } from "@tiptap/react"

/**
 * Check if JSONContent is empty
 */
function isEmptyJSONContent(content: JSONContent | undefined): boolean {
	if (!content) return true
	if (!content.content || content.content.length === 0) return true

	// Check if content only contains empty paragraphs
	const hasContent = content.content.some((node) => {
		if (node.type === "paragraph") {
			return node.content && node.content.length > 0
		}
		return true
	})

	return !hasContent
}

/**
 * EditorStore - Manages editor core state
 *
 * Responsibilities:
 * - Manage editor content (value)
 * - Manage TipTap editor instance
 * - Handle composition state (for IME input)
 * - Handle OAuth progress state
 * - Provide computed values like isEmpty
 */
export class EditorStore {
	value: JSONContent | undefined = undefined
	tiptapEditor: Editor | null = null
	isComposing = false
	isOAuthInProgress = false
	placeholder = ""

	constructor() {
		makeAutoObservable(
			this,
			{},
			{
				autoBind: true,
			},
		)
	}

	/**
	 * Computed - Check if content is empty
	 */
	get isEmpty(): boolean {
		return isEmptyJSONContent(this.value)
	}

	/**
	 * Set editor content value
	 */
	setValue(content: JSONContent | undefined) {
		this.value = content
	}

	/**
	 * Set TipTap editor instance
	 */
	setEditor(editor: Editor | null) {
		this.tiptapEditor = editor
	}

	/**
	 * Set placeholder text
	 */
	setPlaceholder(text: string) {
		this.placeholder = text
	}

	/**
	 * Clear all content
	 */
	clearContent() {
		this.value = undefined
		this.tiptapEditor?.commands.clearContent()
	}

	/**
	 * Focus on editor
	 */
	focus() {
		this.tiptapEditor?.commands.focus()
	}

	/**
	 * Update content and sync with TipTap editor
	 */
	updateContent(content: JSONContent | undefined) {
		this.value = content
		if (content && this.tiptapEditor) {
			this.tiptapEditor.commands.setContent(content)
		}
	}

	/**
	 * Handle composition start (IME input)
	 */
	handleCompositionStart() {
		this.isComposing = true
	}

	/**
	 * Handle composition end (IME input)
	 */
	handleCompositionEnd() {
		this.isComposing = false
	}

	/**
	 * Set OAuth progress state
	 */
	setOAuthInProgress(inProgress: boolean) {
		this.isOAuthInProgress = inProgress
	}

	/**
	 * Dispose resources
	 */
	dispose() {
		// Cleanup if needed
		this.tiptapEditor = null
	}
}
