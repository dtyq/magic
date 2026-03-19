// Main component
export { default } from "./MessageEditor"

// Types
export type { MessageEditorModules, MessageEditorProps, MessageEditorRef } from "./types"

// Re-export hooks for external use if needed
export { useMessageEditor, useMentionManager } from "./hooks"

// MessageEditorProvider
export {
	default as MessageEditorProvider,
	useMessageEditorProvider,
	type MessageEditorProviderProps,
} from "./MessageEditorProvider"
export type {
	MessageEditorProviderConfig,
	MessageEditorProviderValue,
} from "./MessageEditorProvider/types"

// Layout configuration types and constants
export { ToolbarButton } from "./types"
export type { MessageEditorLayoutConfig } from "./types"
export { DEFAULT_LAYOUT_CONFIG } from "./constants/constant"
