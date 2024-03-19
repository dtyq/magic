import type { Content, EditorEvents, AnyExtension, Editor } from "@tiptap/react"
import type { CharacterCountOptions } from "@tiptap/extensions"
import type { SlashDropdownMenuProps } from "@/opensource/components/tiptap-ui-primitive/SlashDropdownMenu"

export interface SimpleEditorProps {
	content?: Content
	characterCountConfig?: Partial<CharacterCountOptions>
	onUpdate?: (update: EditorEvents["update"]) => void
	onContentChange?: (content: string) => void
	/**
	 * Custom handler for Cmd/Ctrl+S keypress
	 */
	onSave?: (editor: Editor | null) => void
	slashConfig?: SlashDropdownMenuProps["config"]
	placeholder?: string
	className?: string
	/**
	 * Additional Tiptap extensions to include
	 * These will be added after the default extensions
	 */
	additionalExtensions?: AnyExtension[]
	/**
	 * Enable or disable drag handle functionality
	 * @default true
	 */
	enableDragHandle?: boolean
	/**
	 * Enable or disable editor editability
	 * @default true
	 */
	isEditable?: boolean
	/**
	 * Whether the editor is mobile
	 * @default false
	 */
	isMobile?: boolean
}

export interface SimpleEditorRef {
	editor: Editor | null
	/** Set editor content */
	setContent: (content: string) => void
}
