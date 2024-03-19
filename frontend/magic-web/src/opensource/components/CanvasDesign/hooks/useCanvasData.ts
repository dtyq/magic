import { useReducer } from "react"
import type { ElementManager } from "../canvas/element/ElementManager"
import type { CanvasEventMap } from "../canvas/EventEmitter"
import { useCanvas } from "../context/CanvasContext"
import { useCanvasEvent, useCanvasEvents } from "./useCanvasEvent"

/**
 * 通用的 Canvas 数据订阅 Hook
 * 职责：订阅 Canvas 事件并提供数据查询
 *
 * @param selector - 数据选择器函数
 * @param events - 需要订阅的事件列表
 * @returns 选择器返回的数据
 */
export function useCanvasData<T>(
	selector: (manager: ElementManager) => T,
	events: Array<keyof CanvasEventMap> = ["element:change"],
): T | null {
	const { canvas } = useCanvas()
	const [, forceUpdate] = useReducer((x) => x + 1, 0)

	// 订阅所有指定的事件
	// 创建一个包装函数，忽略事件参数，只调用 forceUpdate
	useCanvasEvents(
		events as readonly (keyof CanvasEventMap)[],
		(..._events) => {
			forceUpdate()
		},
		[],
	)

	return canvas ? selector(canvas.elementManager) : null
}

/**
 * 订阅特定元素的数据变化
 *
 * @param canvas - Canvas 实例
 * @param elementId - 元素 ID
 * @returns 元素数据
 */
export function useElementData(elementId: string | null) {
	const { canvas } = useCanvas()
	const [, forceUpdate] = useReducer((x) => x + 1, 0)

	// 只订阅该元素的更新事件
	useCanvasEvent(
		"element:updated",
		({ data }) => {
			if (elementId && data.elementId === elementId) {
				forceUpdate()
			}
		},
		[elementId],
	)

	return elementId && canvas ? canvas.elementManager.getElementData(elementId) : null
}
