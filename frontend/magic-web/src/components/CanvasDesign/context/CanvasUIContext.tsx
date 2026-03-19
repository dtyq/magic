import { createContext, useContext, useState, useMemo, type ReactNode } from "react"
import type { LayerElement } from "../canvas/types"
import { useCanvasEvent } from "../hooks/useCanvasEvent"
import { useCanvasElements } from "../hooks/useCanvasElement"
import { useUpdateEffect } from "ahooks"
import type { ElementToolType } from "../types"

interface CanvasUIContextValue {
	// 当前正在编辑的元素 ID
	editingElementId: string | null
	setEditingElementId: (id: string | null) => void

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

	// 画布提示
	subElementTooltip: ElementToolType | null
	setSubElementTooltip: (type: ElementToolType | null) => void

	// 画布是否处于只读模式
	readonly?: boolean
}

const CanvasUIContext = createContext<CanvasUIContextValue | undefined>(undefined)

interface CanvasUIProviderProps {
	readonly?: boolean
	children: ReactNode
}

export function CanvasUIProvider({ children, readonly }: CanvasUIProviderProps) {
	const [editingElementId, setEditingElementId] = useState<string | null>(null)

	const [selectedElementIds, setSelectedElementIds] = useState<string[]>([])
	const [isDragging, setIsDragging] = useState(false)
	const [isSelecting, setIsSelecting] = useState(false)

	const [messageHistoryElementId, setMessageHistoryElementId] = useState<string | null>(null)

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

	// 监听图片 Info 按钮点击事件
	useCanvasEvent("element:image:infoButtonClick", ({ data }) => {
		setMessageHistoryElementId(data.elementId)
	})

	useUpdateEffect(() => {
		if (selectedElementIds.length !== 1 || selectedElementIds[0] !== messageHistoryElementId) {
			setMessageHistoryElementId(null)
		}
	}, [selectedElementIds])

	// 获取选中的元素列表
	const selectedElements = useCanvasElements(selectedElementIds)

	const value: CanvasUIContextValue = useMemo(() => {
		return {
			editingElementId,
			setEditingElementId,

			selectedElements,
			selectedElementIds,

			isDragging,
			isSelecting,

			messageHistoryElementId,
			setMessageHistoryElementId,

			subElementTooltip,
			setSubElementTooltip,

			readonly,
		}
	}, [
		editingElementId,
		selectedElements,
		selectedElementIds,
		isDragging,
		isSelecting,
		messageHistoryElementId,
		subElementTooltip,
		readonly,
	])

	return <CanvasUIContext.Provider value={value}>{children}</CanvasUIContext.Provider>
}

export function useCanvasUI() {
	const context = useContext(CanvasUIContext)
	if (context === undefined) {
		throw new Error("useCanvasUI must be used within a CanvasUIProvider")
	}
	return context
}
