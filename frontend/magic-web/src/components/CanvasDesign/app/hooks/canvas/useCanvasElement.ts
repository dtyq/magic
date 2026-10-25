import { useReducer } from "react"
import { useCanvas } from "../../providers/CanvasProvider"
import type { LayerElement } from "../../../runtime/document/types"
import { useCanvasEventWithInstance } from "./useCanvasEvent"

/**
 * 获取 Canvas 元素的 Hook
 * @param elementIds - 元素 ID 数组（可选），如果不传则获取所有顶层元素
 * @returns 元素数组
 */
export function useCanvasElements(elementIds?: string[]): LayerElement[] {
	const { canvas } = useCanvas()
	const [, forceUpdate] = useReducer((x) => x + 1, 0)
	const shouldSubscribe = Boolean(canvas) && (elementIds === undefined || elementIds.length > 0)

	// 订阅元素变化事件
	useCanvasEventWithInstance(
		shouldSubscribe ? canvas : null,
		"element:change",
		({ data }) => {
			const changedElementIds = data?.elementIds
			const isTransient = data?.phase === "transient"
			if (elementIds === undefined) {
				if (isTransient) return
				forceUpdate()
				return
			}

			if (elementIds.length === 0) {
				return
			}

			const matched =
				!changedElementIds || changedElementIds.some((id) => elementIds.includes(id))
			if (matched && !isTransient) {
				forceUpdate()
			}
		},
		[elementIds, shouldSubscribe],
	)

	useCanvasEventWithInstance(
		shouldSubscribe ? canvas : null,
		"content:previewChanged",
		({ data }) => {
			if (
				elementIds === undefined ||
				!data.elementId ||
				elementIds.includes(data.elementId)
			) {
				forceUpdate()
			}
		},
		[elementIds, shouldSubscribe],
	)

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
 * @param options.includeTransient - 是否订阅仅运行时的瞬时更新
 * @returns 元素数据，如果不存在则返回 null
 */
export function useCanvasElement(
	elementId: string | null,
	options?: { includeTransient?: boolean },
): LayerElement | null {
	const { canvas } = useCanvas()
	const [, forceUpdate] = useReducer((x) => x + 1, 0)
	const shouldSubscribe = Boolean(canvas) && Boolean(elementId)
	const includeTransient = options?.includeTransient === true

	// 订阅元素变化事件
	useCanvasEventWithInstance(
		shouldSubscribe ? canvas : null,
		"element:change",
		({ data }) => {
			if (!elementId) {
				return
			}

			const changedElementIds = data?.elementIds
			const isTransient = data?.phase === "transient"
			const matched = !changedElementIds || changedElementIds.includes(elementId)
			if (matched && (!isTransient || includeTransient)) {
				forceUpdate()
			}
		},
		[elementId, includeTransient, shouldSubscribe],
	)

	useCanvasEventWithInstance(
		shouldSubscribe ? canvas : null,
		"content:previewChanged",
		({ data }) => {
			if (elementId && (!data.elementId || data.elementId === elementId)) forceUpdate()
		},
		[elementId, shouldSubscribe],
	)

	if (!elementId || !canvas) {
		return null
	}

	return canvas.elementManager.getElementData(elementId) ?? null
}
