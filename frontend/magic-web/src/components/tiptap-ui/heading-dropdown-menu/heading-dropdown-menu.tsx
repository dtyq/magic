import * as React from "react"
import { useTranslation } from "react-i18next"

// --- Icons ---
import { ChevronDownIcon } from "@/components/tiptap-icons/chevron-down-icon"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Tiptap UI ---
import { HeadingButton } from "@/components/tiptap-ui/heading-button"
import type { UseHeadingDropdownMenuConfig } from "@/components/tiptap-ui/heading-dropdown-menu"
import { useHeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button, ButtonGroup } from "@/components/tiptap-ui-primitive/button"
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
} from "@/components/tiptap-ui-primitive/dropdown-menu"
import { Card, CardBody } from "@/components/tiptap-ui-primitive/card"

export interface HeadingDropdownMenuProps
	extends Omit<ButtonProps, "type">, UseHeadingDropdownMenuConfig {
	/**
	 * Whether to render the dropdown menu in a portal
	 * @default false
	 */
	portal?: boolean
	/**
	 * Callback for when the dropdown opens or closes
	 */
	onOpenChange?: (isOpen: boolean) => void
}

/**
 * Dropdown menu component for selecting heading levels in a Tiptap editor.
 *
 * For custom dropdown implementations, use the `useHeadingDropdownMenu` hook instead.
 */
export const HeadingDropdownMenu = React.forwardRef<HTMLButtonElement, HeadingDropdownMenuProps>(
	(
		{
			editor: providedEditor,
			levels = [1, 2, 3, 4, 5, 6],
			hideWhenUnavailable = false,
			portal = false,
			onOpenChange,
			...buttonProps
		},
		ref,
	) => {
		const { editor } = useTiptapEditor(providedEditor)
		const { t } = useTranslation("tiptap")
		const [isOpen, setIsOpen] = React.useState(false)
		const { isVisible, isActive, canToggle, Icon } = useHeadingDropdownMenu({
			editor,
			levels,
			hideWhenUnavailable,
		})

		const handleOpenChange = React.useCallback(
			(open: boolean) => {
				if (!editor || !canToggle) return
				setIsOpen(open)
				onOpenChange?.(open)
			},
			[canToggle, editor, onOpenChange],
		)

		if (!isVisible) {
			return null
		}

		return (
			<DropdownMenu modal open={isOpen} onOpenChange={handleOpenChange}>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						data-style="ghost"
						data-active-state={isActive ? "on" : "off"}
						role="button"
						tabIndex={-1}
						disabled={!canToggle}
						data-disabled={!canToggle}
						aria-label={t("toolbar.heading.ariaLabel")}
						aria-pressed={isActive}
						tooltip={t("toolbar.heading.tooltip")}
						{...buttonProps}
						ref={ref}
					>
						<Icon className="tiptap-button-icon" />
						<ChevronDownIcon className="tiptap-button-dropdown-small" />
					</Button>
				</DropdownMenuTrigger>

				<DropdownMenuContent align="start" portal={portal}>
					<Card>
						<CardBody>
							<ButtonGroup>
								{levels.map((level) => (
									<DropdownMenuItem key={`heading-${level}`} asChild>
										<HeadingButton
											editor={editor}
											level={level}
											text={t(`toolbar.heading.level.${level}`)}
											showTooltip={false}
										/>
									</DropdownMenuItem>
								))}
							</ButtonGroup>
						</CardBody>
					</Card>
				</DropdownMenuContent>
			</DropdownMenu>
		)
	},
)

HeadingDropdownMenu.displayName = "HeadingDropdownMenu"

export default HeadingDropdownMenu
