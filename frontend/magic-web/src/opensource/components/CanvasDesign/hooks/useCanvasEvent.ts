import { useEffect } from "react"
import { useCanvas } from "../context/CanvasContext"
import type { Canvas } from "../canvas/Canvas"
import type { CanvasEvent, CanvasEventMap } from "../canvas/EventEmitter"

/**
 * 底层 Hook：订阅 Canvas 事件（需要手动传入 canvasInstance）
 * @param canvasInstance - Canvas 实例
 * @param event - 事件名称
 * @param handler - 事件处理函数（接收包含 type 和 data 的事件对象）
 * @param deps - 依赖项数组（可选）
 */
export function useCanvasEventWithInstance<K extends keyof CanvasEventMap>(
	canvasInstance: Canvas | null | undefined,
	event: K,
	handler: (event: CanvasEvent<K>) => void,
	deps: React.DependencyList = [],
): void {
	useEffect(() => {
		if (!canvasInstance) return

		// 订阅事件
		const unsubscribe = canvasInstance.eventEmitter.on(event, handler)

		// 清理函数：取消订阅
		return unsubscribe
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [canvasInstance, event, ...deps])
}

/**
 * 底层 Hook：订阅 Canvas 事件（只触发一次，需要手动传入 canvasInstance）
 * @param canvasInstance - Canvas 实例
 * @param event - 事件名称
 * @param handler - 事件处理函数（接收包含 type 和 data 的事件对象）
 * @param deps - 依赖项数组（可选）
 */
export function useCanvasEventOnceWithInstance<K extends keyof CanvasEventMap>(
	canvasInstance: Canvas | null | undefined,
	event: K,
	handler: (event: CanvasEvent<K>) => void,
	deps: React.DependencyList = [],
): void {
	useEffect(() => {
		if (!canvasInstance) return

		// 订阅事件（只触发一次）
		const unsubscribe = canvasInstance.eventEmitter.once(event, handler)

		// 清理函数：取消订阅
		return unsubscribe
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [canvasInstance, event, ...deps])
}

/**
 * 订阅 Canvas 事件的 Hook（自动从 Context 获取 canvas）
 * @param event - 事件名称
 * @param handler - 事件处理函数（接收包含 type 和 data 的事件对象）
 * @param deps - 依赖项数组（可选）
 */
export function useCanvasEvent<K extends keyof CanvasEventMap>(
	event: K,
	handler: (event: CanvasEvent<K>) => void,
	deps: React.DependencyList = [],
): void {
	const { canvas } = useCanvas()
	useCanvasEventWithInstance(canvas, event, handler, deps)
}

/**
 * 订阅 Canvas 事件（只触发一次）的 Hook（自动从 Context 获取 canvas）
 * @param event - 事件名称
 * @param handler - 事件处理函数（接收包含 type 和 data 的事件对象）
 * @param deps - 依赖项数组（可选）
 */
export function useCanvasEventOnce<K extends keyof CanvasEventMap>(
	event: K,
	handler: (event: CanvasEvent<K>) => void,
	deps: React.DependencyList = [],
): void {
	const { canvas } = useCanvas()
	useCanvasEventOnceWithInstance(canvas, event, handler, deps)
}

/**
 * 将事件元组转换为对应的 CanvasEvent 元组类型
 * 例如：EventsToCanvasEvents<["element:change", "viewport:scale"]>
 * 结果为：[CanvasEvent<"element:change">, CanvasEvent<"viewport:scale">]
 */
type EventsToCanvasEvents<T extends readonly (keyof CanvasEventMap)[]> = {
	[K in keyof T]: CanvasEvent<T[K]>
}

/**
 * 订阅多个 Canvas 事件的 Hook（自动从 Context 获取 canvas）
 *
 * 当监听多个事件时，回调函数会接收多个 event 参数，每个参数的类型和顺序
 * 精确对应 events 数组中的事件类型。
 *
 * **运行时行为**：每次事件触发时，只有对应位置的参数有值，其他参数为 undefined。
 * 例如，当监听 `["element:change", "viewport:scale"]` 时：
 * - 当 `element:change` 触发时，第一个参数有值，第二个参数为 undefined
 * - 当 `viewport:scale` 触发时，第二个参数有值，第一个参数为 undefined
 *
 * @param events - 事件名称数组（必须使用 `as const` 以确保类型推断正确）
 * @param handler - 事件处理函数（接收多个 event 参数，每个参数对应一个事件类型）
 * @param deps - 依赖项数组（可选）
 * @example
 * ```ts
 * useCanvasEvents(
 *   ["element:change", "viewport:scale"] as const,
 *   (changeEvent, scaleEvent) => {
 *     // changeEvent 类型为 CanvasEvent<"element:change">
 *     // scaleEvent 类型为 CanvasEvent<"viewport:scale">
 *     // 运行时：当 element:change 触发时，changeEvent 有值，scaleEvent 为 undefined
 *     // 运行时：当 viewport:scale 触发时，scaleEvent 有值，changeEvent 为 undefined
 *     if (changeEvent) {
 *       // 处理 element:change 事件
 *     }
 *     if (scaleEvent) {
 *       // 处理 viewport:scale 事件
 *     }
 *   }
 * )
 * ```
 */
export function useCanvasEvents<T extends readonly (keyof CanvasEventMap)[]>(
	events: T,
	handler: (...events: EventsToCanvasEvents<T>) => void,
	deps: React.DependencyList = [],
): void {
	const { canvas } = useCanvas()

	useEffect(() => {
		if (!canvas) return

		// 订阅所有指定的事件
		const unsubscribes = events.map((event, index) => {
			// 为每个事件创建包装函数
			return canvas.eventEmitter.on(event, (eventData) => {
				// 创建一个数组，只有当前触发的事件位置有值，其他位置为 undefined
				const eventArgsArray = new Array(events.length).fill(undefined)
				eventArgsArray[index] = eventData
				const eventArgs = eventArgsArray as EventsToCanvasEvents<T>

				// 调用 handler，传入所有事件参数
				handler(...eventArgs)
			})
		})

		// 清理函数：取消所有订阅
		return () => {
			unsubscribes.forEach((fn) => fn())
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [canvas, ...events, ...deps])
}
