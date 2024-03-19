import { useImperativeHandle } from "react"
import { useCanvas } from "../context/CanvasContext"
import type { CanvasDesignRef } from "../types"
import type { PaddingConfig, CanvasDocument, Marker } from "../canvas/types"
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
			selectMarker: (markerId: string | null) => {
				if (!canvas) return
				if (markerId) {
					canvas.markerManager.selectMarker(markerId)
				} else {
					canvas.markerManager.deselectMarker()
				}
			},
			focusElement: (
				elementIds: string[],
				options?: {
					selectElement?: boolean | string[]
					animated?: boolean
					padding?: PaddingConfig
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
			updateData: (data: CanvasDocument) => {
				if (!canvas) return
				// 兼容 useImmer 创建的 Proxy 对象，转换为普通对象
				const plainData = toPlainObject(data)
				// 使用智能差异更新，只更新变化的元素，保留当前状态
				canvas.elementManager.loadDocumentSmart(plainData)
				// 立即记录历史，支持撤销到更新前的状态
				canvas.historyManager.recordHistoryImmediate()
			},
			ensureElementVisible: (
				elementId: string,
				options?: {
					animated?: boolean
					padding?: PaddingConfig
				},
			) => {
				if (!canvas) return
				// 检查元素是否存在
				if (!canvas.elementManager.hasElement(elementId)) return
				// 先检测元素是否在可视区域
				const isInViewport = canvas.viewportController.isElementInViewport([elementId], {
					padding: options?.padding,
				})
				// 如果不在可视区域，则移动到可视区域
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
