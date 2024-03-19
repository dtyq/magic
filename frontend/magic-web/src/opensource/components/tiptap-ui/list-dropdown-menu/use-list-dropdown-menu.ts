"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { useTranslation } from "react-i18next"

// --- Hooks ---
import { useTiptapEditor } from "@/opensource/hooks/use-tiptap-editor"

// --- Icons ---
import { ListIcon } from "@/opensource/components/tiptap-icons/list-icon"
import { ListOrderedIcon } from "@/opensource/components/tiptap-icons/list-ordered-icon"
import { ListTodoIcon } from "@/opensource/components/tiptap-icons/list-todo-icon"

// --- Lib ---
import { isNodeInSchema } from "@/opensource/lib/tiptap-utils"

// --- Tiptap UI ---
import {
	canToggleList,
	isListActive,
	listIcons,
	type ListType,
} from "@/opensource/components/tiptap-ui/list-button"

/**
 * Configuration for the list dropdown menu functionality
 */
export interface UseListDropdownMenuConfig {
	/**
	 * The Tiptap editor instance.
	 */
	editor?: Editor | null
	/**
	 * The list types to display in the dropdown.
	 * @default ["bulletList", "orderedList", "taskList"]
	 */
	types?: ListType[]
	/**
	 * Whether the dropdown should be hidden when no list types are available
	 * @default false
	 */
	hideWhenUnavailable?: boolean
}

export interface ListOption {
	labelKey: string // i18n key instead of hardcoded label
	type: ListType
	icon: React.ElementType
}

export const listOptions: ListOption[] = [
	{
		labelKey: "toolbar.list.bulletList",
		type: "bulletList",
		icon: ListIcon,
	},
	{
		labelKey: "toolbar.list.orderedList",
		type: "orderedList",
		icon: ListOrderedIcon,
	},
	{
		labelKey: "toolbar.list.taskList",
		type: "taskList",
		icon: ListTodoIcon,
	},
]

export function canToggleAnyList(editor: Editor | null, listTypes: ListType[]): boolean {
	if (!editor || !editor.isEditable) return false
	return listTypes.some((type) => canToggleList(editor, type))
}

export function isAnyListActive(editor: Editor | null, listTypes: ListType[]): boolean {
	if (!editor || !editor.isEditable) return false
	return listTypes.some((type) => isListActive(editor, type))
}

export function getFilteredListOptions(availableTypes: ListType[]): typeof listOptions {
	return listOptions.filter((option) => !option.type || availableTypes.includes(option.type))
}

export function shouldShowListDropdown(params: {
	editor: Editor | null
	listTypes: ListType[]
	hideWhenUnavailable: boolean
	listInSchema: boolean
	canToggleAny: boolean
}): boolean {
	const { editor, hideWhenUnavailable, listInSchema, canToggleAny } = params

	if (!listInSchema || !editor) {
		return false
	}

	if (hideWhenUnavailable && !editor.isActive("code")) {
		return canToggleAny
	}

	return true
}

/**
 * Gets the currently active list type from the available types
 */
export function getActiveListType(
	editor: Editor | null,
	availableTypes: ListType[],
): ListType | undefined {
	if (!editor || !editor.isEditable) return undefined
	return availableTypes.find((type) => isListActive(editor, type))
}

/**
 * Custom hook that provides list dropdown menu functionality for Tiptap editor
 *
 * @example
 * ```tsx
 * // Simple usage
 * function MyListDropdown() {
 *   const {
 *     isVisible,
 *     activeType,
 *     isAnyActive,
 *     canToggleAny,
 *     filteredLists,
 *   } = useListDropdownMenu()
 *
 *   if (!isVisible) return null
 *
 *   return (
 *     <DropdownMenu>
 *       // dropdown content
 *     </DropdownMenu>
 *   )
 * }
 *
 * // Advanced usage with configuration
 * function MyAdvancedListDropdown() {
 *   const {
 *     isVisible,
 *     activeType,
 *   } = useListDropdownMenu({
 *     editor: myEditor,
 *     types: ["bulletList", "orderedList"],
 *     hideWhenUnavailable: true,
 *   })
 *
 *   // component implementation
 * }
 * ```
 */
export function useListDropdownMenu(config?: UseListDropdownMenuConfig) {
	const {
		editor: providedEditor,
		types = ["bulletList", "orderedList", "taskList"],
		hideWhenUnavailable = false,
	} = config || {}

	const { editor } = useTiptapEditor(providedEditor)
	const { t } = useTranslation("tiptap")
	const [isVisible, setIsVisible] = React.useState(false)

	const listInSchema = types.some((type) => isNodeInSchema(type, editor))

	const filteredLists = React.useMemo(() => getFilteredListOptions(types), [types])

	const canToggleAny = canToggleAnyList(editor, types)
	const isAnyActive = isAnyListActive(editor, types)
	const activeType = getActiveListType(editor, types)
	const activeList = filteredLists.find((option) => option.type === activeType)

	React.useEffect(() => {
		if (!editor) return

		const handleSelectionUpdate = () => {
			setIsVisible(
				shouldShowListDropdown({
					editor,
					listTypes: types,
					hideWhenUnavailable,
					listInSchema,
					canToggleAny,
				}),
			)
		}

		handleSelectionUpdate()

		editor.on("update", handleSelectionUpdate)

		return () => {
			editor.off("update", handleSelectionUpdate)
		}
	}, [canToggleAny, editor, hideWhenUnavailable, listInSchema, types])

	return {
		isVisible,
		activeType,
		isActive: isAnyActive,
		canToggle: canToggleAny,
		types,
		filteredLists,
		label: t("toolbar.list.tooltip"),
		ariaLabel: t("toolbar.list.ariaLabel"),
		Icon: activeList ? listIcons[activeList.type] : ListIcon,
	}
}
