"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { NodeSelection, TextSelection } from "@tiptap/pm/state"
import { useTranslation } from "react-i18next"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Icons ---
import { BlockquoteIcon } from "@/components/tiptap-icons/blockquote-icon"

// --- UI Utils ---
import {
	findNodePosition,
	isNodeInSchema,
	isNodeTypeSelected,
	isValidPosition,
} from "@/lib/tiptap-utils"

export const BLOCKQUOTE_SHORTCUT_KEY = "mod+shift+b"

/**
 * Configuration for the blockquote functionality
 */
export interface UseBlockquoteConfig {
	/**
	 * The Tiptap editor instance.
	 */
	editor?: Editor | null
	/**
	 * Whether the button should hide when blockquote is not available.
	 * @default false
	 */
	hideWhenUnavailable?: boolean
	/**
	 * Callback function called after a successful toggle.
	 */
	onToggled?: () => void
}

/**
 * Checks if blockquote can be toggled in the current editor state
 */
export function canToggleBlockquote(editor: Editor | null, turnInto: boolean = true): boolean {
	if (!editor || !editor.isEditable) return false
	if (!isNodeInSchema("blockquote", editor) || isNodeTypeSelected(editor, ["image"])) return false

	if (!turnInto) {
		return editor.can().toggleWrap("blockquote")
	}

	try {
		const view = editor.view
		const state = view.state
		const selection = state.selection

		if (selection.empty || selection instanceof TextSelection) {
			const pos = findNodePosition({
				editor,
				node: state.selection.$anchor.node(1),
			})?.pos
			if (!isValidPosition(pos)) return false
		}

		return true
	} catch {
		return false
	}
}

/**
 * Toggles blockquote formatting for a specific node or the current selection
 */
export function toggleBlockquote(editor: Editor | null): boolean {
	if (!editor || !editor.isEditable) return false
	if (!canToggleBlockquote(editor)) return false

	try {
		const view = editor.view
		let state = view.state
		let tr = state.tr

		// No selection, find the the cursor position
		if (state.selection.empty || state.selection instanceof TextSelection) {
			const pos = findNodePosition({
				editor,
				node: state.selection.$anchor.node(1),
			})?.pos
			if (!isValidPosition(pos)) return false

			tr = tr.setSelection(NodeSelection.create(state.doc, pos))
			view.dispatch(tr)
			state = view.state
		}

		const selection = state.selection

		let chain = editor.chain().focus()

		// Handle NodeSelection
		if (selection instanceof NodeSelection) {
			const firstChild = selection.node.firstChild?.firstChild
			const lastChild = selection.node.lastChild?.lastChild

			const from = firstChild ? selection.from + firstChild.nodeSize : selection.from + 1

			const to = lastChild ? selection.to - lastChild.nodeSize : selection.to - 1

			chain = chain.setTextSelection({ from, to }).clearNodes()
		}

		const toggle = editor.isActive("blockquote")
			? chain.lift("blockquote")
			: chain.wrapIn("blockquote")

		toggle.run()

		editor.chain().focus().selectTextblockEnd().run()

		return true
	} catch {
		return false
	}
}

/**
 * Determines if the blockquote button should be shown
 */
export function shouldShowButton(props: {
	editor: Editor | null
	hideWhenUnavailable: boolean
}): boolean {
	const { editor, hideWhenUnavailable } = props

	if (!editor || !editor.isEditable) return false
	if (!isNodeInSchema("blockquote", editor)) return false

	if (hideWhenUnavailable && !editor.isActive("code")) {
		return canToggleBlockquote(editor)
	}

	return true
}

/**
 * Custom hook that provides blockquote functionality for Tiptap editor
 *
 * @example
 * ```tsx
 * // Simple usage - no params needed
 * function MySimpleBlockquoteButton() {
 *   const { isVisible, handleToggle, isActive } = useBlockquote()
 *
 *   if (!isVisible) return null
 *
 *   return <button onClick={handleToggle}>Blockquote</button>
 * }
 *
 * // Advanced usage with configuration
 * function MyAdvancedBlockquoteButton() {
 *   const { isVisible, handleToggle, label, isActive } = useBlockquote({
 *     editor: myEditor,
 *     hideWhenUnavailable: true,
 *     onToggled: () => console.log('Blockquote toggled!')
 *   })
 *
 *   if (!isVisible) return null
 *
 *   return (
 *     <MyButton
 *       onClick={handleToggle}
 *       aria-label={label}
 *       aria-pressed={isActive}
 *     >
 *       Toggle Blockquote
 *     </MyButton>
 *   )
 * }
 * ```
 */
export function useBlockquote(config?: UseBlockquoteConfig) {
	const { editor: providedEditor, hideWhenUnavailable = false, onToggled } = config || {}

	const { editor } = useTiptapEditor(providedEditor)
	const { t } = useTranslation("tiptap")
	const [isVisible, setIsVisible] = React.useState<boolean>(true)
	const canToggle = canToggleBlockquote(editor)
	const isActive = editor?.isActive("blockquote") || false

	React.useEffect(() => {
		if (!editor) return

		const handleSelectionUpdate = () => {
			setIsVisible(shouldShowButton({ editor, hideWhenUnavailable }))
		}

		handleSelectionUpdate()

		editor.on("update", handleSelectionUpdate)

		return () => {
			editor.off("update", handleSelectionUpdate)
		}
	}, [editor, hideWhenUnavailable])

	const handleToggle = React.useCallback(() => {
		if (!editor) return false

		const success = toggleBlockquote(editor)
		if (success) {
			onToggled?.()
		}
		return success
	}, [editor, onToggled])

	return {
		isVisible,
		isActive,
		handleToggle,
		canToggle,
		label: t("toolbar.blockquote.tooltip"),
		ariaLabel: t("toolbar.blockquote.ariaLabel"),
		shortcutKeys: BLOCKQUOTE_SHORTCUT_KEY,
		Icon: BlockquoteIcon,
	}
}
