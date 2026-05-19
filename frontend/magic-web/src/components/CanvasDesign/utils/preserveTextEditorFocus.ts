import { createContext, useContext } from "react"

export const PRESERVE_TEXT_EDITOR_FOCUS_ATTR = "data-preserve-text-editor-focus"

const PreserveTextEditorFocusContext = createContext(false)

export const PreserveTextEditorFocusProvider = PreserveTextEditorFocusContext.Provider

export function useShouldPreserveTextEditorFocus(): boolean {
	return useContext(PreserveTextEditorFocusContext)
}

export function isPreserveTextEditorFocusTarget(target: EventTarget | null): boolean {
	return (
		target instanceof Element && target.closest(`[${PRESERVE_TEXT_EDITOR_FOCUS_ATTR}]`) !== null
	)
}
