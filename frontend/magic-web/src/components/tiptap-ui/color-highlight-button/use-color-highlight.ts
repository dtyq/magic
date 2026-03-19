"use client"

import * as React from "react"
import { type Editor } from "@tiptap/react"
import { useHotkeys } from "react-hotkeys-hook"
import { useTranslation } from "react-i18next"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { useIsMobile } from "@/hooks/use-mobile"

// --- Lib ---
import { isMarkInSchema, isNodeTypeSelected } from "@/lib/tiptap-utils"

// --- Icons ---
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon"

export const COLOR_HIGHLIGHT_SHORTCUT_KEY = "mod+shift+h"

export type HighlightColorKey =
	| "default"
	| "gray"
	| "brown"
	| "orange"
	| "yellow"
	| "green"
	| "blue"
	| "purple"
	| "pink"
	| "red"

export const HIGHLIGHT_COLORS = [
	{
		key: "default" as HighlightColorKey,
		value: "var(--tt-bg-color)",
		border: "var(--tt-bg-color-contrast)",
	},
	{
		key: "gray" as HighlightColorKey,
		value: "var(--tt-color-highlight-gray)",
		border: "var(--tt-color-highlight-gray-contrast)",
	},
	{
		key: "brown" as HighlightColorKey,
		value: "var(--tt-color-highlight-brown)",
		border: "var(--tt-color-highlight-brown-contrast)",
	},
	{
		key: "orange" as HighlightColorKey,
		value: "var(--tt-color-highlight-orange)",
		border: "var(--tt-color-highlight-orange-contrast)",
	},
	{
		key: "yellow" as HighlightColorKey,
		value: "var(--tt-color-highlight-yellow)",
		border: "var(--tt-color-highlight-yellow-contrast)",
	},
	{
		key: "green" as HighlightColorKey,
		value: "var(--tt-color-highlight-green)",
		border: "var(--tt-color-highlight-green-contrast)",
	},
	{
		key: "blue" as HighlightColorKey,
		value: "var(--tt-color-highlight-blue)",
		border: "var(--tt-color-highlight-blue-contrast)",
	},
	{
		key: "purple" as HighlightColorKey,
		value: "var(--tt-color-highlight-purple)",
		border: "var(--tt-color-highlight-purple-contrast)",
	},
	{
		key: "pink" as HighlightColorKey,
		value: "var(--tt-color-highlight-pink)",
		border: "var(--tt-color-highlight-pink-contrast)",
	},
	{
		key: "red" as HighlightColorKey,
		value: "var(--tt-color-highlight-red)",
		border: "var(--tt-color-highlight-red-contrast)",
	},
]
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]

/**
 * Configuration for the color highlight functionality
 */
export interface UseColorHighlightConfig {
	/**
	 * The Tiptap editor instance.
	 */
	editor?: Editor | null
	/**
	 * The color to apply when toggling the highlight.
	 */
	highlightColor?: string
	/**
	 * Optional label to display alongside the icon.
	 */
	label?: string
	/**
	 * Whether the button should hide when the mark is not available.
	 * @default false
	 */
	hideWhenUnavailable?: boolean
	/**
	 * Called when the highlight is applied.
	 */
	onApplied?: ({ color, label }: { color: string; label: string }) => void
}

export function pickHighlightColorsByValue(values: string[]) {
	const colorMap = new Map(HIGHLIGHT_COLORS.map((color) => [color.value, color]))
	return values
		.map((value) => colorMap.get(value))
		.filter((color): color is (typeof HIGHLIGHT_COLORS)[number] => !!color)
}

/**
 * Get the i18n translation key for a highlight color
 */
export function getHighlightColorI18nKey(colorKey: HighlightColorKey): string {
	return `toolbar.colorHighlight.colors.${colorKey}`
}

export function canColorHighlight(editor: Editor | null): boolean {
	if (!editor || !editor.isEditable) return false
	if (!isMarkInSchema("highlight", editor) || isNodeTypeSelected(editor, ["image"])) return false

	return editor.can().setMark("highlight")
}

export function isColorHighlightActive(editor: Editor | null, highlightColor?: string): boolean {
	if (!editor || !editor.isEditable) return false
	return highlightColor
		? editor.isActive("highlight", { color: highlightColor })
		: editor.isActive("highlight")
}

export function removeHighlight(editor: Editor | null): boolean {
	if (!editor || !editor.isEditable) return false
	if (!canColorHighlight(editor)) return false

	return editor.chain().focus().unsetMark("highlight").run()
}

export function shouldShowButton(props: {
	editor: Editor | null
	hideWhenUnavailable: boolean
}): boolean {
	const { editor, hideWhenUnavailable } = props

	if (!editor || !editor.isEditable) return false
	if (!isMarkInSchema("highlight", editor)) return false

	if (hideWhenUnavailable && !editor.isActive("code")) {
		return canColorHighlight(editor)
	}

	return true
}

export function useColorHighlight(config: UseColorHighlightConfig) {
	const {
		editor: providedEditor,
		label,
		highlightColor,
		hideWhenUnavailable = false,
		onApplied,
	} = config

	const { editor } = useTiptapEditor(providedEditor)
	const { t } = useTranslation("tiptap")
	const isMobile = useIsMobile()
	const [isVisible, setIsVisible] = React.useState<boolean>(true)
	const canColorHighlightState = canColorHighlight(editor)
	const isActive = isColorHighlightActive(editor, highlightColor)

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

	const handleColorHighlight = React.useCallback(() => {
		if (!editor || !canColorHighlightState || !highlightColor || !label) return false

		if (editor.state.storedMarks) {
			const highlightMarkType = editor.schema.marks.highlight
			if (highlightMarkType) {
				editor.view.dispatch(editor.state.tr.removeStoredMark(highlightMarkType))
			}
		}

		setTimeout(() => {
			const success = editor
				.chain()
				.focus()
				.toggleMark("highlight", { color: highlightColor })
				.run()
			if (success) {
				onApplied?.({ color: highlightColor, label })
			}
			return success
		}, 0)
	}, [canColorHighlightState, highlightColor, editor, label, onApplied])

	const handleRemoveHighlight = React.useCallback(() => {
		const success = removeHighlight(editor)
		if (success) {
			onApplied?.({ color: "", label: t("toolbar.colorHighlight.removeHighlight") })
		}
		return success
	}, [editor, onApplied, t])

	useHotkeys(
		COLOR_HIGHLIGHT_SHORTCUT_KEY,
		(event) => {
			event.preventDefault()
			handleColorHighlight()
		},
		{
			enabled: isVisible && canColorHighlightState,
			enableOnContentEditable: !isMobile,
			enableOnFormTags: true,
		},
	)

	return {
		isVisible,
		isActive,
		handleColorHighlight,
		handleRemoveHighlight,
		canColorHighlight: canColorHighlightState,
		label: label || t("toolbar.colorHighlight.tooltip"),
		shortcutKeys: COLOR_HIGHLIGHT_SHORTCUT_KEY,
		Icon: HighlighterIcon,
	}
}
