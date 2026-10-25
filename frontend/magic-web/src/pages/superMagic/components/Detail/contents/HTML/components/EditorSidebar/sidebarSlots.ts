import { createContext, useContext } from "react"

export interface EditorSidebarSlots {
	structureChrome: HTMLElement | null
}

export const EditorSidebarSlotsContext = createContext<EditorSidebarSlots | null>(null)

export function useEditorSidebarSlots() {
	return useContext(EditorSidebarSlotsContext)
}
