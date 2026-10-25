import { createContext, useContext, useRef, useCallback, useEffect, type ReactNode } from "react"
import type { Canvas } from "../../runtime/core/Canvas"

// History and bottom-toolbar surfaces use z-index: 2. Editors use z-index: 3
// so they stay above History even after pointerleave; the temporary promotion
// remains at the existing fixed-control tier for the other interactive surfaces.
const ACTIVE_FLOATING_Z_INDEX = "3"
const FLOATING_SURFACE_POPOVER_SELECTOR =
	"[data-floating-surface-popover][data-floating-surface-owner]"

export interface FloatingComponentOptions {
	/** Enables temporary z-index promotion while the pointer is over the surface. */
	interactive?: boolean
}

interface FloatingComponentEntry {
	element: HTMLElement
	interactive: boolean
	defaultZIndex: string
	relatedElements: Set<HTMLElement>
	deactivateTimer: number | null
}

interface FloatingUIContextValue {
	/** Host-provided collision boundary for floating surfaces. */
	floatingBoundary: HTMLElement | null
	// 注册悬浮组件
	registerFloatingComponent: (
		id: string,
		element: HTMLElement,
		options?: FloatingComponentOptions,
	) => void
	// 注销悬浮组件
	unregisterFloatingComponent: (id: string) => void
	// 临时提升指定悬浮组件层级
	activateFloatingComponent: (id: string) => void
	// 在 pointerleave 后恢复默认层级
	deactivateFloatingComponent: (id: string, relatedTarget?: EventTarget | null) => void
	// 注册通过 Portal 渲染、但仍属于当前悬浮组件的 DOM 节点
	registerFloatingRelatedElement: (id: string, element: HTMLElement) => () => void
	// 处理 wheel 事件（转发给 ViewportController）
	handleWheel: (e: WheelEvent) => void
}

const FloatingUIContext = createContext<FloatingUIContextValue | undefined>(undefined)

interface FloatingUIProviderProps {
	children: ReactNode
	canvas: Canvas | null
	floatingBoundary?: HTMLElement | null
}

export function FloatingUIProvider({
	children,
	canvas,
	floatingBoundary = null,
}: FloatingUIProviderProps) {
	// 存储所有悬浮组件的引用
	const floatingComponentsRef = useRef<Map<string, FloatingComponentEntry>>(new Map())
	const activeFloatingComponentRef = useRef<string | null>(null)

	const restoreDefaultZIndex = useCallback((entry: FloatingComponentEntry) => {
		entry.element.style.zIndex = entry.defaultZIndex
	}, [])

	const activateFloatingComponent = useCallback(
		(id: string) => {
			const entry = floatingComponentsRef.current.get(id)
			if (!entry?.interactive) return

			if (entry.deactivateTimer !== null) {
				window.clearTimeout(entry.deactivateTimer)
				entry.deactivateTimer = null
			}

			const previousId = activeFloatingComponentRef.current
			if (previousId && previousId !== id) {
				const previousEntry = floatingComponentsRef.current.get(previousId)
				if (previousEntry) restoreDefaultZIndex(previousEntry)
			}

			entry.element.style.zIndex = ACTIVE_FLOATING_Z_INDEX
			activeFloatingComponentRef.current = id
		},
		[restoreDefaultZIndex],
	)

	const deactivateFloatingComponent = useCallback(
		(id: string, relatedTarget?: EventTarget | null) => {
			const entry = floatingComponentsRef.current.get(id)
			const target = relatedTarget instanceof Node ? relatedTarget : null
			if (!entry || activeFloatingComponentRef.current !== id) return

			let isInsideRelatedElement = false
			if (target) {
				for (const relatedElement of entry.relatedElements) {
					if (relatedElement.contains(target)) {
						isInsideRelatedElement = true
						break
					}
				}
			}
			if (target && (entry.element.contains(target) || isInsideRelatedElement)) {
				return
			}

			if (entry.deactivateTimer !== null) window.clearTimeout(entry.deactivateTimer)
			entry.deactivateTimer = window.setTimeout(() => {
				entry.deactivateTimer = null
				if (activeFloatingComponentRef.current !== id) return
				restoreDefaultZIndex(entry)
				activeFloatingComponentRef.current = null
			}, 0)
		},
		[restoreDefaultZIndex],
	)

	const registerFloatingComponent = useCallback(
		(id: string, element: HTMLElement, options?: FloatingComponentOptions) => {
			floatingComponentsRef.current.set(id, {
				element,
				interactive: options?.interactive === true,
				defaultZIndex: element.style.zIndex,
				relatedElements: new Set(),
				deactivateTimer: null,
			})
		},
		[],
	)

	const unregisterFloatingComponent = useCallback(
		(id: string) => {
			const entry = floatingComponentsRef.current.get(id)
			if (!entry) return
			if (entry.deactivateTimer !== null) window.clearTimeout(entry.deactivateTimer)
			if (activeFloatingComponentRef.current === id) {
				restoreDefaultZIndex(entry)
				activeFloatingComponentRef.current = null
			}
			floatingComponentsRef.current.delete(id)
		},
		[restoreDefaultZIndex],
	)

	const registerFloatingRelatedElement = useCallback((id: string, element: HTMLElement) => {
		const entry = floatingComponentsRef.current.get(id)
		if (!entry) return () => undefined
		entry.relatedElements.add(element)
		return () => {
			entry.relatedElements.delete(element)
		}
	}, [])

	useEffect(() => {
		const handlePointerOver = (event: PointerEvent) => {
			const target = event.target
			if (!(target instanceof Element)) return
			const popover = target.closest<HTMLElement>(FLOATING_SURFACE_POPOVER_SELECTOR)
			const ownerId = popover?.dataset.floatingSurfaceOwner
			if (!popover || !ownerId) return
			activateFloatingComponent(ownerId)
		}

		const handlePointerOut = (event: PointerEvent) => {
			const target = event.target
			if (!(target instanceof Element)) return
			const popover = target.closest<HTMLElement>(FLOATING_SURFACE_POPOVER_SELECTOR)
			const ownerId = popover?.dataset.floatingSurfaceOwner
			if (!popover || !ownerId) return

			const relatedTarget = event.relatedTarget
			if (relatedTarget instanceof Node && popover.contains(relatedTarget)) return
			deactivateFloatingComponent(ownerId, relatedTarget)
		}

		document.addEventListener("pointerover", handlePointerOver, true)
		document.addEventListener("pointerout", handlePointerOut, true)
		return () => {
			document.removeEventListener("pointerover", handlePointerOver, true)
			document.removeEventListener("pointerout", handlePointerOut, true)
		}
	}, [activateFloatingComponent, deactivateFloatingComponent])

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
		floatingBoundary,
		registerFloatingComponent,
		unregisterFloatingComponent,
		activateFloatingComponent,
		deactivateFloatingComponent,
		registerFloatingRelatedElement,
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

/**
 * Reads the host-provided collision boundary without requiring callers to be
 * mounted under a FloatingUIProvider. This keeps primitive Popover usage
 * backwards-compatible in isolated tests and standalone consumers.
 */
export function useFloatingBoundary() {
	return useContext(FloatingUIContext)?.floatingBoundary ?? null
}
