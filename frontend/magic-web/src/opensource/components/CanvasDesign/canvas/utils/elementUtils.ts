import type { LayerElement } from "../types"
import { generateElementId, generateUniqueElementName } from "./utils"
import type { ElementManager } from "../element/ElementManager"
import type { HistoryManager } from "../interaction/HistoryManager"
import type { ImageUploadManager } from "./ImageUploadManager"
import type { Canvas } from "../Canvas"

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
 * 计算画布中心位置（考虑 defaultViewportOffset.left）
 * @param canvas Canvas 实例
 * @returns 画布中心坐标 { x, y }
 */
export function getCanvasCenter(canvas: Canvas): { x: number; y: number } {
	const stage = canvas.stage
	const stageWidth = stage.width()
	const stageHeight = stage.height()

	// 获取 defaultViewportOffset
	const viewportOffset = canvas.viewportController.getDefaultViewportOffset()
	const offsetLeft = viewportOffset?.left || 0
	const offsetRight = viewportOffset?.right || 0

	// 计算可视区域中心（考虑左右偏移）
	const availableWidth = stageWidth - offsetLeft - offsetRight
	const screenCenterX = offsetLeft + availableWidth / 2
	const screenCenterY = stageHeight / 2

	// 转换为画布坐标（考虑视口缩放和平移）
	const transform = stage.getAbsoluteTransform().copy().invert()
	const canvasCenter = transform.point({ x: screenCenterX, y: screenCenterY })

	return { x: canvasCenter.x, y: canvasCenter.y }
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
 * @param imageUploadManager 图片上传管理器
 * @param callback 要执行的回调函数
 * @param options 可选配置
 * @param options.referenceImages 参考图列表（用于参考图上传）
 * @returns 回调函数的返回值
 */
export async function withUploadLock<T>(
	imageUploadManager: ImageUploadManager | null | undefined,
	callback: () => Promise<T>,
	options?: { referenceImages?: string[] },
): Promise<T> {
	if (!imageUploadManager) {
		return await callback()
	}

	return await imageUploadManager.withLock(callback, options)
}
