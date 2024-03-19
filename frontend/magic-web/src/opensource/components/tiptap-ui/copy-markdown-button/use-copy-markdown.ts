"use client"

import * as React from "react"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { clipboard } from "@/opensource/utils/clipboard-helpers"
import { type Editor } from "@tiptap/react"
import { useTranslation } from "react-i18next"

// --- Hooks ---
import { useTiptapEditor } from "@/opensource/hooks/use-tiptap-editor"

// --- Icons ---
import { CopyMarkdownIcon } from "@/opensource/components/tiptap-icons/copy-markdown-icon"

/**
 * Configuration for the copy markdown functionality
 */
export interface UseCopyMarkdownConfig {
	/**
	 * The Tiptap editor instance.
	 */
	editor?: Editor | null
	/**
	 * Whether the button should hide when unavailable.
	 * @default false
	 */
	hideWhenUnavailable?: boolean
	/**
	 * Callback function called after a successful copy.
	 */
	onCopied?: () => void
}

/**
 * Checks if markdown content can be copied from the editor
 */
export function canCopyMarkdown(editor: Editor | null): boolean {
	if (!editor) return false

	// Check if editor has content
	const isEmpty = editor.isEmpty
	return !isEmpty
}

/**
 * Copies the editor content as markdown to clipboard
 */
export async function copyMarkdown(editor: Editor | null): Promise<boolean> {
	if (!editor) return false
	if (!canCopyMarkdown(editor)) return false

	try {
		// @ts-ignore
		const markdown = editor.storage.markdown.getMarkdown()

		if (!markdown || markdown.trim() === "") return false

		await clipboard.writeText(markdown)
		return true
	} catch (error) {
		console.error("Failed to copy markdown:", error)
		return false
	}
}

/**
 * Determines if the copy markdown button should be shown
 */
export function shouldShowButton(props: {
	editor: Editor | null
	hideWhenUnavailable: boolean
}): boolean {
	const { editor, hideWhenUnavailable } = props

	if (!editor) return false

	if (hideWhenUnavailable) {
		return canCopyMarkdown(editor)
	}

	return true
}

/**
 * Custom hook that provides copy markdown functionality for Tiptap editor
 */
export function useCopyMarkdown(config?: UseCopyMarkdownConfig) {
	const { editor: providedEditor, hideWhenUnavailable = false, onCopied } = config || {}

	const { editor } = useTiptapEditor(providedEditor)
	const { t } = useTranslation("tiptap")
	const [isVisible, setIsVisible] = React.useState<boolean>(true)
	const canCopy = canCopyMarkdown(editor)

	React.useEffect(() => {
		if (!editor) return

		const handleUpdate = () => {
			setIsVisible(shouldShowButton({ editor, hideWhenUnavailable }))
		}

		handleUpdate()

		editor.on("update", handleUpdate)

		return () => {
			editor.off("update", handleUpdate)
		}
	}, [editor, hideWhenUnavailable])

	const handleCopy = React.useCallback(async () => {
		if (!editor) return false

		const success = await copyMarkdown(editor)

		if (success) {
			magicToast.success(t("toolbar.copyMarkdown.success"))
			onCopied?.()
		} else {
			magicToast.error(t("toolbar.copyMarkdown.failed"))
		}

		return success
	}, [editor, onCopied, t])

	return {
		isVisible,
		canCopy,
		handleCopy,
		label: t("toolbar.copyMarkdown.tooltip"),
		ariaLabel: t("toolbar.copyMarkdown.ariaLabel"),
		Icon: CopyMarkdownIcon,
	}
}
