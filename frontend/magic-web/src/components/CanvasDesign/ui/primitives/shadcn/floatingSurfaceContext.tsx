import { createContext, useContext, type ReactNode } from "react"

const FloatingSurfaceContext = createContext<string | null>(null)

export function FloatingSurfaceScope(props: { id: string; children: ReactNode }) {
	return (
		<FloatingSurfaceContext.Provider value={props.id}>
			{props.children}
		</FloatingSurfaceContext.Provider>
	)
}

export function useFloatingSurfaceId() {
	return useContext(FloatingSurfaceContext)
}
