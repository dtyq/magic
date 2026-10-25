import { createContext, useContext } from "react"
import type { MagicWidgetContextValue } from "./types"

const DEFAULT_CONTEXT_VALUE: MagicWidgetContextValue = {
	embedContext: null,
	config: {},
	requestCustomMentionSearch: async () => [],
}

const MagicWidgetContext = createContext<MagicWidgetContextValue>(DEFAULT_CONTEXT_VALUE)

/** Provides the validated document-scoped Widget configuration to descendant consumers. */
export const MagicWidgetContextProvider = MagicWidgetContext.Provider

/** Exposes Widget embed identity and configuration without importing the Provider implementation. */
export function useMagicWidgetConfig(): MagicWidgetContextValue {
	return useContext(MagicWidgetContext)
}
