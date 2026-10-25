import { makeAutoObservable } from "mobx"
import { restoreWechatChatContent } from "../../extensions/wechat-chat-history/transform"
import { Editor, JSONContent } from "@/infrastructure/editors/tiptap/react"
import { isEditorActive, runActiveEditor } from "../../utils/editorLifecycle"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { getMentionUniqueId } from "@/components/business/MentionPanel/tiptap-plugin/types"

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
	/** Keeps programmatically restored Mention nodes valid until the editor consumes them. */
	preserveMentionValidation = false
	/** Keeps trusted Mention nodes from being removed during later draft serialization. */
	preserveMentionContent = false
	/** Tracks Mention identities restored by SDK or draft content across follow-up editor transactions. */
	private trustedMentionIds = new Set<string>()
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
		this.tiptapEditor = isEditorActive(editor) ? editor : null
		if (this.tiptapEditor && this.value !== undefined) {
			// If content was restored before TipTap finished mounting,
			// replay the buffered value into the live editor instance.
			runActiveEditor(this.tiptapEditor, (activeEditor) => {
				activeEditor.commands.setContent(this.value, { emitUpdate: false })
			})
		}
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
		this.preserveMentionValidation = false
		this.preserveMentionContent = false
		this.trustedMentionIds.clear()
		runActiveEditor(this.tiptapEditor, (editor) => {
			editor.commands.clearContent()
		})
	}

	/**
	 * Focus on editor
	 */
	focus() {
		runActiveEditor(this.tiptapEditor, (editor) => {
			editor.commands.focus()
		})
	}

	/**
	 * Update content and sync with TipTap editor
	 */
	updateContent(
		content: JSONContent | undefined,
		options: { preserveMentionValidation?: boolean } = {},
	) {
		const restoredContent = content ? restoreWechatChatContent(content) : undefined
		this.value = restoredContent
		if (options.preserveMentionValidation) {
			this.preserveMentionValidation = true
			this.preserveMentionContent = true
			this.trustedMentionIds.clear()
			this.collectTrustedMentionIds(restoredContent)
		} else {
			this.trustedMentionIds.clear()
			this.preserveMentionContent = false
		}
		if (restoredContent) {
			runActiveEditor(this.tiptapEditor, (editor) => {
				editor.commands.setContent(restoredContent)
			})
			// Mention validation runs inside the setContent transaction; release the bypass afterwards.
			queueMicrotask(() => {
				this.preserveMentionValidation = false
			})
		}
	}

	/** Collects stable identities from trusted JSONContent so later node-view transactions retain them. */
	private collectTrustedMentionIds(content: JSONContent | undefined) {
		if (!content) return
		if (content.type === "mention" && content.attrs) {
			this.trustedMentionIds.add(getMentionUniqueId(content.attrs as TiptapMentionAttributes))
		}
		content.content?.forEach((child) => this.collectTrustedMentionIds(child))
	}

	/** Checks whether a Mention node originated from a trusted SDK or draft restore. */
	isTrustedMention(attrs: TiptapMentionAttributes) {
		return this.trustedMentionIds.has(getMentionUniqueId(attrs))
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
