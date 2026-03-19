import * as React from "react"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Tiptap UI ---
import type { UseCopyMarkdownConfig } from "@/components/tiptap-ui/copy-markdown-button"
import { useCopyMarkdown } from "@/components/tiptap-ui/copy-markdown-button"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"

export interface CopyMarkdownButtonProps extends Omit<ButtonProps, "type">, UseCopyMarkdownConfig {
	/**
	 * Optional text to display alongside the icon.
	 */
	text?: string
}

/**
 * Button component for copying editor content as markdown.
 *
 * For custom button implementations, use the `useCopyMarkdown` hook instead.
 */
export const CopyMarkdownButton = React.forwardRef<HTMLButtonElement, CopyMarkdownButtonProps>(
	(
		{
			editor: providedEditor,
			text,
			hideWhenUnavailable = false,
			onCopied,
			onClick,
			children,
			...buttonProps
		},
		ref,
	) => {
		const { editor } = useTiptapEditor(providedEditor)
		const { isVisible, canCopy, handleCopy, label, ariaLabel, Icon } = useCopyMarkdown({
			editor,
			hideWhenUnavailable,
			onCopied,
		})

		const handleClick = React.useCallback(
			(event: React.MouseEvent<HTMLButtonElement>) => {
				onClick?.(event)
				if (event.defaultPrevented) return
				handleCopy()
			},
			[handleCopy, onClick],
		)

		if (!isVisible) {
			return null
		}

		return (
			<Button
				type="button"
				data-style="ghost"
				role="button"
				disabled={!canCopy}
				data-disabled={!canCopy}
				tabIndex={-1}
				aria-label={ariaLabel}
				tooltip={label}
				onClick={handleClick}
				{...buttonProps}
				ref={ref}
			>
				{children ?? (
					<>
						<Icon className="tiptap-button-icon" />
						{text && <span className="tiptap-button-text">{text}</span>}
					</>
				)}
			</Button>
		)
	},
)

// @ts-ignore
CopyMarkdownButton.displayName = "CopyMarkdownButton"
