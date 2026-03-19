"use client"

import * as React from "react"
import { type Editor } from "@tiptap/react"
import { NodeSelection, TextSelection } from "@tiptap/pm/state"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Icons ---
import { ListIcon } from "@/components/tiptap-icons/list-icon"
import { ListOrderedIcon } from "@/components/tiptap-icons/list-ordered-icon"
import { ListTodoIcon } from "@/components/tiptap-icons/list-todo-icon"

// --- Lib ---
import {
	findNodePosition,
	isNodeInSchema,
	isNodeTypeSelected,
	isValidPosition,
} from "@/lib/tiptap-utils"

export type ListType = "bulletList" | "orderedList" | "taskList"

/**
 * Configuration for the list functionality
 */
export interface UseListConfig {
	/**
	 * The Tiptap editor instance.
	 */
	editor?: Editor | null
	/**
	 * The type of list to toggle.
	 */
	type: ListType
	/**
	 * Whether the button should hide when list is not available.
	 * @default false
	 */
	hideWhenUnavailable?: boolean
	/**
	 * Callback function called after a successful toggle.
	 */
	onToggled?: () => void
}

export const listIcons = {
	bulletList: ListIcon,
	orderedList: ListOrderedIcon,
	taskList: ListTodoIcon,
}

export const listLabels: Record<ListType, string> = {
	bulletList: "Bullet List",
	orderedList: "Ordered List",
	taskList: "Task List",
}

export const LIST_SHORTCUT_KEYS: Record<ListType, string> = {
	bulletList: "mod+shift+8",
	orderedList: "mod+shift+7",
	taskList: "mod+shift+9",
}

/**
 * Checks if a list can be toggled in the current editor state
 */
export function canToggleList(
	editor: Editor | null,
	type: ListType,
	turnInto: boolean = true,
): boolean {
	if (!editor || !editor.isEditable) return false
	if (!isNodeInSchema(type, editor) || isNodeTypeSelected(editor, ["image"])) return false

	if (!turnInto) {
		switch (type) {
			case "bulletList":
				return editor.can().toggleBulletList()
			case "orderedList":
				return editor.can().toggleOrderedList()
			case "taskList":
				return editor.can().toggleList("taskList", "taskItem")
			default:
				return false
		}
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
 * Checks if list is currently active
 */
export function isListActive(editor: Editor | null, type: ListType): boolean {
	if (!editor || !editor.isEditable) return false

	switch (type) {
		case "bulletList":
			return editor.isActive("bulletList")
		case "orderedList":
			return editor.isActive("orderedList")
		case "taskList":
			return editor.isActive("taskList")
		default:
			return false
	}
}

/**
 * Toggles list in the editor
 */
export function toggleList(editor: Editor | null, type: ListType): boolean {
	if (!editor || !editor.isEditable) return false
	if (!canToggleList(editor, type)) return false

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

		if (editor.isActive(type)) {
			// Unwrap list
			chain
				.liftListItem("listItem")
				.lift("bulletList")
				.lift("orderedList")
				.lift("taskList")
				.run()
		} else {
			// Wrap in specific list type
			const toggleMap: Record<ListType, () => typeof chain> = {
				bulletList: () => chain.toggleBulletList(),
				orderedList: () => chain.toggleOrderedList(),
				taskList: () => chain.toggleList("taskList", "taskItem"),
			}

			const toggle = toggleMap[type]
			if (!toggle) return false

			toggle().run()
		}

		editor.chain().focus().selectTextblockEnd().run()

		return true
	} catch {
		return false
	}
}

/**
 * Determines if the list button should be shown
 */
export function shouldShowButton(props: {
	editor: Editor | null
	type: ListType
	hideWhenUnavailable: boolean
}): boolean {
	const { editor, type, hideWhenUnavailable } = props

	if (!editor || !editor.isEditable) return false
	if (!isNodeInSchema(type, editor)) return false

	if (hideWhenUnavailable && !editor.isActive("code")) {
		return canToggleList(editor, type)
	}

	return true
}

/**
 * Custom hook that provides list functionality for Tiptap editor
 *
 * @example
 * ```tsx
 * // Simple usage
 * function MySimpleListButton() {
 *   const { isVisible, handleToggle, isActive } = useList({ type: "bulletList" })
 *
 *   if (!isVisible) return null
 *
 *   return <button onClick={handleToggle}>Bullet List</button>
 * }
 *
 * // Advanced usage with configuration
 * function MyAdvancedListButton() {
 *   const { isVisible, handleToggle, label, isActive } = useList({
 *     type: "orderedList",
 *     editor: myEditor,
 *     hideWhenUnavailable: true,
 *     onToggled: () => console.log('List toggled!')
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
 *       Toggle List
 *     </MyButton>
 *   )
 * }
 * ```
 */
export function useList(config: UseListConfig) {
	const { editor: providedEditor, type, hideWhenUnavailable = false, onToggled } = config

	const { editor } = useTiptapEditor(providedEditor)
	const [isVisible, setIsVisible] = React.useState<boolean>(true)
	const canToggle = canToggleList(editor, type)
	const isActive = isListActive(editor, type)

	React.useEffect(() => {
		if (!editor) return

		const handleSelectionUpdate = () => {
			setIsVisible(shouldShowButton({ editor, type, hideWhenUnavailable }))
		}

		handleSelectionUpdate()

		editor.on("update", handleSelectionUpdate)

		return () => {
			editor.off("update", handleSelectionUpdate)
		}
	}, [editor, type, hideWhenUnavailable])

	const handleToggle = React.useCallback(() => {
		if (!editor) return false

		const success = toggleList(editor, type)
		if (success) {
			onToggled?.()
		}
		return success
	}, [editor, type, onToggled])

	return {
		isVisible,
		isActive,
		handleToggle,
		canToggle,
		label: listLabels[type],
		shortcutKeys: LIST_SHORTCUT_KEYS[type],
		Icon: listIcons[type],
	}
}
