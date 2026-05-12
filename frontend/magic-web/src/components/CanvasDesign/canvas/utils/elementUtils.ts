import type { LayerElement } from "../types"
import { generateElementId, generateUniqueElementName, type Rect } from "./utils"
import type { ElementManager } from "../element/ElementManager"
import type { HistoryManager } from "../interaction/HistoryManager"
import type { CanvasFileUploadManager } from "./CanvasFileUploadManager"
import type { Canvas } from "../Canvas"
import {
	AGENT_PLACEHOLDER_ELEMENT_SPACING,
	AGENT_PLACEHOLDER_MAX_PER_ROW,
	DEFAULT_VIEWPORT_SEARCH_RINGS,
} from "./findNonOverlappingPlacement"

/**
 * 获取所有现有元素的名称集合（包括所有元素，包括子元素）
 * @param elementManager 元素管理器
 * @returns 元素名称集合
 */
export function getAllExistingNames(elementManager: ElementManager): Set<string> {
	const names = new Set<string>()
	const elementsDict = elementManager.getElementsDict()

	// 递归收集所有元素的名称
	const collectNames = (element: LayerElement): void => {
		if (element.name) {
			names.add(element.name)
		}
		if ("children" in element && element.children) {
			for (const child of element.children) {
				collectNames(child)
			}
		}
	}

	// 遍历所有元素
	for (const element of Object.values(elementsDict)) {
		collectNames(element)
	}

	return names
}

/**
 * 递归处理元素，生成唯一名称
 * @param element 元素
 * @param existingNames 现有元素名称集合（会被修改）
 * @returns 处理后的元素（包含唯一名称）
 */
export function regenerateIdsWithUniqueNames(
	element: LayerElement,
	existingNames: Set<string>,
): LayerElement {
	// 生成新 ID
	const newEl = { ...element, id: generateElementId() }

	// 如果有名称，生成唯一名称
	if (newEl.name) {
		newEl.name = generateUniqueElementName(newEl.name, existingNames)
		existingNames.add(newEl.name)
	}

	// 递归处理子元素
	if ("children" in newEl && Array.isArray(newEl.children)) {
		newEl.children = newEl.children.map((child) =>
			regenerateIdsWithUniqueNames(child, existingNames),
		)
	}

	return newEl
}

/**
 * 过滤冗余元素：如果一个元素的父元素已在选中列表中，则该元素是冗余的
 * @param elementIds - 选中的元素ID列表
 * @param elementManager - 元素管理器
 * @returns 过滤后的元素ID列表
 */
export function filterRedundantElements(
	elementIds: string[],
	elementManager: ElementManager,
): string[] {
	return elementIds.filter((id) => {
		const parentId = elementManager.findParentIdForElement(id)
		// 如果父元素也在选中列表中，则当前元素是冗余的
		return !parentId || !elementIds.includes(parentId)
	})
}

/**
 * 获取当前 viewport 在画布坐标系中的可用区域（考虑默认视口预留）
 * @param canvas Canvas 实例
 * @returns 可用区域
 */
export function getViewportCanvasRect(canvas: Canvas): Rect {
	const stage = canvas.stage
	const stageWidth = stage.width()
	const stageHeight = stage.height()
	const {
		left: offsetLeft,
		right: offsetRight,
		top: offsetTop,
		bottom: offsetBottom,
	} = canvas.viewportController.getResolvedDefaultViewportPadding(stageWidth, stageHeight)

	// 转换为画布坐标（考虑视口缩放和平移）
	const transform = stage.getAbsoluteTransform().copy().invert()
	const topLeft = transform.point({ x: offsetLeft, y: offsetTop })
	const bottomRight = transform.point({
		x: stageWidth - offsetRight,
		y: stageHeight - offsetBottom,
	})

	return {
		x: topLeft.x,
		y: topLeft.y,
		width: bottomRight.x - topLeft.x,
		height: bottomRight.y - topLeft.y,
	}
}

/**
 * 计算画布中心位置（考虑默认视口预留）
 * @param canvas Canvas 实例
 * @returns 画布中心坐标 { x, y }
 */
export function getCanvasCenter(canvas: Canvas): { x: number; y: number } {
	const viewportRect = getViewportCanvasRect(canvas)

	return {
		x: viewportRect.x + viewportRect.width / 2,
		y: viewportRect.y + viewportRect.height / 2,
	}
}

function resolveNonNegativeNumber(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback
}

function resolvePositiveInteger(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback
}

/**
 * 获取媒体元素落位配置（支持 rootStorage 覆盖）
 */
export function getResolvedMediaPlacementConfig(canvas: Canvas): {
	spacing: number
	maxPerRow: number
	maxSearchRings: number
} {
	const rootStorage = canvas.magicConfigManager.config?.methods?.getRootStorage?.()
	const mediaPlacementConfig = rootStorage?.mediaPlacementConfig

	return {
		spacing: resolveNonNegativeNumber(
			mediaPlacementConfig?.spacing,
			AGENT_PLACEHOLDER_ELEMENT_SPACING,
		),
		maxPerRow: resolvePositiveInteger(
			mediaPlacementConfig?.maxPerRow,
			AGENT_PLACEHOLDER_MAX_PER_ROW,
		),
		maxSearchRings: resolvePositiveInteger(
			mediaPlacementConfig?.maxSearchRings,
			DEFAULT_VIEWPORT_SEARCH_RINGS,
		),
	}
}

/**
 * 使用历史记录管理器执行异步操作（自动处理启用/禁用）
 * @param historyManager 历史记录管理器（可选）
 * @param callback 需要执行的异步操作回调
 * @returns Promise<T> 操作结果
 */
export async function withHistoryManagerAsync<T>(
	historyManager: HistoryManager | null | undefined,
	callback: () => Promise<T>,
): Promise<T> {
	if (!historyManager) {
		return await callback()
	}

	historyManager.disable()
	try {
		const result = await callback()
		historyManager.enable()
		historyManager.recordHistoryImmediate()
		return result
	} catch (error) {
		historyManager.enable()
		throw error
	}
}

/**
 * 在上传锁定状态下执行回调
 * 类似 withHistoryManagerAsync，自动处理锁定/解锁
 *
 * @param canvasFileUploadManager 文件上传管理器
 * @param callback 要执行的回调函数
 * @param options 可选配置
 * @param options.referenceImages 参考图列表（用于参考图上传）
 * @returns 回调函数的返回值
 */
export async function withUploadLock<T>(
	canvasFileUploadManager: CanvasFileUploadManager | null | undefined,
	callback: () => Promise<T>,
	options?: { referenceImages?: string[] },
): Promise<T> {
	if (!canvasFileUploadManager) {
		return await callback()
	}

	return await canvasFileUploadManager.withLock(callback, options)
}
