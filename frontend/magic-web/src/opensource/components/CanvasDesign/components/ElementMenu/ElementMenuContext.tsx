import { createContext, useContext } from "react"
import type { ElementMenuContextValue } from "./types"

export const ElementMenuContext = createContext<ElementMenuContextValue | null>(null)

export function useElementMenu() {
	const context = useContext(ElementMenuContext)
	if (!context) {
		throw new Error("useElementMenu must be used within ElementMenuProvider")
	}
	return context
}
