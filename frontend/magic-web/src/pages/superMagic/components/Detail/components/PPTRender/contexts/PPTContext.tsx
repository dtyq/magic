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
import { getFolderScopedAttachmentSignature } from "./attachmentListSignature"
import { usePPTStoreDisposal } from "./usePPTStoreDisposal"

interface PPTContextValue {
	eventBus: PPTEventBus
	store: PPTStore
}

export const PPTContext = createContext<PPTContextValue | undefined>(undefined)

interface PPTProviderProps {
	children: ReactNode
	storeConfig: PPTStoreConfig
}

function getJsonSignature(value: unknown): string {
	try {
		return JSON.stringify(value ?? null)
	} catch {
		return String(value)
	}
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
	// 签名仅随文件快照和 PPT 入口更新；切页或展示配置变化不再次扫描整个项目。
	const attachmentListSignature = useMemo(
		() =>
			getFolderScopedAttachmentSignature(storeConfig.attachmentList, storeConfig.mainFileId),
		[storeConfig.attachmentList, storeConfig.mainFileId],
	)

	// Track previous config to detect actual changes without deep comparison
	const prevConfigRef = useRef<{
		displayConfig: any
		displayConfigSlidesSignature: string
		attachmentListSignature: string
		attachmentLoadState: PPTStoreConfig["attachmentLoadState"]
		projectId: PPTStoreConfig["projectId"]
		mainFileId: string | undefined
		mainFileName: string | undefined
		initialActiveIndex: number | undefined
		fileApiIdentityKey: string
	} | null>(null)

	// Single-channel update: sync config to store as early as possible (useLayoutEffect)
	// This replaces the previous useDeepCompareEffect which added frame delay
	useLayoutEffect(() => {
		const prev = prevConfigRef.current
		const displayConfigSlidesSignature = getJsonSignature(storeConfig.displayConfig?.slides)
		const fileApiIdentityKey = storeConfig.fileApi?.identityKey ?? "none"
		const slidesChanged =
			!prev || prev.displayConfigSlidesSignature !== displayConfigSlidesSignature
		const attachmentListChanged =
			!prev || prev.attachmentListSignature !== attachmentListSignature
		const attachmentLoadStateChanged =
			!prev ||
			prev.projectId !== storeConfig.projectId ||
			prev.attachmentLoadState?.projectId !== storeConfig.attachmentLoadState?.projectId ||
			prev.attachmentLoadState?.status !== storeConfig.attachmentLoadState?.status
		const mainFileChanged =
			!prev ||
			prev.mainFileId !== storeConfig.mainFileId ||
			prev.mainFileName !== storeConfig.mainFileName
		const displayConfigChanged = !prev || prev.displayConfig !== storeConfig.displayConfig
		const initialActiveIndexChanged =
			!prev || prev.initialActiveIndex !== storeConfig.initialActiveIndex
		const fileApiChanged = !prev || prev.fileApiIdentityKey !== fileApiIdentityKey

		if (
			slidesChanged ||
			attachmentListChanged ||
			attachmentLoadStateChanged ||
			mainFileChanged ||
			displayConfigChanged ||
			initialActiveIndexChanged ||
			fileApiChanged
		) {
			prevConfigRef.current = {
				displayConfig: storeConfig.displayConfig,
				displayConfigSlidesSignature,
				attachmentListSignature,
				attachmentLoadState: storeConfig.attachmentLoadState,
				projectId: storeConfig.projectId,
				mainFileId: storeConfig.mainFileId,
				mainFileName: storeConfig.mainFileName,
				initialActiveIndex: storeConfig.initialActiveIndex,
				fileApiIdentityKey,
			}
			void store.updateConfig({
				projectId: storeConfig.projectId,
				attachments: storeConfig.attachments,
				attachmentList: storeConfig.attachmentList,
				attachmentLoadState: storeConfig.attachmentLoadState,
				mainFileId: storeConfig.mainFileId,
				mainFileName: storeConfig.mainFileName,
				displayConfig: storeConfig.displayConfig,
				initialActiveIndex: storeConfig.initialActiveIndex,
				fileApi: storeConfig.fileApi,
			})
		}
	}, [
		store,
		attachmentListSignature,
		storeConfig.attachments,
		storeConfig.attachmentList,
		storeConfig.attachmentLoadState,
		storeConfig.projectId,
		storeConfig.displayConfig,
		storeConfig.fileApi?.identityKey,
		storeConfig.mainFileId,
		storeConfig.mainFileName,
		storeConfig.initialActiveIndex,
	])

	// Abort queued/running slide work after a real unmount (StrictMode replays effects in dev).
	usePPTStoreDisposal(store)

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
