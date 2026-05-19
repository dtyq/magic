import type { Marker, ImageElement } from "@/components/CanvasDesign/canvas/types"
import { ElementTypeEnum } from "@/components/CanvasDesign/canvas/types"
import type {
	IdentifyImageMarkRequest,
	IdentifyImageMarkResponse,
	UploadPrivateFile,
	UploadPrivateFileResponse,
} from "@/components/CanvasDesign/types.magic"
import {
	MentionItemType,
	type CanvasMarkerMentionData,
} from "@/components/business/MentionPanel/types"
import {
	buildMarkerFromCanvasMarkerMentionData,
	createCanvasMarkerMentionData,
	getCanvasMarkerMentionImagePath,
} from "@/components/business/MentionPanel/utils/canvasMarkerMention"
import {
	MarkerStorage,
	buildMarkerCompositeKey,
	type CompositePathCacheEntry,
} from "./storage/MarkerStorage"
import type { SyncToMessageEditorMode, SyncToMessageEditorOptions } from "./types"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { PubSubTypedPayloadMap } from "@/utils/pubSubPayloadMap"
import {
	MarkerCompositorService,
	type MarkerCompositorMethods,
} from "./compositor/MarkerCompositorService"

type MarkerManagerPublishEvent =
	| typeof PubSubEvents.Super_Magic_Marker_Data_Updated
	| typeof PubSubEvents.Super_Magic_Insert_Marker_To_Chat
	| typeof PubSubEvents.Super_Magic_Sync_Markers_To_Chat

type MarkerManagerPublishPayload = PubSubTypedPayloadMap[MarkerManagerPublishEvent]

/** 判断是否为刷新/导航导致的中断错误（应重试） */
export function isLikelyAbortError(error: string): boolean {
	if (!error) return false
	const lower = error.toLowerCase()
	return (
		lower.includes("failed to fetch") ||
		lower.includes("aborted") ||
		lower === "aborterror" ||
		lower.includes("the operation was aborted")
	)
}

/** CanvasMarkerMentionData → Manager 输入（纯转换，不写回） */
export function fromCanvasMarkerMentionData(mentionData: CanvasMarkerMentionData): {
	marker: Marker
	designProjectId: string
	element?: Pick<ImageElement, "src">
} | null {
	// Manager 仍以 Marker 为内部状态，消息侧只保存轻量 mention；这里作为边界适配层。
	const marker = buildMarkerFromCanvasMarkerMentionData(mentionData)
	const imagePath = getCanvasMarkerMentionImagePath(mentionData)
	const { design_project_id } = mentionData
	if (!design_project_id || !marker?.id) return null
	return {
		marker,
		designProjectId: design_project_id,
		element: imagePath ? { src: imagePath } : undefined,
	}
}

/** 在嵌套的 elements 中查找指定 id 的 Image 元素 */
function findImageElementById(
	elements: Array<{ id?: string; type?: string; src?: string; children?: unknown[] }>,
	elementId: string,
): ImageElement | undefined {
	for (const el of elements) {
		if (el.id === elementId && el.type === ElementTypeEnum.Image && el.src) {
			return el as ImageElement
		}
		if (Array.isArray(el.children)) {
			const found = findImageElementById(el.children as typeof elements, elementId)
			if (found) return found
		}
	}
	return undefined
}

export interface SuperMagicMarkerManagerDependencies {
	/** 获取 designData.canvas.elements（用于 fetch 时查找 ImageElement） */
	getCanvasElements?: (designProjectId: string) => { elements?: unknown[] } | null
	/** 从画布获取图片元素的信息（可选，画布打开时优先使用） */
	getElementImageInfo?: (elementId: string) => Promise<{
		imageInfo?: {
			naturalWidth: number
			naturalHeight: number
			fileSize?: number
			mimeType?: string
			filename?: string
		}
		ossUrl?: string
		image?: HTMLImageElement | ImageBitmap
	} | null>
	/** identifyImageMark API */
	identifyImageMark?: (params: IdentifyImageMarkRequest) => Promise<IdentifyImageMarkResponse>
	/** uploadPrivateFiles API */
	uploadPrivateFiles?: (files: UploadPrivateFile[]) => Promise<UploadPrivateFileResponse[]>
	/** getFileInfo API */
	getFileInfo?: (path: string) => Promise<{ src?: string }>
	/** 发布事件到 MessageEditor */
	publishToMessageEditor?: (
		event: MarkerManagerPublishEvent,
		payload: MarkerManagerPublishPayload,
	) => void
	/** 当前项目 ID（用于 identifyImageMark） */
	projectId?: string
	/** 话题 ID（用于 syncToMessageEditor 构建 mention 数据） */
	topicId?: string
	/** 获取图片 OSS URL（画布打开时优先使用，用于 mention 预览） */
	getImageOssUrl?: (elementId: string) => Promise<string | null>
}

export class SuperMagicMarkerManager {
	private static instance: SuperMagicMarkerManager | null = null

	private markersByProject = new Map<string, Marker[]>()
	/** markerId -> ImageElement.src，画布添加时缓存，支持离画布 fetch */
	private elementSrcByProject = new Map<string, Record<string, string>>()
	/** markerId -> 合成图上传路径缓存，刷新后复用，避免重复上传 */
	private compositePathByProject = new Map<string, Record<string, CompositePathCacheEntry>>()
	private storage: MarkerStorage
	private dependencies: SuperMagicMarkerManagerDependencies = {}
	private loadingMarkers = new Set<string>()
	private activeMarkerRequests = new Map<
		string,
		{ requestId: number; controller: AbortController }
	>()
	private markerRequestIds = new Map<string, number>()
	private isSyncingToEditor = false

	constructor(deps: SuperMagicMarkerManagerDependencies = {}) {
		this.storage = new MarkerStorage()
		this.dependencies = deps
	}

	static getInstance(): SuperMagicMarkerManager {
		if (!SuperMagicMarkerManager.instance) {
			SuperMagicMarkerManager.instance = new SuperMagicMarkerManager()
		}
		return SuperMagicMarkerManager.instance
	}

	updateDependencies(deps: Partial<SuperMagicMarkerManagerDependencies>): void {
		this.dependencies = { ...this.dependencies, ...deps }
	}

	private getElementSrcCache(designProjectId: string): Record<string, string> {
		let cache = this.elementSrcByProject.get(designProjectId)
		if (cache === undefined) {
			cache = this.storage.getMarkerElementSrc(designProjectId)
			this.elementSrcByProject.set(designProjectId, cache)
		}
		return cache
	}

	private saveElementSrcCache(designProjectId: string, cache: Record<string, string>): void {
		this.elementSrcByProject.set(designProjectId, cache)
		const markers =
			this.markersByProject.get(designProjectId) ?? this.storage.getMarkers(designProjectId)
		this.storage.saveMarkers(designProjectId, markers, cache)
	}

	private getCompositePathCache(
		designProjectId: string,
	): Record<string, CompositePathCacheEntry> {
		let cache = this.compositePathByProject.get(designProjectId)
		if (cache === undefined) {
			cache = this.storage.getMarkerCompositePath(designProjectId)
			this.compositePathByProject.set(designProjectId, cache)
		}
		return cache
	}

	private saveCompositePathCache(
		designProjectId: string,
		markerId: string,
		entry: CompositePathCacheEntry,
	): void {
		const cache = { ...this.getCompositePathCache(designProjectId), [markerId]: entry }
		this.compositePathByProject.set(designProjectId, cache)
		this.storage.saveMarkerCompositePath(designProjectId, markerId, entry)
	}

	private hasMarkerGeometryChanged(previousMarker?: Marker, nextMarker?: Marker): boolean {
		if (!previousMarker || !nextMarker) return false
		if (previousMarker.type !== nextMarker.type) return false

		if (
			previousMarker.relativeX !== nextMarker.relativeX ||
			previousMarker.relativeY !== nextMarker.relativeY ||
			!this.isElementCropEqual(previousMarker.elementCrop, nextMarker.elementCrop)
		) {
			return true
		}

		if (!("areaWidth" in previousMarker) || !("areaWidth" in nextMarker)) return false
		if (!("areaHeight" in previousMarker) || !("areaHeight" in nextMarker)) return false

		return (
			previousMarker.areaWidth !== nextMarker.areaWidth ||
			previousMarker.areaHeight !== nextMarker.areaHeight
		)
	}

	private clearMarkerRecognitionState(marker: Marker): Marker {
		return {
			...marker,
			result: undefined,
			error: undefined,
			selectedSuggestionIndex: undefined,
		}
	}

	private isElementCropEqual(left?: ImageElement["crop"], right?: ImageElement["crop"]): boolean {
		if (!left && !right) return true
		if (!left || !right) return false

		return (
			left.x === right.x &&
			left.y === right.y &&
			left.width === right.width &&
			left.height === right.height
		)
	}

	private getNextMarkerRequestId(markerId: string): number {
		const nextRequestId = (this.markerRequestIds.get(markerId) ?? 0) + 1
		this.markerRequestIds.set(markerId, nextRequestId)
		return nextRequestId
	}

	private isMarkerRequestCurrent(markerId: string, requestId: number): boolean {
		return this.activeMarkerRequests.get(markerId)?.requestId === requestId
	}

	private cancelMarkerRequest(markerId: string): void {
		const activeRequest = this.activeMarkerRequests.get(markerId)
		if (!activeRequest) return
		activeRequest.controller.abort()
	}

	private cloneMarker<T extends Marker>(marker: T): T {
		return JSON.parse(JSON.stringify(marker)) as T
	}

	private cloneMarkers(markers: Marker[]): Marker[] {
		return markers.map((marker) => this.cloneMarker(marker))
	}

	getMarkers(designProjectId: string): Marker[] {
		let markers = this.markersByProject.get(designProjectId)
		if (markers === undefined) {
			markers = this.cloneMarkers(this.storage.getMarkers(designProjectId))
			this.markersByProject.set(designProjectId, markers)
		}
		return this.cloneMarkers(markers)
	}

	setMarkers(designProjectId: string, markers: Marker[]): void {
		const previousMarkers = this.getMarkers(designProjectId)
		const previousMarkersMap = new Map(previousMarkers.map((marker) => [marker.id, marker]))
		const markersToRefresh: string[] = []
		const normalizedMarkers = markers.map((marker) => {
			const previousMarker = previousMarkersMap.get(marker.id)
			if (!this.hasMarkerGeometryChanged(previousMarker, marker)) return marker

			const normalizedMarker = this.clearMarkerRecognitionState(marker)
			markersToRefresh.push(marker.id)
			return normalizedMarker
		})

		const storedMarkers = this.cloneMarkers(normalizedMarkers)
		this.markersByProject.set(designProjectId, storedMarkers)
		const markerIds = new Set(storedMarkers.map((m) => m.id))
		const cache = this.getElementSrcCache(designProjectId)
		const pruned =
			Object.keys(cache).length === 0
				? cache
				: Object.fromEntries(Object.entries(cache).filter(([id]) => markerIds.has(id)))
		this.storage.saveMarkers(designProjectId, storedMarkers, pruned)
		if (pruned !== cache) {
			this.elementSrcByProject.set(designProjectId, pruned)
		}
		this.storage.pruneMarkerCompositePath(designProjectId, markerIds)
		const compositeCache = this.getCompositePathCache(designProjectId)
		if (Object.keys(compositeCache).length > 0) {
			this.compositePathByProject.set(
				designProjectId,
				Object.fromEntries(
					Object.entries(compositeCache).filter(([id]) => markerIds.has(id)),
				),
			)
		}

		markersToRefresh.forEach((markerId) => {
			this.requestMarkerDataRefresh(designProjectId, markerId)
		})
	}

	addMarker(designProjectId: string, marker: Marker, element?: Pick<ImageElement, "src">): void {
		const markers = this.getMarkers(designProjectId)
		if (markers.some((m) => m.id === marker.id)) return
		const updated = this.cloneMarkers([...markers, marker])
		this.markersByProject.set(designProjectId, updated)
		if (element?.src) {
			const cache = { ...this.getElementSrcCache(designProjectId), [marker.id]: element.src }
			this.saveElementSrcCache(designProjectId, cache)
		} else {
			this.storage.saveMarkers(designProjectId, updated)
		}
	}

	removeMarker(designProjectId: string, markerId: string): void {
		const markers = this.getMarkers(designProjectId).filter((m) => m.id !== markerId)
		this.markersByProject.set(designProjectId, markers)
		const cache = this.getElementSrcCache(designProjectId)
		const rest = Object.fromEntries(Object.entries(cache).filter(([id]) => id !== markerId))
		this.saveElementSrcCache(designProjectId, rest)
		const validIds = new Set(markers.map((m) => m.id))
		this.storage.pruneMarkerCompositePath(designProjectId, validIds)
		const compositeCache = this.getCompositePathCache(designProjectId)
		if (compositeCache[markerId]) {
			const pruned = { ...compositeCache }
			delete pruned[markerId]
			this.compositePathByProject.set(designProjectId, pruned)
		}
	}

	updateMarker(designProjectId: string, markerId: string, updates: Partial<Marker>): void {
		const markers = this.getMarkers(designProjectId)
		const index = markers.findIndex((m) => m.id === markerId)
		if (index < 0) return
		const updatedMarkers = markers.map((m, i) =>
			i === index ? ({ ...m, ...updates } as Marker) : m,
		)
		this.setMarkers(designProjectId, updatedMarkers)
	}

	requestMarkerDataRefresh(designProjectId: string, markerId: string): void {
		const marker = this.getMarker(designProjectId, markerId)
		if (!marker) return

		this.publishToMessageEditor(PubSubEvents.Super_Magic_Marker_Data_Updated, {
			updates: [
				{
					markerId,
					data: {
						loading: true,
					},
				},
			],
		})

		const requestId = this.getNextMarkerRequestId(markerId)
		this.cancelMarkerRequest(markerId)
		void this.fetchMarkerData(designProjectId, markerId, { force: true, requestId })
	}

	getMarker(designProjectId: string, markerId: string): Marker | undefined {
		return this.getMarkers(designProjectId).find((m) => m.id === markerId)
	}

	/** 检查 mark_id 是否仍存在（用于草稿恢复时对比） */
	hasMarker(designProjectId: string, markId: string): boolean {
		return this.getMarker(designProjectId, markId) !== undefined
	}

	/** 批量检查多个 designProjectId 下仍存在的 mark_id */
	getExistentMarkIds(items: Array<{ designProjectId: string; markId: string }>): Set<string> {
		const result = new Set<string>()
		for (const { designProjectId, markId } of items) {
			if (this.hasMarker(designProjectId, markId)) {
				result.add(markId)
			}
		}
		return result
	}

	/** 获取 marker 关联的 ImageElement src（用于与 CanvasMarkerMentionData 互推） */
	getMarkerElementSrc(designProjectId: string, markerId: string): string | undefined {
		return this.getElementSrcCache(designProjectId)[markerId]
	}

	/**
	 * Manager 数据 → CanvasMarkerMentionData
	 * 使用缓存的 image（element src）或 options.imagePath 覆盖，可与 fromCanvasMarkerMentionData 互推
	 */
	toCanvasMarkerMentionData(
		designProjectId: string,
		marker: Marker,
		options: {
			markNumber: number
			projectId?: string
			topicId?: string
			loading?: boolean
			imagePath?: string
			elementWidth?: number
			elementHeight?: number
		},
	): CanvasMarkerMentionData {
		const imagePath = options.imagePath ?? this.getMarkerElementSrc(designProjectId, marker.id)
		return createCanvasMarkerMentionData({
			marker,
			designProjectId,
			markNumber: options.markNumber,
			projectId: options.projectId,
			topicId: options.topicId,
			loading: options.loading ?? true,
			imagePath,
			elementWidth: options.elementWidth,
			elementHeight: options.elementHeight,
		})
	}

	/**
	 * CanvasMarkerMentionData → Manager 数据
	 * 将 mention 数据同步到 Manager：补充 marker、缓存 image 为 element src
	 */
	syncFromCanvasMarkerMentionData(mentionData: CanvasMarkerMentionData): void {
		const marker = buildMarkerFromCanvasMarkerMentionData(mentionData)
		const imagePath = getCanvasMarkerMentionImagePath(mentionData)
		const { design_project_id } = mentionData
		if (!design_project_id || !marker?.id) return
		const existing = this.getMarker(design_project_id, marker.id)
		if (!existing) {
			this.addMarker(design_project_id, marker, imagePath ? { src: imagePath } : undefined)
			pubsub.publish(PubSubEvents.Super_Magic_Markers_Synced_To_Manager, {
				designProjectId: design_project_id,
			})
		} else if (imagePath && !this.getMarkerElementSrc(design_project_id, marker.id)) {
			this.updateMarkerElementSrc(design_project_id, marker.id, imagePath)
		}
	}

	/** 单独更新 marker 的 element src 缓存（用于从 mention 数据反推补全） */
	updateMarkerElementSrc(designProjectId: string, markerId: string, src: string): void {
		const marker = this.getMarker(designProjectId, markerId)
		if (!marker) return
		const cache = { ...this.getElementSrcCache(designProjectId), [markerId]: src }
		this.saveElementSrcCache(designProjectId, cache)
	}

	/** 从存储重新加载指定 designProject 的 markers（清除内存缓存） */
	reloadFromStorage(designProjectId: string): Marker[] {
		this.markersByProject.delete(designProjectId)
		this.elementSrcByProject.delete(designProjectId)
		this.compositePathByProject.delete(designProjectId)
		return this.getMarkers(designProjectId)
	}

	/** 清除指定 designProject 的 markers（切换 topic 时调用） */
	clearMarkers(designProjectId: string): void {
		this.markersByProject.set(designProjectId, [])
		this.elementSrcByProject.set(designProjectId, {})
		this.compositePathByProject.set(designProjectId, {})
		this.storage.saveMarkers(designProjectId, [], {})
		this.storage.pruneMarkerCompositePath(designProjectId, new Set())
	}

	/**
	 * 获取 marker 识别数据
	 * 画布开/关均走 MarkerCompositorService（无画布合成）
	 */
	async fetchMarkerData(
		designProjectId: string,
		markerId: string,
		options?: { force?: boolean; requestId?: number },
	): Promise<void> {
		const marker = this.getMarker(designProjectId, markerId)
		if (!marker) return
		if (marker.result && !options?.force) return
		if (this.loadingMarkers.has(markerId) && !options?.force) return

		const {
			getCanvasElements,
			getElementImageInfo,
			getFileInfo,
			uploadPrivateFiles,
			identifyImageMark,
			projectId,
		} = this.dependencies
		if (!getFileInfo || !uploadPrivateFiles || !identifyImageMark) return

		const requestId = options?.requestId ?? this.getNextMarkerRequestId(markerId)
		const controller = new AbortController()
		this.activeMarkerRequests.set(markerId, { requestId, controller })

		// 优先使用缓存的 element src（支持画布未打开时 fetch）
		const cachedSrc = this.getElementSrcCache(designProjectId)[markerId]
		let element: ImageElement | undefined
		if (cachedSrc) {
			element = {
				id: marker.elementId,
				type: ElementTypeEnum.Image,
				src: cachedSrc,
				crop: marker.elementCrop,
			} as ImageElement
		}
		if (!element) {
			const elements = getCanvasElements?.(designProjectId)?.elements
			if (!Array.isArray(elements)) return
			element = findImageElementById(
				elements as { id?: string; type?: string; src?: string; children?: unknown[] }[],
				marker.elementId,
			)
		}
		if (!element?.src) return

		// 尝试从画布获取图片信息（画布打开时优先使用）
		const canvasImageInfo = await getElementImageInfo?.(marker.elementId)
		if (!this.isMarkerRequestCurrent(markerId, requestId)) return

		// 计算 sequence：同元素下 markers 的序号（从 1 起）
		const sameElementMarkers = this.getMarkers(designProjectId)
			.filter((m) => m.elementId === marker.elementId)
			.sort((a, b) => {
				const ax = a.relativeX + a.relativeY
				const bx = b.relativeX + b.relativeY
				return ax - bx || a.id.localeCompare(b.id)
			})
		const sequence = sameElementMarkers.findIndex((m) => m.id === markerId) + 1 || 1

		this.loadingMarkers.add(markerId)
		this.updateMarker(designProjectId, markerId, { error: undefined })

		const elementSrc = element.src
		const invalidationKey = buildMarkerCompositeKey(elementSrc, marker)
		const cachedComposite = this.getCompositePathCache(designProjectId)[markerId]

		try {
			const methods: MarkerCompositorMethods = {
				getFileInfo,
				uploadPrivateFiles:
					uploadPrivateFiles as MarkerCompositorMethods["uploadPrivateFiles"],
				identifyImageMark:
					identifyImageMark as MarkerCompositorMethods["identifyImageMark"],
			}

			let result: Awaited<ReturnType<typeof MarkerCompositorService.identify>>

			if (
				cachedComposite?.invalidationKey === invalidationKey &&
				cachedComposite.filePath &&
				cachedComposite.imageInfo
			) {
				const cachedImageInfo = cachedComposite.imageInfo
				result = await MarkerCompositorService.identify({
					marker,
					filePath: cachedComposite.filePath,
					imageInfo: {
						naturalWidth: cachedImageInfo.naturalWidth,
						naturalHeight: cachedImageInfo.naturalHeight,
						fileSize: 0,
						mimeType: "image/png",
						filename: "image.png",
					},
					methods: { identifyImageMark: methods.identifyImageMark },
					projectId,
					signal: controller.signal,
				})
			} else {
				const compositeResult = await MarkerCompositorService.composite({
					marker,
					element,
					sequence,
					methods,
					projectId,
					imageInfo: canvasImageInfo?.imageInfo,
					ossUrl: canvasImageInfo?.ossUrl,
					image: canvasImageInfo?.image,
					signal: controller.signal,
				})
				if (!this.isMarkerRequestCurrent(markerId, requestId)) return
				this.saveCompositePathCache(designProjectId, markerId, {
					filePath: compositeResult.filePath,
					invalidationKey,
					imageInfo: {
						naturalWidth: compositeResult.imageInfo.naturalWidth,
						naturalHeight: compositeResult.imageInfo.naturalHeight,
					},
				})
				result = await MarkerCompositorService.identify({
					marker,
					filePath: compositeResult.filePath,
					imageInfo: compositeResult.imageInfo,
					methods: { identifyImageMark: methods.identifyImageMark },
					projectId,
					signal: controller.signal,
				})
			}

			if (!this.isMarkerRequestCurrent(markerId, requestId)) return

			// identify 返回 IdentifyImageMarkResponse
			this.updateMarker(designProjectId, markerId, { result, error: undefined })
			this.publishToMessageEditor(PubSubEvents.Super_Magic_Marker_Data_Updated, {
				markerId,
				designProjectId,
				result,
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			if (controller.signal.aborted || !this.isMarkerRequestCurrent(markerId, requestId))
				return

			this.updateMarker(designProjectId, markerId, { error: errorMessage })
			this.publishToMessageEditor(PubSubEvents.Super_Magic_Marker_Data_Updated, {
				markerId,
				designProjectId,
				error: errorMessage,
			})
		} finally {
			if (this.isMarkerRequestCurrent(markerId, requestId)) {
				this.activeMarkerRequests.delete(markerId)
				this.loadingMarkers.delete(markerId)
			}
		}
	}

	private publishToMessageEditor(
		event: MarkerManagerPublishEvent,
		payload: MarkerManagerPublishPayload,
	): void {
		const publish =
			this.dependencies.publishToMessageEditor ??
			((e: MarkerManagerPublishEvent, p: MarkerManagerPublishPayload) => pubsub.publish(e, p))
		publish(event, payload)
	}

	/**
	 * 构建单个 marker 的 mention 数据（依赖 getCanvasElements、getImageOssUrl、getFileInfo）
	 */
	private async buildMentionDataForMarker(
		designProjectId: string,
		marker: Marker,
		markNumber: number,
	): Promise<CanvasMarkerMentionData | null> {
		const { getCanvasElements, projectId, topicId } = this.dependencies
		const elements = getCanvasElements?.(designProjectId)?.elements
		if (!Array.isArray(elements)) return null

		const element = findImageElementById(
			elements as {
				id?: string
				type?: string
				src?: string
				width?: number
				height?: number
				scaleX?: number
				scaleY?: number
				children?: unknown[]
			}[],
			marker.elementId,
		) as ImageElement | undefined
		if (!element?.src) return null

		const imagePath = element.src

		const scaleX = element.scaleX ?? 1
		const scaleY = element.scaleY ?? 1
		const elementWidth = element.width ? element.width * scaleX : undefined
		const elementHeight = element.height ? element.height * scaleY : undefined

		return this.toCanvasMarkerMentionData(designProjectId, marker, {
			markNumber,
			projectId,
			topicId,
			loading: !marker.result && !marker.error,
			imagePath,
			elementWidth,
			elementHeight,
		})
	}

	/**
	 * 同步 markers 到 MessageEditor
	 * - restore: 只更新已有节点，不 insertContent
	 * - insert: 在光标处插入
	 */
	async syncToMessageEditor(
		designProjectId: string,
		mode: SyncToMessageEditorMode,
		options?: SyncToMessageEditorOptions,
	): Promise<void> {
		if (this.isSyncingToEditor) return

		if (mode === "insert" && options?.markerId) {
			const marker = this.getMarker(designProjectId, options.markerId)
			if (!marker) return

			const markers = this.getMarkers(designProjectId)
			const markerIndex = markers.findIndex((m) => m.id === marker.id)
			const markNumber = markerIndex >= 0 ? markerIndex + 1 : markers.length

			const mentionData = await this.buildMentionDataForMarker(
				designProjectId,
				marker,
				markNumber,
			)
			if (!mentionData) return

			this.publishToMessageEditor(PubSubEvents.Super_Magic_Insert_Marker_To_Chat, {
				items: [{ type: MentionItemType.DESIGN_MARKER, data: mentionData }],
			})
			return
		}

		if (mode === "restore") {
			this.isSyncingToEditor = true
			try {
				const markers = this.getMarkers(designProjectId)
				if (markers.length === 0) return

				const items: Array<{
					type: typeof MentionItemType.DESIGN_MARKER
					data: CanvasMarkerMentionData
				}> = []
				for (let i = 0; i < markers.length; i++) {
					const mentionData = await this.buildMentionDataForMarker(
						designProjectId,
						markers[i],
						i + 1,
					)
					if (mentionData) {
						items.push({ type: MentionItemType.DESIGN_MARKER, data: mentionData })
					}
				}
				if (items.length > 0) {
					this.publishToMessageEditor(PubSubEvents.Super_Magic_Sync_Markers_To_Chat, {
						items,
					})
				}
			} finally {
				this.isSyncingToEditor = false
			}
		}
	}
}
