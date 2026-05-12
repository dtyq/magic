import { createContext, useContext, useEffect, useRef, type ReactNode } from "react"
import type { SelfMediaInitialNavigation } from "../../../types"
import type { AttachmentNode } from "../services"
import { SelfMediaStore } from "./SelfMediaStore"

const SelfMediaStoreContext = createContext<SelfMediaStore | null>(null)

export interface SelfMediaStoreProviderProps {
	folderFileId?: string
	attachmentList?: AttachmentNode[]
	attachments?: AttachmentNode[]
	/** In-memory one-shot from file tree open; optional */
	initialNavigation?: SelfMediaInitialNavigation | null
	/** Inject a prebuilt store (tests only). */
	store?: SelfMediaStore
	children?: ReactNode
}

/**
 * Provides a scoped `SelfMediaStore` to a `SelfMediaRootRender` subtree.
 * The store is instantiated once per mount and disposed on unmount.
 */
export function SelfMediaStoreProvider({
	folderFileId,
	attachmentList,
	attachments,
	initialNavigation,
	store: injected,
	children,
}: SelfMediaStoreProviderProps) {
	const storeRef = useRef<SelfMediaStore | null>(null)
	if (!storeRef.current) {
		storeRef.current = injected ?? new SelfMediaStore()
	}
	const store = storeRef.current
	const syncTree = attachments ?? attachmentList
	// Injected stores are test-only pre-seeded instances: skip the sync and
	// dispose effects so tests retain full control over store state.
	const isInjected = injected !== undefined

	// `syncTree` may be a MobX observable array whose reference never changes
	// even when items are added / updated by the AI agent. Using only reference
	// equality as the effect dependency would therefore miss those mutations.
	// We also depend on the array length so the effect re-fires whenever the
	// attachment list grows (the most common trigger for new posts).
	const syncTreeLength = syncTree?.length ?? 0

	useEffect(() => {
		if (isInjected) return
		void store.sync({ folderFileId, attachments: syncTree, initialNavigation })
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [store, folderFileId, syncTree, syncTreeLength, isInjected, initialNavigation])

	useEffect(() => {
		if (isInjected) return
		return () => {
			store.dispose()
		}
	}, [store, isInjected])

	return <SelfMediaStoreContext.Provider value={store}>{children}</SelfMediaStoreContext.Provider>
}

/** Read the ambient store; throws outside a provider. */
export function useSelfMediaStore(): SelfMediaStore {
	const ctx = useContext(SelfMediaStoreContext)
	if (!ctx) {
		throw new Error("useSelfMediaStore must be used inside a <SelfMediaStoreProvider>")
	}
	return ctx
}

/** Read the ambient store if any; returns null outside a provider. */
export function useOptionalSelfMediaStore(): SelfMediaStore | null {
	return useContext(SelfMediaStoreContext)
}
