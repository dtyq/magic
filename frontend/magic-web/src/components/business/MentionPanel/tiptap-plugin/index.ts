// Main plugin exports
export { default as MentionExtension } from "./MentionExtension"
export { default as MentionPanelRenderer } from "./MentionPanelRenderer"
export { createMentionPanelSuggestion } from "./suggestion"

// Type exports
export type {
	MentionPanelPluginOptions,
	MentionPanelRendererProps,
	MentionPanelRendererRef,
	MentionPanelSuggestionProps,
	TiptapMentionAttributes,
	MentionSelectHandler,
	MentionCloseHandler,
	MentionKeyDownHandler,
} from "./types"

// Re-export MentionPanel types for convenience
export type { MentionItem, PanelState, MentionItemType as ItemType } from "../types"
export type { Language } from "../i18n/types"

// Default export
export { MentionExtension as default } from "./MentionExtension"
