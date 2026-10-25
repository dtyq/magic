import { useImperativeHandle } from "react"
import { useCanvas } from "../../providers/CanvasProvider"
import type { CanvasDesignRef } from "../../../public/props"
import type { CanvasDocument, Marker, PaddingInsetConfig } from "../../../runtime/document/types"
import { toPlainObject } from "../../../runtime/shared/ids"
import { ImageElement as ImageElementClass } from "../../../runtime/elements/image/ImageElement"
import { getActiveImageContent } from "../../../runtime/document/elementContent"

const RESOURCE_REFRESH_CONCURRENCY = 3

async function runWithConcurrency<T>(
	items: T[],
	concurrency: number,
	task: (item: T) => Promise<unknown>,
): Promise<void> {
	if (items.length === 0) return
	const workerCount = Math.min(Math.max(1, concurrency), items.length)
	let nextIndex = 0

	await Promise.all(
		Array.from({ length: workerCount }, async () => {
			while (nextIndex < items.length) {
				const currentIndex = nextIndex
				nextIndex += 1
				await task(items[currentIndex])
			}
		}),
	)
}

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
					canvas.loadDocument(plainData, {
						elementDetailsProvenance: options.elementDetailsProvenance,
					})
				} else {
					// 使用智能差异更新，只更新变化的元素，保留当前状态
					canvas.loadDocumentSmart(plainData, {
						elementDetailsProvenance: options?.elementDetailsProvenance,
					})
					// 立即记录历史，支持撤销到更新前的状态
					if (options?.historyPolicy !== "exclude")
						canvas.historyManager.recordHistoryImmediate()
				}
			},
			exportCurrentDocument: () => {
				if (!canvas) return null
				return canvas.exportDocument({ includeTemporary: false })
			},
			getCanvasInstance: () => canvas,
			refreshResources: async (resources) => {
				if (!canvas) return
				await runWithConcurrency(
					resources,
					RESOURCE_REFRESH_CONCURRENCY,
					async (resource) => {
						if (resource.mediaType === "audio") {
							canvas.audioPlaybackManager.releaseByPath(resource.path)
							const refreshed = await canvas.audioResourceManager.refresh(
								resource.path,
							)
							if (refreshed) {
								canvas.visibilityManager.invalidateAudioLoadRequest(
									resource.path,
									"host-refresh",
								)
							}
							return
						}
						if (resource.mediaType === "video") {
							return canvas.videoResourceManager.refreshResource(resource.path)
						}
						return canvas.imageResourceManager.refreshResource(resource.path)
					},
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
					const active =
						(canvas.getEffectiveContent(imageData.id) as ReturnType<
							typeof getActiveImageContent
						>) ?? getActiveImageContent(imageData)
					if (!active.src) return null
					const ossInfo = await canvas.imageResourceManager.ensureFreshOssInfo(active.src)
					return ossInfo?.ossSrc ?? null
				}
				return null
			},
			getElementImageInfo: async (elementId: string) => {
				if (!canvas) return null
				const elementInstance = canvas.elementManager.getElementInstance(elementId)
				if (!(elementInstance instanceof ImageElementClass)) return null

				const imageData = elementInstance.getData()
				const active =
					(canvas.getEffectiveContent(imageData.id) as ReturnType<
						typeof getActiveImageContent
					>) ?? getActiveImageContent(imageData)
				if (!active.src) return null

				const resource = await canvas.imageResourceManager.getResource(active.src, {
					variant: "full",
				})
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
