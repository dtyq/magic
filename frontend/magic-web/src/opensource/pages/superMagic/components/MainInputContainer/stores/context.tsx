import { createContext, ReactNode, useContext, useMemo } from "react"
import { ScenePanelVariant } from "../components/LazyScenePanel/types"
import { SceneStateStore } from "./SceneStateStore"

interface SceneStateContextValue {
	store: SceneStateStore
	variant?: ScenePanelVariant
}

const SceneStateContext = createContext<SceneStateContextValue | null>(null)

interface SceneStateProviderProps {
	store?: SceneStateStore
	variant?: ScenePanelVariant
	preferParent?: boolean
	children: ReactNode
}

export function SceneStateProvider({
	store,
	variant,
	preferParent = false,
	children,
}: SceneStateProviderProps) {
	const parentContext = useContext(SceneStateContext)
	const parentStore = parentContext?.store
	const parentVariant = parentContext?.variant
	const effectiveStore = preferParent ? (parentStore ?? store) : (store ?? parentStore)
	const effectiveVariant = preferParent ? (parentVariant ?? variant) : (variant ?? parentVariant)

	const contextValue = useMemo<SceneStateContextValue | null>(() => {
		if (!effectiveStore) return null
		return {
			store: effectiveStore,
			variant: effectiveVariant,
		}
	}, [effectiveStore, effectiveVariant])

	if (!contextValue) return <>{children}</>

	return <SceneStateContext.Provider value={contextValue}>{children}</SceneStateContext.Provider>
}

// Backward compatible alias.
export const SceneStateStoreProvider = SceneStateProvider

export function useOptionalSceneStateStore() {
	return useContext(SceneStateContext)?.store ?? null
}

export function useOptionalScenePanelVariant() {
	return useContext(SceneStateContext)?.variant
}

export function useSceneStateStore() {
	const store = useOptionalSceneStateStore()
	if (!store) {
		throw new Error("useSceneStateStore must be used within SceneStateProvider")
	}

	return store
}
