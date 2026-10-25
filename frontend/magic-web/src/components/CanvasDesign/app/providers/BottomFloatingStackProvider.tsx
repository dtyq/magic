import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react"

const BOTTOM_FLOATING_STACK_GAP = 12

interface BottomFloatingSurfaceRegistration {
	elementId: string
	order: number
	height: number
}

interface BottomFloatingStackContextValue {
	offsets: ReadonlyMap<string, number>
	registerSurface: (surfaceId: string, registration: BottomFloatingSurfaceRegistration) => void
	updateSurfaceHeight: (surfaceId: string, height: number) => void
	unregisterSurface: (surfaceId: string) => void
}

const EMPTY_OFFSETS = new Map<string, number>()

const BottomFloatingStackContext = createContext<BottomFloatingStackContextValue>({
	offsets: EMPTY_OFFSETS,
	registerSurface: () => undefined,
	updateSurfaceHeight: () => undefined,
	unregisterSurface: () => undefined,
})

export function resolveBottomFloatingStackOffsets(
	surfaces: ReadonlyMap<string, BottomFloatingSurfaceRegistration>,
): Map<string, number> {
	const grouped = new Map<string, Array<[string, BottomFloatingSurfaceRegistration]>>()
	for (const entry of surfaces) {
		const group = grouped.get(entry[1].elementId) ?? []
		group.push(entry)
		grouped.set(entry[1].elementId, group)
	}

	const offsets = new Map<string, number>()
	for (const group of grouped.values()) {
		group.sort(
			(left, right) => left[1].order - right[1].order || left[0].localeCompare(right[0]),
		)
		let offset = 0
		for (const [surfaceId, registration] of group) {
			offsets.set(surfaceId, offset)
			offset += registration.height + BOTTOM_FLOATING_STACK_GAP
		}
	}
	return offsets
}

export function BottomFloatingStackProvider({ children }: { children: ReactNode }) {
	const [surfaces, setSurfaces] = useState<Map<string, BottomFloatingSurfaceRegistration>>(
		() => new Map(),
	)

	const registerSurface = useCallback(
		(surfaceId: string, registration: BottomFloatingSurfaceRegistration) => {
			setSurfaces((current) => {
				const previous = current.get(surfaceId)
				if (
					previous?.elementId === registration.elementId &&
					previous.order === registration.order &&
					previous.height === registration.height
				) {
					return current
				}
				const next = new Map(current)
				next.set(surfaceId, registration)
				return next
			})
		},
		[],
	)

	const updateSurfaceHeight = useCallback((surfaceId: string, height: number) => {
		setSurfaces((current) => {
			const previous = current.get(surfaceId)
			if (!previous || previous.height === height) return current
			const next = new Map(current)
			next.set(surfaceId, { ...previous, height })
			return next
		})
	}, [])

	const unregisterSurface = useCallback((surfaceId: string) => {
		setSurfaces((current) => {
			if (!current.has(surfaceId)) return current
			const next = new Map(current)
			next.delete(surfaceId)
			return next
		})
	}, [])

	const value = useMemo(
		() => ({
			offsets: resolveBottomFloatingStackOffsets(surfaces),
			registerSurface,
			updateSurfaceHeight,
			unregisterSurface,
		}),
		[registerSurface, surfaces, unregisterSurface, updateSurfaceHeight],
	)

	return (
		<BottomFloatingStackContext.Provider value={value}>
			{children}
		</BottomFloatingStackContext.Provider>
	)
}

export function useBottomFloatingSurface(options: {
	surfaceId: string
	elementId: string | null | undefined
	order: number
	enabled: boolean
}) {
	const { offsets, registerSurface, updateSurfaceHeight, unregisterSurface } = useContext(
		BottomFloatingStackContext,
	)
	const nodeRef = useRef<HTMLDivElement | null>(null)
	const { surfaceId, elementId, order, enabled } = options

	const setRef = useCallback((node: HTMLDivElement | null) => {
		nodeRef.current = node
	}, [])

	useEffect(() => {
		if (!enabled || !elementId) {
			unregisterSurface(surfaceId)
			return
		}

		const node = nodeRef.current
		registerSurface(surfaceId, {
			elementId,
			order,
			height: node?.offsetHeight ?? 0,
		})

		if (!node || typeof ResizeObserver === "undefined") {
			return () => unregisterSurface(surfaceId)
		}
		const observer = new ResizeObserver(() => {
			updateSurfaceHeight(surfaceId, node.offsetHeight)
		})
		observer.observe(node)
		return () => {
			observer.disconnect()
			unregisterSurface(surfaceId)
		}
	}, [
		elementId,
		enabled,
		order,
		registerSurface,
		surfaceId,
		unregisterSurface,
		updateSurfaceHeight,
	])

	return {
		containerRef: setRef,
		stackOffset: offsets.get(surfaceId) ?? 0,
	}
}
