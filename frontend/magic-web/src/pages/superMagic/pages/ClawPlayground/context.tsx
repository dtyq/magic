import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { ClawPlaygroundRootStore } from "./store/root-store"

const ClawPlaygroundStoreContext = createContext<ClawPlaygroundRootStore | null>(null)

export function ClawPlaygroundStoreProvider({ children }: { children: ReactNode }) {
	const [store] = useState(() => new ClawPlaygroundRootStore())

	useEffect(() => {
		return () => {
			store.dispose()
		}
	}, [store])

	return (
		<ClawPlaygroundStoreContext.Provider value={store}>
			{children}
		</ClawPlaygroundStoreContext.Provider>
	)
}

export function useClawPlaygroundStore() {
	const store = useContext(ClawPlaygroundStoreContext)
	if (!store) {
		throw new Error("useClawPlaygroundStore must be used within <ClawPlaygroundStoreProvider>")
	}
	return store
}
