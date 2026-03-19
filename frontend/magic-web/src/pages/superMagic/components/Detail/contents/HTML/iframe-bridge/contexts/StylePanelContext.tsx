import { createContext, useContext, useMemo, type ReactNode } from "react"
import { StylePanelStore } from "../stores/StylePanelStore"

/**
 * StylePanel Store Context
 * Provides instance-specific store for each IsolatedHTMLRenderer
 */
const StylePanelStoreContext = createContext<StylePanelStore | null>(null)

interface StylePanelStoreProviderProps {
	children: ReactNode
}

/**
 * Provider component that creates and provides an instance-specific store
 */
export function StylePanelStoreProvider({ children }: StylePanelStoreProviderProps) {
	// Create a new store instance for this provider
	const store = useMemo(() => new StylePanelStore(), [])

	return (
		<StylePanelStoreContext.Provider value={store}>{children}</StylePanelStoreContext.Provider>
	)
}

/**
 * Hook to access the instance-specific StylePanelStore
 * Must be used within a StylePanelStoreProvider
 */
export function useStylePanelStore(): StylePanelStore {
	const store = useContext(StylePanelStoreContext)
	if (!store) {
		throw new Error("useStylePanelStore must be used within a StylePanelStoreProvider")
	}
	return store
}
