import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { SkillEditRootStore } from "./store/root-store"

const SkillEditStoreContext = createContext<SkillEditRootStore | null>(null)

interface SkillEditStoreProviderProps {
	children: ReactNode
}

export function SkillEditStoreProvider({ children }: SkillEditStoreProviderProps) {
	const [store] = useState(() => new SkillEditRootStore())

	useEffect(() => {
		return () => {
			store.setDraftPrompt("")
			store.conversation.reset()
		}
	}, [store])

	return <SkillEditStoreContext.Provider value={store}>{children}</SkillEditStoreContext.Provider>
}

export function useSkillEditStore() {
	const store = useContext(SkillEditStoreContext)
	if (!store) {
		throw new Error("useSkillEditStore must be used within <SkillEditStoreProvider>")
	}
	return store
}
