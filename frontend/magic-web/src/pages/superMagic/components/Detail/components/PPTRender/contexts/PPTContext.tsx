import {
	createContext,
	useContext,
	useMemo,
	useRef,
	useEffect,
	useLayoutEffect,
	type ReactNode,
} from "react"
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
 * Creates event bus and store instances for each PPTRender component.
 * Uses a single-channel update design: all slide sync flows through store.updateConfig().
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

	// Track previous config to detect actual changes without deep comparison
	const prevConfigRef = useRef<{
		displayConfig: any
		attachmentList: any[] | undefined
		mainFileId: string | undefined
		mainFileName: string | undefined
	} | null>(null)

	// Single-channel update: sync config to store as early as possible (useLayoutEffect)
	// This replaces the previous useDeepCompareEffect which added frame delay
	useLayoutEffect(() => {
		const prev = prevConfigRef.current
		const slidesChanged =
			!prev ||
			JSON.stringify(prev.displayConfig?.slides) !==
				JSON.stringify(storeConfig.displayConfig?.slides)
		const attachmentListChanged = !prev || prev.attachmentList !== storeConfig.attachmentList
		const mainFileChanged =
			!prev ||
			prev.mainFileId !== storeConfig.mainFileId ||
			prev.mainFileName !== storeConfig.mainFileName
		const displayConfigChanged = !prev || prev.displayConfig !== storeConfig.displayConfig

		if (slidesChanged || attachmentListChanged || mainFileChanged || displayConfigChanged) {
			prevConfigRef.current = {
				displayConfig: storeConfig.displayConfig,
				attachmentList: storeConfig.attachmentList,
				mainFileId: storeConfig.mainFileId,
				mainFileName: storeConfig.mainFileName,
			}
			store.updateConfig({
				attachments: storeConfig.attachments,
				attachmentList: storeConfig.attachmentList,
				mainFileId: storeConfig.mainFileId,
				mainFileName: storeConfig.mainFileName,
				displayConfig: storeConfig.displayConfig,
			})
		}
	})

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
