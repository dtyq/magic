"use client"

import * as React from "react"
import { type Editor } from "@/infrastructure/editors/tiptap/react"
import { NodeSelection } from "@/infrastructure/editors/tiptap/pm-state"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Lib ---
import {
	findNodePosition,
	isNodeInSchema,
	isNodeTypeSelected,
	isValidPosition,
} from "@/infrastructure/editors/tiptap/utils"

// --- Icons ---
import { HeadingOneIcon } from "@/components/tiptap-icons/heading-one-icon"
import { HeadingTwoIcon } from "@/components/tiptap-icons/heading-two-icon"
import { HeadingThreeIcon } from "@/components/tiptap-icons/heading-three-icon"
import { HeadingFourIcon } from "@/components/tiptap-icons/heading-four-icon"
import { HeadingFiveIcon } from "@/components/tiptap-icons/heading-five-icon"
import { HeadingSixIcon } from "@/components/tiptap-icons/heading-six-icon"
import { runActiveEditor } from "@/utils/tiptapEditorLifecycle"

export type Level = 1 | 2 | 3 | 4 | 5 | 6

/**
 * Configuration for the heading functionality
 */
export interface UseHeadingConfig {
	/**
	 * The Tiptap editor instance.
	 */
	editor?: Editor | null
	/**
	 * The heading level.
	 */
	level: Level
	/**
	 * Whether the button should hide when heading is not available.
	 * @default false
	 */
	hideWhenUnavailable?: boolean
	/**
	 * Callback function called after a successful heading toggle.
	 */
	onToggled?: () => void
}

export const headingIcons = {
	1: HeadingOneIcon,
	2: HeadingTwoIcon,
	3: HeadingThreeIcon,
	4: HeadingFourIcon,
	5: HeadingFiveIcon,
	6: HeadingSixIcon,
}

export const HEADING_SHORTCUT_KEYS: Record<Level, string> = {
	1: "ctrl+alt+1",
	2: "ctrl+alt+2",
	3: "ctrl+alt+3",
	4: "ctrl+alt+4",
	5: "ctrl+alt+5",
	6: "ctrl+alt+6",
}

/**
 * Checks if heading can be toggled in the current editor state
 */
export function canToggle(editor: Editor | null, level?: Level, turnInto: boolean = true): boolean {
	return (
		runActiveEditor(
			editor,
			(activeEditor) => {
				if (!activeEditor.isEditable) return false
				if (
					!isNodeInSchema("heading", activeEditor) ||
					isNodeTypeSelected(activeEditor, ["image"])
				)
					return false

				if (!turnInto) {
					return level
						? activeEditor.can().setNode("heading", { level })
						: activeEditor.can().setNode("heading")
				}

				try {
					const view = activeEditor.view
					const state = view.state
					const selection = state.selection

					if (selection.empty) {
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
 * Checks if heading is currently active
 */
export function isHeadingActive(editor: Editor | null, level?: Level | Level[]): boolean {
	return (
		runActiveEditor(
			editor,
			(activeEditor) => {
				if (!activeEditor.isEditable) return false

				if (Array.isArray(level)) {
					return level.some((l) => activeEditor.isActive("heading", { level: l }))
				}

				return level
					? activeEditor.isActive("heading", { level })
					: activeEditor.isActive("heading")
			},
			false,
		) ?? false
	)
}

/**
 * Toggles heading in the editor
 */
export function toggleHeading(editor: Editor | null, level: Level | Level[]): boolean {
	return (
		runActiveEditor(
			editor,
			(activeEditor) => {
				if (!activeEditor.isEditable) return false

				const levels = Array.isArray(level) ? level : [level]
				const toggleLevel = levels.find((l) => canToggle(activeEditor, l))

				if (!toggleLevel) return false

				try {
					const view = activeEditor.view
					let state = view.state
					let tr = state.tr

					// 仅折叠光标扩成块选区；多行选区保留。空块不 NodeSelection，避免 clearNodes 破坏空段
					if (state.selection.empty) {
						const pos = findNodePosition({
							editor: activeEditor,
							node: state.selection.$anchor.node(1),
						})?.pos
						if (!isValidPosition(pos)) return false

						const block = state.doc.nodeAt(pos)
						if (block && block.content.size > 0) {
							tr = tr.setSelection(NodeSelection.create(state.doc, pos))
							view.dispatch(tr)
							state = view.state
						}
					}

					const selection = state.selection
					let chain = activeEditor.chain().focus()

					const headingActive = levels.some((l) =>
						activeEditor.isActive("heading", { level: l }),
					)

					if (selection instanceof NodeSelection) {
						const firstChild = selection.node.firstChild?.firstChild
						const lastChild = selection.node.lastChild?.lastChild

						const from = firstChild
							? selection.from + firstChild.nodeSize
							: selection.from + 1

						const to = lastChild ? selection.to - lastChild.nodeSize : selection.to - 1

						chain = chain.setTextSelection({ from, to })
						if (!headingActive) {
							chain = chain.clearNodes()
						}
					}

					const toggle = headingActive
						? chain.setNode("paragraph")
						: chain.setNode("heading", { level: toggleLevel })

					toggle.run()

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
 * Determines if the heading button should be shown
 */
export function shouldShowButton(props: {
	editor: Editor | null
	level?: Level | Level[]
	hideWhenUnavailable: boolean
}): boolean {
	const { editor, level, hideWhenUnavailable } = props

	const isVisible =
		runActiveEditor(
			editor,
			(activeEditor) => {
				if (!activeEditor.isEditable) return false
				if (!isNodeInSchema("heading", activeEditor)) return false

				if (hideWhenUnavailable && !activeEditor.isActive("code")) {
					if (Array.isArray(level)) {
						return level.some((l) => canToggle(activeEditor, l))
					}
					return canToggle(activeEditor, level)
				}

				return true
			},
			false,
		) ?? false

	return isVisible
}

/**
 * Custom hook that provides heading functionality for Tiptap editor
 *
 * @example
 * ```tsx
 * // Simple usage
 * function MySimpleHeadingButton() {
 *   const { isVisible, isActive, handleToggle, Icon } = useHeading({ level: 1 })
 *
 *   if (!isVisible) return null
 *
 *   return (
 *     <button
 *       onClick={handleToggle}
 *       aria-pressed={isActive}
 *     >
 *       <Icon />
 *       Heading 1
 *     </button>
 *   )
 * }
 *
 * // Advanced usage with configuration
 * function MyAdvancedHeadingButton() {
 *   const { isVisible, isActive, handleToggle, label, Icon } = useHeading({
 *     level: 2,
 *     editor: myEditor,
 *     hideWhenUnavailable: true,
 *     onToggled: (isActive) => console.log('Heading toggled:', isActive)
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
 *       <Icon />
 *       Toggle Heading 2
 *     </MyButton>
 *   )
 * }
 * ```
 */
export function useHeading(config: UseHeadingConfig) {
	const { editor: providedEditor, level, hideWhenUnavailable = false, onToggled } = config

	const { editor } = useTiptapEditor(providedEditor)
	const [isVisible, setIsVisible] = React.useState<boolean>(true)
	const canToggleState = canToggle(editor, level)
	const isActive = isHeadingActive(editor, level)

	React.useEffect(() => {
		if (!editor) return

		const handleSelectionUpdate = () => {
			setIsVisible(shouldShowButton({ editor, level, hideWhenUnavailable }))
		}

		handleSelectionUpdate()

		editor.on("update", handleSelectionUpdate)

		return () => {
			editor.off("update", handleSelectionUpdate)
		}
	}, [editor, level, hideWhenUnavailable])

	const handleToggle = React.useCallback(() => {
		if (!editor) return false

		const success = toggleHeading(editor, level)
		if (success) {
			onToggled?.()
		}
		return success
	}, [editor, level, onToggled])

	return {
		isVisible,
		isActive,
		handleToggle,
		canToggle: canToggleState,
		label: `Heading ${level}`,
		shortcutKeys: HEADING_SHORTCUT_KEYS[level],
		Icon: headingIcons[level],
	}
}
