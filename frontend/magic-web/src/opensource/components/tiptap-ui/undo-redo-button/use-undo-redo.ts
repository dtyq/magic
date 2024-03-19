import * as React from "react"
import { type Editor } from "@tiptap/react"
import { useTranslation } from "react-i18next"

// --- Hooks ---
import { useTiptapEditor } from "@/opensource/hooks/use-tiptap-editor"

// --- Lib ---
import { isNodeTypeSelected } from "@/opensource/lib/tiptap-utils"

// --- Icons ---
import { Redo2Icon } from "@/opensource/components/tiptap-icons/redo2-icon"
import { Undo2Icon } from "@/opensource/components/tiptap-icons/undo2-icon"

export type UndoRedoAction = "undo" | "redo"

/**
 * Configuration for the history functionality
 */
export interface UseUndoRedoConfig {
	/**
	 * The Tiptap editor instance.
	 */
	editor?: Editor | null
	/**
	 * The history action to perform (undo or redo).
	 */
	action: UndoRedoAction
	/**
	 * Whether the button should hide when action is not available.
	 * @default false
	 */
	hideWhenUnavailable?: boolean
	/**
	 * Callback function called after a successful action execution.
	 */
	onExecuted?: () => void
}

export const UNDO_REDO_SHORTCUT_KEYS: Record<UndoRedoAction, string> = {
	undo: "mod+z",
	redo: "mod+shift+z",
}

export const historyActionLabels: Record<UndoRedoAction, string> = {
	undo: "Undo",
	redo: "Redo",
}

export const historyIcons = {
	undo: Undo2Icon,
	redo: Redo2Icon,
}

/**
 * Checks if a history action can be executed
 */
export function canExecuteUndoRedoAction(editor: Editor | null, action: UndoRedoAction): boolean {
	if (!editor || !editor.isEditable) return false
	if (isNodeTypeSelected(editor, ["image"])) return false

	return action === "undo" ? editor.can().undo() : editor.can().redo()
}

/**
 * Executes a history action on the editor
 */
export function executeUndoRedoAction(editor: Editor | null, action: UndoRedoAction): boolean {
	if (!editor || !editor.isEditable) return false
	if (!canExecuteUndoRedoAction(editor, action)) return false

	const chain = editor.chain().focus()
	return action === "undo" ? chain.undo().run() : chain.redo().run()
}

/**
 * Determines if the history button should be shown
 */
export function shouldShowButton(props: {
	editor: Editor | null
	hideWhenUnavailable: boolean
	action: UndoRedoAction
}): boolean {
	const { editor, hideWhenUnavailable, action } = props

	if (!editor || !editor.isEditable) return false

	if (hideWhenUnavailable && !editor.isActive("code")) {
		return canExecuteUndoRedoAction(editor, action)
	}

	return true
}

/**
 * Custom hook that provides history functionality for Tiptap editor
 *
 * @example
 * ```tsx
 * // Simple usage
 * function MySimpleUndoButton() {
 *   const { isVisible, handleAction } = useHistory({ action: "undo" })
 *
 *   if (!isVisible) return null
 *
 *   return <button onClick={handleAction}>Undo</button>
 * }
 *
 * // Advanced usage with configuration
 * function MyAdvancedRedoButton() {
 *   const { isVisible, handleAction, label } = useHistory({
 *     editor: myEditor,
 *     action: "redo",
 *     hideWhenUnavailable: true,
 *     onExecuted: () => console.log('Action executed!')
 *   })
 *
 *   if (!isVisible) return null
 *
 *   return (
 *     <MyButton
 *       onClick={handleAction}
 *       aria-label={label}
 *     >
 *       Redo
 *     </MyButton>
 *   )
 * }
 * ```
 */
export function useUndoRedo(config: UseUndoRedoConfig) {
	const { editor: providedEditor, action, hideWhenUnavailable = false, onExecuted } = config

	const { editor } = useTiptapEditor(providedEditor)
	const { t } = useTranslation("tiptap")
	const [isVisible, setIsVisible] = React.useState<boolean>(true)
	const canExecute = canExecuteUndoRedoAction(editor, action)

	React.useEffect(() => {
		if (!editor) return

		const handleUpdate = () => {
			setIsVisible(shouldShowButton({ editor, hideWhenUnavailable, action }))
		}

		handleUpdate()

		editor.on("update", handleUpdate)

		return () => {
			editor.off("update", handleUpdate)
		}
	}, [editor, hideWhenUnavailable, action])

	const handleAction = React.useCallback(() => {
		if (!editor) return false

		const success = executeUndoRedoAction(editor, action)
		if (success) {
			onExecuted?.()
		}
		return success
	}, [editor, action, onExecuted])

	return {
		isVisible,
		handleAction,
		canExecute,
		label: t(`toolbar.history.${action}`),
		shortcutKeys: UNDO_REDO_SHORTCUT_KEYS[action],
		Icon: historyIcons[action],
	}
}
