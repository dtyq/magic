import { createContext, useContext, type ReactNode } from "react"

export const OverlayZIndexContext = createContext<number | null>(null)

export interface OverlayZIndexProviderProps {
	value: number | null | undefined
	children: ReactNode
}

const Z_INDEX_CLASS_PATTERN = /^!?z(-|$|\[)/

/** Provide the host overlay z-index to nested or portaled layers. */
export function OverlayZIndexProvider({ value, children }: OverlayZIndexProviderProps) {
	return (
		<OverlayZIndexContext.Provider value={value ?? null}>
			{children}
		</OverlayZIndexContext.Provider>
	)
}

/** Read the nearest overlay host z-index, such as a preview modal. */
export function useCurrentOverlayZIndex(): number | null {
	return useContext(OverlayZIndexContext)
}

/**
 * Drop Tailwind z-index classes so inline overlay elevation can win.
 * Important editor classes like `!z-[960]` otherwise cover dynamic layers.
 */
export function omitZIndexClassNames(className?: string) {
	if (!className) return className
	const next = className
		.split(/\s+/)
		.filter((token) => token && !Z_INDEX_CLASS_PATTERN.test(token))
		.join(" ")
	return next || undefined
}

/**
 * Raise a floating layer above the current overlay host.
 * Outside a provider, keep explicit values or CSS class defaults.
 */
export function resolveEffectiveOverlayZIndex(
	currentOverlayZIndex: number | null,
	explicitZIndex?: number | string,
	offset = 10,
): number | undefined {
	if (explicitZIndex != null) {
		const parsed = Number(explicitZIndex)
		if (!Number.isNaN(parsed) && currentOverlayZIndex != null) {
			return Math.max(parsed, currentOverlayZIndex + offset)
		}
		return typeof explicitZIndex === "number"
			? explicitZIndex
			: Number(explicitZIndex) || undefined
	}
	if (currentOverlayZIndex != null) {
		return currentOverlayZIndex + offset
	}
	return undefined
}
