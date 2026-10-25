import type { FrontmatterSourceReplacement } from "@/components/tiptap-node/frontmatter-node/frontmatter-node-utils"
import type {
	Content,
	EditorEvents,
	AnyExtension,
	Editor,
} from "@/infrastructure/editors/tiptap/react"
import type { CharacterCountOptions } from "@/infrastructure/editors/tiptap/extensions"
import type { SlashDropdownMenuProps } from "@/components/tiptap-ui-primitive/SlashDropdownMenu"

export interface SimpleEditorProps {
	/** Embedded editors can use inline Markdown shortcuts without a full toolbar. */
	showToolbar?: boolean
	content?: Content
	/** Preview-only position mapping; does not update the editor document. */
	onFrontmatterSourceMap?: (ranges: FrontmatterSourceReplacement[], content: string) => void
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
	 * Enable or disable search and replace functionality
	 * @default true
	 */
	enableSearchReplace?: boolean
	/** Enable the read-only search panel and global Cmd/Ctrl+F shortcut. @default false */
	enableReadonlySearch?: boolean
	/** Cached tabs pass their visibility down so only the active preview handles global shortcuts. */
	isTabActive?: boolean
	/**
	 * Enable the persisted wrap toggle for read-only code blocks.
	 * @default false
	 */
	enableCodeBlockWrap?: boolean
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
	/**
	 * Lets the editor expand with its content so the browser page owns scrolling.
	 * @default false
	 */
	documentFlow?: boolean
}

export interface SimpleEditorRef {
	editor: Editor | null
	/** Set editor content */
	setContent: (content: string) => void
}
