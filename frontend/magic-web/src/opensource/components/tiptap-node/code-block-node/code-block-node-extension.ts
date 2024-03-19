import { CodeBlock as TiptapCodeBlock } from "@tiptap/extension-code-block"
import { ReactNodeViewRenderer } from "@tiptap/react"
import CodeBlockNodeView from "./code-block-node-view"

/**
 * Custom CodeBlock node extension
 * Extends the official Tiptap CodeBlock with custom React rendering
 * - Editable mode: uses default rendering for editing
 * - Read-only mode: uses MagicCode component for syntax highlighting and copy functionality
 */
export const CodeBlockNode = TiptapCodeBlock.extend({
	addNodeView() {
		return ReactNodeViewRenderer(CodeBlockNodeView, {
			contentDOMElementTag: "code",
		})
	},
})

export default CodeBlockNode
