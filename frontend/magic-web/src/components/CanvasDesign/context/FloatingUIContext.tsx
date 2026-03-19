import { createContext, useContext, useRef, useCallback, type ReactNode } from "react"
import type { Canvas } from "../canvas/Canvas"

interface FloatingUIContextValue {
	// 注册悬浮组件
	registerFloatingComponent: (id: string, element: HTMLElement) => void
	// 注销悬浮组件
	unregisterFloatingComponent: (id: string) => void
	// 处理 wheel 事件（转发给 ViewportController）
	handleWheel: (e: WheelEvent) => void
}

const FloatingUIContext = createContext<FloatingUIContextValue | undefined>(undefined)

interface FloatingUIProviderProps {
	children: ReactNode
	canvas: Canvas | null
}

export function FloatingUIProvider({ children, canvas }: FloatingUIProviderProps) {
	// 存储所有悬浮组件的引用
	const floatingComponentsRef = useRef<Map<string, HTMLElement>>(new Map())

	const registerFloatingComponent = useCallback((id: string, element: HTMLElement) => {
		floatingComponentsRef.current.set(id, element)
	}, [])

	const unregisterFloatingComponent = useCallback((id: string) => {
		floatingComponentsRef.current.delete(id)
	}, [])

	// 统一的 wheel 事件处理器
	const handleWheel = useCallback(
		(e: WheelEvent) => {
			if (!canvas) return

			// 转发给 ViewportController 处理
			canvas.viewportController.handleWheelFromFloating(e)
		},
		[canvas],
	)

	const value: FloatingUIContextValue = {
		registerFloatingComponent,
		unregisterFloatingComponent,
		handleWheel,
	}

	return <FloatingUIContext.Provider value={value}>{children}</FloatingUIContext.Provider>
}

export function useFloatingUI() {
	const context = useContext(FloatingUIContext)
	if (context === undefined) {
		throw new Error("useFloatingUI must be used within a FloatingUIProvider")
	}
	return context
}
