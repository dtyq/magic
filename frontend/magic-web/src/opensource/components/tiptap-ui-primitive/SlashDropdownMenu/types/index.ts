import { Editor, Range } from "@tiptap/react"
import { ReactNode } from "react"

/**
 * Available slash menu item types
 */
export type SlashMenuItemType =
	| "text"
	| "heading_1"
	| "heading_2"
	| "heading_3"
	| "heading_4"
	| "heading_5"
	| "heading_6"
	| "bullet_list"
	| "ordered_list"
	| "todo_list"
	| "quote"
	| "code_block"
	| "image"
	| "storage_image"
	| "project_image"
	| "divider"
	| "table"
	| "inline_math"
	| "block_math"

/**
 * Suggestion item interface for slash menu
 */
export interface SuggestionItem {
	/** Display title */
	title: string
	/** Subtitle or description */
	subtext?: string
	/** Alternative search terms */
	aliases?: string[]
	/** Icon component */
	icon?: ReactNode
	/** Badge component */
	badge?: ReactNode
	/** Group name for categorization */
	group?: string
	/** Unique identifier */
	id: string
	/** Type of the item */
	type: SlashMenuItemType
	/** Action to perform when selected */
	onSelect: (props: { editor: Editor; range?: Range | null }) => void
	/** Whether item is available/enabled */
	enabled?: (editor: Editor) => boolean
}

/**
 * Configuration for slash menu
 */
export interface SlashMenuConfig {
	/** Array of enabled menu item types */
	enabledItems?: SlashMenuItemType[]
	/** Custom menu items to add */
	customItems?: SuggestionItem[]
	/** Group assignments for menu items */
	itemGroups?: Record<string, string>
	/** Whether to show group labels */
	showGroups?: boolean
	/** Maximum number of items to show */
	maxItems?: number
	/** Placeholder text when no items found */
	emptyPlaceholder?: string
}

/**
 * Props for SlashDropdownMenu component
 */
export interface SlashDropdownMenuProps {
	/** Tiptap editor instance */
	editor: Editor | null
	/** Configuration for menu behavior */
	config?: SlashMenuConfig
	/** Custom CSS class name */
	className?: string
	/** Custom styles */
	style?: React.CSSProperties
}

/**
 * Props for individual menu item component
 */
export interface SlashMenuItemProps {
	/** The suggestion item data */
	item: SuggestionItem
	/** Whether item is currently selected/highlighted */
	isSelected?: boolean
	/** Click handler */
	onClick?: () => void
	/** Custom CSS class name */
	className?: string
	/** Whether to show subtext */
	showSubtext?: boolean
}

/**
 * Props for menu list component
 */
export interface SlashMenuListProps {
	/** Array of suggestion items */
	items: SuggestionItem[]
	/** Currently selected item index */
	selectedIndex?: number
	/** Handler for item click */
	onItemClick?: (item: SuggestionItem, index: number) => void
	/** Whether to show groups */
	showGroups?: boolean
	/** Custom CSS class name */
	className?: string
}

/**
 * Return type for useSlashDropdownMenu hook
 */
export interface UseSlashDropdownMenuReturn {
	/** Function to get available menu items */
	getSlashMenuItems: (editor: Editor) => SuggestionItem[]
	/** Processed configuration */
	config: Required<SlashMenuConfig>
	/** Filter items by query */
	filterItems: (items: SuggestionItem[], query?: string) => SuggestionItem[]
}

/**
 * Suggestion props from Tiptap
 */
export interface SuggestionProps {
	editor: Editor
	range: Range
	query: string
	text: string
	items: SuggestionItem[]
	command: (item: SuggestionItem) => void
	decorationNode: Element | null
	clientRect?: () => DOMRect | null
}

/**
 * Default group names
 */
export const DEFAULT_GROUPS = {
	FORMATTING: "Formatting",
	LISTS: "Lists",
	BLOCKS: "Blocks",
	MEDIA: "Media",
	MATH: "Math",
} as const

/**
 * Search configuration
 */
export interface SearchConfig {
	/** Whether search is case sensitive */
	caseSensitive?: boolean
	/** Whether to search in aliases */
	searchAliases?: boolean
	/** Whether to search in subtext */
	searchSubtext?: boolean
	/** Minimum query length to start filtering */
	minQueryLength?: number
}
