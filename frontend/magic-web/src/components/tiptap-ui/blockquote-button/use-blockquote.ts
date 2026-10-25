"use client"

import * as React from "react"
import type { Editor } from "@/infrastructure/editors/tiptap/react"
import { NodeSelection, TextSelection } from "@/infrastructure/editors/tiptap/pm-state"
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
} from "@/infrastructure/editors/tiptap/utils"
import { runActiveEditor } from "@/utils/tiptapEditorLifecycle"

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
	return (
		runActiveEditor(
			editor,
			(activeEditor) => {
				if (!activeEditor.isEditable) return false
				if (
					!isNodeInSchema("blockquote", activeEditor) ||
					isNodeTypeSelected(activeEditor, ["image"])
				)
					return false

				if (!turnInto) {
					return activeEditor.can().toggleWrap("blockquote")
				}

				try {
					const view = activeEditor.view
					const state = view.state
					const selection = state.selection

					if (selection.empty || selection instanceof TextSelection) {
						const pos = findNodePosition({
							editor: activeEditor,
							node: state.selection.$anchor.node(1),
						})?.pos
						if (!isValidPosition(pos)) return false
					}

					return true
				} catch {
					return false
				}
			},
			false,
		) ?? false
	)
}

/**
 * Toggles blockquote formatting for a specific node or the current selection
 */
export function toggleBlockquote(editor: Editor | null): boolean {
	return (
		runActiveEditor(
			editor,
			(activeEditor) => {
				if (!activeEditor.isEditable) return false
				if (!canToggleBlockquote(activeEditor)) return false

				try {
					const view = activeEditor.view
					let state = view.state
					let tr = state.tr

					// No selection, find the the cursor position
					if (state.selection.empty || state.selection instanceof TextSelection) {
						const pos = findNodePosition({
							editor: activeEditor,
							node: state.selection.$anchor.node(1),
						})?.pos
						if (!isValidPosition(pos)) return false

						tr = tr.setSelection(NodeSelection.create(state.doc, pos))
						view.dispatch(tr)
						state = view.state
					}

					const selection = state.selection

					let chain = activeEditor.chain().focus()

					// Handle NodeSelection
					if (selection instanceof NodeSelection) {
						const firstChild = selection.node.firstChild?.firstChild
						const lastChild = selection.node.lastChild?.lastChild

						const from = firstChild
							? selection.from + firstChild.nodeSize
							: selection.from + 1

						const to = lastChild ? selection.to - lastChild.nodeSize : selection.to - 1

						chain = chain.setTextSelection({ from, to }).clearNodes()
					}

					const toggle = activeEditor.isActive("blockquote")
						? chain.lift("blockquote")
						: chain.wrapIn("blockquote")

					toggle.run()

					activeEditor.chain().focus().selectTextblockEnd().run()

					return true
				} catch {
					return false
				}
			},
			false,
		) ?? false
	)
}

/**
 * Determines if the blockquote button should be shown
 */
export function shouldShowButton(props: {
	editor: Editor | null
	hideWhenUnavailable: boolean
}): boolean {
	const { editor, hideWhenUnavailable } = props

	const isVisible =
		runActiveEditor(
			editor,
			(activeEditor) => {
				if (!activeEditor.isEditable) return false
				if (!isNodeInSchema("blockquote", activeEditor)) return false

				if (hideWhenUnavailable && !activeEditor.isActive("code")) {
					return canToggleBlockquote(activeEditor)
				}

				return true
			},
			false,
		) ?? false

	return isVisible
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
	const isActive =
		runActiveEditor(editor, (activeEditor) => activeEditor.isActive("blockquote"), false) ??
		false

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
