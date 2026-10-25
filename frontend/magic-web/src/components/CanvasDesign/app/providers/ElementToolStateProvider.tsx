import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import type { ElementToolType } from "../../public/props"
import { useCanvasEvent } from "../hooks/canvas/useCanvasEvent"

type ElementToolStateRecord = Record<string, unknown>
type ElementToolStateStore = Record<string, ElementToolStateRecord>

interface ElementToolStateContextValue {
	getElementToolState: <T>(
		elementId: string,
		toolType: ElementToolType,
		contentId?: string,
	) => T | undefined
	setElementToolState: <T>(
		elementId: string,
		toolType: ElementToolType,
		state: T,
		contentId?: string,
	) => void
	clearElementToolState: (
		elementId: string,
		toolType: ElementToolType,
		contentId?: string,
	) => void
	clearElementToolStates: (elementId: string) => void
	clearAllElementToolStates: () => void
}

interface ElementToolStateProviderProps {
	children: ReactNode
}

const ElementToolStateContext = createContext<ElementToolStateContextValue | undefined>(undefined)

export function ElementToolStateProvider({ children }: ElementToolStateProviderProps) {
	const [store, setStore] = useState<ElementToolStateStore>({})

	const getElementToolState = useCallback(
		<T,>(elementId: string, toolType: ElementToolType, contentId?: string): T | undefined => {
			const key = contentId ? `${toolType}\u0000${contentId}` : toolType
			return store[elementId]?.[key] as T | undefined
		},
		[store],
	)

	const setElementToolState = useCallback(
		<T,>(elementId: string, toolType: ElementToolType, state: T, contentId?: string) => {
			if (!elementId) return
			const key = contentId ? `${toolType}\u0000${contentId}` : toolType
			setStore((prev) => ({
				...prev,
				[elementId]: {
					...prev[elementId],
					[key]: state,
				},
			}))
		},
		[],
	)

	const clearElementToolState = useCallback(
		(elementId: string, toolType: ElementToolType, contentId?: string) => {
			if (!elementId) return
			const key = contentId ? `${toolType}\u0000${contentId}` : toolType
			setStore((prev) => {
				const elementStates = prev[elementId]
				if (!elementStates || !(key in elementStates)) return prev

				const nextElementStates = { ...elementStates }
				delete nextElementStates[key]

				const next = { ...prev }
				if (Object.keys(nextElementStates).length === 0) {
					delete next[elementId]
					return next
				}

				next[elementId] = nextElementStates
				return next
			})
		},
		[],
	)

	const clearElementToolStates = useCallback((elementId: string) => {
		if (!elementId) return
		setStore((prev) => {
			if (!prev[elementId]) return prev
			const next = { ...prev }
			delete next[elementId]
			return next
		})
	}, [])

	const clearAllElementToolStates = useCallback(() => {
		setStore({})
	}, [])

	useCanvasEvent(
		"element:deleted",
		({ data }) => {
			clearElementToolStates(data.elementId)
		},
		[clearElementToolStates],
	)

	useCanvasEvent("document:loaded", clearAllElementToolStates, [clearAllElementToolStates])

	const value = useMemo<ElementToolStateContextValue>(
		() => ({
			getElementToolState,
			setElementToolState,
			clearElementToolState,
			clearElementToolStates,
			clearAllElementToolStates,
		}),
		[
			clearAllElementToolStates,
			clearElementToolState,
			clearElementToolStates,
			getElementToolState,
			setElementToolState,
		],
	)

	return (
		<ElementToolStateContext.Provider value={value}>
			{children}
		</ElementToolStateContext.Provider>
	)
}

export function useElementToolState<T>(
	elementId: string | null | undefined,
	toolType: ElementToolType,
	contentId?: string,
) {
	const context = useContext(ElementToolStateContext)
	if (context === undefined) {
		throw new Error("useElementToolState must be used within an ElementToolStateProvider")
	}

	const state = elementId
		? context.getElementToolState<T>(elementId, toolType, contentId)
		: undefined

	const setState = useCallback(
		(nextState: T) => {
			if (!elementId) return
			context.setElementToolState(elementId, toolType, nextState, contentId)
		},
		[context, contentId, elementId, toolType],
	)

	const clearState = useCallback(() => {
		if (!elementId) return
		context.clearElementToolState(elementId, toolType, contentId)
	}, [context, contentId, elementId, toolType])

	return {
		state,
		setState,
		clearState,
	}
}
