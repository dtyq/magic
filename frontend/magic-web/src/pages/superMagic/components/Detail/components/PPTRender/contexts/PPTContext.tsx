import { createContext, useContext, useMemo, useRef, useEffect, type ReactNode } from "react"
import { useDeepCompareEffect } from "ahooks"
import { createPPTEventBus, type PPTEventBus } from "../events/PPTEventBus"
import { createPPTStore, type PPTStore, type PPTStoreConfig } from "../stores"

interface PPTContextValue {
	eventBus: PPTEventBus
	store: PPTStore
}

export const PPTContext = createContext<PPTContextValue | undefined>(undefined)

interface PPTProviderProps {
	children: ReactNode
	storeConfig: PPTStoreConfig
}

/**
 * Provider for PPT components
 * Creates event bus and store instances for each PPTRender component
 */
export function PPTProvider({ children, storeConfig }: PPTProviderProps) {
	// Create event bus instance once per PPTRender
	const eventBus = useMemo(() => createPPTEventBus(), [])

	// Create Store instance (memoized to prevent recreation)
	const storeRef = useRef<PPTStore | null>(null)
	if (!storeRef.current) {
		storeRef.current = createPPTStore(storeConfig)
	}
	const store = storeRef.current

	// Update store config when dependencies change
	useDeepCompareEffect(() => {
		store.updateConfig({
			attachments: storeConfig.attachments,
			attachmentList: storeConfig.attachmentList,
			mainFileId: storeConfig.mainFileId,
			mainFileName: storeConfig.mainFileName,
			metadata: storeConfig.metadata,
		})
	}, [
		storeConfig.attachments,
		storeConfig.attachmentList,
		storeConfig.mainFileId,
		storeConfig.mainFileName,
		storeConfig.metadata,
		store,
	])

	// Update cache config when organizationCode or selectedProjectId changes
	useEffect(() => {
		store.updateCacheConfig({
			organizationCode: storeConfig.organizationCode,
			selectedProjectId: storeConfig.selectedProjectId,
		})
	}, [storeConfig.organizationCode, storeConfig.selectedProjectId, store])

	const value = useMemo(() => ({ eventBus, store }), [eventBus, store])

	return <PPTContext.Provider value={value}>{children}</PPTContext.Provider>
}

/**
 * Hook to access PPT Event Bus instance
 * @throws Error if used outside PPTProvider
 */
export function usePPTEventBusContext(): PPTEventBus {
	const context = useContext(PPTContext)
	if (context === undefined) {
		throw new Error("usePPTEventBusContext must be used within PPTProvider")
	}
	return context.eventBus
}

/**
 * Hook to access PPT Store instance
 * @throws Error if used outside PPTProvider
 */
export function usePPTStore(): PPTStore {
	const context = useContext(PPTContext)
	if (context === undefined) {
		throw new Error("usePPTStore must be used within PPTProvider")
	}
	return context.store
}

/**
 * Hook to access both Event Bus and Store
 * @throws Error if used outside PPTProvider
 */
export function usePPTContext(): PPTContextValue {
	const context = useContext(PPTContext)
	if (context === undefined) {
		throw new Error("usePPTContext must be used within PPTProvider")
	}
	return context
}
