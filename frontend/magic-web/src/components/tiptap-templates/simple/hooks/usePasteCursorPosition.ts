import { useMemoizedFn } from "ahooks"
import type { Editor, EditorEvents } from "@tiptap/react"
import type { Slice } from "@tiptap/pm/model"
import { useRef, useEffect } from "react"

interface UsePasteCursorPositionOptions {
	editor: Editor | null
	onUpdate?: (update: EditorEvents["update"]) => void
	onContentChange?: (content: string) => void
}

interface UsePasteCursorPositionReturn {
	handleOnPaste: (event: ClipboardEvent, slice: Slice) => void
	handleEditorUpdate: (update: EditorEvents["update"]) => void
}

/**
 * Hook to handle cursor positioning after paste operations
 * Positions cursor at the end of pasted content instead of a new line
 * Supports both text and image paste operations
 */
export function usePasteCursorPosition({
	editor,
	onUpdate,
	onContentChange,
}: UsePasteCursorPositionOptions): UsePasteCursorPositionReturn {
	// Track paste operation to position cursor correctly after paste
	const pasteSize = useRef<{
		originalPosition: number
		size: number
	} | null>(null)

	// Create editor ref to access editor instance in callbacks
	const editorRef = useRef<Editor | null>(null)

	// Update editorRef when editor changes
	useEffect(() => {
		editorRef.current = editor
	}, [editor])

	// Handle paste event to record cursor position
	const handleOnPaste = useMemoizedFn((_event: ClipboardEvent, slice: Slice) => {
		if (!editorRef.current) return

		// Check if slice contains any content
		if (!slice.content || slice.content.size === 0) return

		// Track paste operation for all content types (text, images, mixed content)
		// Note: Image paste via files may be handled by extensions before reaching here,
		// but HTML paste with image nodes will still be tracked and positioned correctly
		pasteSize.current = {
			originalPosition: editorRef.current.state.selection.$from.pos,
			size: slice.content.size,
		}
	})

	// Handle editor update to position cursor after paste
	const handleEditorUpdate = useMemoizedFn((update: EditorEvents["update"]) => {
		if (pasteSize.current && editorRef.current) {
			// Set cursor position to the end of pasted content
			editorRef.current.commands.focus(
				pasteSize.current.originalPosition + pasteSize.current.size,
			)
			pasteSize.current = null
		}
		onUpdate?.(update)
		// @ts-expect-error - markdown storage may not exist on all editor instances
		onContentChange?.(update?.editor?.storage?.markdown?.getMarkdown() || "")
	})

	return {
		handleOnPaste,
		handleEditorUpdate,
	}
}
