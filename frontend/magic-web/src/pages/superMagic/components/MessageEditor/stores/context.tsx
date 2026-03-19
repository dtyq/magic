import { createContext, useContext, ReactNode } from "react"
import { MessageEditorStore } from "./MessageEditorStore"

/**
 * Context for MessageEditor Store
 */
const MessageEditorStoreContext = createContext<MessageEditorStore | null>(null)

/**
 * Provider component for MessageEditor Store
 */
export interface MessageEditorStoreProviderProps {
	store?: MessageEditorStore
	preferParent?: boolean
	children: ReactNode
}

export function MessageEditorStoreProvider({
	store,
	preferParent = false,
	children,
}: MessageEditorStoreProviderProps) {
	const parentStore = useContext(MessageEditorStoreContext)
	const effectiveStore = preferParent ? (parentStore ?? store) : (store ?? parentStore)

	if (!effectiveStore) {
		return <>{children}</>
	}

	return (
		<MessageEditorStoreContext.Provider value={effectiveStore}>
			{children}
		</MessageEditorStoreContext.Provider>
	)
}

export function useOptionalMessageEditorStore(): MessageEditorStore | null {
	return useContext(MessageEditorStoreContext)
}

/**
 * Hook to access MessageEditor Store
 * @throws Error if used outside of MessageEditorStoreProvider
 */
export function useMessageEditorStore(): MessageEditorStore {
	const store = useOptionalMessageEditorStore()
	if (!store) {
		throw new Error("useMessageEditorStore must be used within MessageEditorStoreProvider")
	}
	return store
}
