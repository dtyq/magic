import {
	createContext,
	useContext,
	useState,
	useCallback,
	useEffect,
	useRef,
	useMemo,
	type PropsWithChildren,
} from "react"
import type { CanvasDesignStorageData } from "../types.magic"
import { useMagic } from "./MagicContext"
import { isMobile as defaultIsMobile } from "../canvas/utils/utils"

interface LayersUIContextValue {
	collapsed: boolean
	width: number
	resizing: boolean
	transitionAnimation: string
	isMobile: boolean
	setCollapsed: (collapsed: boolean) => void
	setWidth: (width: number) => void
	setResizing: (resizing: boolean) => void
	handleResizeStart: (e: React.MouseEvent) => void
}

const LayersUIContext = createContext<LayersUIContextValue | undefined>(undefined)

export function LayersUIProvider(props: PropsWithChildren<{ getIsMobile?: () => boolean }>) {
	const { children, getIsMobile = defaultIsMobile } = props

	const { methods } = useMagic()

	const defaultTransitionAnimation = "all 0.3s ease-in-out"

	const MIN_WIDTH = 240
	const MAX_WIDTH = 600

	const startXRef = useRef(0)
	const startWidthRef = useRef(0)

	const [width, setWidth] = useState(() => {
		if (getIsMobile()) {
			return MIN_WIDTH
		}
		if (methods?.getStorage) {
			try {
				const storageData = methods.getStorage()
				if (storageData?.layersWidth !== undefined) {
					return storageData.layersWidth
				}
			} catch (error) {
				console.error("加载 layersWidth 状态失败:", error)
			}
		}
		return 320
	})
	const [transitionAnimation, setTransitionAnimation] = useState(defaultTransitionAnimation)
	const [resizing, setResizing] = useState(false)
	const [collapsed, setCollapsed] = useState(() => {
		if (getIsMobile()) {
			return true
		}
		if (methods?.getStorage) {
			try {
				const storageData = methods.getStorage()
				if (storageData?.layersCollapsed !== undefined) {
					return storageData.layersCollapsed
				}
			} catch (error) {
				console.error("加载 layersCollapsed 状态失败:", error)
			}
		}
		return true
	})

	// 监听 collapsed 变化，直接保存到 storage
	useEffect(() => {
		if (!methods?.saveStorage) {
			return
		}
		try {
			// 先获取现有的 storage 数据
			const existingData = methods.getStorage() || {}
			const storageData: CanvasDesignStorageData = {
				...existingData,
				layersCollapsed: collapsed,
			}
			methods.saveStorage(storageData)
		} catch (error) {
			console.error("保存 layersCollapsed 状态失败:", error)
		}
	}, [methods, collapsed])

	// 设置 collapsed 的函数
	const handleSetCollapsed = useCallback((value: boolean) => {
		setCollapsed(value)
	}, [])

	// 设置 width 的函数，移动端禁用
	const handleSetWidth = useCallback(
		(value: number) => {
			if (getIsMobile()) {
				return
			}
			setWidth(value)
		},
		[getIsMobile],
	)

	const handleResizeStart = useCallback(
		(e: React.MouseEvent) => {
			if (getIsMobile()) {
				return
			}
			e.preventDefault()
			setResizing(true)
			startXRef.current = e.clientX
			startWidthRef.current = width
		},
		[width, getIsMobile],
	)

	const handleResizeMove = useCallback(
		(e: MouseEvent) => {
			if (!resizing) return
			const deltaX = e.clientX - startXRef.current
			const newWidth = startWidthRef.current + deltaX

			const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth))
			setWidth(clampedWidth)
		},
		[resizing],
	)

	const handleResizeEnd = useCallback(() => {
		setResizing(false)
		// 拖拽结束时保存宽度到 storage
		if (methods?.saveStorage) {
			try {
				const existingData = methods.getStorage() || {}
				const storageData: CanvasDesignStorageData = {
					...existingData,
					layersWidth: width,
				}
				methods.saveStorage(storageData)
			} catch (error) {
				console.error("保存 layersWidth 状态失败:", error)
			}
		}
	}, [methods, width])

	useEffect(() => {
		if (resizing) {
			document.addEventListener("mousemove", handleResizeMove)
			document.addEventListener("mouseup", handleResizeEnd)
			document.body.style.cursor = "ew-resize"
			document.body.style.userSelect = "none"
			return () => {
				document.removeEventListener("mousemove", handleResizeMove)
				document.removeEventListener("mouseup", handleResizeEnd)
				document.body.style.cursor = ""
				document.body.style.userSelect = ""
			}
		}
	}, [resizing, handleResizeMove, handleResizeEnd])

	useEffect(() => {
		if (resizing) {
			setTransitionAnimation("none")
		} else {
			setTransitionAnimation(defaultTransitionAnimation)
		}
	}, [resizing])

	const isMobileValue = useMemo(() => getIsMobile(), [getIsMobile])

	const value: LayersUIContextValue = useMemo(() => {
		return {
			collapsed,
			width,
			resizing,
			transitionAnimation,
			isMobile: isMobileValue,
			setCollapsed: handleSetCollapsed,
			setWidth: handleSetWidth,
			setResizing,
			handleResizeStart,
		}
	}, [
		collapsed,
		handleResizeStart,
		resizing,
		transitionAnimation,
		width,
		handleSetCollapsed,
		handleSetWidth,
		isMobileValue,
	])

	return <LayersUIContext.Provider value={value}>{children}</LayersUIContext.Provider>
}

export function useLayersUI() {
	const context = useContext(LayersUIContext)
	if (context === undefined) {
		throw new Error("useLayersUI must be used within a LayersUIProvider")
	}
	return context
}
