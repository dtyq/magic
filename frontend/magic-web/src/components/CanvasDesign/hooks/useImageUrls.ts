import { useState, useCallback, useEffect, useRef } from "react"
import { useCanvas } from "../context/CanvasContext"
import { useCanvasData } from "./useCanvasData"
import { useCanvasEvent } from "./useCanvasEvent"
import { ElementTypeEnum, type LayerElement } from "../canvas/types"
import { ImageElement as ImageElementClass } from "../canvas/element/elements/ImageElement"
import { normalizePath } from "../canvas/utils/utils"

/**
 * 获取图片元素的 URL 映射
 * @param enabled 是否启用图片获取，默认为 true
 * @returns 图片元素 ID 到图片 URL 的映射
 */
export function useImageUrls(enabled: boolean = true): Map<string, string> {
	const { canvas } = useCanvas()
	const elements = useCanvasData((manager) => manager.getAllElements())
	const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map())

	// 使用 ref 存储上一次的元素 ID 列表，避免因为 elements 引用变化导致不必要的更新
	const prevElementIdsRef = useRef<Set<string>>(new Set())

	// 更新单个图片元素的 URL
	const updateImageUrl = useCallback(
		async (elementId: string) => {
			if (!canvas || !enabled) return
			const elementInstance = canvas.elementManager.getElementInstance(elementId)
			if (elementInstance && elementInstance instanceof ImageElementClass) {
				const elementData = canvas.elementManager.getElementData(elementId)
				if (elementData && elementData.type === ElementTypeEnum.Image) {
					if (elementData.src && elementData.src) {
						const resource = await canvas.imageResourceManager.getResource(
							elementData.src,
						)
						const smallUrl = resource?.thumbnail?.small
						if (!smallUrl) {
							return
						}
						setImageUrls((prev) => {
							const currentUrl = prev.get(elementId)
							// 只有当 URL 实际变化时才更新
							if (currentUrl === smallUrl) {
								return prev
							}
							const next = new Map(prev)
							next.set(elementId, smallUrl)
							return next
						})
					} else {
						// 如果图片未加载完成，移除 URL
						setImageUrls((prev) => {
							// 如果 URL 不存在，不需要更新
							if (!prev.has(elementId)) {
								return prev
							}
							const next = new Map(prev)
							next.delete(elementId)
							return next
						})
					}
				}
			}
		},
		[canvas, enabled],
	)

	// 初始化所有图片元素的 URL
	const initializeImageUrls = useCallback(async () => {
		if (!canvas || !elements || !enabled) return
		// 收集当前所有图片元素的 ID
		const collectImageElementIds = (elements: LayerElement[]): Set<string> => {
			const ids = new Set<string>()
			elements.forEach((element) => {
				if (element.type === ElementTypeEnum.Image) {
					ids.add(element.id)
				}
				if ("children" in element && element.children) {
					collectImageElementIds(element.children).forEach((id) => ids.add(id))
				}
			})
			return ids
		}
		const currentElementIds = collectImageElementIds(elements)
		const prevElementIds = prevElementIdsRef.current
		// 如果元素 ID 列表没有变化，就不需要更新（避免因为 elements 引用变化导致不必要的更新）
		if (
			currentElementIds.size === prevElementIds.size &&
			Array.from(currentElementIds).every((id) => prevElementIds.has(id))
		) {
			// 元素 ID 列表没有变化，不需要更新
			return
		}
		// 收集所有图片元素的路径和ID映射
		const collectImagePaths = (
			elements: LayerElement[],
		): Array<{ id: string; src: string }> => {
			const paths: Array<{ id: string; src: string }> = []
			elements.forEach((element) => {
				if (element.type === ElementTypeEnum.Image) {
					const elementInstance = canvas.elementManager.getElementInstance(element.id)
					if (elementInstance && elementInstance instanceof ImageElementClass) {
						if (element.src) {
							paths.push({ id: element.id, src: element.src })
						}
					}
				}
				// 递归处理子元素
				if ("children" in element && element.children) {
					paths.push(...collectImagePaths(element.children))
				}
			})
			return paths
		}
		const imagePaths = collectImagePaths(elements)
		// 批量获取小图 URL
		const urlPromises = imagePaths.map(async ({ id, src }) => {
			const resource = await canvas.imageResourceManager.getResource(src)
			return { id, url: resource?.thumbnail?.small ?? null }
		})
		const urlResults = await Promise.all(urlPromises)
		const newImageUrls = new Map<string, string>()
		urlResults.forEach(({ id, url }) => {
			if (url) {
				newImageUrls.set(id, url)
			}
		})
		setImageUrls((prev) => {
			// 只有当 Map 内容实际变化时才更新，避免不必要的重新渲染
			// 比较两个 Map 是否相同
			if (prev.size !== newImageUrls.size) {
				prevElementIdsRef.current = currentElementIds
				return newImageUrls
			}
			for (const [key, value] of newImageUrls) {
				if (prev.get(key) !== value) {
					prevElementIdsRef.current = currentElementIds
					return newImageUrls
				}
			}
			// Map 内容相同，返回原 Map 保持引用不变
			prevElementIdsRef.current = currentElementIds
			return prev
		})
	}, [canvas, elements, enabled])

	// 处理元素更新 URL 的通用函数
	const handleElementUpdate = useCallback(
		(elementId: string) => {
			if (!enabled) return
			// 延迟更新，确保元素实例已完全创建/更新/转换
			setTimeout(() => {
				updateImageUrl(elementId)
			}, 0)
		},
		[updateImageUrl, enabled],
	)

	// 初始化图片 URL
	useEffect(() => {
		initializeImageUrls()
	}, [initializeImageUrls])

	// 监听元素创建事件，更新新创建的图片元素的 URL
	useCanvasEvent(
		"element:created",
		useCallback(
			({ data }) => {
				handleElementUpdate(data.elementId)
			},
			[handleElementUpdate],
		),
	)

	// 监听元素更新事件，当图片元素的 src 更新时更新 URL
	useCanvasEvent(
		"element:updated",
		useCallback(
			({ data }) => {
				// 检查是否是图片元素
				if (data.data?.type === ElementTypeEnum.Image) {
					handleElementUpdate(data.elementId)
				}
			},
			[handleElementUpdate],
		),
	)

	// 监听临时元素转正事件，当图片上传完成转为正式元素时更新 URL
	useCanvasEvent(
		"element:temporary:converted",
		useCallback(
			({ data }) => {
				handleElementUpdate(data.elementId)
			},
			[handleElementUpdate],
		),
	)

	// 监听元素删除事件，移除已删除的图片元素的 URL
	useCanvasEvent(
		"element:deleted",
		useCallback(({ data }) => {
			setImageUrls((prev) => {
				if (!prev.has(data.elementId)) {
					return prev
				}
				const next = new Map(prev)
				next.delete(data.elementId)
				return next
			})
		}, []),
	)

	// 监听图片资源加载完成事件，当图片加载完成时更新 URL
	// 同一 path 可能被多个元素引用（如复制粘贴），需更新所有匹配元素
	useCanvasEvent(
		"resource:image:loaded",
		useCallback(
			({ data }) => {
				if (!canvas || !enabled) return
				const elementsDict = canvas.elementManager.getElementsDict()
				const normalizedPath = normalizePath(data.path)
				for (const elementData of Object.values(elementsDict)) {
					if (
						elementData.type === ElementTypeEnum.Image &&
						elementData.src &&
						normalizePath(elementData.src) === normalizedPath
					) {
						updateImageUrl(elementData.id)
					}
				}
			},
			[canvas, updateImageUrl, enabled],
		),
	)

	return imageUrls
}
