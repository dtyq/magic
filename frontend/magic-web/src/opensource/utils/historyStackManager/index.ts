/**
 * HistoryStackManager - Global History Stack Management
 *
 * This module provides a comprehensive solution for managing browser history stack
 * in mobile applications, specifically for handling back button behavior.
 *
 * @example
 * ```typescript
 * // Using the hook (recommended for React components)
 * import { useBackHandler } from "@/opensource/utils/historyStackManager"
 *
 * function MyModal({ isOpen, onClose }) {
 *   useBackHandler(isOpen, onClose, "MyModal")
 *   return <div>...</div>
 * }
 *
 * // Using utility functions
 * import { addBackHandler, removeBackHandler } from "@/opensource/utils/historyStackManager"
 *
 * const entryId = addBackHandler("MyComponent", () => console.log("Back pressed"))
 * removeBackHandler(entryId)
 * ```
 */

// Core manager and types
export { default as historyStackManager } from "./manager"
export type {
	VirtualEntry,
	HistoryStackStats,
	HistoryStackContextValue,
	HistoryStackProviderProps,
	UseBackHandlerReturn,
	HistoryStackManagerInterface,
} from "./types"

// React hooks
export { default as useBackHandler } from "./hooks"

// Provider and context hooks
export {
	HistoryStackProvider,
	useHistoryStackContext,
	useHistoryStackStats,
	useHasActiveEntries,
} from "./provider"

// Utility functions
export {
	addBackHandler,
	removeBackHandler,
	cleanupComponentBackHandlers,
	getHistoryStackStats,
	getActiveHistoryStack,
	hasActiveHistoryEntries,
	cleanupStaleHistoryEntries,
	debugHistoryStack,
	manager,
} from "./utils"

// Default export for convenience
export { default } from "./manager"
