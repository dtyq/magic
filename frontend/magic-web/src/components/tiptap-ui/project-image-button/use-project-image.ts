"use client"

import * as React from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { type Editor } from "@tiptap/react"
import { useTranslation } from "react-i18next"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { useIsMobile } from "@/hooks/use-mobile"

// --- Lib ---
import { isExtensionAvailable } from "@/lib/tiptap-utils"

// --- Icons ---
import { ImagePlusIcon } from "@/components/tiptap-icons/image-plus-icon"

export const PROJECT_IMAGE_SHORTCUT_KEY = "mod+shift+p"

/**
 * Configuration for the project image upload functionality
 */
export interface UseProjectImageConfig {
	/**
	 * The Tiptap editor instance.
	 */
	editor?: Editor | null

	/**
	 * Whether to hide the button when the image upload is not available
	 * @default false
	 */
	hideWhenUnavailable?: boolean

	/**
	 * Callback function called after image is successfully inserted
	 */
	onInserted?: () => void
}

/**
 * Check if the projectImage extension is available in the editor
 */
function canInsertProjectImage(editor: Editor | null): boolean {
	if (!editor) return false
	return isExtensionAvailable(editor, "image")
}

/**
 * Check if a project image node is currently selected
 */
function isProjectImageActive(editor: Editor | null): boolean {
	if (!editor) return false
	// 作为上传控件，不需要选中
	return false
}

/**
 * Insert a project image placeholder/trigger upload
 * Note: This now only validates, the actual dropdown is triggered by the button
 */
function insertProjectImage(editor: Editor): boolean {
	if (!editor || !canInsertProjectImage(editor)) return false
	// Dropdown will be opened by the button component
	return true
}

/**
 * Determine if the button should be shown based on editor state
 */
function shouldShowButton(props: { editor: Editor | null; hideWhenUnavailable: boolean }): boolean {
	const { editor, hideWhenUnavailable } = props

	if (hideWhenUnavailable) {
		return canInsertProjectImage(editor)
	}

	return true
}

/**
 * Custom hook that provides project image functionality for Tiptap editor
 *
 * @example
 * ```tsx
 * function MyProjectImageButton() {
 *   const { isVisible, handleProjectImage, label } = useProjectImage()
 *
 *   if (!isVisible) return null
 *
 *   return <button onClick={handleProjectImage}>{label}</button>
 * }
 * ```
 */
export function useProjectImage(config?: UseProjectImageConfig) {
	const { editor: providedEditor, hideWhenUnavailable = false, onInserted } = config || {}

	const { editor } = useTiptapEditor(providedEditor)
	const isMobile = useIsMobile()
	const { t } = useTranslation("tiptap")
	const [isVisible, setIsVisible] = React.useState<boolean>(true)
	const [dropdownOpen, setDropdownOpen] = React.useState<boolean>(false)
	const canInsert = canInsertProjectImage(editor)
	const isActive = isProjectImageActive(editor)

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

	const handleProjectImage = React.useCallback(() => {
		if (!editor) return false

		const success = insertProjectImage(editor)
		if (success) {
			setDropdownOpen(true)
			onInserted?.()
		}
		return success
	}, [editor, onInserted])

	useHotkeys(
		PROJECT_IMAGE_SHORTCUT_KEY,
		(event) => {
			event.preventDefault()
			handleProjectImage()
		},
		{
			enabled: isVisible && canInsert,
			enableOnContentEditable: !isMobile,
			enableOnFormTags: true,
		},
	)

	return {
		isVisible,
		isActive,
		handleProjectImage,
		canInsert,
		label: t("toolbar.projectImage.tooltip"),
		shortcutKeys: PROJECT_IMAGE_SHORTCUT_KEY,
		Icon: ImagePlusIcon,
		dropdownOpen,
		setDropdownOpen,
		onInserted,
	}
}
