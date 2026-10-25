import { useEffect, useRef } from "react"
import type { Editor } from "@/infrastructure/editors/tiptap/react"

export type MaybeEditor = Editor | null | undefined

type EditorCommandShape = {
	commands?: {
		insertContent?: unknown
		focus?: unknown
	}
	isDestroyed?: unknown
}

function isEditorLifecycleError(error: unknown) {
	if (!(error instanceof Error)) return false

	const message = error.message
	const lowerMessage = message.toLowerCase()
	const destroyedReadPattern =
		/Cannot read properties of (?:null|undefined) \(reading ['"](commands|view|dom|state)['"]\)/i
	const legacyDestroyedReadPattern =
		/Cannot read property ['"](commands|view|dom|state)['"] of (?:null|undefined)/i

	return (
		message.includes("commandManager") ||
		destroyedReadPattern.test(message) ||
		legacyDestroyedReadPattern.test(message) ||
		lowerMessage.includes("editorview") ||
		lowerMessage.includes("editor view") ||
		message.includes("isDestroyed")
	)
}

export function isEditorActive(editor: MaybeEditor): editor is Editor {
	if (!editor || typeof editor !== "object") return false
	if (!("isDestroyed" in editor) || !("commands" in editor)) return false

	try {
		const editorLike = editor as EditorCommandShape

		return (
			editorLike.isDestroyed === false &&
			typeof editorLike.commands?.insertContent === "function" &&
			typeof editorLike.commands?.focus === "function"
		)
	} catch (error) {
		if (isEditorLifecycleError(error)) return false
		throw error
	}
}

export function runActiveEditor<T>(
	editor: MaybeEditor,
	action: (editor: Editor) => T,
	fallback?: T,
): T | undefined {
	if (!isEditorActive(editor)) return fallback

	try {
		return action(editor)
	} catch (error) {
		if (isEditorLifecycleError(error)) return fallback
		throw error
	}
}

export function useLatestActiveEditor(editor: MaybeEditor) {
	const editorRef = useRef<Editor | null>(null)

	useEffect(() => {
		editorRef.current = isEditorActive(editor) ? editor : null

		return () => {
			if (editorRef.current === editor) {
				editorRef.current = null
			}
		}
	}, [editor])

	return editorRef
}
