import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import type { Canvas } from "../canvas/Canvas"

/**
 * Canvas Context - 只负责提供 Canvas 实例
 * 职责：提供 Canvas 实例的访问
 */
interface CanvasContextValue {
	canvas: Canvas | null
	setCanvas: (canvas: Canvas | null) => void
}

const CanvasContext = createContext<CanvasContextValue | undefined>(undefined)

interface CanvasProviderProps {
	children: ReactNode
}

export function CanvasProvider({ children }: CanvasProviderProps) {
	const [canvas, setCanvas] = useState<Canvas | null>(null)

	const value: CanvasContextValue = useMemo(() => {
		return {
			canvas,
			setCanvas,
		}
	}, [canvas])

	return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
}

export function useCanvas() {
	const context = useContext(CanvasContext)
	if (context === undefined) {
		throw new Error("useCanvas must be used within a CanvasProvider")
	}
	return context
}
