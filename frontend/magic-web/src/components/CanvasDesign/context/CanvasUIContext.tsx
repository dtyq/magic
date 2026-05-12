import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from "react"
import type { LayerElement } from "../canvas/types"
import { useCanvasEvent } from "../hooks/useCanvasEvent"
import { useCanvasElements } from "../hooks/useCanvasElement"
import { useUpdateEffect } from "ahooks"
import type { ElementToolType } from "../types"

interface CanvasUIContextValue {
	// 当前正在图层列表中重命名的元素 ID
	layerRenamingElementId: string | null
	setLayerRenamingElementId: (id: string | null) => void

	// 当前正在画布中重命名的元素 ID
	canvasRenamingElementId: string | null
	setCanvasRenamingElementId: (id: string | null) => void

	// 选中的元素 ID 列表（从 Canvas.selectionManager 同步）
	selectedElementIds: string[]

	// 选中的元素列表
	selectedElements: LayerElement[]

	// 是否正在拖拽元素
	isDragging: boolean

	// 是否正在框选元素
	isSelecting: boolean

	// 当前查看历史记录的图片元素 ID（null 表示不显示）
	messageHistoryElementId: string | null
	setMessageHistoryElementId: (id: string | null) => void

	// 当前全屏播放的视频元素 ID（null 表示不显示）
	fullscreenVideoElementId: string | null
	setFullscreenVideoElementId: (id: string | null) => void

	// 当前正在裁剪的图片元素 ID（null 表示不在裁剪模式）
	croppingElementId: string | null
	setCroppingElementId: (id: string | null) => void

	// 当前正在扩展的图片元素 ID（null 表示不在扩展模式）
	extendingElementId: string | null
	setExtendingElementId: (id: string | null) => void

	// 当前正在使用橡皮擦的图片元素 ID（null 表示不在橡皮擦模式）
	erasingElementId: string | null
	setErasingElementId: (id: string | null) => void

	// 画布提示
	subElementTooltip: ElementToolType | null
	setSubElementTooltip: (type: ElementToolType | null) => void

	// 画布是否处于只读模式
	readonly?: boolean
}

interface CanvasRenameUIContextValue {
	layerRenamingElementId: string | null
	setLayerRenamingElementId: (id: string | null) => void
	canvasRenamingElementId: string | null
	setCanvasRenamingElementId: (id: string | null) => void
}

interface CanvasSelectionUIContextValue {
	selectedElementIds: string[]
	selectedElements: LayerElement[]
	isDragging: boolean
	isSelecting: boolean
	subElementTooltip: ElementToolType | null
	setSubElementTooltip: (type: ElementToolType | null) => void
}

interface CanvasPanelUIContextValue {
	messageHistoryElementId: string | null
	setMessageHistoryElementId: (id: string | null) => void
	fullscreenVideoElementId: string | null
	setFullscreenVideoElementId: (id: string | null) => void
}

interface CanvasModeUIContextValue {
	croppingElementId: string | null
	setCroppingElementId: (id: string | null) => void
	extendingElementId: string | null
	setExtendingElementId: (id: string | null) => void
	erasingElementId: string | null
	setErasingElementId: (id: string | null) => void
	readonly?: boolean
}

const CanvasRenameUIContext = createContext<CanvasRenameUIContextValue | undefined>(undefined)
const CanvasSelectionUIContext = createContext<CanvasSelectionUIContextValue | undefined>(undefined)
const CanvasPanelUIContext = createContext<CanvasPanelUIContextValue | undefined>(undefined)
const CanvasModeUIContext = createContext<CanvasModeUIContextValue | undefined>(undefined)

interface CanvasUIProviderProps {
	readonly?: boolean
	children: ReactNode
}

export function CanvasUIProvider({ children, readonly }: CanvasUIProviderProps) {
	const [layerRenamingElementId, setLayerRenamingElementId] = useState<string | null>(null)
	const [canvasRenamingElementId, setCanvasRenamingElementId] = useState<string | null>(null)

	const [selectedElementIds, setSelectedElementIds] = useState<string[]>([])
	const [isDragging, setIsDragging] = useState(false)
	const [isSelecting, setIsSelecting] = useState(false)

	const [messageHistoryElementId, setMessageHistoryElementId] = useState<string | null>(null)
	const [fullscreenVideoElementId, setFullscreenVideoElementId] = useState<string | null>(null)

	const [croppingElementId, setCroppingElementId] = useState<string | null>(null)
	const [extendingElementId, setExtendingElementId] = useState<string | null>(null)
	const [erasingElementId, setErasingElementId] = useState<string | null>(null)

	const [subElementTooltip, setSubElementTooltip] = useState<ElementToolType | null>(null)

	// 监听选中事件
	useCanvasEvent("element:select", ({ data }) => {
		setSelectedElementIds(data.elementIds)
		setSubElementTooltip(null)
	})

	// 监听取消选中事件
	useCanvasEvent("element:deselect", () => {
		setSelectedElementIds([])
		setSubElementTooltip(null)
	})

	// 监听拖拽开始事件
	useCanvasEvent("elements:transform:dragstart", () => {
		setIsDragging(true)
	})

	// 监听拖拽结束事件
	useCanvasEvent("elements:transform:dragend", () => {
		setIsDragging(false)
	})

	// 监听框选开始事件
	useCanvasEvent("selection:start", () => {
		setIsSelecting(true)
	})

	// 监听框选结束事件
	useCanvasEvent("selection:end", () => {
		setIsSelecting(false)
	})

	const openMessageHistory = useCallback((elementId: string) => {
		setMessageHistoryElementId(elementId)
	}, [])

	useCanvasEvent("element:image:infoButtonClick", ({ data }) => {
		openMessageHistory(data.elementId)
	})

	useCanvasEvent("element:video:infoButtonClick", ({ data }) => {
		openMessageHistory(data.elementId)
	})

	useCanvasEvent(
		"element:video:fullscreenClick",
		({ data }) => {
			setFullscreenVideoElementId(data.elementId)
		},
		[],
	)

	// 监听进入裁剪模式事件
	useCanvasEvent("crop:enter", ({ data }) => {
		setCroppingElementId(data.elementId)
	})

	// 监听退出裁剪模式事件
	useCanvasEvent("crop:exit", () => {
		setCroppingElementId(null)
	})

	useCanvasEvent("extend:enter", ({ data }) => {
		setExtendingElementId(data.elementId)
	})

	useCanvasEvent("extend:exit", () => {
		setExtendingElementId(null)
	})

	// 监听进入橡皮擦模式事件
	useCanvasEvent("eraser:enter", ({ data }) => {
		setErasingElementId(data.elementId)
	})

	// 监听退出橡皮擦模式事件
	useCanvasEvent("eraser:exit", () => {
		setErasingElementId(null)
	})

	useUpdateEffect(() => {
		if (selectedElementIds.length !== 1 || selectedElementIds[0] !== messageHistoryElementId) {
			setMessageHistoryElementId(null)
		}
	}, [selectedElementIds])

	useUpdateEffect(() => {
		if (!readonly) return
		setLayerRenamingElementId(null)
		setCanvasRenamingElementId(null)
	}, [readonly])

	// 获取选中的元素列表
	const selectedElements = useCanvasElements(selectedElementIds)

	const renameValue = useMemo<CanvasRenameUIContextValue>(() => {
		return {
			layerRenamingElementId,
			setLayerRenamingElementId,
			canvasRenamingElementId,
			setCanvasRenamingElementId,
		}
	}, [layerRenamingElementId, canvasRenamingElementId])

	const selectionValue = useMemo<CanvasSelectionUIContextValue>(() => {
		return {
			selectedElements,
			selectedElementIds,
			isDragging,
			isSelecting,
			subElementTooltip,
			setSubElementTooltip,
		}
	}, [selectedElements, selectedElementIds, isDragging, isSelecting, subElementTooltip])

	const panelValue = useMemo<CanvasPanelUIContextValue>(() => {
		return {
			messageHistoryElementId,
			setMessageHistoryElementId,
			fullscreenVideoElementId,
			setFullscreenVideoElementId,
		}
	}, [messageHistoryElementId, fullscreenVideoElementId])

	const modeValue = useMemo<CanvasModeUIContextValue>(() => {
		return {
			croppingElementId,
			setCroppingElementId,
			extendingElementId,
			setExtendingElementId,
			erasingElementId,
			setErasingElementId,
			readonly,
		}
	}, [croppingElementId, extendingElementId, erasingElementId, readonly])

	return (
		<CanvasRenameUIContext.Provider value={renameValue}>
			<CanvasSelectionUIContext.Provider value={selectionValue}>
				<CanvasPanelUIContext.Provider value={panelValue}>
					<CanvasModeUIContext.Provider value={modeValue}>
						{children}
					</CanvasModeUIContext.Provider>
				</CanvasPanelUIContext.Provider>
			</CanvasSelectionUIContext.Provider>
		</CanvasRenameUIContext.Provider>
	)
}

export function useCanvasRenameUI() {
	const context = useContext(CanvasRenameUIContext)
	if (context === undefined) {
		throw new Error("useCanvasRenameUI must be used within a CanvasUIProvider")
	}
	return context
}

export function useCanvasSelectionUI() {
	const context = useContext(CanvasSelectionUIContext)
	if (context === undefined) {
		throw new Error("useCanvasSelectionUI must be used within a CanvasUIProvider")
	}
	return context
}

export function useCanvasPanelUI() {
	const context = useContext(CanvasPanelUIContext)
	if (context === undefined) {
		throw new Error("useCanvasPanelUI must be used within a CanvasUIProvider")
	}
	return context
}

export function useCanvasModeUI() {
	const context = useContext(CanvasModeUIContext)
	if (context === undefined) {
		throw new Error("useCanvasModeUI must be used within a CanvasUIProvider")
	}
	return context
}

export function useCanvasUI() {
	const value: CanvasUIContextValue = {
		...useCanvasRenameUI(),
		...useCanvasSelectionUI(),
		...useCanvasPanelUI(),
		...useCanvasModeUI(),
	}
	return value
}
