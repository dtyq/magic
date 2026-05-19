import { useImperativeHandle } from "react"
import { useCanvas } from "../context/CanvasContext"
import type { CanvasDesignRef } from "../types"
import type { CanvasDocument, Marker, PaddingInsetConfig } from "../canvas/types"
import { toPlainObject } from "../canvas/utils/utils"
import { ImageElement as ImageElementClass } from "../canvas/element/elements/ImageElement"

/**
 * 处理 CanvasDesignRef 的暴露
 * 职责：将 Canvas 实例的方法暴露给外部 ref
 */
export function useCanvasDesignRef(ref: React.Ref<CanvasDesignRef>): void {
	const { canvas } = useCanvas()

	useImperativeHandle(
		ref,
		(): CanvasDesignRef => ({
			removeMarker: (markerId: string) => {
				if (!canvas) return
				canvas.markerManager.removeMarker(markerId)
			},
			clearMarkers: () => {
				if (!canvas) return
				// 获取所有 marker，逐个删除以触发保存逻辑
				const markers = canvas.markerManager.exportMarkers()
				markers.forEach((marker) => {
					canvas.markerManager.removeMarker(marker.id)
				})
			},
			addMarkers: (markers: Marker[], options?: { silent?: boolean }) => {
				if (!canvas) return
				canvas.markerManager.addMarkers(markers, options)
			},
			getMarkers: () => {
				if (!canvas) return []
				return canvas.markerManager.exportMarkers()
			},
			getMarker: (id: string) => {
				if (!canvas) return null
				return canvas.markerManager.getMarker(id) ?? null
			},
			updateMarker: (markerId: string, updates: Partial<Marker>) => {
				if (!canvas) return null
				canvas.markerManager.updateMarker(markerId, updates)
				return canvas.markerManager.getMarker(markerId) ?? null
			},
			focusElement: (
				elementIds: string[],
				options?: {
					selectElement?: boolean | string[]
					animated?: boolean
					padding?: PaddingInsetConfig
					panOnly?: boolean
				},
			) => {
				if (!canvas) return
				if (elementIds.length === 0) return
				canvas.viewportController.focusOnElements(elementIds, options)
			},
			fitToScreen: () => {
				if (!canvas) return
				canvas.viewportController.fitToScreen()
			},
			updateData: (data: CanvasDocument, options) => {
				if (!canvas) return
				// 兼容 useImmer 创建的 Proxy 对象，转换为普通对象
				const plainData = toPlainObject(data)
				if (options?.mode === "replace") {
					canvas.loadDocument(plainData)
				} else {
					// 使用智能差异更新，只更新变化的元素，保留当前状态
					canvas.elementManager.loadDocumentSmart(plainData)
					// 立即记录历史，支持撤销到更新前的状态
					canvas.historyManager.recordHistoryImmediate()
				}
			},
			refreshResources: async (resources) => {
				if (!canvas) return
				await Promise.all(
					resources.map((resource) => {
						if (resource.mediaType === "video") {
							return canvas.videoResourceManager.refreshResource(resource.path)
						}
						return canvas.imageResourceManager.refreshResource(resource.path)
					}),
				)
			},
			ensureElementVisible: (
				elementId: string,
				options?: {
					animated?: boolean
					padding?: PaddingInsetConfig
				},
			) => {
				if (!canvas) return
				if (!canvas.elementManager.hasElement(elementId)) return
				const isInViewport = canvas.viewportController.isElementInViewport([elementId], {
					padding: options?.padding,
				})
				if (!isInViewport) {
					canvas.viewportController.moveElementToViewport([elementId], {
						animated: options?.animated ?? true,
						padding: options?.padding,
					})
				}
			},
			getImageOssUrl: async (elementId: string) => {
				if (!canvas) return null
				const elementInstance = canvas.elementManager.getElementInstance(elementId)
				if (elementInstance && elementInstance instanceof ImageElementClass) {
					const imageData = elementInstance.getData()
					if (!imageData.src) return null
					const resource = await canvas.imageResourceManager.getResource(imageData.src)
					return resource?.ossSrc ?? null
				}
				return null
			},
			getElementImageInfo: async (elementId: string) => {
				if (!canvas) return null
				const elementInstance = canvas.elementManager.getElementInstance(elementId)
				if (!(elementInstance instanceof ImageElementClass)) return null

				const imageData = elementInstance.getData()
				if (!imageData.src) return null

				const resource = await canvas.imageResourceManager.getResource(imageData.src)
				if (!resource) return null

				return {
					imageInfo: resource.imageInfo,
					ossUrl: resource.ossSrc,
					image: resource.image,
				}
			},
		}),
		[canvas],
	)
}
