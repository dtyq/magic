import * as React from "react"
import type { Editor } from "@tiptap/react"
import { useTranslation } from "react-i18next"

// --- Hooks ---
import { useTiptapEditor } from "@/opensource/hooks/use-tiptap-editor"

// --- Icons ---
import { LinkIcon } from "@/opensource/components/tiptap-icons/link-icon"

// --- Lib ---
import { isMarkInSchema, sanitizeUrl } from "@/opensource/lib/tiptap-utils"

/**
 * Configuration for the link popover functionality
 */
export interface UseLinkPopoverConfig {
	/**
	 * The Tiptap editor instance.
	 */
	editor?: Editor | null
	/**
	 * Whether to hide the link popover when not available.
	 * @default false
	 */
	hideWhenUnavailable?: boolean
	/**
	 * Callback function called when the link is set.
	 */
	onSetLink?: () => void
}

/**
 * Configuration for the link handler functionality
 */
export interface LinkHandlerProps {
	/**
	 * The Tiptap editor instance.
	 */
	editor: Editor | null
	/**
	 * Callback function called when the link is set.
	 */
	onSetLink?: () => void
}

/**
 * Checks if a link can be set in the current editor state
 */
export function canSetLink(editor: Editor | null): boolean {
	if (!editor || !editor.isEditable) return false
	return editor.can().setMark("link")
}

/**
 * Checks if a link is currently active in the editor
 */
export function isLinkActive(editor: Editor | null): boolean {
	if (!editor || !editor.isEditable) return false
	return editor.isActive("link")
}

/**
 * Determines if the link button should be shown
 */
export function shouldShowLinkButton(props: {
	editor: Editor | null
	hideWhenUnavailable: boolean
}): boolean {
	const { editor, hideWhenUnavailable } = props

	const linkInSchema = isMarkInSchema("link", editor)

	if (!linkInSchema || !editor) {
		return false
	}

	if (hideWhenUnavailable && !editor.isActive("code")) {
		return canSetLink(editor)
	}

	return true
}

/**
 * Custom hook for handling link operations in a Tiptap editor
 */
export function useLinkHandler(props: LinkHandlerProps) {
	const { editor, onSetLink } = props
	const [url, setUrl] = React.useState<string | null>(null)
	const [title, setTitle] = React.useState<string | null>(null)

	React.useEffect(() => {
		if (!editor) return

		// Get URL and title immediately on mount
		const updateInitialState = () => {
			if (isLinkActive(editor)) {
				const { href, title: linkTitle } = editor.getAttributes("link")
				setUrl(href || "")
				setTitle(linkTitle || "")
			} else {
				setUrl("")
				setTitle("")
			}
		}

		updateInitialState()
	}, [editor])

	React.useEffect(() => {
		if (!editor) return

		const updateLinkState = () => {
			if (isLinkActive(editor)) {
				const { href, title: linkTitle } = editor.getAttributes("link")
				setUrl(href || "")
				setTitle(linkTitle || "")
			} else {
				// Clear state when link is not active
				setUrl("")
				setTitle("")
			}
		}

		// Update immediately when selection changes
		updateLinkState()

		// Listen to selection changes
		editor.on("selectionUpdate", updateLinkState)
		// Also listen to document updates
		editor.on("update", updateLinkState)

		return () => {
			editor.off("selectionUpdate", updateLinkState)
			editor.off("update", updateLinkState)
		}
	}, [editor])

	const setLink = React.useCallback(() => {
		if (!url || !editor) return

		const { selection } = editor.state
		const isEmpty = selection.empty

		// Encode URL if it contains spaces to ensure markdown parsing works correctly
		// According to Markdown spec, URLs with spaces should be URL-encoded
		// We use encodeURI to preserve path structure while encoding spaces
		let encodedUrl = url
		if (url && /[\s<>]/.test(url)) {
			// Use encodeURI to encode spaces while preserving path separators and other valid characters
			// This ensures markdown parsing works while maintaining valid URLs for HTML rendering
			encodedUrl = encodeURI(url)
		}

		const linkAttributes: { href: string; title?: string } = { href: encodedUrl }
		if (title && title.trim()) {
			linkAttributes.title = title.trim()
		}

		if (isEmpty) {
			// If no text is selected, insert text with link mark
			// This ensures the link is properly formatted as [text](url) in markdown
			// instead of being recognized as auto-link <url>
			const linkText = title && title.trim() ? title.trim() : url
			editor
				.chain()
				.focus()
				.insertContent({
					type: "text",
					text: linkText,
					marks: [
						{
							type: "link",
							attrs: linkAttributes,
						},
					],
				})
				.run()
		} else {
			// If text is selected, convert it to a link
			editor.chain().focus().extendMarkRange("link").setLink(linkAttributes).run()
		}

		setUrl(null)
		setTitle(null)

		onSetLink?.()
	}, [editor, onSetLink, url, title])

	const removeLink = React.useCallback(() => {
		if (!editor) return
		editor
			.chain()
			.focus()
			.extendMarkRange("link")
			.unsetLink()
			.setMeta("preventAutolink", true)
			.run()
		setUrl("")
		setTitle("")
	}, [editor])

	const openLink = React.useCallback(
		(target: string = "_blank", features: string = "noopener,noreferrer") => {
			if (!url) return

			const safeUrl = sanitizeUrl(url, window.location.href)
			if (safeUrl !== "#") {
				window.open(safeUrl, target, features)
			}
		},
		[url],
	)

	return {
		url: url || "",
		setUrl,
		title: title || "",
		setTitle,
		setLink,
		removeLink,
		openLink,
	}
}

/**
 * Custom hook for link popover state management
 */
export function useLinkState(props: { editor: Editor | null; hideWhenUnavailable: boolean }) {
	const { editor, hideWhenUnavailable = false } = props

	const canSet = canSetLink(editor)
	const isActive = isLinkActive(editor)

	const [isVisible, setIsVisible] = React.useState(false)

	React.useEffect(() => {
		if (!editor) return

		const handleSelectionUpdate = () => {
			setIsVisible(
				shouldShowLinkButton({
					editor,
					hideWhenUnavailable,
				}),
			)
		}

		handleSelectionUpdate()

		editor.on("update", handleSelectionUpdate)

		return () => {
			editor.off("update", handleSelectionUpdate)
		}
	}, [editor, hideWhenUnavailable])

	return {
		isVisible,
		canSet,
		isActive,
	}
}

/**
 * Main hook that provides link popover functionality for Tiptap editor
 *
 * @example
 * ```tsx
 * // Simple usage
 * function MyLinkButton() {
 *   const { isVisible, canSet, isActive, Icon, label } = useLinkPopover()
 *
 *   if (!isVisible) return null
 *
 *   return <button disabled={!canSet}>Link</button>
 * }
 *
 * // Advanced usage with configuration
 * function MyAdvancedLinkButton() {
 *   const { isVisible, canSet, isActive, Icon, label } = useLinkPopover({
 *     editor: myEditor,
 *     hideWhenUnavailable: true,
 *     onSetLink: () => console.log('Link set!')
 *   })
 *
 *   if (!isVisible) return null
 *
 *   return (
 *     <MyButton
 *       disabled={!canSet}
 *       aria-label={label}
 *       aria-pressed={isActive}
 *     >
 *       <Icon />
 *       {label}
 *     </MyButton>
 *   )
 * }
 * ```
 */
export function useLinkPopover(config?: UseLinkPopoverConfig) {
	const { editor: providedEditor, hideWhenUnavailable = false, onSetLink } = config || {}

	const { editor } = useTiptapEditor(providedEditor)
	const { t } = useTranslation("tiptap")

	const { isVisible, canSet, isActive } = useLinkState({
		editor,
		hideWhenUnavailable,
	})

	const linkHandler = useLinkHandler({
		editor,
		onSetLink,
	})

	return {
		isVisible,
		canSet,
		isActive,
		label: t("toolbar.link.tooltip"),
		ariaLabel: t("toolbar.link.ariaLabel"),
		Icon: LinkIcon,
		...linkHandler,
	}
}
