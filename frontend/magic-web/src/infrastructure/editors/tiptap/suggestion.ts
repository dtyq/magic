// Keep the local facade's runtime exports identical to @tiptap/suggestion so migrated
// consumers can use either the default extension or the named Suggestion factory.
export { default, Suggestion, exitSuggestion } from "@tiptap/suggestion"
export type { SuggestionKeyDownProps, SuggestionProps, SuggestionOptions } from "@tiptap/suggestion"
