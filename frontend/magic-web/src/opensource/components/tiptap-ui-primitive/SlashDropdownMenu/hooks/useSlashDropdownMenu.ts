import { useMemo } from "react"
import { Editor } from "@tiptap/react"
import { useTranslation } from "react-i18next"
import type {
	SlashMenuConfig,
	SuggestionItem,
	UseSlashDropdownMenuReturn,
	SearchConfig,
} from "../types"
import {
	createDefaultMenuItems,
	DEFAULT_SLASH_MENU_CONFIG,
	filterEnabledItems,
} from "../config/defaultItems"

/**
 * Default search configuration
 */
const DEFAULT_SEARCH_CONFIG: Required<SearchConfig> = {
	caseSensitive: false,
	searchAliases: true,
	searchSubtext: true,
	minQueryLength: 0,
}

/**
 * Filter items by search query
 */
function filterItemsByQuery(
	items: SuggestionItem[],
	query?: string,
	searchConfig: Required<SearchConfig> = DEFAULT_SEARCH_CONFIG,
): SuggestionItem[] {
	if (!query || query.length < searchConfig.minQueryLength) {
		return items
	}

	const normalizedQuery = searchConfig.caseSensitive ? query : query.toLowerCase()

	return items.filter((item) => {
		// Search in title
		const title = searchConfig.caseSensitive ? item.title : item.title.toLowerCase()
		if (title.includes(normalizedQuery)) return true

		// Search in subtext if enabled
		if (searchConfig.searchSubtext && item.subtext) {
			const subtext = searchConfig.caseSensitive ? item.subtext : item.subtext.toLowerCase()
			if (subtext.includes(normalizedQuery)) return true
		}

		// Search in aliases if enabled
		if (searchConfig.searchAliases && item.aliases) {
			return item.aliases.some((alias) => {
				const normalizedAlias = searchConfig.caseSensitive ? alias : alias.toLowerCase()
				return normalizedAlias.includes(normalizedQuery)
			})
		}

		return false
	})
}

/**
 * Group items by their group property
 */
function groupItems(items: SuggestionItem[]): Record<string, SuggestionItem[]> {
	const grouped: Record<string, SuggestionItem[]> = {}

	items.forEach((item) => {
		const group = item.group || "Other"
		if (!grouped[group]) {
			grouped[group] = []
		}
		grouped[group].push(item)
	})

	return grouped
}

/**
 * Sort items within groups and flatten back to array with group separators
 */
function processSortedItems(
	items: SuggestionItem[],
	showGroups: boolean,
	maxItems?: number,
): SuggestionItem[] {
	if (!showGroups) {
		return maxItems ? items.slice(0, maxItems) : items
	}

	const grouped = groupItems(items)
	const sortedGroups = Object.keys(grouped).sort()
	const result: SuggestionItem[] = []
	let itemCount = 0

	for (const groupName of sortedGroups) {
		if (maxItems && itemCount >= maxItems) break

		const groupItems = grouped[groupName]
		const remainingSlots = maxItems ? maxItems - itemCount : groupItems.length
		const itemsToAdd = groupItems.slice(0, remainingSlots)

		result.push(...itemsToAdd)
		itemCount += itemsToAdd.length
	}

	return result
}

/**
 * Hook for managing slash dropdown menu functionality
 */
export function useSlashDropdownMenu(config: SlashMenuConfig = {}): UseSlashDropdownMenuReturn {
	const { t } = useTranslation("tiptap")
	// Merge config with defaults
	const mergedConfig = useMemo(
		() => ({
			...DEFAULT_SLASH_MENU_CONFIG,
			...config,
			customItems: config.customItems || [],
			itemGroups: {
				...DEFAULT_SLASH_MENU_CONFIG.itemGroups,
				...config.itemGroups,
			},
		}),
		[config],
	)

	// Create function to get menu items based on editor
	const getSlashMenuItems = useMemo(() => {
		return (editor: Editor): SuggestionItem[] => {
			if (!editor) return []

			// Get all default menu items with internationalization
			const defaultItems = createDefaultMenuItems(editor, t)

			// Filter items that are actually enabled by the editor
			const enabledItems = defaultItems.filter((item) => {
				return item.enabled ? item.enabled(editor) : true
			})

			// Filter by configured enabled types
			const filteredItems = filterEnabledItems(
				enabledItems,
				mergedConfig.enabledItems,
				editor,
			)

			// Add custom items if provided
			const customItems = mergedConfig.customItems || []
			const allItems = [...filteredItems, ...customItems]

			// Apply group assignments from config
			const itemsWithGroups = allItems.map((item) => ({
				...item,
				group: mergedConfig.itemGroups?.[item.type] || item.group || "Other",
			}))

			// Sort and limit items
			return processSortedItems(
				itemsWithGroups,
				mergedConfig.showGroups,
				mergedConfig.maxItems,
			)
		}
	}, [mergedConfig, t])

	// Create filter function for search
	const filterItems = useMemo(() => {
		return (items: SuggestionItem[], query?: string): SuggestionItem[] => {
			const filtered = filterItemsByQuery(items, query || "", DEFAULT_SEARCH_CONFIG)
			return processSortedItems(filtered, mergedConfig.showGroups, mergedConfig.maxItems)
		}
	}, [mergedConfig.showGroups, mergedConfig.maxItems])

	return {
		getSlashMenuItems,
		config: mergedConfig,
		filterItems,
	}
}

/**
 * Hook for getting filtered slash menu items with search
 */
export function useFilteredSlashItems(
	editor: Editor | null,
	query: string,
	config: SlashMenuConfig = {},
): SuggestionItem[] {
	const { getSlashMenuItems, filterItems } = useSlashDropdownMenu(config)

	return useMemo(() => {
		if (!editor) return []

		const allItems = getSlashMenuItems(editor)
		return filterItems(allItems, query)
	}, [editor, query, getSlashMenuItems, filterItems])
}

/**
 * Utility function to check if an item matches search query
 */
export function itemMatchesQuery(item: SuggestionItem, query: string): boolean {
	if (!query) return true

	const normalizedQuery = query.toLowerCase()

	// Check title
	if (item.title.toLowerCase().includes(normalizedQuery)) return true

	// Check subtext
	if (item.subtext?.toLowerCase().includes(normalizedQuery)) return true

	// Check aliases
	if (item.aliases?.some((alias) => alias.toLowerCase().includes(normalizedQuery))) return true

	return false
}

/**
 * Utility function to get item groups from items array
 */
export function getItemGroups(items: SuggestionItem[]): string[] {
	const groups = new Set<string>()
	items.forEach((item) => {
		if (item.group) groups.add(item.group)
	})
	return Array.from(groups).sort()
}
