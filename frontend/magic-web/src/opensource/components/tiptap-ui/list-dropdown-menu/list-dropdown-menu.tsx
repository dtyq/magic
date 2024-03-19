import * as React from "react"
import { type Editor } from "@tiptap/react"
import { useTranslation } from "react-i18next"

// --- Hooks ---
import { useTiptapEditor } from "@/opensource/hooks/use-tiptap-editor"

// --- Icons ---
import { ChevronDownIcon } from "@/opensource/components/tiptap-icons/chevron-down-icon"

// --- Tiptap UI ---
import { ListButton, type ListType } from "@/opensource/components/tiptap-ui/list-button"

import { useListDropdownMenu } from "./use-list-dropdown-menu"

// --- UI Primitives ---
import type { ButtonProps } from "@/opensource/components/tiptap-ui-primitive/button"
import { Button, ButtonGroup } from "@/opensource/components/tiptap-ui-primitive/button"
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
} from "@/opensource/components/tiptap-ui-primitive/dropdown-menu"
import { Card, CardBody } from "@/opensource/components/tiptap-ui-primitive/card"

export interface ListDropdownMenuProps extends Omit<ButtonProps, "type"> {
	/**
	 * The Tiptap editor instance.
	 */
	editor?: Editor
	/**
	 * The list types to display in the dropdown.
	 */
	types?: ListType[]
	/**
	 * Whether the dropdown should be hidden when no list types are available
	 * @default false
	 */
	hideWhenUnavailable?: boolean
	/**
	 * Callback for when the dropdown opens or closes
	 */
	onOpenChange?: (isOpen: boolean) => void
	/**
	 * Whether to render the dropdown menu in a portal
	 * @default false
	 */
	portal?: boolean
}

export function ListDropdownMenu({
	editor: providedEditor,
	types = ["bulletList", "orderedList", "taskList"],
	hideWhenUnavailable = false,
	onOpenChange,
	portal = false,
	...props
}: ListDropdownMenuProps) {
	const { editor } = useTiptapEditor(providedEditor)
	const { t } = useTranslation("tiptap")
	const [isOpen, setIsOpen] = React.useState(false)

	const { filteredLists, canToggle, isActive, isVisible, Icon, label, ariaLabel } =
		useListDropdownMenu({
			editor,
			types,
			hideWhenUnavailable,
		})

	const handleOnOpenChange = React.useCallback(
		(open: boolean) => {
			setIsOpen(open)
			onOpenChange?.(open)
		},
		[onOpenChange],
	)

	if (!isVisible || !editor || !editor.isEditable) {
		return null
	}

	return (
		<DropdownMenu open={isOpen} onOpenChange={handleOnOpenChange}>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					data-style="ghost"
					data-active-state={isActive ? "on" : "off"}
					role="button"
					tabIndex={-1}
					disabled={!canToggle}
					data-disabled={!canToggle}
					aria-label={ariaLabel}
					tooltip={label}
					{...props}
				>
					<Icon className="tiptap-button-icon" />
					<ChevronDownIcon className="tiptap-button-dropdown-small" />
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent align="start" portal={portal}>
				<Card>
					<CardBody>
						<ButtonGroup>
							{filteredLists.map((option) => (
								<DropdownMenuItem key={option.type} asChild>
									<ListButton
										editor={editor}
										type={option.type}
										text={t(option.labelKey)}
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
}

export default ListDropdownMenu
