import Konva from "konva"
import type { Marker, MarkerArea, ToolType, FrameElement, LayerElement } from "../types"
import { generateMarkerId } from "../utils/utils"
import { ToolTypeEnum, MarkerTypeEnum } from "../types"
import type { Canvas } from "../Canvas"
import type { IdentifyImageMarkResponse } from "../../types.magic"
import { BaseMarker } from "./markers/BaseMarker"
import { PointMarker } from "./markers/PointMarker"
import { AreaMarker } from "./markers/AreaMarker"

/**
 * 标记管理器 - 管理画布上的标记
 */
export class MarkerManager {
	private canvas: Canvas

	private markers: Marker[]
	private markerInstances: Map<string, BaseMarker> = new Map()
	private selectedMarkerId: string | null = null
	private currentTool: ToolType | null = null
	// 是否正在吸附（吸附期间暂停 marker 位置更新，避免抖动）
	private isSnapping = false
	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas
		// 确保 markers 数组是可扩展的
		this.markers = []
		this.setupEventListeners()
	}

	/**
	 * 设置事件监听
	 */
	private setupEventListeners(): void {
		// 监听工具切换事件，记录当前工具
		this.canvas.eventEmitter.on("tool:change", ({ data }) => {
			this.currentTool = data.tool
			// 更新所有 Marker 实例的 currentTool
			this.markerInstances.forEach((instance) => {
				instance.updateCurrentTool(this.currentTool)
			})
		})

		// 监听元素删除事件，删除关联的标记
		this.canvas.eventEmitter.on("element:deleted", ({ data }) => {
			this.removeMarkersByElementId(data.elementId)
		})

		// 处理拖拽移动事件
		const handleDragMove = (elementId: string) => {
			const element = this.canvas.elementManager.getElementData(elementId)
			if (element?.type === "image") {
				this.updateMarkerPositionsRealtime(elementId)
			} else if (element?.type === "frame") {
				this.updateMarkersForFrameRealtime(elementId)
			}
		}

		// 监听拖拽移动事件（拖拽中实时更新）
		this.canvas.eventEmitter.on("elements:transform:dragmove", ({ data }) => {
			// 吸附期间跳过更新，避免抖动
			if (this.isSnapping) return
			data.elementIds.forEach((elementId) => {
				handleDragMove(elementId)
			})
		})

		// 监听缩放移动事件（缩放中实时更新）
		this.canvas.eventEmitter.on("elements:transform:anchorDragmove", ({ data }) => {
			// 吸附期间跳过更新，避免抖动
			if (this.isSnapping) return
			data.elementIds.forEach((elementId) => {
				handleDragMove(elementId)
			})
		})

		// 监听吸附开始事件，暂停 marker 位置更新
		this.canvas.eventEmitter.on("snap:start", () => {
			this.isSnapping = true
		})

		// 监听吸附结束事件，恢复 marker 位置更新并更新一次位置
		this.canvas.eventEmitter.on("snap:end", () => {
			this.isSnapping = false
			// 吸附结束后，更新所有相关元素的 marker 位置
			const imageElementIds = new Set<string>()
			this.markers.forEach((marker) => {
				imageElementIds.add(marker.elementId)
			})
			imageElementIds.forEach((elementId) => {
				const element = this.canvas.elementManager.getElementData(elementId)
				if (element?.type === "image") {
					this.updateMarkerPositionsRealtime(elementId)
				} else if (element?.type === "frame") {
					this.updateMarkersForFrameRealtime(elementId)
				}
			})
		})

		// 监听元素重新渲染事件（节点重新渲染时更新标记位置）
		this.canvas.eventEmitter.on("element:rerendered", ({ data }) => {
			if (data.data.type === "image") {
				// 使用 realtime 方法从节点读取最新的位置和尺寸
				// 这样可以避免元素数据更新时序问题
				this.updateMarkerPositionsRealtime(data.elementId)
			} else if (data.data.type === "frame") {
				// 当Frame更新时，需要更新Frame内所有图片元素的marker位置
				this.updateMarkersForFrameRealtime(data.elementId)
			}
		})

		// 监听viewport缩放事件，更新标记缩放（保持固定大小）
		this.canvas.eventEmitter.on("viewport:scale", () => {
			this.updateAllMarkerScales()
		})

		// 监听文档恢复事件（撤销/恢复时触发）
		this.canvas.eventEmitter.on("document:restored", () => {
			// 更新所有图片元素的 marker 位置
			const imageElementIds = new Set<string>()
			this.markers.forEach((marker) => {
				imageElementIds.add(marker.elementId)
			})
			imageElementIds.forEach((elementId) => {
				const element = this.canvas.elementManager.getElementData(elementId)
				if (element?.type === "image") {
					this.updateMarkerPositionsRealtime(elementId)
				} else if (element?.type === "frame") {
					this.updateMarkersForFrameRealtime(elementId)
				}
			})
		})

		// 监听元素选中事件，取消标记选中
		this.canvas.eventEmitter.on("element:select", () => {
			this.deselectMarker()
		})

		// 监听删除快捷键
		this.canvas.eventEmitter.on("keyboard:delete", () => {
			if (this.selectedMarkerId) {
				this.removeMarker(this.selectedMarkerId)
			}
		})

		// 监听元素创建事件
		this.canvas.eventEmitter.on("element:created", () => {
			// Markers Layer 会自动保持在正确的层级
		})

		// 监听图片加载完成事件
		this.canvas.eventEmitter.on("element:image:loaded", () => {
			// Markers Layer 会自动保持在正确的层级
		})

		// 监听 Frame 创建事件，重新渲染 Frame 内图片元素的 marker
		this.canvas.eventEmitter.on("frame:created", ({ data }) => {
			this.rerenderMarkersForFrame(data.frameId)
		})

		// 监听 Frame 移除事件，重新渲染被释放的图片元素的 marker
		this.canvas.eventEmitter.on("frame:removed", ({ data }) => {
			// Frame 移除时，子元素已经被释放并更新了坐标
			// 需要重新渲染这些元素的 marker
			// 由于 Frame 已经被删除，我们需要通过其他方式找到被释放的元素
			// 实际上，在 Frame 移除后，子元素会触发 element:updated 事件
			// 但为了确保 marker 位置正确，我们使用延迟重新渲染所有 marker
			// 使用 requestAnimationFrame 确保在元素更新完成后再重新渲染
			requestAnimationFrame(() => {
				this.rerenderAllMarkers()
			})
		})

		// 监听stage点击事件，点击空白处取消marker选中
		this.canvas.stage.on("click", (e) => {
			// 只在选择工具激活时处理
			if (this.currentTool !== ToolTypeEnum.Select) {
				return
			}

			const clickedNode = e.target

			// 检查是否点击了marker
			let isMarkerClicked = false
			let currentNode: Konva.Node | null = clickedNode
			while (currentNode) {
				if (currentNode.name() === "marker") {
					isMarkerClicked = true
					break
				}
				currentNode = currentNode.getParent()
			}

			// 如果没有点击marker，取消marker选中
			if (!isMarkerClicked && this.selectedMarkerId) {
				this.deselectMarker()
			}
		})
	}

	/**
	 * 添加标记
	 * @param elementId 元素ID
	 * @param relativeX 相对X位置（0-1）
	 * @param relativeY 相对Y位置（0-1）
	 * @param type 标记类型（默认为点标记）
	 * @param areaWidth 区域宽度（相对值 0-1，仅用于区域标记）
	 * @param areaHeight 区域高度（相对值 0-1，仅用于区域标记）
	 * @returns 是否成功添加标记
	 */
	public addMarker(
		elementId: string,
		relativeX: number,
		relativeY: number,
		type: number = MarkerTypeEnum.Mark,
		areaWidth?: number,
		areaHeight?: number,
	): boolean {
		// 使用 PermissionManager 统一判断是否可以创建标记
		if (!this.canvas.permissionManager.canCreateMarker()) {
			return false
		}

		// 创建初始 marker 对象
		let marker: Marker
		if (type === MarkerTypeEnum.Area) {
			// 区域标记
			if (areaWidth === undefined || areaHeight === undefined) {
				console.error("Area marker requires areaWidth and areaHeight")
				return false
			}
			marker = {
				type: MarkerTypeEnum.Area,
				id: generateMarkerId(),
				elementId,
				relativeX,
				relativeY,
				areaWidth,
				areaHeight,
			} as MarkerArea
		} else {
			// 点标记
			marker = {
				type: MarkerTypeEnum.Mark,
				id: generateMarkerId(),
				elementId,
				relativeX,
				relativeY,
			}
		}

		// 触发 before-create 事件（无论 canAddImageMarker 返回什么都要触发）
		// 仅作为通知，传递 marker 副本，监听器无法修改原始对象
		this.canvas.eventEmitter.emit({
			type: "marker:before-create",
			data: { marker: { ...marker } },
		})

		// 检查是否可以添加图片标记
		if (!this.canvas.permissionManager.canAddImageMarker()) {
			return false
		}

		this.markers.push(marker)
		this.renderMarker(marker)

		// 触发创建事件
		this.canvas.eventEmitter.emit({
			type: "marker:created",
			data: { marker },
		})

		// 默认选中新添加的标记
		this.selectMarker(marker.id)
		return true
	}

	/**
	 * 批量添加标记
	 * @param markers 要添加的标记数组
	 * @param options silent: 为 true 时不触发 marker:before-create / marker:created
	 */
	public addMarkers(markers: Marker[], options?: { silent?: boolean }): void {
		if (!markers || markers.length === 0) return

		// 使用 PermissionManager 统一判断是否可以创建标记
		if (!this.canvas.permissionManager.canCreateMarker()) {
			return
		}

		// 检查是否可以添加图片标记
		if (!this.canvas.permissionManager.canAddImageMarker()) {
			return
		}

		// 过滤掉关联元素不存在的 marker
		const validMarkers = markers.filter((marker) =>
			this.canvas.elementManager.hasElement(marker.elementId),
		)

		if (validMarkers.length === 0) return

		const silent = options?.silent === true

		// 批量添加 markers
		validMarkers.forEach((marker) => {
			if (!silent) {
				this.canvas.eventEmitter.emit({
					type: "marker:before-create",
					data: { marker: { ...marker } },
				})
			}

			this.markers.push(marker)

			if (!silent) {
				this.canvas.eventEmitter.emit({
					type: "marker:created",
					data: { marker },
				})
			}
		})

		// 重新渲染所有标记（更新序号）
		this.renderAllMarkers()

		// 选中最后一个添加的标记
		if (validMarkers.length > 0) {
			this.selectMarker(validMarkers[validMarkers.length - 1].id)
		}
	}

	/**
	 * 删除标记
	 */
	public removeMarker(markerId: string): void {
		// 使用 PermissionManager 统一判断是否可以删除标记
		if (!this.canvas.permissionManager.canDeleteMarker()) {
			return
		}

		const index = this.markers.findIndex((m) => m.id === markerId)
		if (index === -1) return

		this.markers.splice(index, 1)

		// 销毁实例
		const instance = this.markerInstances.get(markerId)
		if (instance) {
			instance.destroy()
			this.markerInstances.delete(markerId)
		}

		// 清除选中状态
		if (this.selectedMarkerId === markerId) {
			this.selectedMarkerId = null
			// 触发选中状态变化事件
			this.canvas.eventEmitter.emit({ type: "marker:select", data: { id: null } })
		}

		// 触发删除事件
		this.canvas.eventEmitter.emit({ type: "marker:deleted", data: { id: markerId } })

		// 重新渲染所有标记（更新序号）
		this.renderAllMarkers()
	}

	/**
	 * 根据元素ID删除所有关联的标记
	 */
	private removeMarkersByElementId(elementId: string): void {
		const markersToRemove = this.markers.filter((m) => m.elementId === elementId)
		markersToRemove.forEach((marker) => {
			this.removeMarker(marker.id)
		})
	}

	/**
	 * 实时更新指定元素的标记位置（从Konva节点实时读取位置）
	 * 用于拖拽和transform中实时更新，此时元素数据还未更新
	 */
	private updateMarkerPositionsRealtime(elementId: string): void {
		const relatedMarkers = this.markers.filter((m) => m.elementId === elementId)
		relatedMarkers.forEach((marker) => {
			const instance = this.markerInstances.get(marker.id)
			if (instance) {
				instance.updatePosition()
			}
		})

		this.canvas.markersLayer.batchDraw()
	}

	/**
	 * 渲染标记
	 */
	private renderMarker(marker: Marker): void {
		const index = this.markers.findIndex((m) => m.id === marker.id)
		if (index === -1) return

		const sequence = index + 1 // 序号从1开始

		// 根据类型创建对应的 Marker 实例
		let instance: BaseMarker
		if (marker.type === MarkerTypeEnum.Mark) {
			instance = new PointMarker({
				marker,
				canvas: this.canvas,
				sequence,
				selectedMarkerId: this.selectedMarkerId,
				currentTool: this.currentTool,
			})
		} else {
			instance = new AreaMarker({
				marker,
				canvas: this.canvas,
				sequence,
				selectedMarkerId: this.selectedMarkerId,
				currentTool: this.currentTool,
			})
		}

		// 渲染实例
		instance.render()

		// 设置事件处理
		instance.setupClickHandler(
			(markerId) => this.selectMarker(markerId),
			() => this.deselectMarker(),
		)
		instance.setupHoverHandler()

		// 保存实例
		this.markerInstances.set(marker.id, instance)

		this.canvas.markersLayer.batchDraw()
	}

	/**
	 * 选中标记
	 */
	public selectMarker(markerId: string): void {
		// 如果选中的是同一个 marker，不触发事件
		if (this.selectedMarkerId === markerId) {
			return
		}

		// 取消之前的选中
		if (this.selectedMarkerId) {
			const prevInstance = this.markerInstances.get(this.selectedMarkerId)
			if (prevInstance) {
				prevInstance.updateSelection(null)
			}
		}

		// 选中新标记
		this.selectedMarkerId = markerId
		const instance = this.markerInstances.get(markerId)
		if (instance) {
			instance.updateSelection(markerId)
		}

		// 取消元素选中
		this.canvas.selectionManager.deselectAll()

		// 触发选中状态变化事件
		this.canvas.eventEmitter.emit({ type: "marker:select", data: { id: markerId } })

		this.canvas.markersLayer.batchDraw()
	}

	/**
	 * 取消标记选中
	 */
	public deselectMarker(): void {
		if (this.selectedMarkerId) {
			const instance = this.markerInstances.get(this.selectedMarkerId)
			if (instance) {
				instance.updateSelection(null)
			}
			this.selectedMarkerId = null
			// 触发选中状态变化事件
			this.canvas.eventEmitter.emit({ type: "marker:select", data: { id: null } })
			this.canvas.markersLayer.batchDraw()
		}
	}

	/**
	 * 获取当前选中的标记ID
	 */
	public getSelectedMarkerId(): string | null {
		return this.selectedMarkerId
	}

	/**
	 * 获取标记数据
	 */
	public getMarker(markerId: string): Marker | undefined {
		return this.markers.find((m) => m.id === markerId)
	}

	/**
	 * 深度比较两个 Marker 对象是否相等
	 */
	private isMarkerEqual(marker1: Marker, marker2: Marker): boolean {
		// 比较基本字段
		if (
			marker1.id !== marker2.id ||
			marker1.elementId !== marker2.elementId ||
			marker1.relativeX !== marker2.relativeX ||
			marker1.relativeY !== marker2.relativeY ||
			marker1.selectedSuggestionIndex !== marker2.selectedSuggestionIndex ||
			marker1.error !== marker2.error
		) {
			return false
		}

		// 深度比较 result 字段
		return this.isResultEqual(marker1.result, marker2.result)
	}

	/**
	 * 深度比较两个 IdentifyImageMarkResponse 对象是否相等
	 */
	private isResultEqual(
		result1?: IdentifyImageMarkResponse,
		result2?: IdentifyImageMarkResponse,
	): boolean {
		if (result1 === result2) {
			return true
		}
		if (!result1 || !result2) {
			return false
		}

		// 使用 JSON 序列化进行深度比较
		try {
			return JSON.stringify(result1) === JSON.stringify(result2)
		} catch {
			// 如果序列化失败，使用浅比较
			return result1 === result2
		}
	}

	/**
	 * 更新标记数据
	 */
	public updateMarker(markerId: string, updates: Partial<Marker>): void {
		const marker = this.markers.find((m) => m.id === markerId)
		if (!marker) {
			return
		}

		// 保存更新前的数据副本
		const oldMarker = JSON.parse(JSON.stringify(marker))

		// 更新标记数据
		Object.assign(marker, updates)

		// 比较是否真正更新了
		if (!this.isMarkerEqual(oldMarker, marker)) {
			// 触发更新事件
			this.canvas.eventEmitter.emit({
				type: "marker:updated",
				data: { marker },
			})
		}
	}

	/**
	 * 将 markers 恢复至画布
	 */
	public restoreMarkers(markers: Marker[]): void {
		if (!markers?.length) return
		this.loadMarkers(markers)
	}

	/**
	 * 更新所有标记的缩放
	 */
	private updateAllMarkerScales(): void {
		this.markerInstances.forEach((instance) => {
			instance.updateScale()
		})
		this.canvas.markersLayer.batchDraw()
	}

	/**
	 * 重新渲染所有标记
	 */
	private renderAllMarkers(): void {
		// 清除所有现有实例
		this.markerInstances.forEach((instance) => {
			instance.destroy()
		})
		this.markerInstances.clear()

		// 重新渲染
		this.markers.forEach((marker) => {
			this.renderMarker(marker)
		})
	}

	/**
	 * 重新渲染所有标记（公共方法，用于外部调用）
	 */
	private rerenderAllMarkers(): void {
		this.renderAllMarkers()
	}

	/**
	 * 实时更新指定 Frame 内所有图片元素的 marker 位置
	 * 用于 Frame 拖拽时实时更新 marker 位置
	 * @param frameId Frame 元素 ID
	 */
	private updateMarkersForFrameRealtime(frameId: string): void {
		const frameElement = this.canvas.elementManager.getElementData(frameId)
		if (!frameElement || frameElement.type !== "frame") {
			return
		}

		// 获取 Frame 内的所有子元素
		const frameData = frameElement as FrameElement
		if (!frameData.children || frameData.children.length === 0) {
			return
		}

		// 收集 Frame 内所有图片元素的 ID
		const imageElementIds = new Set<string>()
		const collectImageIds = (elements: LayerElement[]): void => {
			for (const element of elements) {
				if (element.type === "image") {
					imageElementIds.add(element.id)
				}
				// 递归处理嵌套的 Frame 或 Group
				if ("children" in element && element.children && element.children.length > 0) {
					collectImageIds(element.children)
				}
			}
		}

		collectImageIds(frameData.children)

		// 实时更新这些图片元素的 marker 位置
		imageElementIds.forEach((imageElementId) => {
			this.updateMarkerPositionsRealtime(imageElementId)
		})
	}

	/**
	 * 重新渲染指定 Frame 内所有图片元素的 marker
	 * @param frameId Frame 元素 ID
	 */
	private rerenderMarkersForFrame(frameId: string): void {
		const frameElement = this.canvas.elementManager.getElementData(frameId)
		if (!frameElement || frameElement.type !== "frame") {
			return
		}

		// 获取 Frame 内的所有子元素
		const frameData = frameElement as FrameElement
		if (!frameData.children || frameData.children.length === 0) {
			return
		}

		// 收集 Frame 内所有图片元素的 ID
		const imageElementIds = new Set<string>()
		const collectImageIds = (elements: LayerElement[]): void => {
			for (const element of elements) {
				if (element.type === "image") {
					imageElementIds.add(element.id)
				}
				// 递归处理嵌套的 Frame 或 Group
				if ("children" in element && element.children && element.children.length > 0) {
					collectImageIds(element.children)
				}
			}
		}

		collectImageIds(frameData.children)

		// 重新渲染这些图片元素的 marker
		if (imageElementIds.size > 0) {
			// 使用 requestAnimationFrame 确保在元素更新完成后再重新渲染
			requestAnimationFrame(() => {
				this.markers.forEach((marker) => {
					if (imageElementIds.has(marker.elementId)) {
						// 销毁旧的实例
						const oldInstance = this.markerInstances.get(marker.id)
						if (oldInstance) {
							oldInstance.destroy()
							this.markerInstances.delete(marker.id)
						}
						// 重新渲染
						this.renderMarker(marker)
					}
				})
				this.canvas.markersLayer.batchDraw()
			})
		}
	}

	/**
	 * 从外部注入 markers
	 */
	public setMarkers(markers: Marker[]): void {
		this.loadMarkers(markers)
	}

	/**
	 * 加载标记数据（内部方法）
	 */
	private loadMarkers(markers: Marker[]): void {
		// 创建新数组副本，避免使用可能被冻结的数组
		// 过滤掉关联元素已被删除的marker
		const validMarkers = markers
			? markers.filter((marker) => this.canvas.elementManager.hasElement(marker.elementId))
			: []
		this.markers = validMarkers
		this.renderAllMarkers()
	}

	/**
	 * 导出标记数据
	 */
	public exportMarkers(): Marker[] {
		// 返回数组副本，避免外部修改或冻结影响内部数组
		return [...this.markers]
	}

	/**
	 * 清空所有标记
	 */
	public clear(): void {
		this.markers = []
		this.markerInstances.forEach((instance) => {
			instance.destroy()
		})
		this.markerInstances.clear()
		this.selectedMarkerId = null
		this.canvas.markersLayer.batchDraw()
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		// 清理事件监听器
		this.canvas.eventEmitter.off("tool:change")
		this.canvas.eventEmitter.off("element:deleted")
		this.canvas.eventEmitter.off("elements:transform:dragmove")
		this.canvas.eventEmitter.off("elements:transform:anchorDragmove")
		this.canvas.eventEmitter.off("snap:start")
		this.canvas.eventEmitter.off("snap:end")
		this.canvas.eventEmitter.off("element:updated")
		this.canvas.eventEmitter.off("viewport:scale")
		this.canvas.eventEmitter.off("document:restored")
		this.canvas.eventEmitter.off("element:select")
		this.canvas.eventEmitter.off("keyboard:delete")
		this.canvas.eventEmitter.off("element:created")
		this.canvas.eventEmitter.off("element:image:loaded")
		this.canvas.eventEmitter.off("frame:created")
		this.canvas.eventEmitter.off("frame:removed")
		// 清理 stage 事件监听器
		this.canvas.stage.off("click")
		// 清理 layer 事件监听器
		this.canvas.markersLayer.off("add")

		this.clear()
	}
}
