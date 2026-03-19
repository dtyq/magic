import * as React from "react"

// --- Lib ---
import { parseShortcutKeys } from "@/lib/tiptap-utils"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { Badge } from "@/components/tiptap-ui-primitive/badge"

// --- Tiptap UI ---
import type { ListType, UseListConfig } from "@/components/tiptap-ui/list-button"
import { LIST_SHORTCUT_KEYS, useList } from "@/components/tiptap-ui/list-button"

export interface ListButtonProps extends Omit<ButtonProps, "type">, UseListConfig {
	/**
	 * Optional text to display alongside the icon.
	 */
	text?: string
	/**
	 * Optional show shortcut keys in the button.
	 * @default false
	 */
	showShortcut?: boolean
}

export function ListShortcutBadge({
	type,
	shortcutKeys = LIST_SHORTCUT_KEYS[type],
}: {
	type: ListType
	shortcutKeys?: string
}) {
	return <Badge>{parseShortcutKeys({ shortcutKeys })}</Badge>
}

/**
 * Button component for toggling lists in a Tiptap editor.
 *
 * For custom button implementations, use the `useList` hook instead.
 */
export const ListButton = React.forwardRef<HTMLButtonElement, ListButtonProps>(
	(
		{
			editor: providedEditor,
			type,
			text,
			hideWhenUnavailable = false,
			onToggled,
			showShortcut = false,
			onClick,
			children,
			...buttonProps
		},
		ref,
	) => {
		const { editor } = useTiptapEditor(providedEditor)
		const { isVisible, canToggle, isActive, handleToggle, label, shortcutKeys, Icon } = useList(
			{
				editor,
				type,
				hideWhenUnavailable,
				onToggled,
			},
		)

		const handleClick = React.useCallback(
			(event: React.MouseEvent<HTMLButtonElement>) => {
				onClick?.(event)
				if (event.defaultPrevented) return
				handleToggle()
			},
			[handleToggle, onClick],
		)

		if (!isVisible) {
			return null
		}

		return (
			<Button
				type="button"
				data-style="ghost"
				data-active-state={isActive ? "on" : "off"}
				role="button"
				tabIndex={-1}
				disabled={!canToggle}
				data-disabled={!canToggle}
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
						{showShortcut && (
							<ListShortcutBadge type={type} shortcutKeys={shortcutKeys} />
						)}
					</>
				)}
			</Button>
		)
	},
)

ListButton.displayName = "ListButton"
