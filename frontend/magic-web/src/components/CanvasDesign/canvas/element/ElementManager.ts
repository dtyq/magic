import Konva from "konva"
import type { LayerElement, CanvasDocument } from "../types"
import { ElementTypeEnum } from "../types"
import { GenerationStatus } from "../../types.magic"
import { type CanvasEventMap } from "../EventEmitter"
import { ElementFactory } from "./ElementFactory"
import { BaseElement } from "./BaseElement"
import { NodeAdapter } from "./NodeAdapter"
import { ZIndexManager } from "./ZIndexManager"
import type { Canvas } from "../Canvas"
import { FrameElement } from "./elements/FrameElement"
import { ImageElement as ImageElementClass } from "./elements/ImageElement"
import { normalizeSize } from "../utils/normalizeUtils"

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
	/** 强制重新渲染 */
	forceRerender?: boolean
	/** 批量操作模式（延迟事件触发，需要手动调用 flush） */
	batch?: boolean
	/** 更新模式：控制更新哪些层（默认 'full'） */
	mode?: UpdateMode
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
	private batchMode = false
	private pendingEvents: Array<{
		type: keyof CanvasEventMap
		data: CanvasEventMap[keyof CanvasEventMap]
	}> = []
	private nodeAdapter: NodeAdapter
	public zIndexManager: ZIndexManager

	// 临时元素标记集合
	private temporaryElements: Set<string> = new Set()

	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas
		// 初始化 NodeAdapter（需要 stage）
		this.nodeAdapter = new NodeAdapter({ canvas: this.canvas })
		// 初始化 ZIndexManager
		this.zIndexManager = new ZIndexManager(this.canvas)
	}

	/**
	 * 创建元素
	 * @param elementData - 元素数据
	 * @param options - 操作选项
	 * @throws 如果元素已存在
	 */
	public create(elementData: LayerElement, options?: ElementOperationOptions): void {
		if (this.elements.has(elementData.id)) {
			throw new Error(
				`Element ${elementData.id} already exists. Use update() or upsert() instead.`,
			)
		}
		this.doCreate(elementData, options || {})
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
			onUploadComplete?: (elementId: string) => void
			onUploadFailed?: (elementId: string, error: Error) => void
		},
	): string {
		if (this.elements.has(elementData.id)) {
			throw new Error(`Element ${elementData.id} already exists`)
		}

		// 标记为临时元素
		this.temporaryElements.add(elementData.id)

		// 创建元素实例（与正式元素相同的渲染逻辑）
		this.doCreate(elementData, { silent: false })

		// 获取元素实例
		const element = this.elements.get(elementData.id)

		// 如果是 ImageElement，创建 ossSrc Promise
		if (element instanceof ImageElementClass) {
			element.createOssSrcPromise()
		}

		// 使用全局上传管理器上传文件
		const { uploadFiles, onUploadComplete, onUploadFailed } = uploadContext
		if (uploadFiles.length > 0) {
			this.canvas.imageUploadManager.queueUpload({
				elementId: elementData.id,
				file: uploadFiles[0],
				onUploadComplete: (result) => {
					// 存储上传结果到元素实例（用于后续处理）
					const element = this.elements.get(elementData.id)
					if (element instanceof ImageElementClass) {
						element.uploadResult = result
					}
					// 触发原始回调
					onUploadComplete?.(elementData.id)
				},
				onUploadFailed: (error) => {
					// 触发原始回调
					onUploadFailed?.(elementData.id, error)
				},
			})
		}

		return elementData.id
	}

	/**
	 * 将临时元素转为正式元素
	 * @param elementId - 元素ID
	 * @param updates - 更新数据（通常包含 src 和 status）
	 * @param options - 操作选项
	 */
	public convertToPermament(
		elementId: string,
		updates: Partial<LayerElement>,
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
	 * 更新元素（统一接口，通过 mode 控制更新行为）
	 * @param elementId - 元素ID
	 * @param updates - 要更新的属性
	 * @param options - 操作选项
	 * @throws 如果元素不存在
	 */
	public update(
		elementId: string,
		updates: Partial<LayerElement>,
		options?: ElementOperationOptions,
	): void {
		const element = this.elements.get(elementId)
		if (!element) {
			throw new Error(`Element ${elementId} not found. Use create() or upsert() instead.`)
		}

		const mode = options?.mode || "full"

		// 规范化数据（所有模式都需要）
		const normalizedUpdates = this.normalizeUpdates(element, updates)

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
		updates: Partial<LayerElement>,
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
		updates: Partial<LayerElement>,
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
			this.doCreate(elementData, options || {})
		}
	}

	/**
	 * 批量更新元素
	 * @param updates - 更新数组，每项包含 id 和要更新的数据
	 */
	public batchUpdate(updates: Array<{ id: string; data: Partial<LayerElement> }>): void {
		this.batchMode = true
		try {
			updates.forEach(({ id, data }) => {
				if (this.elements.has(id)) {
					this.doUpdate(id, data, { batch: true })
				}
			})
		} finally {
			this.batchMode = false
			this.flush()
			// 触发批量更新完成事件
			this.canvas.eventEmitter.emit({ type: "element:batchupdated", data: undefined })
		}
	}

	/**
	 * 批量删除元素
	 * @param elementIds - 要删除的元素 ID 数组
	 */
	public batchDelete(elementIds: string[]): void {
		// 先禁用批量模式，因为 doDelete 内部会触发事件
		// 我们需要手动控制事件触发时机
		const originalBatchMode = this.batchMode
		this.batchMode = false

		// 临时禁用历史记录，避免每次删除都记录
		const historyManager = this.canvas.historyManager
		historyManager?.disable()

		try {
			elementIds.forEach((id) => {
				if (this.elements.has(id)) {
					this.doDelete(id)
				}
			})

			// 重新启用历史记录并立即记录一次
			if (historyManager) {
				historyManager.enable()
				historyManager.recordHistoryImmediate()
			}

			// 触发批量删除完成事件
			this.canvas.eventEmitter.emit({
				type: "element:batchdeleted",
				data: { elementIds },
			})
		} finally {
			this.batchMode = originalBatchMode
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
		this.batchMode = true
		try {
			// 规范化 zIndex：按原有顺序排序后，重新分配连续的 zIndex
			const normalizedElements = this.normalizeZIndex(elementsData)
			normalizedElements.forEach((elementData) => {
				this.doCreate(elementData, { batch: true })
			})
		} finally {
			this.batchMode = false
			this.flush()
			// 重新排列顶层元素的渲染顺序，确保 Konva 节点顺序与 zIndex 一致
			this.reorderTopLevelElements()
		}
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
			// 只触发一次 element:change 事件
			this.canvas.eventEmitter.emit({ type: "element:change", data: undefined })
			this.pendingEvents = []
		}
		this.canvas.contentLayer.batchDraw()
	}

	// ==================== 私有实现方法 ====================

	/**
	 * 规范化更新数据（提取公共逻辑）
	 */
	private normalizeUpdates(
		element: BaseElement,
		updates: Partial<LayerElement>,
	): Partial<LayerElement> {
		const normalizedUpdates = { ...updates }

		// 如果更新中包含 width 或 height，将它们规范化
		if (normalizedUpdates.width !== undefined || normalizedUpdates.height !== undefined) {
			const normalizedSize = normalizeSize(
				normalizedUpdates.width ?? element.getData().width ?? 0,
				normalizedUpdates.height ?? element.getData().height ?? 0,
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
		}

		return normalizedUpdates
	}

	/**
	 * 仅更新 node 层（私有方法）
	 */
	private updateNodeOnly(
		element: BaseElement,
		updates: Partial<LayerElement>,
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
		}

		if (updates.scaleX !== undefined) node.scaleX(updates.scaleX)
		if (updates.scaleY !== undefined) node.scaleY(updates.scaleY)

		if (updates.opacity !== undefined) node.opacity(updates.opacity)
		if (updates.visible !== undefined) node.visible(updates.visible)

		// 强制更新（如果需要）
		if (options?.forceRerender) {
			node.getLayer()?.batchDraw()
		}
	}

	/**
	 * 仅更新 data 层（私有方法）
	 */
	private updateDataOnly(
		element: BaseElement,
		updates: Partial<LayerElement>,
		options?: ElementOperationOptions,
	): void {
		// 获取当前数据并合并更新
		const currentData = element.getData()
		const newData = { ...currentData, ...updates, id: element.getId() } as LayerElement

		// 更新元素的内部数据（不触发 node 更新）
		element.update(newData)

		// 触发事件（如果不是 silent 模式）
		if (!options?.silent) {
			this.emitEvent({
				type: "element:updated",
				data: { elementId: element.getId(), data: newData },
			})
			this.emitEvent({ type: "element:change", data: undefined })
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

		const element = this.createElementInstance(finalElementData)
		if (!element) {
			// 不支持的元素类型，跳过创建
			return
		}

		const node = element.render()

		if (node) {
			this.canvas.contentLayer.add(node as Konva.Shape | Konva.Group)
			this.elements.set(finalElementData.id, element)

			// 调用生命周期钩子：节点已挂载到 Layer
			element.onMounted()

			// 递归处理子元素
			this.renderChildren(node, finalElementData, element)

			if (!options.batch) {
				this.canvas.contentLayer.batchDraw()
			}

			if (!options.silent) {
				this.emitEvent({
					type: "element:created",
					data: { elementId: finalElementData.id },
				})
				this.emitEvent({ type: "element:change", data: undefined })
			}
		}
	}

	/**
	 * 查找元素的父元素 ID（通过检查是否在某个父元素的 children 中）
	 * @param elementId - 元素 ID
	 * @returns 父元素 ID，如果没有父元素则返回 undefined
	 */
	public findParentIdForElement(elementId: string): string | undefined {
		for (const element of this.elements.values()) {
			const elementData = element.getData()
			if (
				"children" in elementData &&
				elementData.children &&
				Array.isArray(elementData.children)
			) {
				if (elementData.children.some((child: LayerElement) => child.id === elementId)) {
					return elementData.id
				}
			}
		}
		return undefined
	}

	/**
	 * 执行更新元素的核心逻辑（完整更新：data + node）
	 */
	private doUpdate(
		elementId: string,
		updates: Partial<LayerElement>,
		options: ElementOperationOptions,
	): void {
		const element = this.elements.get(elementId)
		if (!element) return

		// 在获取 currentData 之前，先从节点读取最新的位置信息
		// 这样可以确保如果用户在上传过程中拖动元素，位置信息会被正确保留
		const node = element.getNode()
		let currentData = element.getData()
		if (node && !updates.x && !updates.y) {
			// 如果更新中没有包含位置信息，且节点存在，则从节点读取最新位置
			const nodeX = node.x()
			const nodeY = node.y()
			// 只有当节点位置与数据中的位置不同时，才更新位置
			if (currentData.x !== nodeX || currentData.y !== nodeY) {
				currentData = { ...currentData, x: nodeX, y: nodeY }
			}
		}

		const newData = { ...currentData, ...updates, id: elementId } as LayerElement

		// 检测 zIndex 是否改变
		const zIndexChanged = updates.zIndex !== undefined && updates.zIndex !== currentData.zIndex

		const needsRerender = element.update(newData) || options.forceRerender
		if (needsRerender) {
			element.rerender()
		}

		// 如果 zIndex 改变了，需要重新排列节点顺序
		if (zIndexChanged) {
			// 检查元素是否有父元素
			if (this.hasParent(elementId)) {
				// 有父元素，重新排列父节点中的子节点顺序
				this.reorderChildrenInParent(elementId)
			} else {
				// 顶层元素，重新排列顶层元素顺序
				this.reorderTopLevelElements()
			}
		}

		if (!options.batch) {
			this.canvas.contentLayer.batchDraw()
		}

		if (!options.silent) {
			this.emitEvent({
				type: "element:updated",
				data: { elementId, data: newData },
			})
			this.emitEvent({ type: "element:change", data: undefined })
		}
	}

	/**
	 * 执行删除元素的核心逻辑
	 * @param elementId - 元素ID
	 * @param options - 删除选项
	 */
	private doDelete(elementId: string, options?: { skipChildren?: boolean }): void {
		const element = this.elements.get(elementId)
		if (!element) return

		const elementData = element.getData()

		// 如果是临时元素，清理临时标记
		if (this.temporaryElements.has(elementId)) {
			this.temporaryElements.delete(elementId)

			// 通知 ImageElement 停止上传（忽略结果）
			if ("cancelUpload" in element && typeof element.cancelUpload === "function") {
				element.cancelUpload()
			}

			// 触发临时元素删除事件
			this.canvas.eventEmitter.emit({
				type: "element:temporary:deleted",
				data: { elementId },
			})
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
				elementData.children.forEach((child: LayerElement) => this.doDelete(child.id))

				// 清空 Frame 的 children，避免删除时递归删除子元素
				this.doUpdate(elementId, { children: [] }, { batch: this.batchMode, silent: false })
			} else {
				// 对于非 Frame 元素，递归删除子元素
				if (
					"children" in elementData &&
					elementData.children &&
					Array.isArray(elementData.children)
				) {
					elementData.children.forEach((child: LayerElement) => this.doDelete(child.id))
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
					{ silent: false },
				)
			}
		}

		// 销毁元素实例
		element.destroy()
		this.elements.delete(elementId)

		this.canvas.contentLayer.batchDraw()
		this.canvas.eventEmitter.emit({ type: "element:deleted", data: { elementId } })
		this.canvas.eventEmitter.emit({ type: "element:change", data: undefined })
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
	 * 获取所有元素 ID
	 */
	public getAllElementIds(): string[] {
		return Array.from(this.elements.keys())
	}

	/**
	 * 获取所有顶层元素（不包含子元素）
	 */
	public getAllElements(): LayerElement[] {
		const allElements = Array.from(this.elements.values()).map((el) => el.getData())
		// 过滤出没有父元素的顶层元素
		return allElements.filter((element) => !this.hasParent(element.id))
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

	/**
	 * 加载文档数据
	 * 在加载时创建深拷贝，确保内部数据不受外部影响（如 useImmer 冻结）
	 */
	public loadDocument(doc: CanvasDocument): void {
		this.clear()
		// 深拷贝传入的数据，确保内部数据独立，不受外部状态管理工具影响
		const docCopy = JSON.parse(JSON.stringify(doc)) as CanvasDocument
		this.replaceAll(docCopy.elements || [])
	}

	/**
	 * 智能加载文档数据（差异更新）
	 * 只更新变化的元素，避免全量重新渲染
	 * 在加载时创建深拷贝，确保内部数据不受外部影响（如 useImmer 冻结）
	 */
	public loadDocumentSmart(doc: CanvasDocument): void {
		// 深拷贝传入的数据，确保内部数据独立，不受外部状态管理工具影响
		const docCopy = JSON.parse(JSON.stringify(doc)) as CanvasDocument
		let newElements = docCopy.elements || []

		// 过滤掉临时元素（status: Processing 的图片）
		// 因为撤销/恢复时，临时元素的上传任务已经丢失，无法恢复
		const filterTemporaryElements = (elements: LayerElement[]): LayerElement[] => {
			return elements
				.filter((item) => {
					// 过滤掉上传中的图片元素
					if (item.type === "image" && item.status === GenerationStatus.Processing) {
						return false
					}
					return true
				})
				.map((item) => {
					// 递归过滤子元素
					if ("children" in item && item.children && Array.isArray(item.children)) {
						return {
							...item,
							children: filterTemporaryElements(item.children),
						}
					}
					return item
				})
		}

		newElements = filterTemporaryElements(newElements)

		// 获取当前所有元素（包括子元素）
		const currentElementsDict = this.getElementsDict()
		// 将新文档的所有元素（包括子元素）展开为扁平数组，用于比较
		const flattenElements = (elements: LayerElement[]): LayerElement[] => {
			const result: LayerElement[] = []
			elements.forEach((el) => {
				result.push(el)
				if ("children" in el && el.children && Array.isArray(el.children)) {
					result.push(...flattenElements(el.children))
				}
			})
			return result
		}
		const newElementsFlat = flattenElements(newElements)

		const currentElementMap = new Map(Object.entries(currentElementsDict))
		const newElementMap = new Map(newElementsFlat.map((el) => [el.id, el]))

		// 收集需要删除的元素（在当前存在但新文档中不存在）
		const toDelete: string[] = []
		currentElementMap.forEach((_, id) => {
			if (!newElementMap.has(id)) {
				toDelete.push(id)
			}
		})

		// 收集需要创建的元素（在新文档中存在但当前不存在）
		// 注意：只收集顶层元素，子元素会由 doCreate 递归创建
		const toCreate: LayerElement[] = []
		newElements.forEach((element) => {
			if (!currentElementMap.has(element.id)) {
				toCreate.push(element)
			}
		})

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

			// 更新变化的元素
			toUpdate.forEach(({ id, data }) => {
				this.doUpdate(id, data, { batch: true })
			})
		} finally {
			this.batchMode = false
			this.flush()

			// 触发文档恢复事件，通知所有管理器更新（如 name labels、hover 等）
			// 因为批量模式不会触发 element:updated 事件，需要手动通知
			if (toUpdate.length > 0 || toCreate.length > 0 || toDelete.length > 0) {
				this.canvas.eventEmitter.emit({ type: "document:restored", data: undefined })
			}
		}
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
	 * @param options.includeTemporary 是否包含临时元素（默认 false）
	 */
	public exportDocument(options?: { includeTemporary?: boolean }): CanvasDocument {
		const allElements = this.getAllElements()

		// 根据选项决定是否过滤临时元素
		// 默认过滤（用于外部保存），但历史记录可以选择包含
		const elements = options?.includeTemporary
			? allElements
			: allElements.filter((element) => !this.temporaryElements.has(element.id))

		// 在导出边界统一做深拷贝，确保外部获得的是独立副本
		return JSON.parse(JSON.stringify({ elements })) as CanvasDocument
	}

	/**
	 * 清空所有元素
	 */
	public clear(): void {
		// 先收集所有元素 ID，避免在遍历过程中修改 Map
		const elementIds = Array.from(this.elements.keys())

		// 销毁所有元素
		this.elements.forEach((element) => element.destroy())
		this.elements.clear()

		// 销毁所有子节点，但保留背景
		const background = this.canvas.contentLayer.findOne(".canvas-background") as
			| Konva.Shape
			| Konva.Group
			| null
		this.canvas.contentLayer.destroyChildren()

		// 如果背景存在，重新添加到 layer
		if (background) {
			this.canvas.contentLayer.add(background)
			background.moveToBottom()
		}

		this.canvas.contentLayer.batchDraw()

		// 为每个元素触发删除事件
		elementIds.forEach((elementId) => {
			this.canvas.eventEmitter.emit({ type: "element:deleted", data: { elementId } })
		})

		this.canvas.eventEmitter.emit({ type: "element:change", data: undefined })
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
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
						// 从当前父容器中移除
						existingNode.remove()
						// 添加到新的父容器
						parentNode.add(existingNode)
						// 更新元素数据（坐标等可能需要更新）
						existingElement.update(childData)
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
		for (const element of this.elements.values()) {
			const elementData = element.getData()
			if (
				"children" in elementData &&
				elementData.children &&
				Array.isArray(elementData.children)
			) {
				if (elementData.children.some((child: LayerElement) => child.id === elementId)) {
					return true
				}
			}
		}
		return false
	}

	/**
	 * 查找元素的父元素
	 */
	public findParentElement(elementId: string): BaseElement | undefined {
		for (const element of this.elements.values()) {
			const elementData = element.getData()
			if (
				"children" in elementData &&
				elementData.children &&
				Array.isArray(elementData.children)
			) {
				if (elementData.children.some((child: LayerElement) => child.id === elementId)) {
					return element
				}
			}
		}
		return undefined
	}

	/**
	 * 禁用所有元素的拖拽和交互功能
	 */
	public disableElementDragging(): void {
		this.elements.forEach((element) => {
			element.setDraggable(false)
			element.setListening(false)
		})
	}

	/**
	 * 只禁用所有元素的拖拽功能，保持交互功能（listening）
	 */
	public disableElementDraggingOnly(): void {
		this.elements.forEach((element) => {
			element.setDraggable(false)
		})
	}

	/**
	 * 恢复所有元素的拖拽和交互功能（根据权限管理器判断）
	 */
	public enableElementDragging(): void {
		this.elements.forEach((element) => {
			const elementData = element.getData()
			// 使用 PermissionManager 判断
			const canDrag = this.canvas.permissionManager?.canTransform(elementData) ?? true
			element.setDraggable(canDrag)
			element.setListening(true)
		})
	}

	/**
	 * 更新所有元素的拖拽状态（当 readonly 状态变化时调用）
	 */
	public updateAllElementsDraggable(): void {
		this.elements.forEach((element) => {
			const elementData = element.getData()
			// 使用 PermissionManager 判断
			const canDrag = this.canvas.permissionManager?.canTransform(elementData) ?? true
			element.setDraggable(canDrag)
		})
	}

	/**
	 * 检查元素是否为临时元素
	 */
	public isTemporary(elementId: string): boolean {
		return this.temporaryElements.has(elementId)
	}

	/**
	 * 获取所有临时元素 ID
	 */
	public getTemporaryElementIds(): string[] {
		return Array.from(this.temporaryElements)
	}
}
