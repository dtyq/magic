import React, { useMemo } from "react"
import type { Extension } from "@tiptap/core"
import type { SlashDropdownMenuProps } from "./types"
import { SlashCommandExtension } from "./extension/SlashCommandExtension"

/**
 * Main SlashDropdownMenu component
 *
 * This component provides a simple way to add slash command functionality
 * to any Tiptap editor. It handles the extension configuration automatically.
 */
export function SlashDropdownMenu({ config = {} }: Omit<SlashDropdownMenuProps, "editor">) {
	// The actual slash menu functionality is handled by the SlashCommandExtension
	// This component doesn't render anything itself - it just provides a way to
	// configure the extension through props

	// Note: The extension should be added to the editor's extensions array
	// This component is mainly for providing a React-like API

	// config is used as a reference for type inference and documentation
	void config

	return null
}

/**
 * Hook to create SlashCommand extension with configuration
 */
export function useSlashCommandExtension(config: SlashDropdownMenuProps["config"] = {}) {
	return useMemo(() => {
		return SlashCommandExtension.configure({
			config,
			char: "/",
			allowSpaces: false,
		})
	}, [config])
}

/**
 * Higher-order component that adds slash command functionality to an editor
 */
export function withSlashCommand<P extends { extensions?: Extension[] }>(
	WrappedComponent: React.ComponentType<P>,
	slashConfig: SlashDropdownMenuProps["config"] = {},
) {
	return function WithSlashCommandComponent(props: P) {
		const slashExtension = useSlashCommandExtension(slashConfig)

		const enhancedProps = {
			...props,
			extensions: [...(props.extensions || []), slashExtension],
		}

		return <WrappedComponent {...enhancedProps} />
	}
}

/**
 * Utility function to add slash command to existing editor extensions
 */
export function addSlashCommand(
	extensions: Extension[] = [],
	config: SlashDropdownMenuProps["config"] = {},
) {
	const slashExtension = SlashCommandExtension.configure({
		config,
		char: "/",
		allowSpaces: false,
	})

	return [...extensions, slashExtension]
}

// Re-export types and utilities for convenience
export type {
	SlashDropdownMenuProps,
	SlashMenuConfig,
	SlashMenuItemType,
	SuggestionItem,
	SlashMenuItemProps,
	SlashMenuListProps,
} from "./types"

export {
	useSlashDropdownMenu,
	useFilteredSlashItems,
	itemMatchesQuery,
	getItemGroups,
} from "./hooks/useSlashDropdownMenu"

export { SlashMenuItem, SlashMenuList } from "./components"
export { SlashCommandExtension } from "./extension/SlashCommandExtension"
export { createDefaultMenuItems, DEFAULT_SLASH_MENU_CONFIG } from "./config/defaultItems"

export default SlashDropdownMenu
