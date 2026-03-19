import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { CrewEditRootStore } from "./store/root-store"

const CrewEditStoreContext = createContext<CrewEditRootStore | null>(null)

interface CrewEditStoreProviderProps {
	children: ReactNode
}

export function CrewEditStoreProvider({ children }: CrewEditStoreProviderProps) {
	const [store] = useState(() => new CrewEditRootStore())

	useEffect(() => {
		return () => {
			store.dispose()
		}
	}, [store])

	return <CrewEditStoreContext.Provider value={store}>{children}</CrewEditStoreContext.Provider>
}

/** Access the nearest CrewEditRootStore instance from context. */
export function useCrewEditStore(): CrewEditRootStore {
	const store = useContext(CrewEditStoreContext)
	if (!store) throw new Error("useCrewEditStore must be used within <CrewEditStoreProvider>")
	return store
}
