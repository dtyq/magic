import { createContext, useContext } from "react"
import { AddModelStore } from "./store"

const AddModelStoreContext = createContext<AddModelStore | null>(null)

export const AddModelStoreProvider = AddModelStoreContext.Provider

export function useAddModelStore(): AddModelStore {
	const store = useContext(AddModelStoreContext)
	if (!store) throw new Error("useAddModelStore must be used within AddModelStoreProvider")
	return store
}

export function useOptionalAddModelStore(): AddModelStore | null {
	return useContext(AddModelStoreContext)
}
