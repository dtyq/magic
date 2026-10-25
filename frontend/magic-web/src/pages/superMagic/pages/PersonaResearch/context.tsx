import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react"
import { PersonaResearchStore } from "./store/research-store"

const PersonaResearchStoreContext = createContext<PersonaResearchStore | null>(null)

/**
 * Owns one store for the research home, studio and persona library routes. The share page
 * passes `bootstrap={false}` and feeds the store itself through `initShare`.
 */
export function PersonaResearchStoreProvider({
	children,
	bootstrap = true,
}: PropsWithChildren<{ bootstrap?: boolean }>) {
	const [store] = useState(() => new PersonaResearchStore())

	useEffect(() => {
		if (bootstrap) void store.bootstrap()
		return () => {
			store.dispose()
		}
		// The store is created once; later prop changes must not re-bootstrap it.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [store])

	return (
		<PersonaResearchStoreContext.Provider value={store}>
			{children}
		</PersonaResearchStoreContext.Provider>
	)
}

export function usePersonaResearchStore() {
	const store = useContext(PersonaResearchStoreContext)
	if (!store) {
		throw new Error("usePersonaResearchStore must be used inside PersonaResearchStoreProvider")
	}
	return store
}

/** Same store, or null outside the research routes (avatars render without persona details). */
export function useOptionalPersonaResearchStore() {
	return useContext(PersonaResearchStoreContext)
}
