import {
	CodeBlock as TiptapCodeBlock,
	type CodeBlockOptions as TiptapCodeBlockOptions,
} from "@/infrastructure/editors/tiptap/extension-code-block"
import { ReactNodeViewRenderer } from "@/infrastructure/editors/tiptap/react"
import CodeBlockNodeView from "./code-block-node-view"

export interface CodeBlockNodeOptions extends TiptapCodeBlockOptions {
	enableWrapToggle: boolean
}

/**
 * Custom CodeBlock node extension
 * Extends the official Tiptap CodeBlock with custom React rendering
 * - Editable mode: uses default rendering for editing
 * - Read-only mode: uses MagicCode component for syntax highlighting and copy functionality
 */
export const CodeBlockNode = TiptapCodeBlock.extend<CodeBlockNodeOptions>({
	addOptions() {
		return {
			...this.parent?.(),
			enableWrapToggle: false,
		}
	},

	addNodeView() {
		return ReactNodeViewRenderer(CodeBlockNodeView, {
			contentDOMElementTag: "code",
		})
	},
})

export default CodeBlockNode
