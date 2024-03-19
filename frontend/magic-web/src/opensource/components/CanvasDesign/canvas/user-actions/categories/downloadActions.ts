import type { UserAction } from "../types"
import { getLoadedImageElements } from "../../utils/utils"

/**
 * 下载操作相关的用户动作（Magic 特定）
 */
export const downloadActions: UserAction[] = [
	{
		id: "download.image",
		category: "download",
		canExecute: (canvas) => {
			// 获取已加载的图片元素列表
			const imageElements = getLoadedImageElements(canvas)

			// 至少需要一个已加载的图片元素
			if (imageElements.length === 0) return false

			// 必须有 downloadImage 方法
			const methods = canvas.magicConfigManager.config?.methods
			return !!methods?.downloadImage
		},
		execute: async (canvas) => {
			const imageElements = getLoadedImageElements(canvas)
			if (imageElements.length === 0) return
			const methods = canvas.magicConfigManager.config?.methods
			if (!methods?.downloadImage) return
			await methods.downloadImage(imageElements, false)
		},
	},
	{
		id: "download.image-no-watermark",
		category: "download",
		canExecute: (canvas) => {
			// 获取已加载的图片元素列表
			const imageElements = getLoadedImageElements(canvas)

			// 至少需要一个已加载的图片元素
			if (imageElements.length === 0) return false

			// 必须有 downloadImage 方法
			const methods = canvas.magicConfigManager.config?.methods
			return !!methods?.downloadImage
		},
		execute: async (canvas) => {
			const imageElements = getLoadedImageElements(canvas)
			if (imageElements.length === 0) return
			const methods = canvas.magicConfigManager.config?.methods

			if (!methods?.downloadImage) return
			await methods.downloadImage(imageElements, true)
		},
	},
]
