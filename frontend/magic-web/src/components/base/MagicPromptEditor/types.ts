import type { ReactNode } from "react"
import type { JSONContent, Editor } from "@/infrastructure/editors/tiptap/react"
import type { MentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin/types"

export interface MagicPromptEditorRef {
	/** Get the underlying tiptap editor instance */
	getEditor: () => Editor | null
	/** Get content as JSON */
	getJSON: () => JSONContent | undefined
	/** Get content as plain text (mention nodes replaced with @name) */
	getText: () => string
	/** Set content from JSON */
	setContent: (content: JSONContent) => void
	/** Clear editor content */
	clear: () => void
	/** Focus the editor */
	focus: () => void
}

export interface MagicPromptEditorProps {
	/** Editor content as JSON (controlled) */
	value?: JSONContent
	/** Plain text value — used when JSON is not available. Converted to paragraph content. */
	textValue?: string
	/** Called when content changes */
	onChange?: (json: JSONContent) => void
	/** Called when plain text content changes (text with @mentions preserved as @name) */
	onTextChange?: (text: string) => void
	/** Placeholder text */
	placeholder?: string
	/** Whether the editor is disabled / read-only */
	disabled?: boolean
	/** Minimum height in px */
	minHeight?: number
	/** Maximum height in px (enables scroll) */
	maxHeight?: number
	/** Enable @mention panel */
	enableMention?: boolean
	/** Custom mention panel store — defaults to GlobalMentionPanelStore */
	mentionPanelStore?: MentionPanelStore
	/** Callback when a mention is inserted */
	onMentionInsert?: (attrs: TiptapMentionAttributes) => void
	/** Callback when a mention is removed */
	onMentionRemove?: (attrs: TiptapMentionAttributes) => void
	/** Enable AI polish feature (button in top-right) */
	enableAIPolish?: boolean
	/** Custom AI polish function — receives text content, returns polished text.
	 *  If not provided, built-in AiLLMService will be used with an internal model selector.
	 *  Must preserve @mention markers (e.g. text between special tokens). */
	onAIPolish?: (text: string, mentionNodes: MentionNodeInfo[]) => Promise<string>
	/** Enable inline voice input button */
	enableVoice?: boolean
	/** Extra className for the container */
	className?: string
	/** Number of visible rows (controls min-height via line-height) */
	rows?: number
	/** Called when the editor loses focus */
	onBlur?: () => void
	/** Custom toolbar content rendered below the editor area (e.g. model selector, file picker) */
	bottomToolbar?: ReactNode
}

/** Information about a mention node in the document, used for AI polish preservation */
export interface MentionNodeInfo {
	/** Position in the document */
	pos: number
	/** The mention attributes */
	attrs: TiptapMentionAttributes
	/** Placeholder token used in the text sent to AI (e.g. {{MENTION_0}}) */
	placeholder: string
}
