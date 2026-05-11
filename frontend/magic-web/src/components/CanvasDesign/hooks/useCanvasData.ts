import { useReducer } from "react"
import type { ElementManager } from "../canvas/element/ElementManager"
import type { CanvasEvent, CanvasEventMap } from "../canvas/EventEmitter"
import { useCanvas } from "../context/CanvasContext"
import { useCanvasEvent, useCanvasEvents } from "./useCanvasEvent"

interface UseCanvasDataOptions {
	/** 精准控制 element:change 是否需要触发刷新 */
	shouldUpdateOnElementChange?: (event: CanvasEvent<"element:change">) => boolean
}

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
	options?: UseCanvasDataOptions,
): T | null {
	const { canvas } = useCanvas()
	const [, forceUpdate] = useReducer((x) => x + 1, 0)

	// 订阅所有指定的事件
	useCanvasEvents(
		events as readonly (keyof CanvasEventMap)[],
		(...eventArgs) => {
			for (const event of eventArgs) {
				if (!event) continue

				if (event.type === "element:change") {
					const changeEvent = event as CanvasEvent<"element:change">
					if (
						!options?.shouldUpdateOnElementChange ||
						options.shouldUpdateOnElementChange(changeEvent)
					) {
						forceUpdate()
					}
					return
				}

				forceUpdate()
				return
			}
		},
		[options?.shouldUpdateOnElementChange],
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
