import type { Canvas } from "../Canvas"
import { ImageElement as ImageElementClass } from "../element/elements/ImageElement"
import type { CropConfig, ImageElement } from "../types"
import { ElementTypeEnum } from "../types"
import {
	composeSourceCropFromVisibleCrop,
	getCropDisplaySize,
	getFullSourceCrop,
	getVisibleCropIntersection,
	getVisibleCropFromSourceCrop,
} from "../utils/imageCropUtils"
import { CropRenderer } from "./CropRenderer"
import { calculateNodesRect } from "../utils/utils"

const FULL_CROP_EPSILON = 1e-6

/**
 * 裁剪管理器 - 管理图片元素的裁剪状态
 * 职责：
 * 1. 管理裁剪状态(当前裁剪的元素ID)
 * 2. 协调 CropRenderer、ImageElement 和 Canvas 的交互
 * 3. 处理进入/退出裁剪模式的逻辑
 * 4. 管理临时 crop 数据
 * 5. 处理确认/取消操作
 */
export class CropManager {
	private canvas: Canvas

	// 当前裁剪的元素ID
	private croppingElementId: string | null = null

	// 临时裁剪参数(编辑过程中使用)
	private tempCrop: CropConfig | null = null
	private originalVisibleCrop: CropConfig | null = null

	// 进入裁剪前的原始元素状态(用于取消恢复)
	private originalImageState:
		| Pick<ImageElement, "x" | "y" | "width" | "height" | "crop">
		| undefined = undefined

	// 进入裁剪前的原始节点索引(用于退出时还原节点位置)
	private originalNodeIndex: number | undefined = undefined

	// 裁剪渲染器(由裁剪器绘制，与 ImageElement 解耦)
	private cropRenderer: CropRenderer | null = null

	// 事件监听器引用(用于销毁时移除)
	private escapeHandler?: () => void
	private elementSelectHandler?: (event: { data: { elementIds: string[] } }) => void
	private elementDeselectHandler?: () => void
	private viewportScaleHandler?: () => void
	private viewportPanHandler?: () => void
	private elementUpdatedHandler?: (event: { data: { elementId: string } }) => void
	private elementRerenderedHandler?: (event: { data: { elementId: string } }) => void
	private cropEnterRerenderedHandler?: (event: { data: { elementId: string } }) => void

	private getSourceDimensions(
		elementInstance: ImageElementClass | null,
		imageElement: ImageElement,
	) {
		const imageInfo = elementInstance?.getImageInfo()
		return {
			width: imageInfo?.naturalWidth ?? imageElement.width ?? 0,
			height: imageInfo?.naturalHeight ?? imageElement.height ?? 0,
		}
	}

	private getShiftedElementPosition(
		elementInstance: ImageElementClass | null,
		imageElement: ImageElement,
		offset: { x: number; y: number },
	): { x: number; y: number } {
		const node = elementInstance?.getNode()
		if (node) {
			const nextPosition = node.getTransform().point(offset)
			return {
				x: nextPosition.x,
				y: nextPosition.y,
			}
		}

		return {
			x: (imageElement.x ?? 0) + offset.x * (imageElement.scaleX ?? 1),
			y: (imageElement.y ?? 0) + offset.y * (imageElement.scaleY ?? 1),
		}
	}

	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas

		this.setupEventListeners()
	}

	/**
	 * 设置事件监听
	 */
	private setupEventListeners(): void {
		// ESC 键退出裁剪模式(优先于工具切换)
		this.escapeHandler = () => {
			if (this.croppingElementId) {
				this.cancelCrop()
			}
		}
		this.canvas.eventEmitter.on("keyboard:escape", this.escapeHandler)

		// 选中变化时，若当前在裁剪模式且新选中不包含裁剪元素则退出裁剪
		// 用于处理非正常情况下导致的裁剪过程中断（如通过其他方式选中了其他元素）
		this.elementSelectHandler = ({ data }) => {
			if (this.croppingElementId) {
				this.exitCropMode(true)
			}
		}
		this.canvas.eventEmitter.on("element:select", this.elementSelectHandler)

		// 取消选中时，若当前在裁剪模式则退出裁剪
		// 用于处理非正常情况下导致的裁剪过程中断（如通过其他方式取消了选中）
		this.elementDeselectHandler = () => {
			if (this.croppingElementId) {
				this.exitCropMode(true)
			}
		}
		this.canvas.eventEmitter.on("element:deselect", this.elementDeselectHandler)
	}

	/**
	 * 设置裁剪模式下的位置更新监听（视口/元素变化时触发 crop:position）
	 */
	private setupCropPositionListeners(): void {
		this.viewportScaleHandler = () => this.emitCropPosition()
		this.viewportPanHandler = () => this.emitCropPosition()
		this.elementUpdatedHandler = ({ data }) => {
			if (data.elementId === this.croppingElementId) this.emitCropPosition()
		}
		this.elementRerenderedHandler = ({ data }) => {
			if (data.elementId === this.croppingElementId) this.emitCropPosition()
		}
		this.canvas.eventEmitter.on("viewport:scale", this.viewportScaleHandler)
		this.canvas.eventEmitter.on("viewport:pan", this.viewportPanHandler)
		this.canvas.eventEmitter.on("element:updated", this.elementUpdatedHandler)
		this.canvas.eventEmitter.on("element:rerendered", this.elementRerenderedHandler)
	}

	/**
	 * 移除裁剪模式下的位置更新监听
	 */
	private removeCropPositionListeners(): void {
		if (this.viewportScaleHandler) {
			this.canvas.eventEmitter.off("viewport:scale", this.viewportScaleHandler)
			this.viewportScaleHandler = undefined
		}
		if (this.viewportPanHandler) {
			this.canvas.eventEmitter.off("viewport:pan", this.viewportPanHandler)
			this.viewportPanHandler = undefined
		}
		if (this.elementUpdatedHandler) {
			this.canvas.eventEmitter.off("element:updated", this.elementUpdatedHandler)
			this.elementUpdatedHandler = undefined
		}
		if (this.elementRerenderedHandler) {
			this.canvas.eventEmitter.off("element:rerendered", this.elementRerenderedHandler)
			this.elementRerenderedHandler = undefined
		}
		if (this.cropEnterRerenderedHandler) {
			this.canvas.eventEmitter.off("element:rerendered", this.cropEnterRerenderedHandler)
			this.cropEnterRerenderedHandler = undefined
		}
	}

	/**
	 * 发出裁剪元素位置事件（复用 SelectionManager 的 calculateNodesRect 逻辑）
	 */
	private emitCropPosition(): void {
		if (!this.croppingElementId) return

		const adapter = this.canvas.elementManager.getNodeAdapter()
		const nodes = adapter.getNodesForTransform([this.croppingElementId])

		if (nodes.length === 0) {
			this.canvas.eventEmitter.emit({
				type: "crop:position",
				data: { elementId: this.croppingElementId, boundingRect: null },
			})
			return
		}

		const boundingRect = calculateNodesRect(
			nodes,
			this.canvas.stage,
			this.canvas.elementManager,
		)

		this.canvas.eventEmitter.emit({
			type: "crop:position",
			data: { elementId: this.croppingElementId, boundingRect },
		})
	}

	/**
	 * 移除事件监听
	 */
	private removeEventListeners(): void {
		if (this.escapeHandler) {
			this.canvas.eventEmitter.off("keyboard:escape", this.escapeHandler)
			this.escapeHandler = undefined
		}
		if (this.elementSelectHandler) {
			this.canvas.eventEmitter.off("element:select", this.elementSelectHandler)
			this.elementSelectHandler = undefined
		}
		if (this.elementDeselectHandler) {
			this.canvas.eventEmitter.off("element:deselect", this.elementDeselectHandler)
			this.elementDeselectHandler = undefined
		}
	}

	/**
	 * 进入裁剪模式
	 */
	public enterCropMode(elementId: string): void {
		if (this.canvas.eraserManager.getErasingElementId()) {
			this.canvas.eraserManager.cancelEraser()
		}

		// 如果已有元素在裁剪,先退出
		if (this.croppingElementId && this.croppingElementId !== elementId) {
			this.exitCropMode(true)
		}

		// 获取元素数据
		const elementData = this.canvas.elementManager.getElementData(elementId)
		if (!elementData || elementData.type !== ElementTypeEnum.Image) {
			return
		}

		const imageElement = elementData as ImageElement
		const elementInstance = this.canvas.elementManager.getElementInstance(
			elementId,
		) as ImageElementClass | null

		this.originalImageState = {
			x: imageElement.x,
			y: imageElement.y,
			width: imageElement.width,
			height: imageElement.height,
			crop: imageElement.crop ? { ...imageElement.crop } : undefined,
		}

		const sourceDimensions = this.getSourceDimensions(elementInstance, imageElement)
		const displaySize = getCropDisplaySize({
			crop: imageElement.crop,
			elementSize: {
				width: imageElement.width ?? 0,
				height: imageElement.height ?? 0,
			},
			sourceDimensions,
		})

		// 裁剪编辑态恢复到裁剪前的完整显示边界，并将当前可见区域映射为临时裁剪框
		this.tempCrop = getVisibleCropFromSourceCrop({
			crop: imageElement.crop,
			sourceDimensions,
			displaySize,
		})
		this.originalVisibleCrop = { ...this.tempCrop }

		// 先取消选中并隐藏 Transformer，再进入裁剪模式，避免裁剪时仍显示选中/Transformer
		this.canvas.selectionManager.deselectAll()

		const restoredPosition = this.getShiftedElementPosition(elementInstance, imageElement, {
			x: -(this.tempCrop.x ?? 0),
			y: -(this.tempCrop.y ?? 0),
		})
		this.canvas.elementManager.update(
			elementId,
			{
				x: restoredPosition.x,
				y: restoredPosition.y,
				width: displaySize.width,
				height: displaySize.height,
			},
			{ silent: true },
		)
		this.canvas.markerManager.previewMarkersForCrop(
			elementId,
			this.originalVisibleCrop,
			displaySize,
		)

		// 设置当前裁剪元素ID
		this.croppingElementId = elementId

		// 保存原始节点位置并立即提升（在 rerender 之前）
		const node = elementInstance?.getNode()
		if (node) {
			const parent = node.getParent()
			if (parent) {
				// 保存节点在父容器中的原始索引位置
				this.originalNodeIndex = parent.children?.indexOf(node) ?? -1
				// 立即提升节点至顶层（如果节点已存在）
				node.moveToTop()
			}
		}

		// 监听元素重新渲染事件，在 rerender 完成后再次提升节点至顶层
		// 因为 crop:enter 会触发 ImageElement 的 rerender，重新创建节点
		this.cropEnterRerenderedHandler = ({ data }) => {
			if (data.elementId === elementId) {
				// rerender 完成后，提升节点至顶层
				const rerenderedNode = elementInstance?.getNode()
				if (rerenderedNode) {
					rerenderedNode.moveToTop()
					// 移除监听器（只执行一次）
					if (this.cropEnterRerenderedHandler) {
						this.canvas.eventEmitter.off(
							"element:rerendered",
							this.cropEnterRerenderedHandler,
						)
						this.cropEnterRerenderedHandler = undefined
					}
				}
			}
		}
		this.canvas.eventEmitter.on("element:rerendered", this.cropEnterRerenderedHandler)

		// 触发进入裁剪模式(更新 UI 等，会触发 ImageElement 的 rerender)
		this.canvas.eventEmitter.emit({
			type: "crop:enter",
			data: { elementId },
		})

		// 聚焦到裁剪元素
		this.canvas.viewportController.focusOnElements([elementId], {
			animated: true,
			padding: {
				top: "5%",
				right: "5%",
				bottom: "5%",
				left: "5%",
				minRight: 325,
				minLeft: 325,
			},
			selectElement: false,
			ensureFullyVisible: false,
		})

		// 确保容器获得焦点，以便ESC键能立即响应
		this.canvas.container.focus()

		// 创建裁剪渲染器并绘制 overlay
		this.cropRenderer = new CropRenderer({ canvas: this.canvas, elementId })
		this.cropRenderer.render()

		// 设置裁剪模式下的位置更新监听，并发出首次 crop:position
		this.setupCropPositionListeners()
		this.emitCropPosition()
	}

	/**
	 * 退出裁剪模式
	 * @param shouldRestore 是否恢复原始crop(取消操作时为true)
	 */
	public exitCropMode(shouldRestore: boolean): void {
		if (!this.croppingElementId) {
			return
		}

		const elementId = this.croppingElementId

		// 移除裁剪模式下的位置更新监听
		this.removeCropPositionListeners()

		// 销毁裁剪渲染器
		if (this.cropRenderer) {
			this.cropRenderer.destroy()
			this.cropRenderer = null
		}

		// 如果需要恢复进入裁剪前的原始元素状态
		if (shouldRestore && this.originalImageState) {
			this.canvas.elementManager.update(
				elementId,
				{
					x: this.originalImageState.x,
					y: this.originalImageState.y,
					width: this.originalImageState.width,
					height: this.originalImageState.height,
					crop: this.originalImageState.crop,
				},
				{ silent: true },
			)
		}
		this.canvas.markerManager.clearCropPreview(elementId)

		// 还原原始节点位置（仅改变渲染顺序，不更新数据）
		// 通过重新排序同级节点来恢复正确的顺序（基于 zIndex 数据）
		if (this.originalNodeIndex !== undefined) {
			const parentId = this.canvas.elementManager.findParentIdForElement(elementId)
			if (parentId) {
				// 子元素（在画框内），重新排列父容器内的子元素顺序
				this.canvas.elementManager.reorderChildrenInParentPublic(parentId)
			} else {
				// 顶层元素，重新排列顶层元素顺序
				this.canvas.elementManager.reorderTopLevelElementsPublic()
			}
			this.originalNodeIndex = undefined
		}

		// 先清空裁剪状态，再恢复该元素的选中与 Transformer，最后通知退出裁剪
		this.croppingElementId = null
		this.canvas.selectionManager.select(elementId, false)

		this.canvas.eventEmitter.emit({
			type: "crop:exit",
			data: { elementId, restored: shouldRestore },
		})
		this.tempCrop = null
		this.originalVisibleCrop = null
		this.originalImageState = undefined
	}

	/**
	 * 更新临时crop
	 */
	public updateTempCrop(crop: CropConfig): void {
		this.tempCrop = crop

		// 触发临时crop更新事件(通知面板)
		if (this.croppingElementId) {
			this.canvas.eventEmitter.emit({
				type: "crop:tempCropUpdate",
				data: {
					elementId: this.croppingElementId,
					tempCrop: crop,
				},
			})
		}
	}

	/**
	 * 从面板更新临时crop
	 * @param crop 新的裁剪配置
	 * @param isLocked 是否锁定比例
	 */
	public updateTempCropFromPanel(crop: CropConfig, isLocked?: boolean): void {
		if (!this.croppingElementId) return

		this.tempCrop = crop

		// 触发面板更新事件(通知 CropRenderer 同步裁剪框)
		this.canvas.eventEmitter.emit({
			type: "crop:updateFromPanel",
			data: {
				elementId: this.croppingElementId,
				tempCrop: crop,
				isLocked,
			},
		})
	}

	/**
	 * 获取“恢复原图”对应的临时裁剪框
	 * 基于当前裁剪编辑态的完整显示边界，而不是面板传入的元素快照
	 */
	public getRestoreOriginalTempCrop(): CropConfig | null {
		if (!this.croppingElementId) return null

		const elementData = this.canvas.elementManager.getElementData(this.croppingElementId)
		if (!elementData || elementData.type !== ElementTypeEnum.Image) {
			return null
		}

		const restoreOriginalCrop = {
			x: 0,
			y: 0,
			width: elementData.width ?? 0,
			height: elementData.height ?? 0,
		}

		return restoreOriginalCrop
	}

	/**
	 * 从面板恢复原图，并立即同步到当前裁剪会话
	 */
	public restoreOriginalFromPanel(): CropConfig | null {
		const restoreOriginalCrop = this.getRestoreOriginalTempCrop()
		if (!restoreOriginalCrop) return null

		this.updateTempCropFromPanel(restoreOriginalCrop, false)
		return restoreOriginalCrop
	}

	/**
	 * 确认裁剪
	 */
	public confirmCrop(): void {
		if (!this.croppingElementId || !this.tempCrop || !this.originalVisibleCrop) {
			return
		}

		const elementData = this.canvas.elementManager.getElementData(this.croppingElementId)
		if (!elementData || elementData.type !== ElementTypeEnum.Image) {
			return
		}

		const imageElement = elementData as ImageElement
		const elementInstance = this.canvas.elementManager.getElementInstance(
			this.croppingElementId,
		) as ImageElementClass | null
		const sourceDimensions = this.getSourceDimensions(elementInstance, imageElement)
		const displaySize = {
			width: imageElement.width ?? 0,
			height: imageElement.height ?? 0,
		}

		// 保存时宽高取整，x/y 保持精度以避免位置跳动
		const visibleCrop: CropConfig = {
			...this.tempCrop,
			width: Math.round(this.tempCrop.width),
			height: Math.round(this.tempCrop.height),
		}
		const finalVisibleCrop = getVisibleCropIntersection({
			visibleCrop,
			displaySize,
		})

		const crop = composeSourceCropFromVisibleCrop({
			visibleCrop: finalVisibleCrop,
			displaySize,
			sourceDimensions,
		})
		const roundedCrop: CropConfig = {
			...crop,
			width: Math.round(crop.width),
			height: Math.round(crop.height),
		}
		const fullSourceCrop = getFullSourceCrop(sourceDimensions)
		const nextPersistedCrop =
			Math.abs(roundedCrop.x - fullSourceCrop.x) <= FULL_CROP_EPSILON &&
			Math.abs(roundedCrop.y - fullSourceCrop.y) <= FULL_CROP_EPSILON &&
			Math.abs(roundedCrop.width - fullSourceCrop.width) <= FULL_CROP_EPSILON &&
			Math.abs(roundedCrop.height - fullSourceCrop.height) <= FULL_CROP_EPSILON
				? undefined
				: roundedCrop
		const nextPosition = this.getShiftedElementPosition(elementInstance, imageElement, {
			x: finalVisibleCrop.x,
			y: finalVisibleCrop.y,
		})

		// 写入新的元素边界和 source crop
		this.canvas.elementManager.update(this.croppingElementId, {
			x: nextPosition.x,
			y: nextPosition.y,
			width: finalVisibleCrop.width,
			height: finalVisibleCrop.height,
			crop: nextPersistedCrop,
		})
		this.canvas.markerManager.applyConfirmedCropToMarkers(
			this.croppingElementId,
			this.originalVisibleCrop,
			finalVisibleCrop,
			nextPersistedCrop,
		)
		this.canvas.eventEmitter.emit({
			type: "crop:confirmed",
			data: { elementId: this.croppingElementId },
		})

		// 退出裁剪模式(不恢复)
		this.exitCropMode(false)
	}

	/**
	 * 取消裁剪
	 */
	public cancelCrop(): void {
		// 退出裁剪模式(恢复原始crop)
		this.exitCropMode(true)
	}

	/**
	 * 同步裁剪框 Transformer 的宽高比锁定状态（修饰键变化时由 Canvas 调用）
	 */
	public setKeepRatio(): void {
		this.cropRenderer?.setKeepRatio()
	}

	/**
	 * 获取当前裁剪元素ID
	 */
	public getCroppingElementId(): string | null {
		return this.croppingElementId
	}

	/**
	 * 获取临时crop
	 */
	public getTempCrop(): CropConfig | null {
		return this.tempCrop
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		this.removeEventListeners()
		// 如果正在裁剪,先退出
		if (this.croppingElementId) {
			this.exitCropMode(true)
		}
	}
}
