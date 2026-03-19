import * as React from "react"

// --- Lib ---
import { parseShortcutKeys } from "@/lib/tiptap-utils"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Tiptap UI ---
import type { UseProjectImageConfig } from "./use-project-image"
import { PROJECT_IMAGE_SHORTCUT_KEY, useProjectImage } from "./use-project-image"
import { ProjectImageDropdown } from "./project-image-dropdown"

// Import to ensure type declarations are loaded
import "@/components/tiptap-node/project-image-node/save-image-to-project-extension"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { Badge } from "@/components/tiptap-ui-primitive/badge"
import MagicDropdown from "@/components/base/MagicDropdown"
import { useIsMobile } from "@/hooks/use-mobile"
import MagicPopup from "@/components/base-mobile/MagicPopup"

export interface ProjectImageButtonProps extends Omit<ButtonProps, "type">, UseProjectImageConfig {
	/**
	 * Optional text to display alongside the icon.
	 */
	text?: string
	/**
	 * Optional show shortcut keys in the button.
	 * @default false
	 */
	showShortcut?: boolean
	/**
	 * Optional onClick handler
	 */
	onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
}

export function ProjectImageShortcutBadge({
	shortcutKeys = PROJECT_IMAGE_SHORTCUT_KEY,
}: {
	shortcutKeys?: string
}) {
	return <Badge>{parseShortcutKeys({ shortcutKeys })}</Badge>
}

/**
 * Button component for uploading/inserting project images in a Tiptap editor.
 *
 * For custom button implementations, use the `useProjectImage` hook instead.
 */
export const ProjectImageButton = React.forwardRef<HTMLButtonElement, ProjectImageButtonProps>(
	(
		{
			editor: providedEditor,
			text,
			hideWhenUnavailable = false,
			onInserted,
			showShortcut = false,
			onClick,
			children,
			...buttonProps
		},
		ref,
	) => {
		const isMobile = useIsMobile()

		const { editor } = useTiptapEditor(providedEditor)
		const {
			isVisible,
			canInsert,
			handleProjectImage,
			label,
			isActive,
			shortcutKeys,
			Icon,
			dropdownOpen,
			setDropdownOpen,
		} = useProjectImage({
			editor,
			hideWhenUnavailable,
			onInserted,
		})

		const handleClick = React.useCallback(
			(event: React.MouseEvent<HTMLButtonElement>) => {
				onClick?.(event)
				if (event.defaultPrevented) return
				handleProjectImage()
			},
			[handleProjectImage, onClick],
		)

		// Get projectId from saveImageToProject extension storage
		const projectId = React.useMemo(() => {
			if (!editor) return undefined
			const storage = editor.storage as {
				saveImageToProject?: { projectId: string; documentPath?: string }
			}
			return storage.saveImageToProject?.projectId
		}, [editor])

		if (!isVisible) {
			return null
		}

		const button = (
			<Button
				type="button"
				data-style="ghost"
				data-active-state={isActive ? "on" : "off"}
				role="button"
				tabIndex={-1}
				disabled={!canInsert}
				data-disabled={!canInsert}
				aria-label={label}
				aria-pressed={isActive}
				tooltip={label}
				onClick={handleClick}
				{...buttonProps}
				ref={ref}
			>
				{children ?? (
					<>
						<Icon className="tiptap-button-icon" />
						{text && <span className="tiptap-button-text">{text}</span>}
						{showShortcut && <ProjectImageShortcutBadge shortcutKeys={shortcutKeys} />}
					</>
				)}
			</Button>
		)

		if (isMobile) {
			return (
				<>
					{button}
					<MagicPopup visible={dropdownOpen} onClose={() => setDropdownOpen(false)}>
						<ProjectImageDropdown
							editor={editor}
							onClose={() => setDropdownOpen(false)}
							onInserted={onInserted}
							projectId={projectId}
						/>
					</MagicPopup>
				</>
			)
		}

		return (
			<MagicDropdown
				open={dropdownOpen}
				onOpenChange={setDropdownOpen}
				popupRender={() => (
					<ProjectImageDropdown
						editor={editor}
						onClose={() => setDropdownOpen(false)}
						onInserted={onInserted}
						projectId={projectId}
					/>
				)}
				trigger={["click"]}
				placement="bottomLeft"
			>
				{button}
			</MagicDropdown>
		)
	},
) as React.ForwardRefExoticComponent<
	ProjectImageButtonProps & React.RefAttributes<HTMLButtonElement>
> & { displayName: string }

ProjectImageButton.displayName = "ProjectImageButton"
