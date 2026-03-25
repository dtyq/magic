import { createContext, useContext, type ReactNode } from "react"
import type { PublishPanelStore } from "./store"

const PublishPanelStoreContext = createContext<PublishPanelStore | null>(null)

interface PublishPanelStoreProviderProps {
	store: PublishPanelStore
	children: ReactNode
}

export function PublishPanelStoreProvider({ store, children }: PublishPanelStoreProviderProps) {
	return (
		<PublishPanelStoreContext.Provider value={store}>
			{children}
		</PublishPanelStoreContext.Provider>
	)
}

export function usePublishPanelStore() {
	const store = useContext(PublishPanelStoreContext)
	if (!store) {
		throw new Error("usePublishPanelStore must be used within <PublishPanelStoreProvider>")
	}
	return store
}
