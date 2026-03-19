import { useReducer } from "react"
import { useCanvas } from "../context/CanvasContext"
import type { LayerElement } from "../canvas/types"
import { useCanvasEvent } from "./useCanvasEvent"

/**
 * 获取 Canvas 元素的 Hook
 * @param elementIds - 元素 ID 数组（可选），如果不传则获取所有顶层元素
 * @returns 元素数组
 */
export function useCanvasElements(elementIds?: string[]): LayerElement[] {
	const { canvas } = useCanvas()
	const [, forceUpdate] = useReducer((x) => x + 1, 0)

	// 订阅元素变化事件
	useCanvasEvent("element:change", forceUpdate, [elementIds])

	if (!canvas) {
		return []
	}

	// 如果传入了 elementIds，则根据 ID 获取对应的元素
	if (elementIds) {
		return elementIds
			.map((id) => canvas.elementManager.getElementData(id))
			.filter((element): element is LayerElement => element !== undefined)
	}

	// 如果没有传入 elementIds，则获取所有顶层元素
	return canvas.elementManager.getAllElements()
}

/**
 * 获取单个 Canvas 元素的 Hook
 * @param elementId - 元素 ID
 * @returns 元素数据，如果不存在则返回 null
 */
export function useCanvasElement(elementId: string | null): LayerElement | null {
	const { canvas } = useCanvas()
	const [, forceUpdate] = useReducer((x) => x + 1, 0)

	// 订阅元素变化事件
	useCanvasEvent("element:change", forceUpdate, [elementId])

	if (!elementId || !canvas) {
		return null
	}

	return canvas.elementManager.getElementData(elementId) ?? null
}
