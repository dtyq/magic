import { useReducer } from "react"
import type { ElementManager } from "../../../runtime/elements/core/ElementManager"
import type { CanvasEvent, CanvasEventMap } from "../../../runtime/core/EventEmitter"
import { useCanvas } from "../../providers/CanvasProvider"
import { useCanvasEvent, useCanvasEvents } from "./useCanvasEvent"

interface UseCanvasDataOptions {
	/** 精准控制 element:change 是否需要触发刷新 */
	shouldUpdateOnElementChange?: (event: CanvasEvent<"element:change">) => boolean
	/** 精准控制其他事件是否需要触发刷新 */
	shouldUpdateOnEvent?: (event: CanvasEvent) => boolean
	/** 可选的刷新调度器；未提供时保持事件触发后的同步刷新语义。 */
	scheduleUpdate?: (update: () => void, event: CanvasEvent) => void
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
				if (event.type !== "element:change" && options?.shouldUpdateOnEvent) {
					if (!options.shouldUpdateOnEvent(event as CanvasEvent)) continue
				}

				if (event.type === "element:change") {
					const changeEvent = event as CanvasEvent<"element:change">
					const shouldUpdate =
						!options?.shouldUpdateOnElementChange ||
						options.shouldUpdateOnElementChange(changeEvent)
					if (shouldUpdate) {
						if (options?.scheduleUpdate) {
							options.scheduleUpdate(forceUpdate, event as CanvasEvent)
						} else {
							forceUpdate()
						}
					}
					return
				}

				if (options?.scheduleUpdate) {
					options.scheduleUpdate(forceUpdate, event as CanvasEvent)
				} else {
					forceUpdate()
				}
				return
			}
		},
		[
			options?.scheduleUpdate,
			options?.shouldUpdateOnElementChange,
			options?.shouldUpdateOnEvent,
		],
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
