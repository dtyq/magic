import type { UserAction, ViewActionOptions } from "../types"

/**
 * 视图操作相关的用户动作
 */
export const viewActions: UserAction[] = [
	{
		id: "view.zoom-in",
		category: "view",
		canExecute: () => {
			// 缩放操作总是可用
			return true
		},
		execute: (canvas) => {
			canvas.viewportController.zoomIn()
		},
	},
	{
		id: "view.zoom-out",
		category: "view",
		canExecute: () => {
			// 缩放操作总是可用
			return true
		},
		execute: (canvas) => {
			canvas.viewportController.zoomOut()
		},
	},
	{
		id: "view.zoom-fit",
		category: "view",
		canExecute: () => {
			// 缩放操作总是可用
			return true
		},
		execute: (canvas) => {
			canvas.viewportController.fitToScreen({ animated: true })
		},
	},
	{
		id: "view.focus-element",
		category: "view",
		canExecute: () => {
			// 定位操作总是可用（执行时会检查元素是否存在）
			return true
		},
		execute: (canvas, options?: ViewActionOptions) => {
			const elementIds = options?.elementIds
			if (!elementIds || elementIds.length === 0) {
				return
			}
			// 过滤出存在的元素ID
			const validElementIds = elementIds.filter((id) => canvas.elementManager.hasElement(id))
			if (validElementIds.length === 0) {
				return
			}
			// 先检测元素是否在可视区域
			const isInViewport = canvas.viewportController.isElementInViewport(validElementIds)
			// 如果不在可视区域，则移动到可视区域
			if (!isInViewport) {
				canvas.viewportController.moveElementToViewport(validElementIds, {
					animated: true,
				})
			}
		},
	} satisfies UserAction<"view.focus-element", ViewActionOptions>,
]
