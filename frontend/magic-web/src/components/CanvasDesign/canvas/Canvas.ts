import Konva from "konva"
import type { CanvasConfig, CanvasDocument, ViewportState, ToolType } from "./types"
import { ToolTypeEnum } from "./types"
import { ViewportController } from "./interaction/ViewportController"
import { EventEmitter, type CanvasEventMap } from "./EventEmitter"
import { ElementManager } from "./element/ElementManager"
import { SelectionManager } from "./interaction/SelectionManager"
import { TransformManager } from "./interaction/TransformManager"
import { HoverManager } from "./interaction/HoverManager"
import { SelectionHighlightManager } from "./interaction/SelectionHighlightManager"
import { KeyboardManager } from "./interaction/KeyboardManager"
import { ToolManager } from "./interaction/ToolManager"
import { isMobile as defaultIsMobile } from "./utils/utils"
import { AlignmentManager } from "./interaction/AlignmentManager"
import { FrameManager } from "./interaction/FrameManager"
import { HistoryManager } from "./interaction/HistoryManager"
import { MarkerManager } from "./interaction/MarkerManager"
import { SnapGuideManager } from "./interaction/SnapGuideManager"
import { PermissionManager } from "./PermissionManager"
import { NameLabelManager } from "./interaction/NameLabelManager"
import { SizeLabelManager } from "./interaction/SizeLabelManager"
import type { TFunction } from "../context/I18nContext"
import { MagicConfigManager } from "./MagicConfigManager"
import { ClipboardManager } from "./interaction/ClipboardManager"
import { DropOverlayManager } from "./interaction/DropOverlayManager"
import { CursorManager } from "./interaction/CursorManager"
import { UserActionRegistry } from "./user-actions/UserActionRegistry"
import { BackgroundManager } from "./interaction/BackgroundManager"
import { ImageUploadManager } from "./utils/ImageUploadManager"
import { ImageResourceManager } from "./utils/ImageResourceManager"
import {
	editActions,
	layerActions,
	frameActions,
	elementActions,
	alignActions,
	distributeActions,
	selectionActions,
	viewActions,
	conversationActions,
	downloadActions,
} from "./user-actions"

/**
 * Canvas类 - 封装Konva画布的初始化和管理
 */
export class Canvas {
	public container: HTMLDivElement
	public stage: Konva.Stage

	// 五层架构的 Layer 管理（从底到顶）
	public contentLayer: Konva.Layer // 1. 内容层：用户创建的所有元素
	public selectionLayer: Konva.Layer // 2. 选择层：框选矩形和选中高亮效果
	public controlsLayer: Konva.Layer // 3. 控制层：Transformer 和 Hover 边框
	public markersLayer: Konva.Layer // 4. 标记层：图片上的 Marker 标记（在最上层，不被遮挡）
	public overlayLayer: Konva.Layer // 5. 辅助层：吸附辅助线、名称标签、尺寸标签

	public viewportController: ViewportController
	public eventEmitter: EventEmitter<CanvasEventMap>

	public permissionManager: PermissionManager
	public elementManager: ElementManager
	public selectionManager: SelectionManager
	public transformManager: TransformManager
	public hoverManager: HoverManager
	public selectionHighlightManager: SelectionHighlightManager
	public toolManager: ToolManager
	public keyboardManager: KeyboardManager
	public alignmentManager: AlignmentManager
	public frameManager: FrameManager
	public historyManager: HistoryManager
	public markerManager: MarkerManager
	public snapGuideManager: SnapGuideManager
	public nameLabelManager: NameLabelManager
	public sizeLabelManager: SizeLabelManager
	public magicConfigManager: MagicConfigManager
	public clipboardManager: ClipboardManager
	public dropOverlayManager: DropOverlayManager
	public cursorManager: CursorManager
	public userActionRegistry: UserActionRegistry
	public backgroundManager: BackgroundManager
	public imageUploadManager: ImageUploadManager
	public imageResourceManager: ImageResourceManager

	public readonly: boolean
	public isMobileDevice: boolean
	public id?: string

	public t?: TFunction

	// window 点击事件处理函数引用（用于移除监听器）
	private handleWindowClick: ((e: MouseEvent) => void) | null = null

	/**
	 * 构造函数
	 * @param config - Canvas配置
	 */
	constructor(options: CanvasConfig) {
		this.container = options.element

		this.t = options.t
		this.id = options.id

		this.readonly = options.defaultReadyonly ?? false

		this.isMobileDevice = defaultIsMobile()
		this.updateIsMobileDevice(options.getIsMobile)

		// 设置容器可以获得焦点
		this.container.tabIndex = 0
		this.container.style.outline = "none"
		// 自动获得焦点
		this.container.focus()

		// 获取容器尺寸
		const width = this.container.offsetWidth || window.innerWidth
		const height = this.container.offsetHeight || window.innerHeight

		// 创建Konva Stage
		this.stage = new Konva.Stage({
			container: this.container,
			width: width,
			height: height,
		})

		// 创建五层架构的 Layer
		this.contentLayer = new Konva.Layer({ name: "content", listening: true })
		this.selectionLayer = new Konva.Layer({ name: "selection", listening: false })
		this.markersLayer = new Konva.Layer({ name: "markers", listening: true })
		this.controlsLayer = new Konva.Layer({ name: "controls", listening: true })
		this.overlayLayer = new Konva.Layer({ name: "overlay", listening: false })

		// 按顺序添加到 Stage（从底到顶）
		this.stage.add(this.contentLayer)
		this.stage.add(this.selectionLayer)
		this.stage.add(this.controlsLayer)
		this.stage.add(this.markersLayer)
		this.stage.add(this.overlayLayer)

		// 创建事件发射器
		this.eventEmitter = new EventEmitter()

		// 初始化 MagicConfigManager
		this.magicConfigManager = new MagicConfigManager({
			canvas: this,
			config: options.magic,
		})

		// 初始化 ImageUploadManager（全局上传管理器）
		this.imageUploadManager = new ImageUploadManager({
			canvas: this,
		})

		// 初始化 ImageResourceManager（图片资源管理器，每个 Canvas 实例独立）
		this.imageResourceManager = new ImageResourceManager({
			canvas: this,
		})

		// 初始化 ClipboardManager
		this.clipboardManager = new ClipboardManager({
			canvas: this,
		})

		// 初始化 DropOverlayManager
		this.dropOverlayManager = new DropOverlayManager({
			canvas: this,
		})

		// 初始化 CursorManager（需要较早初始化，工具管理器依赖它）
		this.cursorManager = new CursorManager({
			canvas: this,
		})

		// 初始化 PermissionManager（需要最早初始化，其他管理器依赖它）
		this.permissionManager = new PermissionManager({
			canvas: this,
		})

		// 初始化 ElementManager（使用 Content Layer）
		this.elementManager = new ElementManager({
			canvas: this,
		})

		// 初始化 SelectionManager（使用 Content Layer 用于查询节点）
		this.selectionManager = new SelectionManager({
			canvas: this,
		})

		// 初始化 TransformManager（使用 Controls Layer）
		this.transformManager = new TransformManager({
			canvas: this,
		})

		// 初始化 HoverManager（使用 Controls Layer）
		this.hoverManager = new HoverManager({
			canvas: this,
		})

		// 初始化 SelectionHighlightManager（使用 Selection Layer）
		this.selectionHighlightManager = new SelectionHighlightManager({
			canvas: this,
		})

		// 初始化视口控制器
		this.viewportController = new ViewportController({
			canvas: this,
		})

		// 初始化快捷键管理器
		this.keyboardManager = new KeyboardManager({
			canvas: this,
			container: this.container,
		})

		// 初始化对齐管理器
		this.alignmentManager = new AlignmentManager({
			canvas: this,
		})

		// 初始化画框管理器
		this.frameManager = new FrameManager({
			canvas: this,
		})

		// 初始化历史管理器
		this.historyManager = new HistoryManager({
			canvas: this,
		})

		// 初始化标记管理器（使用 Markers Layer）
		this.markerManager = new MarkerManager({
			canvas: this,
		})

		// 初始化吸附引导线管理器（使用 Overlay Layer 绘制，Content Layer 获取坐标）
		this.snapGuideManager = new SnapGuideManager({
			canvas: this,
		})

		// 初始化名称标签管理器（使用共享的 Overlay Layer）
		this.nameLabelManager = new NameLabelManager({
			canvas: this,
		})

		// 初始化尺寸标签管理器（使用共享的 Overlay Layer）
		this.sizeLabelManager = new SizeLabelManager({
			canvas: this,
		})

		// 初始化工具管理器（负责创建所有工具，使用 Content Layer）
		this.toolManager = new ToolManager({
			canvas: this,
		})

		// 初始化用户动作注册表
		this.userActionRegistry = new UserActionRegistry({
			canvas: this,
		})
		this.userActionRegistry.registerAll([
			...editActions,
			...layerActions,
			...frameActions,
			...elementActions,
			...alignActions,
			...distributeActions,
			...selectionActions,
			...viewActions,
			...conversationActions,
			...downloadActions,
		])

		// 初始化背景管理器（使用 Content Layer 的最底层）
		this.backgroundManager = new BackgroundManager({
			canvas: this,
		})

		// 设置键盘事件监听
		this.setupKeyboardListeners()

		// 设置文本元素双击编辑监听
		this.setupTextDoubleClickListener()

		// 监听窗口大小变化
		this.setupResizeHandler()

		// 设置 window 点击监听（点击窗口其他地方取消选中）
		this.setupWindowClickHandler()

		// 设置画布点击时获得焦点
		this.setupCanvasFocusHandler()

		// 禁用右键菜单
		this.setupContextMenuHandler()

		// 发布画布就绪事件
		this.eventEmitter.emit({ type: "canvas:ready", data: undefined })
	}

	/**
	 * 设置元素双击监听
	 */
	private setupTextDoubleClickListener(): void {
		this.eventEmitter.on("element:dblclick", ({ data }) => {
			const { elementId, elementType } = data

			// 根据元素类型处理双击事件
			if (elementType === "text") {
				// 切换到文本工具
				this.toolManager.setActiveToolByType(ToolTypeEnum.Text)

				// 使用 setTimeout 确保工具切换完成后再进入编辑模式
				setTimeout(() => {
					this.toolManager.getTextTool().editElement(elementId)
				}, 0)
			}
		})
	}

	/**
	 * 设置窗口大小变化监听
	 */
	private setupResizeHandler(): void {
		const resizeObserver = new ResizeObserver(() => {
			this.resize()
		})

		resizeObserver.observe(this.container)
	}

	/**
	 * 设置画布点击时获得焦点
	 */
	private setupCanvasFocusHandler(): void {
		this.stage.on("mousedown", () => {
			this.container.focus()
		})
	}

	/**
	 * 禁用右键菜单
	 */
	private setupContextMenuHandler(): void {
		// 在容器上禁用右键菜单
		this.container.addEventListener("contextmenu", (e) => {
			e.preventDefault()
			return false
		})

		// 在 stage 上处理右键菜单
		this.stage.on("contextmenu", (e) => {
			e.evt.preventDefault()

			// 如果点击的是 stage 本身（空白区域），触发画布右键菜单事件
			if (e.target === this.stage) {
				const pos = this.stage.getPointerPosition()
				if (pos) {
					// 转换为画布坐标（考虑视口缩放和平移）
					const transform = this.stage.getAbsoluteTransform().copy().invert()
					const canvasPos = transform.point(pos)

					this.eventEmitter.emit({
						type: "canvas:contextmenu",
						data: {
							x: e.evt.clientX,
							y: e.evt.clientY,
							canvasX: canvasPos.x,
							canvasY: canvasPos.y,
						},
					})
				}
			}
		})
	}

	/**
	 * 设置 window 点击监听（点击窗口其他地方取消选中）
	 */
	private setupWindowClickHandler(): void {
		this.handleWindowClick = (e: MouseEvent) => {
			const target = e.target as Node

			// 检查点击的目标是否在画布容器内
			if (target && this.container.contains(target)) {
				// 点击在画布内，不处理（由 SelectionTool 处理）
				return
			}

			// 检查点击的目标是否在UI组件内（ImageMessageEditor、ElementTools、Layers、MessageHistory、Tools、ElementMenu、Zoom、MentionPanel）
			let currentNode: Node | null = target
			while (currentNode && currentNode !== document.body) {
				if (currentNode instanceof Element) {
					if (
						currentNode.hasAttribute("data-canvas-ui-component") ||
						currentNode.hasAttribute("data-mention-panel")
					) {
						// 点击在UI组件内，不取消选中
						return
					}
				}
				currentNode = currentNode.parentNode
			}

			// 点击在画布外且不在UI组件内，取消选中
			if (this.selectionManager.hasSelection()) {
				this.selectionManager.deselectAll()
			}
		}

		// 使用捕获阶段，确保在其他事件处理之前执行
		window.addEventListener("click", this.handleWindowClick, true)
	}

	/**
	 * 设置键盘事件监听
	 */
	private setupKeyboardListeners(): void {
		// 监听删除快捷键
		this.eventEmitter.on("keyboard:delete", () => {
			this.userActionRegistry.execute("edit.delete")
		})

		// 工具快捷键映射配置
		const toolKeyMap = new Map<string, { toolType: ToolType; isTemporary: boolean }>([
			["v", { toolType: ToolTypeEnum.Select, isTemporary: false }],
			["h", { toolType: ToolTypeEnum.Hand, isTemporary: false }],
			// ["t", { toolType: ToolTypeEnum.Text, isTemporary: true }],
			["f", { toolType: ToolTypeEnum.Frame, isTemporary: true }],
			["a", { toolType: ToolTypeEnum.ImageGenerator, isTemporary: false }],
			["m", { toolType: ToolTypeEnum.Marker, isTemporary: false }],
		])

		// 监听工具快捷键
		this.eventEmitter.on("keyboard:tool", ({ data }) => {
			const { key } = data

			// 处理按键释放
			if (key.endsWith("-up")) {
				const baseKey = key.replace("-up", "")

				// 空格键松开时恢复之前的工具
				if (baseKey === "space") {
					this.toolManager.restorePreviousTool()
					return
				}

				// 其他工具键：只有临时工具才在松开时切换
				const config = toolKeyMap.get(baseKey)
				if (config?.isTemporary) {
					this.toolManager.switchToSelection()
				}
				return
			}

			// 处理 Space 键（特殊临时工具）
			if (key === "space") {
				this.toolManager.savePreviousTool()
				this.toolManager.setActiveToolByType(ToolTypeEnum.Hand, "keyboard")
				return
			}

			// 处理其他工具快捷键
			const config = toolKeyMap.get(key)
			if (config) {
				if (config.isTemporary) {
					// 临时工具：保存当前工具
					this.toolManager.savePreviousTool()
				}
				this.toolManager.setActiveToolByType(config.toolType, "keyboard")
			}
		})

		// 监听 ESC 键（切换回选择工具）
		this.eventEmitter.on("keyboard:escape", () => {
			this.toolManager.switchToSelection()
		})

		// 监听缩放快捷键
		this.eventEmitter.on("keyboard:zoom:in", () => {
			this.userActionRegistry.execute("view.zoom-in")
		})

		this.eventEmitter.on("keyboard:zoom:out", () => {
			this.userActionRegistry.execute("view.zoom-out")
		})

		this.eventEmitter.on("keyboard:zoom:fit", () => {
			this.userActionRegistry.execute("view.zoom-fit")
		})

		// 监听 Shift 键（用于锁定 Transformer 宽高比）
		this.eventEmitter.on("keyboard:shift:down", () => {
			this.transformManager.setKeepRatio(true)
		})

		this.eventEmitter.on("keyboard:shift:up", () => {
			this.transformManager.setKeepRatio(false)
		})

		// 监听 Meta/Command 键（用于锁定 Transformer 宽高比）
		this.eventEmitter.on("keyboard:meta:down", () => {
			this.transformManager.setKeepRatio(true)
		})

		this.eventEmitter.on("keyboard:meta:up", () => {
			this.transformManager.setKeepRatio(false)
		})

		// 监听全选快捷键
		this.eventEmitter.on("keyboard:select:all", () => {
			this.userActionRegistry.execute("selection.select-all")
		})

		// 监听复制快捷键
		this.eventEmitter.on("keyboard:copy", () => {
			this.userActionRegistry.execute("edit.copy")
		})

		// 监听复制为 PNG 快捷键
		this.eventEmitter.on("keyboard:copy-png", () => {
			this.userActionRegistry.execute("edit.copy-png")
		})

		// 监听粘贴快捷键
		this.eventEmitter.on("keyboard:paste", async (event) => {
			await this.userActionRegistry.execute("edit.paste", { clipboardEvent: event.data })
		})

		// 监听画框快捷键
		this.eventEmitter.on("keyboard:frame:create", () => {
			this.userActionRegistry.execute("frame.create")
		})

		this.eventEmitter.on("keyboard:frame:remove", () => {
			this.userActionRegistry.execute("frame.remove")
		})

		// 监听层级移动快捷键
		this.eventEmitter.on("keyboard:layer:move-up", () => {
			this.userActionRegistry.execute("layer.move-up")
		})

		this.eventEmitter.on("keyboard:layer:move-down", () => {
			this.userActionRegistry.execute("layer.move-down")
		})

		this.eventEmitter.on("keyboard:layer:move-to-top", () => {
			this.userActionRegistry.execute("layer.move-to-top")
		})

		this.eventEmitter.on("keyboard:layer:move-to-bottom", () => {
			this.userActionRegistry.execute("layer.move-to-bottom")
		})

		// 监听可见性和锁定快捷键
		this.eventEmitter.on("keyboard:element:toggle-visible", () => {
			this.userActionRegistry.execute("element.toggle-visible")
		})

		this.eventEmitter.on("keyboard:element:toggle-lock", () => {
			this.userActionRegistry.execute("element.toggle-lock")
		})

		// 监听添加至当前对话快捷键
		this.eventEmitter.on("keyboard:conversation:add-to-current", () => {
			this.userActionRegistry.execute("conversation.add-to-current")
		})

		// 监听对齐快捷键
		this.eventEmitter.on("keyboard:align:left", () => {
			this.userActionRegistry.execute("align.left")
		})
		this.eventEmitter.on("keyboard:align:horizontal-center", () => {
			this.userActionRegistry.execute("align.horizontal-center")
		})
		this.eventEmitter.on("keyboard:align:right", () => {
			this.userActionRegistry.execute("align.right")
		})
		this.eventEmitter.on("keyboard:align:top", () => {
			this.userActionRegistry.execute("align.top")
		})
		this.eventEmitter.on("keyboard:align:vertical-center", () => {
			this.userActionRegistry.execute("align.vertical-center")
		})
		this.eventEmitter.on("keyboard:align:bottom", () => {
			this.userActionRegistry.execute("align.bottom")
		})

		// 监听分布快捷键
		this.eventEmitter.on("keyboard:distribute:horizontal", () => {
			this.userActionRegistry.execute("distribute.horizontal")
		})
		this.eventEmitter.on("keyboard:distribute:vertical", () => {
			this.userActionRegistry.execute("distribute.vertical")
		})
		this.eventEmitter.on("keyboard:distribute:auto-layout", () => {
			this.userActionRegistry.execute("distribute.auto-layout")
		})
	}

	/**
	 * 调整画布大小
	 */
	public resize(): void {
		const width = this.container.offsetWidth
		const height = this.container.offsetHeight

		this.stage.width(width)
		this.stage.height(height)
		this.stage.batchDraw()

		// 发布画布大小变化事件
		this.eventEmitter.emit({ type: "canvas:resize", data: { width, height } })
	}

	/**
	 * 获取Stage实例
	 */
	public getStage(): Konva.Stage {
		return this.stage
	}

	/**
	 * 加载文档数据
	 * @param doc - 画布文档
	 */
	public loadDocument(doc: CanvasDocument): void {
		// 禁用历史记录，避免在加载时记录
		this.historyManager.disable()

		this.elementManager.loadDocument(doc)

		// 重新启用历史记录
		this.historyManager.enable()

		// 记录初始状态
		this.historyManager.recordHistoryImmediate()

		// 初始化所有元素的名称标签
		this.nameLabelManager.initializeAllLabels()

		// 初始化所有元素的尺寸标签
		this.sizeLabelManager.initializeAllLabels()

		// 发布文档加载完成事件，通知UI层数据已更新
		this.eventEmitter.emit({ type: "document:loaded", data: undefined })
	}

	/**
	 * 导出文档数据
	 * @param options 导出选项
	 * @param options.includeTemporary 是否包含临时元素（默认 false）
	 * @returns 画布文档
	 */
	public exportDocument(options?: { includeTemporary?: boolean }): CanvasDocument {
		return this.elementManager.exportDocument(options)
	}

	/**
	 * 导出视口状态
	 * @returns 视口状态
	 */
	public exportViewport(): ViewportState {
		return {
			scale: this.viewportController.getScale(),
			x: this.stage.x(),
			y: this.stage.y(),
		}
	}

	/**
	 * 加载视口状态
	 * @param viewport 视口状态
	 */
	public loadViewport(viewport: ViewportState): void {
		this.viewportController.setScale(viewport.scale)
		this.viewportController.setPosition({ x: viewport.x, y: viewport.y })
	}

	/**
	 * 清空画布
	 */
	public clear(): void {
		this.elementManager.clear()
		this.markerManager.clear()

		// 发布画布清空事件
		this.eventEmitter.emit({ type: "canvas:clear", data: undefined })
	}

	/**
	 * 批量切换元素可见性
	 * @param visible - 目标可见性状态
	 */
	public toggleElementsVisibility(visible: boolean): void {
		const selectedIds = this.selectionManager.getSelectedIds()
		if (selectedIds.length === 0) return

		// 批量更新
		const updates = selectedIds.map((id) => ({
			id,
			data: { visible },
		}))

		this.elementManager.batchUpdate(updates)
	}

	/**
	 * 自动切换元素可见性（根据当前状态）
	 */
	public autoToggleElementsVisibility(): void {
		const selectedIds = this.selectionManager.getSelectedIds()
		if (selectedIds.length === 0) return

		// 获取所有选中元素
		const selectedElements = selectedIds
			.map((id) => this.elementManager.getElementData(id))
			.filter((el) => el !== undefined)

		// 判断是否全部可见
		const allVisible = selectedElements.every((el) => el.visible !== false)

		// 切换到相反状态
		this.toggleElementsVisibility(!allVisible)
	}

	/**
	 * 批量切换元素锁定状态
	 * @param locked - 目标锁定状态
	 */
	public toggleElementsLock(locked: boolean): void {
		const selectedIds = this.selectionManager.getSelectedIds()
		if (selectedIds.length === 0) return

		// 批量更新
		const updates = selectedIds.map((id) => ({
			id,
			data: { locked },
		}))

		this.elementManager.batchUpdate(updates)

		// 锁定元素后取消选中
		if (locked) {
			this.selectionManager.deselectAll()
		}
	}

	/**
	 * 自动切换元素锁定状态（根据当前状态）
	 */
	public autoToggleElementsLock(): void {
		const selectedIds = this.selectionManager.getSelectedIds()
		if (selectedIds.length === 0) return

		// 获取所有选中元素
		const selectedElements = selectedIds
			.map((id) => this.elementManager.getElementData(id))
			.filter((el) => el !== undefined)

		// 判断是否全部未锁定
		const allUnlocked = selectedElements.every((el) => el.locked !== true)

		// 切换到相反状态
		this.toggleElementsLock(allUnlocked)
	}

	/**
	 * 设置单个元素的锁定状态
	 * @param elementId - 元素ID
	 * @param locked - 锁定状态
	 */
	public setElementLock(elementId: string, locked: boolean): void {
		this.elementManager.update(elementId, { locked })

		// 锁定元素后，如果该元素被选中，则取消选中
		if (locked && this.selectionManager.getSelectedIds().includes(elementId)) {
			this.selectionManager.deselect(elementId)
		}
	}

	/**
	 * 设置单个元素的可见性
	 * @param elementId - 元素ID
	 * @param visible - 可见性状态
	 */
	public setElementVisible(elementId: string, visible: boolean): void {
		this.elementManager.setElementVisible(elementId, visible)
	}

	/**
	 * 删除所有选中的元素
	 */
	public deleteSelectedElements(): void {
		const selectedIds = this.selectionManager.getSelectedIds()
		if (selectedIds.length === 0) return

		// 使用 PermissionManager 过滤可删除的元素
		const deletableElementIds = selectedIds.filter((id) => {
			const elementData = this.elementManager.getElementData(id)
			return this.permissionManager.canDelete(elementData)
		})

		if (deletableElementIds.length === 0) {
			// 所有选中的元素都不可删除，不执行删除
			return
		}

		// 使用批量删除方法
		this.elementManager.batchDelete(deletableElementIds)

		// 清空选中状态
		this.selectionManager.deselectAll()
	}

	/**
	 * 设置只读状态
	 */
	public setReadonly(readonly: boolean): void {
		this.readonly = readonly

		// 更新所有元素的拖拽状态
		this.elementManager.updateAllElementsDraggable()

		// 如果切换到只读模式，清空选中状态并切换到选择工具
		if (readonly) {
			this.selectionManager.deselectAll()
			this.toolManager.setActiveToolByType(ToolTypeEnum.Select)
		}
	}

	/**
	 * 设置翻译函数
	 * @param t - 翻译函数
	 */
	public setT(t?: TFunction): void {
		this.t = t
	}

	/**
	 * 设置是否为移动设备
	 * @param isMobileDevice - 是否为移动设备
	 */
	public updateIsMobileDevice(getIsMobile?: () => boolean): void {
		this.isMobileDevice = getIsMobile ? getIsMobile() : defaultIsMobile()
	}

	/**
	 * 收集指定 Layer 中的所有节点
	 * @param layer - 要收集的 Layer 实例
	 * @returns 所有节点的数组（排除背景节点）
	 */
	public collectLayerNodes(layer: Konva.Layer): Konva.Node[] {
		const nodes: Konva.Node[] = []
		const collectRecursive = (node: Konva.Node): void => {
			// 排除背景节点
			if (node.name() === "canvas-background") {
				return
			}
			nodes.push(node)
			if (node instanceof Konva.Group) {
				node.getChildren().forEach((child) => collectRecursive(child))
			}
		}
		layer.getChildren().forEach((child) => collectRecursive(child))
		return nodes
	}

	/**
	 * 获取所有 Layer 的映射
	 * @returns Layer 名称到 Layer 实例的映射
	 */
	public getAllLayers(): Map<string, Konva.Layer> {
		return new Map([
			["content", this.contentLayer],
			["selection", this.selectionLayer],
			["markers", this.markersLayer],
			["controls", this.controlsLayer],
			["overlay", this.overlayLayer],
		])
	}

	/**
	 * 销毁画布
	 */
	public destroy(): void {
		// 移除 window 点击监听器
		if (this.handleWindowClick) {
			window.removeEventListener("click", this.handleWindowClick, true)
			this.handleWindowClick = null
		}

		// 清理所有事件监听器, 切断 Manager 之间的通信
		this.eventEmitter.removeAllListeners()

		this.dropOverlayManager.destroy()
		this.cursorManager.destroy()
		this.permissionManager.destroy()
		this.elementManager.destroy()
		this.viewportController.destroy()
		this.selectionManager.destroy()
		this.transformManager.destroy()
		this.hoverManager.destroy()
		this.toolManager.destroy()
		this.keyboardManager.destroy()
		this.alignmentManager.destroy()
		this.frameManager.destroy()
		this.historyManager.destroy()
		this.markerManager.destroy()
		this.snapGuideManager.destroy()
		this.nameLabelManager.destroy()
		this.sizeLabelManager.destroy()
		this.toolManager.destroy()
		this.backgroundManager.destroy()

		// 清理图片资源管理器
		this.imageResourceManager.destroy()
		this.stage.destroy()
	}
}
