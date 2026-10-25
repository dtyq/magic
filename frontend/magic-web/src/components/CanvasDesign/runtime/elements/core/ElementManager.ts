import Konva from "konva"
import type {
	LayerElement,
	CanvasDocument,
	ImageElement,
	ElementType,
	ElementUpdatePatch,
} from "../../document/types"
import { ElementTypeEnum } from "../../document/types"
import type {
	CanvasElementChangePayload,
	CanvasElementNameChange,
	CanvasEventMap,
} from "../../core/EventEmitter"
import { ElementFactory } from "./ElementFactory"
import { BaseElement } from "./BaseElement"
import { NodeAdapter } from "./NodeAdapter"
import { ZIndexManager } from "./ZIndexManager"
import type { Canvas } from "../../core/Canvas"
import { FrameElement } from "../frame/FrameElement"
import { ImageElement as ImageElementClass } from "../image/ImageElement"
import { VideoElement as VideoElementClass } from "../video/VideoElement"
import { exportCanvasDocument, exportLayerElement } from "../../document/exportDocument"
import { syncCropConfigOnResize } from "../../resources/image/imageCropUtils"
import { normalizeFrameCreationSize, normalizeSize } from "../../shared/normalize/normalizeUtils"
import { sanitizeCanvasDocument } from "../../document/temporaryElementUtils"
import { CanvasDocumentIndex } from "./CanvasDocumentIndex"
import { resumeDocumentAssetCompliancePolling } from "../../resources/asset/CanvasAssetComplianceTaskManager"
import { resumeImageBatchPollingManagers } from "../../resources/polling/resumeImageBatchPolling"
import {
	getActiveImageContent,
	updateImageContent,
	getActiveContent,
	getElementContentFields,
	updateContent,
} from "../../document/elementContent"
import type { UploadFileResponse } from "../../../public/magic-types"
import { validateElementData } from "../../document/validateElement"
import { generateUniqueElementName } from "../../shared/ids"
import { getAllExistingNames } from "../../shared/placement/elementUtils"

/**
 * 更新模式
 */
export type UpdateMode = "full" | "data-only" | "node-only"

/**
 * 元素操作选项
 */
export interface ElementOperationOptions {
	/** 不触发 element:updated 事件（不记录历史） */
	silent?: boolean
	/** 触发持久化更新事件，但不将本次更新加入用户撤回栈 */
	historyPolicy?: "include" | "exclude"
	/** 强制重新渲染 */
	forceRerender?: boolean
	/** 批量操作模式（延迟事件触发，需要手动调用 flush） */
	batch?: boolean
	/** 更新模式：控制更新哪些层（默认 'full'） */
	mode?: UpdateMode
	/** 跳过图片尺寸变化时的 crop 同步，适用于 transform 实时阶段 */
	skipImageCropResizeSync?: boolean
	/** 跳过节点层几何缓存失效；适用于随后会进行 data-only 提交的 transform 同步 */
	skipGeometryInvalidate?: boolean
	/** 跳过 zIndex 变更后的全量同级节点重排；调用方需要自行维护 Konva 节点顺序 */
	skipZIndexReorder?: boolean
	/** 批量更新成功后是否发送 element:batchupdated；事务调用方可延后到正式提交后发送 */
	emitBatchUpdated?: boolean
}

export interface ElementCreateResult<T extends LayerElement = LayerElement> {
	elementId: string
	element: T
}

export interface ElementLoadIssue {
	elementId: string
	elementType: LayerElement["type"]
	message: string
}

export interface ElementManagerDocumentPatch {
	upserts: Array<{ element: LayerElement; parentId: string | null }>
	deletedElementIds: string[]
	changedElementIds: string[]
	elementNameChanges?: CanvasElementNameChange[]
}

export interface ReparentElementOptions {
	/** 目标父元素；null 表示移动到根级 content layer */
	targetParentId: string | null
	/** 元素当前在 content layer 坐标系中的变换原点 */
	positionInContent: { x: number; y: number }
	/** 取消拖拽时只恢复内部状态，不对外发出提交事件 */
	silent?: boolean
}

export interface ReparentElementsOptions {
	/** 目标父元素；null 表示移动到根级 content layer */
	targetParentId: string | null
	/** 元素在 content layer 坐标系中的最终变换原点 */
	elements: Array<{
		elementId: string
		positionInContent: { x: number; y: number }
	}>
	/** 取消拖拽时只恢复内部状态，不对外发出提交事件 */
	silent?: boolean
}

export type TemporaryElementKind = "upload" | "generation-result"

export interface TemporaryElementMetadata {
	kind: TemporaryElementKind
	historyPolicy: "include" | "exclude"
	clipboardPolicy: "include" | "exclude"
}

const TEMPORARY_ELEMENT_METADATA: Record<TemporaryElementKind, TemporaryElementMetadata> = {
	upload: {
		kind: "upload",
		historyPolicy: "include",
		clipboardPolicy: "include",
	},
	"generation-result": {
		kind: "generation-result",
		historyPolicy: "exclude",
		clipboardPolicy: "exclude",
	},
}

export interface CommitGenerationTarget {
	elementId: string
	contentId?: string
	persistedPatch: ElementUpdatePatch
}

type ElementMutationPatch = ElementUpdatePatch & {
	id?: string
	type?: ElementType
}

function getElementChildIds(element: LayerElement): string[] {
	if (!("children" in element) || !Array.isArray(element.children)) return []
	return element.children.map((child) => child.id)
}

function hasSameElementChildOrder(left: LayerElement, right: LayerElement): boolean {
	const leftChildIds = getElementChildIds(left)
	const rightChildIds = getElementChildIds(right)
	if (leftChildIds.length !== rightChildIds.length) return false
	return leftChildIds.every((childId, index) => childId === rightChildIds[index])
}

/**
 * 元素管理器 - 管理画布上的所有元素实例
 * 职责：
 * 1. 管理元素实例的生命周期
 * 2. 管理 Konva 节点的渲染
 * 3. 提供数据查询接口
 * 4. 发出元素变化事件
 */
export class ElementManager {
	private canvas: Canvas

	private elements: Map<string, BaseElement> = new Map()
	private elementDraggingDisabled = false
	private viewportGestureDraggingDisabled = false
	private elementListeningDisabled = false
	private viewportGestureUnsubscribe?: () => void
	private batchMode = false
	private lastLoadIssues: ElementLoadIssue[] = []
	private isBatchDeleting = false
	private pendingBatchDeleteChangeIds: Set<string> = new Set()
	private isContentLayerDrawDeferred = false
	/** During full document replacement, geometry is rebuilt once after the whole tree exists. */
	private isReplacingAll = false
	private pendingEvents: Array<{
		type: keyof CanvasEventMap
		data: CanvasEventMap[keyof CanvasEventMap]
	}> = []
	private nodeAdapter: NodeAdapter
	public zIndexManager: ZIndexManager
	private documentIndex: CanvasDocumentIndex = new CanvasDocumentIndex()
	/**
	 * Visibility is a property of the data-tree path, not of the current viewport. Cache it between
	 * spatial consumers so one visibility pass does not walk the same nested Frame/Group ancestors
	 * for every media element.
	 */
	private dataTreeVisibilityCache = new Map<string, boolean>()

	// 临时元素按来源分类；不同来源拥有独立的历史和剪贴板策略。
	private temporaryElements: Map<string, TemporaryElementMetadata> = new Map()

	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas
		// 初始化 NodeAdapter（需要 stage）
		this.nodeAdapter = new NodeAdapter({ canvas: this.canvas })
		// 初始化 ZIndexManager
		this.zIndexManager = new ZIndexManager(this.canvas)
		this.viewportGestureUnsubscribe = this.canvas.eventEmitter.on(
			"viewport:gesture",
			({ data }) => {
				this.setViewportGestureDraggingDisabled(data.active)
			},
		)
	}

	/**
	 * 创建元素
	 * @param elementData - 元素数据
	 * @param options - 操作选项
	 * 主动创建的 Frame 会在此统一规范化宽高；文档加载不经过此入口。
	 * @throws 如果元素已存在
	 */
	public create<T extends LayerElement>(
		elementData: T,
		options?: ElementOperationOptions,
	): ElementCreateResult<T> | null {
		if (this.elements.has(elementData.id)) {
			throw new Error(
				`Element ${elementData.id} already exists. Use update() or upsert() instead.`,
			)
		}
		const resolvedElement = this.resolveUniqueElementName(
			this.normalizeCreatedElementData(elementData),
		)
		this.doCreate(resolvedElement, options || {})
		const createdElement = this.elements.get(resolvedElement.id)?.getData()
		if (!createdElement) {
			return null
		}
		return { elementId: resolvedElement.id, element: createdElement as T }
	}

	/**
	 * 创建仅存在于运行时的临时元素。
	 * 临时标记必须早于 element:created，保证外部 DSL 导出不会包含该元素。
	 */
	public createTemporaryElement(
		elementData: LayerElement,
		options?: ElementOperationOptions,
		temporaryKind: TemporaryElementKind = "generation-result",
	): ElementCreateResult {
		if (this.elements.has(elementData.id)) {
			throw new Error(`Element ${elementData.id} already exists`)
		}

		const elementWithUniqueName = this.resolveUniqueElementName(
			this.normalizeCreatedElementData(elementData),
		)
		this.markElementTemporary(elementWithUniqueName.id, temporaryKind)
		try {
			this.doCreate(elementWithUniqueName, options || {})
			if (!this.elements.has(elementWithUniqueName.id)) {
				throw new Error(`Element ${elementWithUniqueName.id} could not be created`)
			}
		} catch (error) {
			if (this.elements.has(elementWithUniqueName.id)) {
				this.doDelete(elementWithUniqueName.id, { suppressEvents: true })
			} else {
				this.temporaryElements.delete(elementWithUniqueName.id)
			}
			throw error
		}
		const createdElement = this.elements.get(elementWithUniqueName.id)?.getData()
		if (!createdElement) {
			throw new Error(`Element ${elementWithUniqueName.id} could not be created`)
		}
		return { elementId: elementWithUniqueName.id, element: createdElement }
	}

	/**
	 * 创建临时元素（用于上传中的图片）
	 * 临时元素会被渲染和交互，但不会被导出到 canvasDocument
	 * @param elementData - 元素数据
	 * @param uploadContext - 上传上下文（包含 uploadFiles 和回调）
	 * @returns 元素ID
	 */
	public createTemporary(
		elementData: LayerElement,
		uploadContext: {
			uploadFiles: File[]
			onUploadComplete?: (elementId: string, result: UploadFileResponse) => void
			onUploadFailed?: (elementId: string, error: Error) => void
			onUploadSettled?: () => void
		},
	): string {
		// 创建元素实例（与正式元素相同的渲染逻辑）
		const createResult = this.createTemporaryElement(elementData, { silent: false }, "upload")

		// 获取元素实例
		const element = this.elements.get(createResult.elementId)

		// 如果是 ImageElement，创建 ossSrc Promise
		if (element instanceof ImageElementClass) {
			element.createOssSrcPromise()
		}

		// 使用全局上传管理器上传文件
		const { uploadFiles, onUploadComplete, onUploadFailed, onUploadSettled } = uploadContext
		if (uploadFiles.length > 0) {
			this.canvas.canvasFileUploadManager.queueUpload({
				elementId: createResult.elementId,
				file: uploadFiles[0],
				onUploadComplete: (result) => {
					// 存储上传结果到元素实例（用于后续处理）
					const element = this.elements.get(createResult.elementId)
					if (
						element instanceof ImageElementClass ||
						element instanceof VideoElementClass
					) {
						element.uploadResult = result
					}
					// 触发原始回调
					onUploadComplete?.(createResult.elementId, result)
				},
				onUploadFailed: (error) => {
					// 触发原始回调
					onUploadFailed?.(createResult.elementId, error)
				},
				onUploadSettled,
			})
		}

		return createResult.elementId
	}

	/**
	 * 将已存在或即将创建的元素标记为临时元素。
	 * 用于容器子元素先渲染上传态、后续上传完成再转正的场景。
	 */
	public markElementTemporary(elementId: string, kind: TemporaryElementKind = "upload"): void {
		this.temporaryElements.set(elementId, TEMPORARY_ELEMENT_METADATA[kind])
	}

	/**
	 * 将临时元素转为正式元素
	 * @param elementId - 元素ID
	 * @param updates - 更新数据（通常包含 src 和 status）
	 * @param options - 操作选项
	 */
	public convertToPermament(
		elementId: string,
		updates: ElementUpdatePatch,
		options?: ElementOperationOptions,
	): void {
		if (!this.temporaryElements.has(elementId)) {
			throw new Error(`Element ${elementId} is not temporary`)
		}

		// 移除临时标记
		this.temporaryElements.delete(elementId)

		// 更新元素数据
		this.doUpdate(elementId, updates, options || { silent: false })

		// 触发转正事件
		this.canvas.eventEmitter.emit({
			type: "element:temporary:converted",
			data: { elementId },
		})
	}

	/**
	 * 将一个或多个已被后端确认的生成目标一次性写入正式 DSL。
	 * 目标会先完整校验，再通过单次 batchUpdate 提交，从而只产生一个历史快照和一个 element:change。
	 */
	public commitGenerationTargets(targets: CommitGenerationTarget[]): void {
		if (targets.length === 0) return

		const elementIds = new Set<string>()
		const convertedElementIds: string[] = []
		for (const target of targets) {
			if (elementIds.has(target.elementId)) {
				throw new Error(`Duplicate generation target ${target.elementId}`)
			}
			elementIds.add(target.elementId)

			if (!this.elements.has(target.elementId)) {
				throw new Error(`Element ${target.elementId} not found`)
			}

			const temporary = this.temporaryElements.get(target.elementId)
			if (temporary?.kind === "upload") {
				throw new Error(`Element ${target.elementId} is an upload temporary element`)
			}
			if (temporary?.kind === "generation-result") {
				convertedElementIds.push(target.elementId)
			}
		}

		this.batchUpdate(
			targets.map((target) => ({
				id: target.elementId,
				data: target.persistedPatch,
			})),
			{
				silent: false,
				emitBatchUpdated: convertedElementIds.length === 0,
			},
		)

		// batchUpdate 成功后才登记 user，避免写 DSL 失败时留下虚假的任务所有权。
		for (const target of targets) {
			const imagePatch = target.persistedPatch as Record<string, unknown>
			const request = target.contentId
				? (
						imagePatch.contents as
							| Array<{
									contentId: string
									generateImageRequest?: { image_id?: string }
							  }>
							| undefined
					)?.find((content) => content.contentId === target.contentId)
						?.generateImageRequest
				: (imagePatch.generateImageRequest as { image_id?: string } | undefined)
			if (request?.image_id) {
				this.canvas.elementDetailsRuntimeManager?.markGenerateImageRequestAsUser(
					target.elementId,
					request.image_id,
					target.contentId,
				)
			}
		}

		convertedElementIds.forEach((elementId) => this.temporaryElements.delete(elementId))
		convertedElementIds.forEach((elementId) => {
			this.canvas.eventEmitter.emit({
				type: "element:temporary:converted",
				data: { elementId },
			})
		})
		if (convertedElementIds.length > 0) {
			this.canvas.eventEmitter.emit({
				type: "element:batchupdated",
				data: { elementIds: convertedElementIds },
			})
		}
	}

	/**
	 * 更新元素（统一接口，通过 mode 控制更新行为）
	 * @param elementId - 元素ID
	 * @param updates - 要更新的属性
	 * @param options - 操作选项
	 * @throws 如果元素不存在
	 */
	public update(
		elementId: string,
		updates: ElementUpdatePatch,
		options?: ElementOperationOptions,
	): void {
		const element = this.elements.get(elementId)
		if (!element) {
			throw new Error(`Element ${elementId} not found. Use create() or upsert() instead.`)
		}

		const mode = options?.mode || "full"

		// 规范化数据（所有模式都需要）
		const normalizedUpdates = this.normalizeUpdates(element, updates, options)

		// 根据模式决定更新什么
		switch (mode) {
			case "node-only":
				// 仅更新 node（用于实时变换）
				this.updateNodeOnly(element, normalizedUpdates, options)
				break

			case "data-only":
				// 仅更新 data（用于变换结束时同步）
				this.updateDataOnly(element, normalizedUpdates, options)
				break

			case "full":
			default:
				// 完整更新（常规场景）
				this.doUpdate(elementId, normalizedUpdates, options || {})
				break
		}
	}

	/**
	 * 仅更新元素的 Konva node（用于实时变换场景）
	 * 不会触发数据同步、事件或历史记录
	 * @deprecated 使用 update(id, updates, { mode: 'node-only' }) 替代
	 */
	public updateNode(
		elementId: string,
		updates: ElementUpdatePatch,
		options?: { forceUpdate?: boolean },
	): void {
		this.update(elementId, updates, {
			mode: "node-only",
			forceRerender: options?.forceUpdate,
		})
	}

	/**
	 * 仅更新元素的 data（用于批量数据同步场景）
	 * 不会触发 node 更新或重新渲染
	 * @deprecated 使用 update(id, updates, { mode: 'data-only' }) 替代
	 */
	public updateData(
		elementId: string,
		updates: ElementUpdatePatch,
		options?: ElementOperationOptions,
	): void {
		this.update(elementId, updates, {
			...options,
			mode: "data-only",
		})
	}

	/**
	 * 删除元素（递归删除子元素）
	 * @param elementId - 元素ID
	 * @param options - 删除选项
	 */
	public delete(elementId: string, options?: { skipChildren?: boolean }): void {
		this.doDelete(elementId, options)
	}

	/**
	 * 设置元素（存在则更新，不存在则创建）
	 * @param elementData - 元素数据
	 * @param options - 操作选项
	 */
	public upsert(elementData: LayerElement, options?: ElementOperationOptions): void {
		if (this.elements.has(elementData.id)) {
			this.doUpdate(elementData.id, elementData, options || {})
		} else {
			this.doCreate(this.normalizeCreatedElementData(elementData), options || {})
		}
	}

	/**
	 * 批量更新元素
	 * @param updates - 更新数组，每项包含 id 和要更新的数据
	 */
	public batchUpdate(
		updates: Array<{ id: string; data: ElementUpdatePatch }>,
		options?: ElementOperationOptions,
	): void {
		// 在任何 Element 落入 Runtime 前完成整批校验，避免后续目标非法时留下部分更新。
		const stagedDataByElementId = new Map<string, LayerElement>()
		for (const { id, data } of updates) {
			const element = this.elements.get(id)
			if (!element) continue
			const currentData = stagedDataByElementId.get(id) ?? element.getData()
			const nextData = this.mergeElementData(currentData, data, id)
			validateElementData(nextData)
			stagedDataByElementId.set(id, nextData)
		}

		this.batchMode = true
		let succeeded = false
		try {
			updates.forEach(({ id, data }) => {
				if (this.elements.has(id)) {
					this.doUpdate(id, data, { ...options, batch: true })
				}
			})
			succeeded = true
		} finally {
			this.batchMode = false
			this.flush()
			if (succeeded && options?.emitBatchUpdated !== false) {
				// 只有全部更新成功后才触发批量完成，避免失败事务污染历史快照。
				this.canvas.eventEmitter.emit({
					type: "element:batchupdated",
					data: { elementIds: [...stagedDataByElementId.keys()] },
				})
			}
		}
	}

	/**
	 * 批量删除元素
	 * @param elementIds - 要删除的元素 ID 数组
	 */
	public batchDelete(elementIds: string[]): void {
		const documentElementIds = elementIds.filter(
			(elementId) =>
				this.elements.has(elementId) &&
				this.temporaryElements.get(elementId)?.kind !== "generation-result",
		)
		// 临时禁用历史记录，避免每次删除都记录
		const historyManager = this.canvas.historyManager
		historyManager?.disable()
		this.isBatchDeleting = true
		this.pendingBatchDeleteChangeIds.clear()
		this.isContentLayerDrawDeferred = false

		try {
			elementIds.forEach((id) => {
				if (this.elements.has(id)) {
					this.doDelete(id)
				}
			})

			this.flushDeferredBatchDeleteEffects()

			// 重新启用历史记录并立即记录一次
			if (historyManager) {
				historyManager.enable()
				if (documentElementIds.length > 0) {
					historyManager.recordHistoryImmediate()
				}
			}

			// 触发批量删除完成事件
			this.canvas.eventEmitter.emit({
				type: "element:batchdeleted",
				data: { elementIds },
			})
		} finally {
			this.isBatchDeleting = false
			this.pendingBatchDeleteChangeIds.clear()
			this.isContentLayerDrawDeferred = false
			// 确保异常情况下也能重新启用历史记录
			historyManager?.enable()
		}
	}

	/**
	 * 批量替换所有元素
	 * @param elementsData - 元素数据数组
	 */
	public replaceAll(elementsData: LayerElement[]): void {
		this.clear()
		this.lastLoadIssues = []
		this.isReplacingAll = true
		this.batchMode = true
		try {
			// 规范化 zIndex：按原有顺序排序后，重新分配连续的 zIndex
			const normalizedElements = this.normalizeZIndex(elementsData)
			normalizedElements.forEach((elementData) => {
				const pendingEventCount = this.pendingEvents.length
				try {
					this.doCreate(elementData, { batch: true })
				} catch (error) {
					// 丢弃该元素失败前产生的批量事件，避免 flush 时发布半成品状态。
					this.pendingEvents.length = pendingEventCount

					// 单个元素渲染失败不应阻断其他元素和连接的加载。
					// 如果元素已经部分挂载，先回滚其运行时实例，避免留下半成品。
					if (this.elements.has(elementData.id)) {
						try {
							this.doDelete(elementData.id, { suppressEvents: true })
						} catch {
							// 保留原始加载错误，避免清理失败覆盖根因。
						}
					}

					this.lastLoadIssues.push({
						elementId: elementData.id,
						elementType: elementData.type,
						message: error instanceof Error ? error.message : String(error),
					})
				}
			})
		} finally {
			this.isReplacingAll = false
			this.batchMode = false
			// Every element was created from an empty document while ancestor invalidation was deferred.
			// Drop any bounds/index state produced during rendering before consumers query the new tree.
			this.canvas.geometryCacheManager.invalidateAll()
			this.flush()
			// 重新排列顶层元素的渲染顺序，确保 Konva 节点顺序与 zIndex 一致
			this.reorderTopLevelElements()
		}
	}

	/** 获取最近一次批量加载中失败的元素。 */
	public getLastLoadIssues(): ElementLoadIssue[] {
		return [...this.lastLoadIssues]
	}

	/**
	 * 规范化元素的 zIndex
	 * 按原有 zIndex 排序后，重新分配从 1 开始的连续 zIndex
	 * 递归处理子元素
	 */
	private normalizeZIndex(elements: LayerElement[]): LayerElement[] {
		// 按 zIndex 排序（从小到大）
		const sorted = [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))

		// 重新分配连续的 zIndex，从 1 开始
		return sorted.map((el, index) => {
			const normalized = { ...el, zIndex: index + 1 }

			// 递归处理子元素（如画框内的元素）
			if (
				"children" in normalized &&
				normalized.children &&
				Array.isArray(normalized.children)
			) {
				normalized.children = this.normalizeZIndex(normalized.children)
			}

			return normalized
		})
	}

	/**
	 * 刷新批量操作的事件（在批量模式下使用）
	 */
	public flush(): void {
		if (this.pendingEvents.length > 0) {
			// 只触发一次 element:change 事件，并尽量带上受影响的元素 id
			this.emitElementChange(this.collectPendingChangedElementIds(), {
				nameChanges: this.collectPendingElementNameChanges(),
				phase: "commit",
			})
			this.pendingEvents = []
		}
		this.canvas.runtimeScheduler.requestLayerDraw("content", {
			source: "ElementManager",
			reason: "flush",
			priority: "normal",
		})
	}

	private invalidateGeometryForElement(elementId: string): void {
		if (this.isReplacingAll) return

		const invalidIds = new Set<string>([elementId])
		this.collectDescendantGeometryIds(elementId, invalidIds)
		let currentParent = this.findParentElement(elementId)

		while (currentParent) {
			invalidIds.add(currentParent.getData().id)
			currentParent = this.findParentElement(currentParent.getData().id)
		}

		this.canvas.geometryCacheManager.invalidateElements(invalidIds)
	}

	private collectDescendantGeometryIds(elementId: string, invalidIds: Set<string>): void {
		const elementData = this.elements.get(elementId)?.getData()
		if (
			!elementData ||
			!("children" in elementData) ||
			!elementData.children ||
			!Array.isArray(elementData.children)
		) {
			return
		}

		elementData.children.forEach((child) => {
			if (invalidIds.has(child.id)) return
			invalidIds.add(child.id)
			this.collectDescendantGeometryIds(child.id, invalidIds)
		})
	}

	private markDocumentIndexDirty(options?: { topology?: boolean }): void {
		if (options?.topology) {
			this.documentIndex.markTopologyDirty()
			return
		}
		this.documentIndex.markDirty()
	}

	private updateChangesDocumentTopology(
		currentData: LayerElement,
		nextData: LayerElement,
	): boolean {
		return !hasSameElementChildOrder(currentData, nextData)
	}

	private invalidateDataTreeVisibilityCache(): void {
		this.dataTreeVisibilityCache.clear()
	}

	private getElementSrc(data: LayerElement): string | undefined {
		const content = this.canvas.getEffectiveContent(data.id) ?? getActiveContent(data)
		return content && "src" in content && typeof content.src === "string"
			? content.src
			: undefined
	}

	private mergeElementData(
		currentData: LayerElement,
		updates: ElementMutationPatch,
		elementId: string,
	): LayerElement {
		if (updates.id !== undefined && updates.id !== elementId) {
			throw new Error(`Element ${elementId} id cannot be changed`)
		}
		if (updates.type !== undefined && updates.type !== currentData.type) {
			throw new Error(`Element ${elementId} type cannot be changed`)
		}
		const contentFields = new Set(getElementContentFields(currentData.type))
		const contentPatch: Record<string, unknown> = {}
		const elementUpdates: Record<string, unknown> = {
			...(updates as unknown as Record<string, unknown>),
		}
		for (const field of contentFields) {
			if (!Object.prototype.hasOwnProperty.call(elementUpdates, field)) continue
			contentPatch[field] = elementUpdates[field]
			delete elementUpdates[field]
		}

		const currentRecord = currentData as unknown as Record<string, unknown>
		const nextContentElement =
			Object.keys(contentPatch).length > 0
				? updateContent(
						currentData as never,
						(currentRecord.activeContentId as string | null | undefined) ?? undefined,
						contentPatch as never,
					)
				: currentData

		return {
			...(nextContentElement as unknown as LayerElement),
			...elementUpdates,
			id: elementId,
			type: currentData.type,
		} as LayerElement
	}

	private buildElementNameChange(
		previousData: LayerElement,
		nextData: LayerElement,
	): CanvasElementNameChange | undefined {
		const oldName = previousData.name || ""
		const newName = nextData.name || ""
		if (oldName === newName) return undefined

		return {
			elementId: nextData.id,
			elementType: nextData.type,
			oldName: previousData.name,
			newName: nextData.name,
			oldSrc: this.getElementSrc(previousData),
			newSrc: this.getElementSrc(nextData),
		}
	}

	// ==================== 私有实现方法 ====================

	/**
	 * 规范化主动创建的元素数据。
	 * 文档加载使用 replaceAll()/doCreate()，因此不会改写历史 DSL。
	 */
	private normalizeCreatedElementData<T extends LayerElement>(elementData: T): T {
		if (
			elementData.type !== ElementTypeEnum.Frame ||
			elementData.width === undefined ||
			elementData.height === undefined
		) {
			return elementData
		}

		return {
			...elementData,
			...normalizeFrameCreationSize(elementData.width, elementData.height),
		}
	}

	/**
	 * 规范化更新数据（提取公共逻辑）
	 */
	private normalizeUpdates(
		element: BaseElement,
		updates: ElementMutationPatch,
		options?: ElementOperationOptions,
	): ElementMutationPatch {
		const normalizedUpdates = { ...updates }
		const currentData = element.getData()

		// 如果更新中包含 width 或 height，将它们规范化
		if (normalizedUpdates.width !== undefined || normalizedUpdates.height !== undefined) {
			const normalizedSize = normalizeSize(
				normalizedUpdates.width ?? currentData.width ?? 0,
				normalizedUpdates.height ?? currentData.height ?? 0,
				{
					precision: "integer",
				},
			)
			if (normalizedUpdates.width !== undefined) {
				normalizedUpdates.width = normalizedSize.width
			}
			if (normalizedUpdates.height !== undefined) {
				normalizedUpdates.height = normalizedSize.height
			}

			const imageData =
				currentData.type === ElementTypeEnum.Image
					? (currentData as ImageElement)
					: undefined
			const normalizedImageUpdates = normalizedUpdates as Record<string, unknown>
			const activeImageContent = imageData ? getActiveImageContent(imageData) : undefined
			const hasExplicitCropField = Object.prototype.hasOwnProperty.call(
				normalizedUpdates,
				"crop",
			)
			// Content fields can be updated through the complete contents array. Preserve an
			// explicit nested crop change, including crop: undefined, during resize sync.
			const hasExplicitNestedCropField =
				!!activeImageContent &&
				Array.isArray(normalizedUpdates.contents) &&
				normalizedUpdates.contents.some((content) => {
					if (!content || typeof content !== "object") return false
					const contentRecord = content as { contentId?: string }
					return (
						contentRecord.contentId === activeImageContent.contentId &&
						Object.prototype.hasOwnProperty.call(content, "crop")
					)
				})
			const shouldSyncCropOnResize =
				!!activeImageContent?.crop &&
				!hasExplicitCropField &&
				!hasExplicitNestedCropField &&
				!options?.skipImageCropResizeSync

			if (shouldSyncCropOnResize && imageData && activeImageContent?.crop) {
				const imageInfo =
					element instanceof ImageElementClass ? element.getImageInfo() : undefined
				const sourceDimensions = imageInfo
					? {
							width: imageInfo.naturalWidth ?? imageData.width ?? 0,
							height: imageInfo.naturalHeight ?? imageData.height ?? 0,
						}
					: {
							width: imageData.width ?? 0,
							height: imageData.height ?? 0,
						}

				const nextCrop = syncCropConfigOnResize({
					crop: activeImageContent.crop,
					prevElementSize: {
						width: imageData.width ?? 0,
						height: imageData.height ?? 0,
					},
					nextElementSize: {
						width: normalizedUpdates.width ?? imageData.width ?? 0,
						height: normalizedUpdates.height ?? imageData.height ?? 0,
					},
					sourceDimensions,
				})
				const nextImage = updateImageContent(
					imageData,
					imageData.activeContentId ?? undefined,
					{ crop: nextCrop },
				)
				normalizedImageUpdates.contents = nextImage.contents
				normalizedImageUpdates.activeContentId = nextImage.activeContentId
				normalizedImageUpdates.mainContentId = nextImage.mainContentId
			}
		}

		return normalizedUpdates
	}

	/**
	 * 仅更新 node 层（私有方法）
	 */
	private updateNodeOnly(
		element: BaseElement,
		updates: ElementMutationPatch,
		options?: ElementOperationOptions,
	): void {
		const node = element.getNode()
		if (!node) return

		// 更新 node 的属性
		if (updates.x !== undefined) node.x(updates.x)
		if (updates.y !== undefined) node.y(updates.y)

		if (node instanceof Konva.Group) {
			if (updates.width !== undefined) node.width(updates.width)
			if (updates.height !== undefined) node.height(updates.height)
			if (updates.width !== undefined || updates.height !== undefined) {
				element.onTransformResize?.(node.width(), node.height())
			}
		}

		if (updates.scaleX !== undefined) node.scaleX(updates.scaleX)
		if (updates.scaleY !== undefined) node.scaleY(updates.scaleY)

		if (updates.opacity !== undefined) node.opacity(updates.opacity)
		if (updates.visible !== undefined) node.visible(updates.visible)

		// 强制更新（如果需要）
		if (options?.forceRerender) {
			this.canvas.runtimeScheduler.requestLayerDraw("content", {
				source: "ElementManager",
				reason: "force-rerender-node",
				priority: "normal",
			})
		}

		if (!options?.skipGeometryInvalidate) {
			this.invalidateGeometryForElement(element.getId())
		}
	}

	/**
	 * 仅更新 data 层（私有方法）
	 */
	private updateDataOnly(
		element: BaseElement,
		updates: ElementMutationPatch,
		options?: ElementOperationOptions,
	): void {
		// 获取当前数据并合并更新
		const currentData = element.getData()
		const newData = this.mergeElementData(currentData, updates, element.getId())
		validateElementData(newData)
		const nameChange = this.buildElementNameChange(currentData, newData)
		const documentTopologyChanged = this.updateChangesDocumentTopology(currentData, newData)
		if (Object.prototype.hasOwnProperty.call(updates, "visible") || documentTopologyChanged) {
			this.invalidateDataTreeVisibilityCache()
		}

		// 更新元素的内部数据（不触发 node 更新）
		element.update(newData)
		if (documentTopologyChanged) {
			this.markDocumentIndexDirty({ topology: true })
		}
		this.invalidateGeometryForElement(element.getId())

		// 触发事件（如果不是 silent 模式）
		if (!options?.silent) {
			this.emitEvent({
				type: "element:updated",
				data: {
					elementId: element.getId(),
					data: newData,
					previousData: currentData,
					nameChange,
					...(options?.historyPolicy ? { historyPolicy: options.historyPolicy } : {}),
				},
			})
			this.emitElementChange([element.getId()], {
				nameChanges: nameChange ? [nameChange] : undefined,
				phase: "commit",
			})
		} else {
			// silent 仍通知 UI：内存数据已变（如变换拖拽中的字号/尺寸），但不触发宿主保存导出。
			this.emitElementChange([element.getId()], { phase: "transient" })
		}
	}

	/**
	 * 执行创建元素的核心逻辑
	 */
	private doCreate(elementData: LayerElement, options: ElementOperationOptions): void {
		// 如果元素没有指定 zIndex，自动设置为当前层级的下一个 zIndex
		const finalElementData = { ...elementData }
		if (finalElementData.zIndex === undefined || finalElementData.zIndex === null) {
			// 检查元素是否有父元素（通过检查是否在某个父元素的 children 中）
			const parentId = this.findParentIdForElement(finalElementData.id)
			finalElementData.zIndex = this.getNextZIndexInLevel(parentId)
		}
		validateElementData(finalElementData)

		const element = this.createElementInstance(finalElementData)
		if (!element) {
			// 不支持的元素类型，跳过创建
			return
		}

		const node = element.render()

		if (node) {
			this.canvas.contentLayer.add(node as Konva.Shape | Konva.Group)
			this.elements.set(finalElementData.id, element)
			this.dataTreeVisibilityCache.delete(finalElementData.id)
			this.markDocumentIndexDirty({ topology: true })

			// 调用生命周期钩子：节点已挂载到 Layer
			element.onMounted()

			// 递归处理子元素
			this.renderChildren(node, finalElementData, element)

			this.invalidateGeometryForElement(finalElementData.id)

			this.scheduleContentLayerDraw(options)

			if (!options.silent) {
				this.emitEvent({
					type: "element:created",
					data: { elementId: finalElementData.id },
				})
				this.emitElementChange([finalElementData.id])
			}
		}
	}

	/**
	 * 查找元素的父元素 ID（通过检查是否在某个父元素的 children 中）
	 * @param elementId - 元素 ID
	 * @returns 父元素 ID，如果没有父元素则返回 undefined
	 */
	public findParentIdForElement(elementId: string): string | undefined {
		const indexedParentId = this.documentIndex.getParentId(this.elements, elementId)
		if (indexedParentId) return indexedParentId
		if (this.elements.has(elementId)) return undefined

		let parentId: string | undefined
		this.elements.forEach((element) => {
			if (parentId) return
			const elementData = element.getData()
			if (
				"children" in elementData &&
				elementData.children &&
				Array.isArray(elementData.children)
			) {
				if (elementData.children.some((child: LayerElement) => child.id === elementId)) {
					parentId = elementData.id
				}
			}
		})
		return parentId
	}

	/**
	 * 执行更新元素的核心逻辑（完整更新：data + node）
	 */
	private doUpdate(
		elementId: string,
		updates: ElementMutationPatch,
		options: ElementOperationOptions,
	): void {
		const element = this.elements.get(elementId)
		if (!element) return

		// 在获取 currentData 之前，先从节点读取最新的位置信息
		// 这样可以确保如果用户在上传过程中拖动元素，位置信息会被正确保留
		const node = element.getNode()
		let currentData = element.getData()
		if (node) {
			const hasXUpdate = Object.prototype.hasOwnProperty.call(updates, "x")
			const hasYUpdate = Object.prototype.hasOwnProperty.call(updates, "y")
			const nodeX = node.x()
			const nodeY = node.y()
			const shouldSyncX = !hasXUpdate && currentData.x !== nodeX
			const shouldSyncY = !hasYUpdate && currentData.y !== nodeY
			if (shouldSyncX || shouldSyncY) {
				currentData = {
					...currentData,
					...(shouldSyncX ? { x: nodeX } : {}),
					...(shouldSyncY ? { y: nodeY } : {}),
				}
			}
		}

		const newData = this.mergeElementData(currentData, updates, elementId)
		validateElementData(newData)
		const nameChange = this.buildElementNameChange(currentData, newData)

		// 检测 zIndex 是否改变
		const zIndexChanged = updates.zIndex !== undefined && updates.zIndex !== currentData.zIndex
		const documentTopologyChanged = this.updateChangesDocumentTopology(currentData, newData)
		if (Object.prototype.hasOwnProperty.call(updates, "visible") || documentTopologyChanged) {
			this.invalidateDataTreeVisibilityCache()
		}

		const needsRerender = element.update(newData) || options.forceRerender
		if (documentTopologyChanged) {
			this.markDocumentIndexDirty({ topology: true })
		}
		if (needsRerender) {
			element.rerenderWhenTransformIdle()
		}

		this.invalidateGeometryForElement(elementId)

		// 如果 zIndex 改变了，需要重新排列节点顺序
		if (zIndexChanged && !options.skipZIndexReorder) {
			// 检查元素是否有父元素
			if (this.hasParent(elementId)) {
				// 有父元素，重新排列父节点中的子节点顺序
				this.reorderChildrenInParent(elementId)
			} else {
				// 顶层元素，重新排列顶层元素顺序
				this.reorderTopLevelElements()
			}
		}

		this.scheduleContentLayerDraw(options)

		if (!options.silent) {
			this.emitEvent({
				type: "element:updated",
				data: {
					elementId,
					data: newData,
					previousData: currentData,
					nameChange,
					...(options.historyPolicy ? { historyPolicy: options.historyPolicy } : {}),
				},
			})
			this.emitElementChange([elementId], {
				nameChanges: nameChange ? [nameChange] : undefined,
				phase: "commit",
			})
		}
	}

	/**
	 * 执行删除元素的核心逻辑
	 * @param elementId - 元素ID
	 * @param options - 删除选项
	 */
	private doDelete(
		elementId: string,
		options?: { skipChildren?: boolean; suppressEvents?: boolean },
	): void {
		const element = this.elements.get(elementId)
		if (!element) return

		const elementData = element.getData()
		const temporaryMetadata = this.temporaryElements.get(elementId)
		const isRuntimeOnlyGenerationResult = temporaryMetadata?.kind === "generation-result"

		// 如果是临时元素，清理临时标记
		if (this.temporaryElements.has(elementId)) {
			this.temporaryElements.delete(elementId)

			// 通知 ImageElement 停止上传（忽略结果）
			if ("cancelUpload" in element && typeof element.cancelUpload === "function") {
				element.cancelUpload()
			}

			if (!options?.suppressEvents) {
				// 触发临时元素删除事件
				this.canvas.eventEmitter.emit({
					type: "element:temporary:deleted",
					data: { elementId },
				})
			}
		}

		// 如果不跳过子元素删除，则处理子元素
		if (!options?.skipChildren) {
			// 如果是 Frame 元素，先删除子元素
			// 注意：removeFrame() 方法会先清空 children，然后再删除 Frame，所以这里不会执行删除逻辑
			// 只有直接删除画框时（如按 Delete 键），才会执行这里的删除逻辑
			if (
				elementData.type === ElementTypeEnum.Frame &&
				"children" in elementData &&
				elementData.children &&
				Array.isArray(elementData.children) &&
				elementData.children.length > 0
			) {
				// 递归删除所有子元素
				elementData.children.forEach((child: LayerElement) =>
					this.doDelete(child.id, { suppressEvents: options?.suppressEvents }),
				)

				// 清空 Frame 的 children，避免删除时递归删除子元素
				this.doUpdate(
					elementId,
					{ children: [] },
					{
						batch: this.batchMode || this.isBatchDeleting,
						silent: this.isBatchDeleting || options?.suppressEvents,
					},
				)
			} else {
				// 对于非 Frame 元素，递归删除子元素
				if (
					"children" in elementData &&
					elementData.children &&
					Array.isArray(elementData.children)
				) {
					elementData.children.forEach((child: LayerElement) =>
						this.doDelete(child.id, { suppressEvents: options?.suppressEvents }),
					)
				}
			}
		} else {
			// 如果跳过子元素删除（撤销/恢复场景），需要将子元素节点移动到主 layer
			if (
				elementData.type === ElementTypeEnum.Frame &&
				"children" in elementData &&
				elementData.children &&
				Array.isArray(elementData.children) &&
				elementData.children.length > 0
			) {
				const node = element.getNode()
				if (node instanceof Konva.Group) {
					const layer = node.getLayer()
					if (layer) {
						// 将所有子元素节点移动到主 layer
						elementData.children.forEach((child: LayerElement) => {
							const childElement = this.elements.get(child.id)
							const childNode = childElement?.getNode()
							if (
								childNode &&
								(childNode instanceof Konva.Shape ||
									childNode instanceof Konva.Group)
							) {
								// 从 Frame 的 Group 中移除
								childNode.remove()
								// 添加到主 layer
								layer.add(childNode)
							}
						})
					}
				}
			}
		}

		// 从父元素的 children 数组中移除该元素
		const parentElement = this.findParentElement(elementId)
		if (parentElement) {
			const parentData = parentElement.getData()
			if (
				"children" in parentData &&
				parentData.children &&
				Array.isArray(parentData.children)
			) {
				const updatedChildren = parentData.children.filter(
					(child: LayerElement) => child.id !== elementId,
				)
				// 更新父元素的 children 数组
				this.doUpdate(
					parentElement.getData().id,
					{ children: updatedChildren },
					{
						batch: this.batchMode || this.isBatchDeleting,
						silent: this.isBatchDeleting || options?.suppressEvents,
					},
				)
			}
		}

		// 销毁元素实例
		element.destroy()
		this.elements.delete(elementId)
		this.invalidateDataTreeVisibilityCache()
		this.markDocumentIndexDirty({ topology: true })
		this.invalidateGeometryForElement(elementId)

		this.scheduleContentLayerDraw()
		if (!options?.suppressEvents) {
			this.canvas.eventEmitter.emit({
				type: "element:deleted",
				data: {
					elementId,
					...(isRuntimeOnlyGenerationResult
						? { persistence: "runtime-only" as const }
						: {}),
				},
			})
			if (!isRuntimeOnlyGenerationResult) {
				this.emitElementChange([elementId])
			}
		}
	}

	/**
	 * 创建元素实例（统一的工厂方法）
	 */
	private createElementInstance(data: LayerElement): BaseElement | null {
		return ElementFactory.create(data, this.canvas)
	}

	/**
	 * 触发事件（支持批量模式）
	 */
	private emitEvent<K extends keyof CanvasEventMap>(event: {
		type: K
		data: CanvasEventMap[K]
	}): void {
		if (this.batchMode) {
			this.pendingEvents.push(event)
		} else {
			this.canvas.eventEmitter.emit(event)
		}
	}

	private emitElementChange(
		elementIds?: string[],
		payload?: Omit<CanvasElementChangePayload, "elementIds">,
	): void {
		if (this.isBatchDeleting) {
			elementIds?.forEach((elementId) => {
				this.pendingBatchDeleteChangeIds.add(elementId)
			})
			return
		}

		const data =
			(elementIds && elementIds.length > 0) ||
			payload?.phase ||
			(payload?.nameChanges && payload.nameChanges.length > 0)
				? {
						...payload,
						phase: payload?.phase ?? "commit",
						elementIds: elementIds && elementIds.length > 0 ? elementIds : undefined,
						nameChanges:
							payload?.nameChanges && payload.nameChanges.length > 0
								? payload.nameChanges
								: undefined,
					}
				: undefined

		this.emitEvent({
			type: "element:change",
			data,
		})
	}

	private scheduleContentLayerDraw(options?: Pick<ElementOperationOptions, "batch">): void {
		if (options?.batch || this.isBatchDeleting) {
			this.isContentLayerDrawDeferred = true
			return
		}

		this.canvas.runtimeScheduler.requestLayerDraw("content", {
			source: "ElementManager",
			reason: "content-layer",
			priority: "normal",
		})
	}

	private flushDeferredBatchDeleteEffects(): void {
		if (this.pendingBatchDeleteChangeIds.size > 0) {
			const elementIds: string[] = []
			this.pendingBatchDeleteChangeIds.forEach((elementId) => {
				elementIds.push(elementId)
			})
			this.canvas.eventEmitter.emit({
				type: "element:change",
				data: { elementIds, phase: "commit" },
			})
		}

		if (this.isContentLayerDrawDeferred) {
			this.canvas.runtimeScheduler.requestLayerDraw("content", {
				source: "ElementManager",
				reason: "batch-delete-flush",
				priority: "normal",
			})
		}
	}

	private collectPendingChangedElementIds(): string[] | undefined {
		const elementIds = new Set<string>()

		for (const event of this.pendingEvents) {
			switch (event.type) {
				case "element:created":
				case "element:updated":
				case "element:deleted":
				case "element:rerendered":
				case "element:temporary:converted":
				case "element:temporary:deleted":
				case "element:image:infoButtonClick":
				case "element:image:retryClick":
				case "element:image:generate-submit-started":
				case "element:image:generate-submit-failed":
				case "element:image:fullscreenClick":
				case "element:video:infoButtonClick":
				case "element:video:retryClick":
				case "element:video:generate-submit-started":
				case "element:video:generate-submit-failed":
				case "element:video:fullscreenClick":
				case "element:audio:fullscreenClick":
				case "element:image:resultUpdated":
				case "element:image:loaded":
				case "element:image:ossSrcReady":
				case "element:dragstart":
				case "element:dragmove":
				case "element:dragend": {
					const eventData = event.data as { elementId?: string }
					if (eventData.elementId) {
						elementIds.add(eventData.elementId)
					}
					break
				}
				case "element:batchdeleted":
				case "elements:transform:dragstart":
				case "elements:transform:dragmove":
				case "elements:transform:dragend":
				case "elements:transform:anchorDragStart":
				case "elements:transform:anchorDragmove":
				case "elements:transform:anchorDragend": {
					const eventData = event.data as { elementIds?: string[] }
					eventData.elementIds?.forEach((elementId) => {
						elementIds.add(elementId)
					})
					break
				}
			}
		}

		if (elementIds.size === 0) return undefined
		const pendingElementIds: string[] = []
		elementIds.forEach((elementId) => {
			pendingElementIds.push(elementId)
		})
		return pendingElementIds
	}

	private collectPendingElementNameChanges(): CanvasElementNameChange[] | undefined {
		const changesByElementId = new Map<string, CanvasElementNameChange>()

		for (const event of this.pendingEvents) {
			if (event.type !== "element:updated") continue
			const eventData = event.data as { nameChange?: CanvasElementNameChange }
			const nameChange = eventData.nameChange
			if (!nameChange) continue

			const existingChange = changesByElementId.get(nameChange.elementId)
			changesByElementId.set(nameChange.elementId, {
				...nameChange,
				oldName: existingChange?.oldName ?? nameChange.oldName,
				oldSrc: existingChange?.oldSrc ?? nameChange.oldSrc,
			})
		}

		if (changesByElementId.size === 0) return undefined
		return Array.from(changesByElementId.values())
	}

	/**
	 * 获取 NodeAdapter（供框架层使用）
	 */
	public getNodeAdapter(): NodeAdapter {
		return this.nodeAdapter
	}

	/**
	 * 获取元素实例
	 */
	public getElementInstance(elementId: string): BaseElement | undefined {
		return this.elements.get(elementId)
	}

	// ==================== 元素操作便捷方法 ====================

	/**
	 * 设置元素位置
	 */
	public setElementPosition(elementId: string, x: number, y: number): void {
		const element = this.elements.get(elementId)
		if (element) {
			element.setPosition(x, y)
		}
	}

	/**
	 * 获取元素位置
	 */
	public getElementPosition(elementId: string): { x: number; y: number } | null {
		const element = this.elements.get(elementId)
		return element ? element.getPosition() : null
	}

	/**
	 * 设置元素透明度（支持临时设置）
	 */
	public setElementOpacity(elementId: string, opacity: number, temporary: boolean = false): void {
		const element = this.elements.get(elementId)
		if (element) {
			element.setOpacity(opacity, { temporary })
		}
	}

	/**
	 * 获取元素透明度
	 */
	public getElementOpacity(elementId: string): number | null {
		const element = this.elements.get(elementId)
		return element ? element.getOpacity() : null
	}

	/**
	 * 设置元素可见性
	 */
	public setElementVisible(elementId: string, visible: boolean): void {
		const element = this.elements.get(elementId)
		if (element) {
			element.setVisible(visible)
		}
	}

	/**
	 * 设置元素尺寸
	 */
	public setElementSize(elementId: string, width: number, height: number): void {
		const element = this.elements.get(elementId)
		if (element) {
			element.setSize(width, height)
		}
	}

	/**
	 * 获取元素数据
	 */
	public getElementData(elementId: string): LayerElement | undefined {
		const element = this.elements.get(elementId)
		return element?.getData()
	}

	/**
	 * 元素在数据树上是否视为可见：`visible === false` 的节点及其子树不参与适配范围等计算。
	 */
	public isElementVisibleInDataTree(elementId: string): boolean {
		if (this.dataTreeVisibilityCache.has(elementId)) {
			return this.dataTreeVisibilityCache.get(elementId) ?? false
		}

		const path: string[] = []
		const visited = new Set<string>()
		let currentId: string | undefined = elementId
		let visible = true
		while (currentId) {
			const cached = this.dataTreeVisibilityCache.get(currentId)
			if (cached !== undefined) {
				visible = cached
				break
			}
			if (visited.has(currentId)) {
				// Malformed cyclic data must not turn a visibility query into an infinite loop.
				visible = false
				break
			}
			visited.add(currentId)

			const data = this.getElementData(currentId)
			if (!data || data.visible === false) {
				visible = false
				break
			}
			path.push(currentId)
			currentId = this.findParentIdForElement(currentId)
		}

		path.forEach((pathElementId) => {
			this.dataTreeVisibilityCache.set(pathElementId, visible)
		})
		return visible
	}

	/**
	 * 检查元素是否存在
	 */
	public hasElement(elementId: string): boolean {
		return this.elements.has(elementId)
	}

	/**
	 * 获取指定层级的最大 zIndex
	 * @param parentId - 父元素 ID，如果为空则获取顶层元素的最大 zIndex
	 * @returns 指定层级的最大 zIndex，如果没有元素则返回 0
	 */
	public getMaxZIndexInLevel(parentId?: string): number {
		let maxZIndex = 0

		if (parentId === undefined) {
			// 获取顶层元素的最大 zIndex
			const topLevelElements = this.getAllElements()
			topLevelElements.forEach((element) => {
				const zIndex = element.zIndex ?? 0
				if (zIndex > maxZIndex) {
					maxZIndex = zIndex
				}
			})
		} else {
			// 获取指定画框内子元素的最大 zIndex
			const parentElement = this.elements.get(parentId)
			if (parentElement) {
				const parentData = parentElement.getData()
				if (
					"children" in parentData &&
					parentData.children &&
					Array.isArray(parentData.children)
				) {
					parentData.children.forEach((child: LayerElement) => {
						const zIndex = child.zIndex ?? 0
						if (zIndex > maxZIndex) {
							maxZIndex = zIndex
						}
					})
				}
			}
		}

		return maxZIndex
	}

	/**
	 * 获取指定层级的下一个 zIndex
	 * @param parentId - 父元素 ID，如果为空则获取顶层元素的下一个 zIndex
	 * @returns 指定层级的下一个 zIndex，如果没有元素则返回 1
	 */
	public getNextZIndexInLevel(parentId?: string): number {
		const maxZIndex = this.getMaxZIndexInLevel(parentId)
		return maxZIndex + 1
	}

	/**
	 * 为根级指定层级腾出一个插入位。
	 *
	 * 使用连续整数层级而不是小数，避免多次拖出同一画框后 zIndex
	 * 不断逼近导致精度和排序问题。返回被顺延的元素 ID，供增量持久化一并提交。
	 */
	private makeRoomForTopLevelZIndex(insertionZIndex: number, amount = 1): string[] {
		if (amount <= 0) return []
		const shiftedElementIds: string[] = []
		const elementsToShift = this.getAllElements()
			.filter((element) => (element.zIndex ?? 0) >= insertionZIndex)
			.sort((left, right) => (right.zIndex ?? 0) - (left.zIndex ?? 0))

		elementsToShift.forEach((elementData) => {
			const element = this.elements.get(elementData.id)
			if (!element) return
			element.update({
				...elementData,
				zIndex: (elementData.zIndex ?? 0) + amount,
			} as LayerElement)
			shiftedElementIds.push(elementData.id)
		})

		return shiftedElementIds
	}

	/**
	 * 获取所有元素 ID
	 */
	public getAllElementIds(): string[] {
		return Array.from(this.elements.keys())
	}

	/**
	 * Returns the revision for parent/child topology changes. Geometry and content updates keep this
	 * revision stable so render visibility can use an incremental workset diff.
	 */
	public getDocumentTopologyRevision(): number {
		return this.documentIndex.getTopologyRevision()
	}

	public getElementCount(): number {
		return this.elements.size
	}

	/**
	 * 获取所有顶层元素（不包含子元素）
	 */
	public getAllElements(): LayerElement[] {
		return this.documentIndex
			.getRootElementIds(this.elements)
			.map((elementId) => this.elements.get(elementId)?.getData())
			.filter((element): element is LayerElement => element !== undefined)
	}

	public getParentAndSiblings(elementId: string): {
		parentElement: LayerElement | null
		siblings: LayerElement[]
	} {
		const parentId = this.documentIndex.getParentId(this.elements, elementId)
		if (parentId) {
			const parentElement = this.elements.get(parentId)?.getData() ?? null
			const siblings = this.documentIndex
				.getChildIds(this.elements, parentId)
				.map((childId) => this.elements.get(childId)?.getData())
				.filter((element): element is LayerElement => element !== undefined)
			return { parentElement, siblings }
		}

		if (!this.elements.has(elementId)) {
			return { parentElement: null, siblings: [] }
		}

		return { parentElement: null, siblings: this.getAllElements() }
	}

	/**
	 * 原子地改变多个元素的父级。
	 *
	 * 调用方在拖拽过程中可以暂时把节点放到 content layer；这里统一负责将
	 * content 坐标转换为目标父级局部坐标、维护两侧 children、Konva 父节点、
	 * zIndex 和文档索引。所有元素先完成校验，再开始修改，避免批量操作只成功一半。
	 */
	public reparentElements(options: ReparentElementsOptions): boolean {
		const items = Array.from(
			new Map(options.elements.map((item) => [item.elementId, item])).values(),
		)
		if (items.length === 0) return false

		const targetParentId = options.targetParentId
		const targetParentElement = targetParentId ? this.elements.get(targetParentId) : undefined
		const targetParentData = targetParentElement?.getData()
		if (
			targetParentId &&
			(!targetParentElement || targetParentData?.type !== ElementTypeEnum.Frame)
		) {
			return false
		}

		const targetNodeCandidate = targetParentElement?.getNode()
		if (targetParentId && !(targetNodeCandidate instanceof Konva.Group)) return false
		const targetNode =
			targetNodeCandidate instanceof Konva.Group ? targetNodeCandidate : undefined
		const contentTransform = this.canvas.contentLayer.getAbsoluteTransform()
		const getChildren = (data: LayerElement | undefined): LayerElement[] =>
			data && "children" in data && Array.isArray(data.children) ? [...data.children] : []

		const prepared = items.map((item) => {
			const element = this.elements.get(item.elementId)
			const node = element?.getNode()
			if (!element || !node || this.isTemporary(item.elementId)) return null

			const currentData = element.getData()
			const sourceParentId = this.findParentIdForElement(item.elementId) ?? null
			const sourceParentElement = sourceParentId
				? this.elements.get(sourceParentId)
				: undefined
			const sourceParentData = sourceParentElement?.getData()
			if (sourceParentId && sourceParentData?.type !== ElementTypeEnum.Frame) return null

			const isSilentRestore = options.silent && sourceParentId === targetParentId
			if (
				!isSilentRestore &&
				!this.canvas.permissionManager.canReparentElement(
					currentData,
					sourceParentData,
					targetParentData,
				)
			) {
				return null
			}

			const stagePosition = contentTransform.point(item.positionInContent)
			const localPosition = targetNode
				? targetNode.getAbsoluteTransform().copy().invert().point(stagePosition)
				: item.positionInContent

			return {
				...item,
				element,
				node,
				currentData,
				sourceParentId,
				sourceParentElement,
				sourceParentData,
				localPosition,
				parentChanged: sourceParentId !== targetParentId,
			}
		})
		if (prepared.some((item) => item === null)) return false

		const validItems = prepared as Array<NonNullable<(typeof prepared)[number]>>
		const parentChangedItems = validItems.filter((item) => item.parentChanged)
		const sourceParentIds = new Set(
			parentChangedItems
				.map((item) => item.sourceParentId)
				.filter((id): id is string => Boolean(id)),
		)
		// 根级插入位置以源画框为锚点；多个不同源画框同时拖出时没有唯一锚点，
		// 由交互层拒绝这类混合选区，这里也做最后一道原子校验。
		if (!targetParentId && sourceParentIds.size > 1) return false

		const nextZIndexById = new Map<string, number | undefined>()
		validItems.forEach((item) => nextZIndexById.set(item.elementId, item.currentData.zIndex))
		let shiftedElementIds: string[] = []
		if (parentChangedItems.length > 0) {
			if (targetParentId) {
				let nextZIndex = this.getNextZIndexInLevel(targetParentId)
				parentChangedItems.forEach((item) => {
					nextZIndexById.set(item.elementId, nextZIndex++)
				})
			} else {
				const sourceFrame = validItems[0]?.sourceParentData
				if (sourceFrame?.type !== ElementTypeEnum.Frame) return false
				const insertionZIndex = (sourceFrame.zIndex ?? 0) + 1
				shiftedElementIds = this.makeRoomForTopLevelZIndex(
					insertionZIndex,
					parentChangedItems.length,
				)
				parentChangedItems.forEach((item, index) => {
					nextZIndexById.set(item.elementId, insertionZIndex + index)
				})
			}
		}

		const nextDataById = new Map<string, LayerElement>()
		validItems.forEach((item) => {
			const nextZIndex = nextZIndexById.get(item.elementId)
			nextDataById.set(item.elementId, {
				...item.currentData,
				x: item.localPosition.x,
				y: item.localPosition.y,
				...(nextZIndex === undefined ? {} : { zIndex: nextZIndex }),
			} as LayerElement)
		})

		const sourceParentNextData = new Map<string, LayerElement>()
		validItems.forEach((item) => {
			if (!item.parentChanged || !item.sourceParentId || !item.sourceParentData) return
			const existing = sourceParentNextData.get(item.sourceParentId) ?? item.sourceParentData
			sourceParentNextData.set(item.sourceParentId, {
				...existing,
				children: getChildren(existing).filter((child) => child.id !== item.elementId),
			} as LayerElement)
		})

		if (targetParentElement && targetParentData) {
			const movedIds = new Set(parentChangedItems.map((item) => item.elementId))
			const targetChildren = getChildren(targetParentData)
				.filter((child) => !movedIds.has(child.id))
				.map((child) => nextDataById.get(child.id) ?? child)
			const nextTargetData = {
				...targetParentData,
				children: [
					...targetChildren,
					...parentChangedItems.map(
						(item) => nextDataById.get(item.elementId) as LayerElement,
					),
				],
			} as LayerElement
			targetParentElement.update(nextTargetData)
		}
		sourceParentNextData.forEach((data, parentId) => {
			if (parentId !== targetParentId) this.elements.get(parentId)?.update(data)
		})

		// 先把节点挂到目标容器，再更新元素数据；Frame 的 clip 和局部坐标从这一刻保持一致。
		validItems.forEach((item) => {
			item.node.remove()
			if (targetNode) targetNode.add(item.node as Konva.Shape | Konva.Group)
			else this.canvas.contentLayer.add(item.node as Konva.Shape | Konva.Group)
			item.node.position(item.localPosition)
			item.element.update(nextDataById.get(item.elementId) as LayerElement)
		})

		if (parentChangedItems.length > 0) {
			this.markDocumentIndexDirty({ topology: true })
			// Reparenting changes the ancestor chain for the moved subtree, so cached visibility
			// results for the child and every descendant are no longer valid.
			this.invalidateDataTreeVisibilityCache()
		}
		validItems.forEach((item) => {
			this.invalidateGeometryForElement(item.elementId)
			if (item.sourceParentId) {
				this.invalidateGeometryForElement(item.sourceParentId)
			}
		})
		if (targetParentId) {
			this.invalidateGeometryForElement(targetParentId)
		}

		validItems.forEach((item) => {
			if (item.sourceParentElement instanceof FrameElement)
				item.sourceParentElement.ensureBorderOnTop()
		})
		if (targetParentElement instanceof FrameElement) targetParentElement.ensureBorderOnTop()
		if (targetParentId) this.reorderChildrenInParentPublic(targetParentId)
		else this.reorderTopLevelElementsPublic()
		this.canvas.runtimeScheduler.requestLayerDraw("content", {
			source: "ElementManager",
			reason: "reparent-elements",
			priority: "input",
		})

		if (!options.silent) {
			validItems.forEach((item) => {
				this.emitEvent({
					type: "element:updated",
					data: {
						elementId: item.elementId,
						data: nextDataById.get(item.elementId) as LayerElement,
						previousData: item.currentData,
					},
				})
			})
			this.emitElementChange(
				Array.from(
					new Set(
						[
							...validItems.map((item) => item.elementId),
							...validItems.map((item) => item.sourceParentId),
							targetParentId,
							...shiftedElementIds,
						].filter((id): id is string => Boolean(id)),
					),
				),
				{ phase: "commit" },
			)
		}

		// Reparenting updates the source/target parent instances directly, so the
		// regular element:updated label refresh never sees the changed frame counts.
		if (parentChangedItems.length > 0) {
			const affectedParentIds = new Set<string>()
			parentChangedItems.forEach((item) => {
				if (item.sourceParentId) affectedParentIds.add(item.sourceParentId)
			})
			if (targetParentId) affectedParentIds.add(targetParentId)
			this.canvas.refreshNameLabelIcons?.(Array.from(affectedParentIds))
		}
		return true
	}

	public reparentElement(elementId: string, options: ReparentElementOptions): boolean {
		return this.reparentElements({
			targetParentId: options.targetParentId,
			elements: [{ elementId, positionInContent: options.positionInContent }],
			silent: options.silent,
		})
	}

	/**
	 * 获取所有元素的字典（包含所有元素，包括子元素）
	 * @returns 以元素ID为key的字典对象
	 */
	public getElementsDict(): Record<string, LayerElement> {
		const dict: Record<string, LayerElement> = {}
		this.elements.forEach((element, id) => {
			dict[id] = element.getData()
		})
		return dict
	}

	/** 为通过公开 create 入口进入运行时的新元素统一分配唯一名称。 */
	private resolveUniqueElementName(elementData: LayerElement): LayerElement {
		const existingNames = getAllExistingNames(this)

		const resolve = (element: LayerElement): LayerElement => {
			let resolved = element
			if (element.name) {
				const uniqueName = generateUniqueElementName(element.name, existingNames)
				if (uniqueName !== element.name) resolved = { ...resolved, name: uniqueName }
				existingNames.add(uniqueName)
			}
			if ("children" in element && Array.isArray(element.children)) {
				const children = element.children.map(resolve)
				if (children.some((child, index) => child !== element.children?.[index])) {
					resolved = { ...resolved, children } as LayerElement
				}
			}
			return resolved
		}

		return resolve(elementData)
	}

	public exportDocumentPatch(options: {
		changedElementIds: string[]
		deletedElementIds?: string[]
		includeTemporary?: boolean
		elementNameChanges?: CanvasElementNameChange[]
	}): ElementManagerDocumentPatch {
		const changedElementIds = Array.from(new Set(options.changedElementIds))
		const deletedElementIds = Array.from(new Set(options.deletedElementIds ?? []))
		const upserts: ElementManagerDocumentPatch["upserts"] = []

		changedElementIds.forEach((elementId) => {
			if (deletedElementIds.includes(elementId)) return
			if (!options.includeTemporary && this.temporaryElements.has(elementId)) return

			const elementData = this.getElementData(elementId)
			if (!elementData) return

			upserts.push({
				element: exportLayerElement(elementData),
				parentId: this.findParentIdForElement(elementId) ?? null,
			})
		})

		return {
			upserts,
			deletedElementIds,
			changedElementIds,
			elementNameChanges:
				options.elementNameChanges && options.elementNameChanges.length > 0
					? options.elementNameChanges
					: undefined,
		}
	}

	/**
	 * 加载文档数据
	 * 在加载时创建深拷贝，确保内部数据不受外部影响（如 useImmer 冻结）
	 */
	public loadDocument(doc: CanvasDocument): void {
		this.clear()
		// 深拷贝传入的数据，确保内部数据独立，不受外部状态管理工具影响
		const docCopy = sanitizeCanvasDocument(JSON.parse(JSON.stringify(doc)) as CanvasDocument)
		this.replaceAll(docCopy.elements || [])
		resumeImageBatchPollingManagers(this.canvas)
		resumeDocumentAssetCompliancePolling(this.canvas)
	}

	/**
	 * 将快照中的元素规范为可与当前数据安全合并的形态。
	 * 导出时「无 crop」不会写出 crop 字段，若合并时缺少该键，{ ...current, ...snapshot } 会错误保留旧 crop（撤销裁剪不生效）。
	 */
	private normalizeLayerElementFromSnapshot(data: LayerElement): LayerElement {
		// v3 快照会整体替换 contents；Content 内缺失 crop 已能自然表达“撤销裁剪”。
		// 完整快照省略 visible 表示可见；例：隐藏后恢复旧快照，应覆盖当前 false。
		// 普通增量更新缺少 visible 仍表示保留原值，只在快照恢复边界补全默认值。
		return { ...data, visible: data.visible ?? true }
	}

	/**
	 * 智能加载文档数据（差异更新）
	 * 只更新变化的元素，避免全量重新渲染
	 * 在加载时创建深拷贝，确保内部数据不受外部影响（如 useImmer 冻结）
	 */
	public loadDocumentSmart(doc: CanvasDocument): boolean {
		// 深拷贝传入的数据，确保内部数据独立，不受外部状态管理工具影响
		const docCopy = sanitizeCanvasDocument(JSON.parse(JSON.stringify(doc)) as CanvasDocument)
		const newElements = docCopy.elements || []

		const flattenElements = (
			elements: LayerElement[],
			parentId: string | null,
			parentMap: Map<string, string | null>,
		): LayerElement[] => {
			const result: LayerElement[] = []
			elements.forEach((el) => {
				parentMap.set(el.id, parentId)
				result.push(el)
				if ("children" in el && el.children && Array.isArray(el.children)) {
					result.push(...flattenElements(el.children, el.id, parentMap))
				}
			})
			return result
		}

		const currentParentMap = new Map<string, string | null>()
		flattenElements(this.getAllElements(), null, currentParentMap)
		const newElementsFlat = flattenElements(newElements, null, new Map<string, string | null>())

		// 获取当前所有元素（包括子元素）
		const currentElementsDict = this.getElementsDict()
		const currentElementMap = new Map(Object.entries(currentElementsDict))
		const newElementMap = new Map(newElementsFlat.map((el) => [el.id, el]))

		// 收集需要删除的元素（在当前存在但新文档中不存在）
		const toDelete: string[] = []
		currentElementMap.forEach((_, id) => {
			if (!newElementMap.has(id)) {
				toDelete.push(id)
			}
		})

		const getCurrentDepth = (elementId: string): number => {
			let depth = 0
			let parentId = currentParentMap.get(elementId)
			while (parentId) {
				depth += 1
				parentId = currentParentMap.get(parentId)
			}
			return depth
		}

		toDelete.sort((a, b) => getCurrentDepth(b) - getCurrentDepth(a))

		// 收集需要创建的顶层元素，嵌套新增元素由父容器树同步负责创建
		const toCreate: LayerElement[] = []
		newElements.forEach((element) => {
			if (!currentElementMap.has(element.id)) {
				toCreate.push(element)
			}
		})

		const toMoveTopLevel = newElements
			.filter((element) => currentElementMap.has(element.id))
			.filter((element) => currentParentMap.get(element.id) !== null)

		// 收集需要更新的元素（都存在但数据不同）
		// 包括所有元素（顶层和子元素）
		const toUpdate: Array<{ id: string; data: LayerElement }> = []
		newElementsFlat.forEach((newElement) => {
			const currentElement = currentElementMap.get(newElement.id)
			if (currentElement && !this.isElementEqual(currentElement, newElement)) {
				toUpdate.push({ id: newElement.id, data: newElement })
			}
		})

		// 批量模式执行所有操作
		this.batchMode = true
		try {
			// 删除不存在的元素
			// 在撤销/恢复场景中，跳过子元素的递归删除，因为历史管理器会负责恢复正确的状态
			toDelete.forEach((id) => this.doDelete(id, { skipChildren: true }))

			// 创建新元素
			toCreate.forEach((elementData) => {
				this.doCreate(elementData, { batch: true })
			})

			// 既有元素从容器移到顶层时，需要同步 Konva 节点父级
			toMoveTopLevel.forEach((elementData) => {
				this.moveElementToContentLayer(elementData.id)
			})

			// 更新变化的元素
			toUpdate.forEach(({ id, data }) => {
				this.doUpdate(id, this.normalizeLayerElementFromSnapshot(data), { batch: true })
			})

			// 同步容器子树，覆盖嵌套新增、父子关系变化与子节点排序
			newElements.forEach((elementData) => {
				this.syncElementTreeFromDocument(elementData)
			})

			this.reorderTopLevelElements()
		} finally {
			this.batchMode = false
			this.flush()
			resumeImageBatchPollingManagers(this.canvas)
			resumeDocumentAssetCompliancePolling(this.canvas)
		}

		// 由 Canvas 在元素与连接都恢复完成后统一发出 document:restored。
		// ElementManager 单独恢复时不能保证连接管理器已经切换到同一份文档。
		return (
			toUpdate.length > 0 ||
			toCreate.length > 0 ||
			toDelete.length > 0 ||
			toMoveTopLevel.length > 0
		)
	}

	private moveElementToContentLayer(elementId: string): void {
		const element = this.elements.get(elementId)
		const node = element?.getNode()
		if (!node) return
		if (node.getParent() === this.canvas.contentLayer) return

		node.remove()
		this.canvas.contentLayer.add(node as Konva.Shape | Konva.Group)
		this.invalidateGeometryForElement(elementId)
	}

	private syncElementTreeFromDocument(elementData: LayerElement): void {
		const element = this.elements.get(elementData.id)
		const node = element?.getNode()
		if (!element || !(node instanceof Konva.Group)) return
		if (
			!("children" in elementData) ||
			!elementData.children ||
			!Array.isArray(elementData.children)
		)
			return

		const sortedChildren = [...elementData.children].sort(
			(a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
		)

		sortedChildren.forEach((childData) => {
			this.ensureChildElementInParent(node, childData)
			this.syncElementTreeFromDocument(childData)
		})

		sortedChildren.forEach((childData) => {
			this.elements.get(childData.id)?.getNode()?.moveToTop()
		})

		if (element instanceof FrameElement) {
			element.ensureBorderOnTop()
		}
	}

	private ensureChildElementInParent(parentNode: Konva.Group, childData: LayerElement): void {
		const existingElement = this.elements.get(childData.id)
		const existingNode = existingElement?.getNode()
		if (existingElement && existingNode) {
			const parentChanged = existingNode.getParent() !== parentNode
			if (parentChanged) {
				existingNode.remove()
				parentNode.add(existingNode as Konva.Shape | Konva.Group)
				this.invalidateDataTreeVisibilityCache()
				this.invalidateGeometryForElement(childData.id)
				this.markDocumentIndexDirty({ topology: true })
			}
			return
		}

		const childElement = this.createElementInstance(childData)
		if (!childElement) return

		const childNode = childElement.render()
		if (!childNode) return

		parentNode.add(childNode as Konva.Shape | Konva.Group)
		this.elements.set(childData.id, childElement)
		this.dataTreeVisibilityCache.delete(childData.id)
		if (!existingElement) {
			this.markDocumentIndexDirty({ topology: true })
		}
		childElement.onMounted()
		this.invalidateGeometryForElement(childData.id)

		this.emitEvent({
			type: "element:created",
			data: { elementId: childData.id },
		})
		this.emitElementChange([childData.id])
	}

	/**
	 * 比较两个元素是否相等（深度比较）
	 */
	private isElementEqual(a: LayerElement, b: LayerElement): boolean {
		return JSON.stringify(a) === JSON.stringify(b)
	}

	/**
	 * 导出文档数据
	 * 在导出边界创建深拷贝，确保外部获得的是独立副本，避免 useImmer 等状态管理工具冻结内部数据
	 * @param options 导出选项
	 * @param options.includeTemporary 是否包含允许进入历史的临时元素（默认 false）
	 */
	public exportDocument(options?: { includeTemporary?: boolean }): CanvasDocument {
		const allElements = this.getAllElements()

		// 外部保存排除所有临时元素；历史快照只保留声明为 history include 的上传占位。
		const elements = this.filterTemporaryElements(
			allElements,
			options?.includeTemporary ? "history" : "external",
		)

		// 在导出边界按声明白名单导出，既隔离内部引用，也避免透出运行时附加字段
		return exportCanvasDocument(elements)
	}

	private filterTemporaryElements(
		elements: LayerElement[],
		policy: "external" | "history" | "clipboard",
	): LayerElement[] {
		const filterElement = (element: LayerElement): LayerElement | null => {
			const temporary = this.temporaryElements.get(element.id)
			if (temporary) {
				const shouldInclude =
					policy === "history"
						? temporary.historyPolicy === "include"
						: policy === "clipboard"
							? temporary.clipboardPolicy === "include"
							: false
				if (!shouldInclude) return null
			}

			if (!("children" in element) || !Array.isArray(element.children)) {
				return element
			}

			return {
				...element,
				children: element.children
					.map(filterElement)
					.filter((child): child is LayerElement => child !== null),
			} as LayerElement
		}

		return elements
			.map(filterElement)
			.filter((element): element is LayerElement => element !== null)
	}

	/** 复制协议只允许上传临时元素，生成结果占位符必须留在当前 Canvas 运行时。 */
	public filterElementsForClipboard(elements: LayerElement[]): LayerElement[] {
		return this.filterTemporaryElements(elements, "clipboard")
	}

	/**
	 * 清空所有元素
	 */
	public clear(): void {
		// 先收集所有元素 ID，避免在遍历过程中修改 Map
		const elementIds = Array.from(this.elements.keys())
		const runtimeOnlyGenerationElementIds = new Set(
			Array.from(this.temporaryElements.entries())
				.filter(([, metadata]) => metadata.kind === "generation-result")
				.map(([elementId]) => elementId),
		)

		// 销毁所有元素
		this.elements.forEach((element) => element.destroy())
		this.elements.clear()
		this.temporaryElements.clear()
		this.documentIndex.clear()
		this.invalidateDataTreeVisibilityCache()

		// 销毁所有子节点，但保留背景
		const background = this.canvas.contentLayer.findOne(".canvas-background") as
			Konva.Shape | Konva.Group | null
		this.canvas.contentLayer.destroyChildren()

		// 如果背景存在，重新添加到 layer
		if (background) {
			this.canvas.contentLayer.add(background)
			background.moveToBottom()
		}

		this.canvas.runtimeScheduler.requestLayerDraw("content", {
			source: "ElementManager",
			reason: "clear",
			priority: "normal",
		})
		this.canvas.geometryCacheManager.invalidateAll()

		// 为每个元素触发删除事件
		elementIds.forEach((elementId) => {
			this.canvas.eventEmitter.emit({
				type: "element:deleted",
				data: {
					elementId,
					...(runtimeOnlyGenerationElementIds.has(elementId)
						? { persistence: "runtime-only" as const }
						: {}),
				},
			})
		})
		const documentElementIds = elementIds.filter(
			(elementId) => !runtimeOnlyGenerationElementIds.has(elementId),
		)

		this.canvas.eventEmitter.emit({
			type: "element:change",
			data:
				documentElementIds.length > 0
					? { elementIds: documentElementIds, phase: "commit" }
					: undefined,
		})
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		this.viewportGestureUnsubscribe?.()
		this.viewportGestureUnsubscribe = undefined
		this.clear()
		this.elements.clear()
	}

	/**
	 * 递归处理子元素
	 * @param parentNode - 父节点
	 * @param parentElementData - 父元素数据
	 * @param parentElement - 父元素实例
	 */
	private renderChildren(
		parentNode: Konva.Node,
		parentElementData: LayerElement,
		parentElement: BaseElement,
	): void {
		// 检查元素是否有 children 属性
		if (
			!("children" in parentElementData) ||
			!parentElementData.children ||
			parentElementData.children.length === 0
		) {
			return
		}

		// 如果父节点是 Group，渲染子元素
		if (parentNode instanceof Konva.Group) {
			// 按 zIndex 排序子元素
			const sortedChildren = [...parentElementData.children].sort(
				(a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
			)

			sortedChildren.forEach((childData) => {
				// 检查子元素是否已经存在（撤销/恢复场景）
				const existingElement = this.elements.get(childData.id)
				if (existingElement) {
					// 子元素已存在，复用现有节点并移动到父容器
					const existingNode = existingElement.getNode()
					if (
						existingNode &&
						(existingNode instanceof Konva.Shape || existingNode instanceof Konva.Group)
					) {
						const previousChildData = existingElement.getData()
						const parentChanged = existingNode.getParent() !== parentNode
						// 从当前父容器中移除
						existingNode.remove()
						// 添加到新的父容器
						parentNode.add(existingNode)
						// 更新元素数据（坐标等可能需要更新）
						existingElement.update(childData)
						const documentTopologyChanged =
							parentChanged ||
							this.updateChangesDocumentTopology(previousChildData, childData)
						if (
							previousChildData.visible !== childData.visible ||
							documentTopologyChanged
						) {
							this.invalidateDataTreeVisibilityCache()
						}
						if (documentTopologyChanged) {
							this.markDocumentIndexDirty({ topology: true })
						}
						this.invalidateGeometryForElement(childData.id)
					}
					return
				}

				// 创建子元素实例
				const childElement = this.createElementInstance(childData)
				if (!childElement) {
					// 不支持的元素类型，跳过创建
					return
				}

				// 渲染子节点
				const childNode = childElement.render()
				if (childNode) {
					parentNode.add(childNode as Konva.Shape | Konva.Group)
					this.elements.set(childData.id, childElement)
					this.dataTreeVisibilityCache.delete(childData.id)
					this.markDocumentIndexDirty({ topology: true })
					this.invalidateGeometryForElement(childData.id)
					childElement.onMounted()

					// 发出元素创建事件
					this.canvas.eventEmitter.emit({
						type: "element:created",
						data: { elementId: childData.id },
					})

					// 递归处理嵌套的容器元素
					this.renderChildren(childNode, childData, childElement)
				}
			})

			// 如果父元素是 Frame，确保边框始终在最上层
			if (parentElement instanceof FrameElement) {
				parentElement.ensureBorderOnTop()
			}
		}
	}

	/**
	 * 重新排列父节点中的子节点顺序（基于 zIndex）
	 * 当子元素的 zIndex 改变时调用
	 */
	private reorderChildrenInParent(elementId: string): void {
		const childElement = this.elements.get(elementId)
		const childNode = childElement?.getNode()
		if (!childNode) return

		const parentNode = childNode.getParent()
		if (!parentNode || !(parentNode instanceof Konva.Group)) return

		// 获取父元素的数据
		const parentElement = this.elements.get(parentNode.id())
		if (!parentElement) return

		const parentData = parentElement.getData()
		if (
			!("children" in parentData) ||
			!parentData.children ||
			!Array.isArray(parentData.children)
		)
			return

		// 按 zIndex 升序排序所有子元素数据（zIndex 小的在底层）
		const sortedChildren = [...parentData.children].sort(
			(a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
		)

		// 使用 moveToTop 方法按顺序调整每个子节点的位置
		// 从 zIndex 最小的开始，依次 moveToTop，这样最终顺序就是正确的
		sortedChildren.forEach((childData) => {
			const childElement = this.elements.get(childData.id)
			const node = childElement?.getNode()
			if (node) {
				// moveToTop 会把节点移到父容器的最顶层
				node.moveToTop()
			}
		})

		// 如果父元素是 Frame，确保边框始终在最上层
		if (parentElement instanceof FrameElement) {
			parentElement.ensureBorderOnTop()
		}
	}

	/**
	 * 重新排列顶层元素的顺序（基于 zIndex）
	 * 当顶层元素的 zIndex 改变时调用
	 */
	private reorderTopLevelElements(): void {
		// 获取所有顶层元素
		const topLevelElements = this.getAllElements()

		// 按 zIndex 升序排序所有顶层元素数据（zIndex 小的在底层）
		const sortedElements = [...topLevelElements].sort(
			(a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
		)

		// 使用 moveToTop 方法按顺序调整每个顶层节点的位置
		// 从 zIndex 最小的开始，依次 moveToTop，这样最终顺序就是正确的
		sortedElements.forEach((elementData) => {
			const element = this.elements.get(elementData.id)
			const node = element?.getNode()
			if (node) {
				// moveToTop 会把节点移到 layer 的最顶层
				node.moveToTop()
			}
		})
	}

	/**
	 * 重新排列顶层元素的顺序（公共方法）
	 * 供 BaseElement.rerender 调用
	 */
	public reorderTopLevelElementsPublic(): void {
		this.reorderTopLevelElements()
	}

	/**
	 * 重新排列父容器内子元素的顺序（公共方法）
	 * 供 BaseElement.rerender 调用
	 */
	public reorderChildrenInParentPublic(parentId: string): void {
		const parentElement = this.elements.get(parentId)
		if (!parentElement) return

		const parentData = parentElement.getData()
		if (
			!("children" in parentData) ||
			!parentData.children ||
			!Array.isArray(parentData.children)
		)
			return

		// 获取第一个子元素来触发重排序
		const firstChildId = parentData.children[0]?.id
		if (firstChildId) {
			this.reorderChildrenInParent(firstChildId)
		}
	}

	/**
	 * 检查元素是否有父元素
	 */
	private hasParent(elementId: string): boolean {
		return this.documentIndex.hasParent(this.elements, elementId)
	}

	/**
	 * 查找元素的父元素
	 */
	public findParentElement(elementId: string): BaseElement | undefined {
		const parentId = this.documentIndex.getParentId(this.elements, elementId)
		if (parentId) return this.elements.get(parentId)
		if (this.elements.has(elementId)) return undefined

		let parentElement: BaseElement | undefined
		this.elements.forEach((element) => {
			if (parentElement) return
			const elementData = element.getData()
			if (
				"children" in elementData &&
				elementData.children &&
				Array.isArray(elementData.children)
			) {
				if (elementData.children.some((child: LayerElement) => child.id === elementId)) {
					parentElement = element
				}
			}
		})
		return parentElement
	}

	/**
	 * 禁用所有元素的拖拽和交互功能
	 */
	public disableElementDragging(): void {
		this.elementDraggingDisabled = true
		this.elementListeningDisabled = true
		this.elements.forEach((element) => {
			element.setDraggable(false)
			element.setListening(false)
		})
	}

	/**
	 * 只禁用所有元素的拖拽功能，保持交互功能（listening）
	 */
	public disableElementDraggingOnly(): void {
		this.elementDraggingDisabled = true
		this.elements.forEach((element) => {
			element.setDraggable(false)
		})
	}

	public canListenElement(): boolean {
		return !this.elementListeningDisabled
	}

	/**
	 * 统一计算元素当前是否允许被 Konva 原生拖拽。
	 *
	 * Konva 的拖拽由节点的 draggable 标记驱动；图片/视频加载后的 rerender
	 * 也必须复用这条计算，否则不同批次节点会出现拖拽能力不一致。
	 *
	 * 多选移动由 TransformManager 的 multiSelectionProxy 统一承接。此时真实元素节点
	 * 必须关闭原生拖拽，否则命中真实节点时会绕过 proxy，只拖动单个元素。
	 */
	public canDragElement(elementData: LayerElement): boolean {
		if (this.elementDraggingDisabled || this.viewportGestureDraggingDisabled) {
			return false
		}

		const selectionManager = this.canvas.selectionManager
		const isSelected = selectionManager?.isSelected(elementData.id) ?? false
		const selectionCount = selectionManager?.getSelectionCount() ?? 0
		const isSelectedInMultiSelection = selectionCount > 1 && isSelected
		if (isSelectedInMultiSelection) {
			return false
		}

		return (
			(this.canvas.permissionManager?.canTransform(elementData) ?? true) &&
			(!this.canvas.isKeepRatioModifierPressed() || isSelected)
		)
	}

	/**
	 * 恢复所有元素的拖拽和交互功能（根据权限管理器判断）
	 */
	public enableElementDragging(): void {
		this.elementDraggingDisabled = false
		this.elementListeningDisabled = false
		this.elements.forEach((element) => {
			const elementData = element.getData()
			element.setDraggable(this.canDragElement(elementData))
			element.setListening(true)
		})
	}

	/**
	 * 更新所有元素的拖拽状态（当画布访问能力变化时调用）
	 */
	public updateAllElementsDraggable(): void {
		this.elements.forEach((element) => {
			const elementData = element.getData()
			element.setDraggable(this.canDragElement(elementData))
		})
	}

	private setViewportGestureDraggingDisabled(disabled: boolean): void {
		if (this.viewportGestureDraggingDisabled === disabled) {
			return
		}

		this.viewportGestureDraggingDisabled = disabled
		if (disabled) {
			this.stopAllElementDrags()
		}
		this.updateAllElementsDraggable()
	}

	private stopAllElementDrags(): void {
		this.elements.forEach((element) => {
			const node = element.getNode()
			if (node?.isDragging()) {
				node.stopDrag()
			}
		})
	}

	/**
	 * 界面语言切换后重绘各元素 Konva 节点，使占位/状态等文案走新的 `canvas.t`
	 * 跳过 Frame、Group：rerender 会销毁容器子树，子元素由各自 rerender 更新即可
	 */
	public rerenderAllElementsForLocale(): void {
		this.elements.forEach((element) => {
			const type = element.getData().type
			if (type === ElementTypeEnum.Frame || type === ElementTypeEnum.Group) return
			element.rerender()
		})
		this.canvas.runtimeScheduler.requestLayerDraw("content", {
			source: "ElementManager",
			reason: "locale-rerender",
			priority: "normal",
		})
	}

	/**
	 * 检查元素是否为临时元素
	 */
	public isTemporary(elementId: string): boolean {
		return this.temporaryElements.has(elementId)
	}

	/** 仅正式文档元素可以参与连接等会被单独持久化的关系。 */
	public canParticipateInDocumentRelations(elementId: string): boolean {
		return this.elements.has(elementId) && !this.temporaryElements.has(elementId)
	}

	public getTemporaryElementMetadata(elementId: string): TemporaryElementMetadata | null {
		return this.temporaryElements.get(elementId) ?? null
	}

	/**
	 * 获取所有临时元素 ID
	 */
	public getTemporaryElementIds(): string[] {
		return Array.from(this.temporaryElements.keys())
	}
}
