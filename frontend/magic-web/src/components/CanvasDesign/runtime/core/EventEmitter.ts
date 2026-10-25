import type {
	LayerElement,
	CanvasDeviceInfo,
	ToolType,
	ToolKeyEvent,
	Marker,
	CropConfig,
	ExtendSession,
	CanvasConnection,
} from "../document/types"
import type { IdentifyImageMarkResponse } from "../../public/magic-types"
import type {
	ImageResourceVariant,
	ImageSource,
	LoadedResource,
} from "../resources/image/ImageResourceManager"
import type {
	LoadedVideoResource,
	VideoPosterSource,
} from "../resources/video/VideoResourceManager"
import type { ResourceLoadFailureReason } from "../resources/media-common/resourceLoadFailure"
import type { ConnectionOrigin } from "../shared/connectionOrigin"
import type { GenerationElementToolId } from "../element-tools/model/ElementToolTypes"
import type { CanvasAccessContext } from "../../public/props"

export type ViewportChangeSource =
	"wheel" | "gesture" | "minimap" | "programmatic" | "resize" | "restore" | "unknown"

export type ViewportChangePhase = "start" | "move" | "end"

export type CanvasElementChangePhase = "transient" | "commit"

export interface CanvasElementNameChange {
	elementId: string
	elementType: LayerElement["type"]
	oldName?: string
	newName?: string
	oldSrc?: string
	newSrc?: string
}

export interface CanvasElementChangePayload {
	elementIds?: string[]
	phase?: CanvasElementChangePhase
	nameChanges?: CanvasElementNameChange[]
}

/**
 * 画布图片拖向插件窗口时的统一事件载荷。
 *
 * start/move/end 共用这份结构，clientX/clientY 始终是当前窗口坐标，
 * 插件面板会再转换成 iframe 内部坐标。
 */
export interface CanvasImageExternalDragPayload {
	/** 拖拽起始图片元素 ID； */
	originElementId: string
	/** 本次拖拽可导出的图片元素 ID 列表； */
	imageElementIds: string[]
	/** 当前指针窗口 X 坐标 */
	clientX: number
	/** 当前指针窗口 Y 坐标 */
	clientY: number
	/** 是否以取消状态结束，例如 Escape、工具切换或多指手势打断 */
	cancelled?: boolean
}

/**
 * 事件映射接口 - 定义所有可能的事件及其数据类型
 */
export interface CanvasEventMap {
	// 缩放相关事件
	"viewport:scale": { scale: number }
	"viewport:pan": { x: number; y: number }
	"viewport:changed": {
		scale: number
		position: { x: number; y: number }
		source: ViewportChangeSource
		phase: ViewportChangePhase
	}
	"viewport:gesture": {
		active: boolean
		source: "touch-pinch" | "webkit-gesture" | "minimap"
		pointerCount?: number
	}
	"viewport:reset": void

	// 元素相关事件
	"element:select": { elementIds: string[] }
	"element:deselect": { elementIds?: string[] } | undefined
	"element:hover": { elementId: string | null }
	"element:created": { elementId: string }
	"element:updated": {
		elementId: string
		data: LayerElement
		previousData?: LayerElement
		nameChange?: CanvasElementNameChange
		historyPolicy?: "include" | "exclude"
	}
	"element:rerendered": { elementId: string; data: LayerElement } // 元素节点重新渲染（不记录历史）
	"element:deleted": { elementId: string; persistence?: "runtime-only" }
	"element:change": CanvasElementChangePayload | undefined // 任何元素变化时触发，用于触发UI更新
	"element:batchupdated": { elementIds?: string[] } | undefined // 批量更新完成事件
	"element:batchdeleted": { elementIds: string[] } // 批量删除完成事件
	"referenceImages:changed": { elementId: string } // 图片元素参考图增删（触发未引用资源清理）
	"connection:change": {
		connections: CanvasConnection[]
		changedConnectionIds?: string[]
		deletedConnectionIds?: string[]
	} // 元素业务关联线增删或恢复
	"connection:selection:change": {
		selectedConnectionIds: string[]
		addedConnectionIds?: string[]
		removedConnectionIds?: string[]
	} // 元素业务关联线选区变化
	"connection:select": { connectionId: string } // 选中元素业务关联线
	"connection:deselect": { connectionId: string } // 取消选中元素业务关联线
	"connection:menu:open": {
		origin: ConnectionOrigin
		x: number
		y: number
		canvasX: number
		canvasY: number
		source: "handle" | "drag-empty"
	} // 元素业务关联线菜单打开
	"connection:menu:close": {
		origin: ConnectionOrigin
		source: "handle" | "drag-empty"
	} // 元素业务关联线菜单关闭

	// 临时元素相关事件
	"element:temporary:converted": { elementId: string } // 临时元素转为正式元素
	"element:temporary:deleted": { elementId: string } // 临时元素被删除

	// 元素交互事件
	"element:dblclick": {
		elementId: string
		elementType: string
		clientX?: number
		clientY?: number
	}
	"canvas:dblclick": { x: number; y: number; canvasX: number; canvasY: number }
	"element:contextmenu": { elementId: string; x: number; y: number }
	/** 画布名称标签或菜单开始重命名，供 React overlay 同步输入框 */
	"element:rename-start": { elementId: string }
	/** 提交或取消画布重命名，供 React overlay 关闭输入框 */
	"element:rename-end": { elementId: string }
	"element:image:infoButtonClick": { elementId: string; contentId?: string }
	"element:video:infoButtonClick": { elementId: string }
	/** 失败态点击重新生成，交给 UI 打开编辑器并恢复草稿 */
	"element:image:retryClick": { elementId: string }
	/**
	 * 元素工具命令的 UI fallback。
	 *
	 * Result/编辑器组件可能因为资源加载、版本切换或生成状态暂时未挂载，
	 * 这时命令总线仍然需要把已捕获的目标交给对应元素的编辑器宿主，不能
	 * 依赖某个短生命周期的编辑器实例完成注册。
	 */
	"element:image:toolCommand": {
		elementId: string
		contentId?: string
		toolId: GenerationElementToolId
	}
	/** 失败态点击重新生成，交给 UI 打开编辑器并恢复草稿 */
	"element:video:retryClick": { elementId: string }
	/** 见 element:image:toolCommand。 */
	"element:video:toolCommand": {
		elementId: string
		contentId?: string
		toolId: GenerationElementToolId
	}
	/** 宿主图片类提交开始，供 UI 先隐藏编辑器（如去背景） */
	"element:image:generate-submit-started": { elementId: string }
	/** 宿主图片类提交失败或前置校验未通过，供 UI 恢复图片编辑器展示 */
	"element:image:generate-submit-failed": { elementId: string }
	/** 宿主视频类提交开始，供 UI 先隐藏编辑器 */
	"element:video:generate-submit-started": { elementId: string }
	/** 宿主 generateVideo 提交失败或前置校验未通过，供 UI 恢复生成编辑器展示 */
	"element:video:generate-submit-failed": { elementId: string }
	"element:image:fullscreenClick": { elementId: string }
	"element:video:fullscreenClick": { elementId: string }
	"element:audio:fullscreenClick": { elementId: string }
	/** 分镜上游参考图的运行时预览，不改变 Storyboard DSL 或连接。 */
	"storyboard:reference-image:preview": { path: string; crop?: CropConfig }
	"element:image:replaceClick": {
		elementId: string
		contentId: string | null
		clientX?: number
		clientY?: number
	}
	"element:image:replaceStateChanged": {
		elementId: string
		status: "idle" | "uploading" | "applying" | "error"
		source?: "local-upload" | "project-file"
		contentId?: string | null
		phase?: "uploading" | "applying"
	}
	"element:audio:replaceClick": {
		elementId: string
		clientX?: number
		clientY?: number
	}
	"element:audio:replaceStateChanged": {
		elementId: string
		status: "idle" | "uploading" | "applying" | "error"
		source?: "local-upload" | "project-file"
		contentId?: string | null
		phase?: "uploading" | "applying"
	}
	/** 媒体元素统一替换入口；contentId 在点击时捕获，避免异步上传误写其他 Content。 */
	"element:media:replaceClick": {
		elementId: string
		mediaType: "image" | "video" | "audio"
		contentId: string | null
		anchorElement?: HTMLElement
		anchorRect?: { left: number; top: number; width: number; height: number }
		clientX?: number
		clientY?: number
	}
	"element:media:replaceStateChanged": {
		elementId: string
		mediaType: "image" | "video" | "audio"
		contentId: string | null
		status: "idle" | "uploading" | "applying" | "error"
		source: "local-upload" | "project-file"
		phase?: "uploading" | "applying"
	}
	"element:image:resultUpdated": { elementId: string }
	/** 等待期限到达只刷新展示，不表示后端生成失败。 */
	"element:image:displayStateChanged": { elementId: string; contentId: string }
	"element:image:loaded": { elementId: string } // 图片加载完成事件
	"element:image:ossSrcReady": { elementId: string } // ossSrc 获取成功事件
	"text:editing-state-change": { active: boolean; elementId: string | null }
	"text:formatting-state-change": void

	// 图片资源管理器事件
	"resource:image:loaded": { path: string; resource: LoadedResource } // 图片资源加载完成事件
	"resource:image:display-loaded": {
		elementId: string
		path: string
		resource: LoadedResource
		reason: string
	} // 可见性调度触发的单个图片元素目标资源加载完成；用于 full 避免全局广播升级
	"resource:image:variant-load-failed": {
		path: string
		variant: ImageResourceVariant
		reason?: ResourceLoadFailureReason
	} // 单个图片 variant 加载失败事件；用于 low -> preview 降级，不直接驱动元素错误态
	"resource:image:load-failed": {
		path: string
		/** 与 ImageResourceManager 条目一致；便于 UI 区分文件缺失与通用加载失败 */
		reason?: ResourceLoadFailureReason
		/** refresh 失败时保留旧 decoded surface，仅使可见性请求状态失效等待重试。 */
		preservePreview?: boolean
	} // 图片资源加载失败事件
	"resource:image:will-close": {
		path?: string
		variant: ImageResourceVariant
		image: ImageSource
		reason: string
	} // 图片 decoded/native 资源即将释放；元素必须同步断开 Konva.Image 持有的 image 引用
	"resource:video:refreshed": { path: string; resource: LoadedVideoResource } // 视频资源替换后刷新完成事件
	/** 视频 poster 即将被原地释放；消费者必须先解除 Konva.Image 对 source 的引用。 */
	"resource:video:will-release": {
		path?: string
		poster: VideoPosterSource
		reason: string
	}
	"resource:video:load-failed": {
		path: string
		reason?: ResourceLoadFailureReason
		/** refresh 失败时可保留旧 poster，仅使调度状态失效并等待后续重试 */
		preservePreview?: boolean
	} // 视频换链/刷新失败（如附件已删除）
	"resource:audio:load-failed": {
		path: string
		reason?: ResourceLoadFailureReason
	} // 音频换链、预加载或刷新失败
	"resource:remote-load-deferral-released": { path: string; key: string } // 跨画布粘贴远程参考资源迁移完成/结束，允许预览重试
	"resource:released": { path: string } // 资源生命周期清理事件（供资源 URL 缓存同步）

	// 元素拖拽相关事件（单元素）
	"element:dragstart": { elementId: string }
	"element:dragmove": { elementId: string }
	"element:dragend": { elementId: string }
	"image:external-drag:start": CanvasImageExternalDragPayload
	"image:external-drag:move": CanvasImageExternalDragPayload
	"image:external-drag:end": CanvasImageExternalDragPayload

	// 元素变换相关事件（多元素 - 通过 Transformer）
	"elements:transform:dragstart": { elementIds: string[] }
	"elements:transform:dragmove": {
		elementIds: string[]
		boundingRect?: { x: number; y: number; width: number; height: number } | null
	}
	"elements:transform:dragend": { elementIds: string[] }
	"elements:transform:intentend": { elementIds: string[] }
	"elements:transform:anchorDragStart": { elementIds: string[]; activeAnchor: string }
	"elements:transform:anchorDragmove": { elementIds: string[]; activeAnchor: string }
	"elements:transform:anchorDragend": { elementIds: string[]; activeAnchor: string }

	// 框选相关事件
	"selection:start": void
	"selection:end": void

	// 选中元素位置事件
	"selection:position": {
		boundingRect: { x: number; y: number; width: number; height: number } | null
	}

	// 吸附相关事件
	"snap:start": void
	"snap:end": void

	// 画布相关事件
	"canvas:ready": void
	"canvas:resize": { width: number; height: number }
	"canvas:clear": void
	"permission:changed": CanvasAccessContext
	"content:previewChanged": { elementId?: string; contentId?: string }
	"canvas:devicechange": {
		previous: CanvasDeviceInfo
		current: CanvasDeviceInfo
	}
	"canvas:contextmenu": { x: number; y: number; canvasX: number; canvasY: number } // 画布空白区域右键菜单事件
	// 菜单只请求打开已有文件选择器；工具栏持有上传流程与创建位置快照。
	"ui:upload:request": {
		mediaType: "image" | "video" | "audio"
		position: { x: number; y: number }
	}
	"document:loaded": void // 文档加载完成事件
	"document:restored": void // 文档恢复事件（撤销/恢复时触发，用于更新 UI 状态）

	// 画框相关事件
	"frame:created": { frameId: string }
	"frame:removed": { frameId: string }

	// 标记相关事件
	"marker:before-create": { marker: Marker }
	"marker:created": { marker: Marker }
	"marker:deleted": { id: string }
	"marker:updated": { marker: Marker }
	"marker:info-start": { markerId: string }
	"marker:info-end": {
		markerId: string
		result?: IdentifyImageMarkResponse
		error?: string
	}
	"marker:restored": { markers: Marker[] } // 从 storage 恢复成功后触发

	// 工具相关事件
	"tool:change": { tool: ToolType | null }

	// 裁剪相关事件
	"crop:enter": { elementId: string } // 进入裁剪模式
	"crop:exit": { elementId: string; restored: boolean } // 退出裁剪模式
	"crop:confirmed": { elementId: string; contentId?: string } // 确认保存裁剪
	"crop:tempCropUpdate": { elementId: string; tempCrop: CropConfig } // 临时crop更新(通知面板)
	"crop:updateFromPanel": {
		// 面板更新(来自ImageCropPanel)
		elementId: string
		tempCrop: CropConfig
		isLocked?: boolean
	}
	"crop:position": {
		// 裁剪模式下元素位置(供 UI 层定位 ImageCropPanel)
		elementId: string
		boundingRect: { x: number; y: number; width: number; height: number } | null
	}

	// 扩展相关事件
	"extend:enter": { elementId: string }
	"extend:exit": { elementId: string; restored: boolean }
	"extend:confirmed": { elementId: string; session: ExtendSession }
	"extend:tempUpdate": { elementId: string; session: ExtendSession }
	"extend:updateFromPanel": { elementId: string; session: ExtendSession }
	"extend:position": {
		elementId: string
		boundingRect: { x: number; y: number; width: number; height: number } | null
	}

	// 橡皮擦相关事件
	"eraser:enter": { elementId: string } // 进入橡皮擦模式
	"eraser:exit": { elementId: string; contentId?: string; restored: boolean } // 退出橡皮擦模式
	"eraser:position": {
		// 橡皮擦模式下元素位置(供 UI 层定位 ImageEraserPanel)
		elementId: string
		boundingRect: { x: number; y: number; width: number; height: number } | null
	}
	"eraser:sessionUpdate": {
		// 橡皮擦会话状态变化（半径、撤销/重做栈等）
		elementId: string
		contentId?: string
		radius: number
		strokeCount: number
		canUndo: boolean
		canRedo: boolean
		mode: "erase" | "restore"
	}

	// 键盘事件
	"keyboard:keydown": { key: string; modifiers: string[]; originalEvent: KeyboardEvent }
	"keyboard:keyup": { key: string; modifiers: string[]; originalEvent: KeyboardEvent }
	"keyboard:delete": void
	"keyboard:tool": { key: ToolKeyEvent }
	"keyboard:escape": void
	"keyboard:zoom:in": void
	"keyboard:zoom:out": void
	"keyboard:zoom:fit": void
	"keyboard:shift:down": void
	"keyboard:shift:up": void
	"keyboard:alt:down": void
	"keyboard:alt:up": void
	"keyboard:meta:down": void
	"keyboard:meta:up": void
	"keyboard:select:all": void
	"keyboard:undo": void
	"keyboard:redo": void
	"keyboard:copy": void
	"keyboard:duplicate": void
	"keyboard:copy-png": void
	"keyboard:paste": ClipboardEvent // 传递 ClipboardEvent 以便访问剪贴板数据
	"keyboard:frame:create": void
	"keyboard:frame:remove": void
	// 层级快捷键事件
	"keyboard:layer:move-up": void
	"keyboard:layer:move-down": void
	"keyboard:layer:move-to-top": void
	"keyboard:layer:move-to-bottom": void
	// 可见性和锁定快捷键事件
	"keyboard:element:toggle-visible": void
	"keyboard:element:toggle-lock": void
	// 对齐快捷键事件
	"keyboard:align:left": void
	"keyboard:align:horizontal-center": void
	"keyboard:align:right": void
	"keyboard:align:top": void
	"keyboard:align:vertical-center": void
	"keyboard:align:bottom": void
	// 分布快捷键事件
	"keyboard:distribute:horizontal": void
	"keyboard:distribute:vertical": void
	"keyboard:distribute:auto-layout": void
	// 对话快捷键事件
	"keyboard:conversation:add-to-current": void

	// 上传中的临时元素状态
	"upload:pending-change": {
		pendingUndoCount: number
	}
	"upload:resource-pending-change": {
		paths: string[]
	}

	// 历史记录事件
	"history:statechange": {
		canUndo: boolean
		canRedo: boolean
		undoStackSize: number
		redoStackSize: number
	}
}

/**
 * 统一的事件接口 - 所有事件都必须包含 type 和 data 两个字段
 */
export type CanvasEvent<K extends keyof CanvasEventMap = keyof CanvasEventMap> = {
	type: K
	data: CanvasEventMap[K]
}

/**
 * 事件监听器类型
 */
type EventListener<T extends CanvasEvent = CanvasEvent> = (event: T) => void

/**
 * 事件发射器 - 用于 Canvas 层与 UI 层的通信
 */
export class EventEmitter<EventMap extends Record<keyof EventMap, unknown> = CanvasEventMap> {
	private listeners: Map<keyof EventMap, Set<EventListener<CanvasEvent>>> = new Map()
	/** 订阅集合未变化时复用派发快照，避免高频 viewport 事件逐帧复制全部监听器。 */
	private listenerSnapshots: Map<keyof EventMap, EventListener<CanvasEvent>[]> = new Map()

	/** 记录已触发过的事件及其数据，用于支持"订阅时如果已触发则立即执行"的功能 */
	private emittedEvents: Map<keyof EventMap, CanvasEvent> = new Map()

	/** 需要记忆的事件列表（订阅时如果已触发则立即执行） */
	private readonly memorizedEvents: Set<keyof CanvasEventMap> = new Set<keyof CanvasEventMap>([
		"canvas:ready",
		"selection:position",
		"extend:position",
	])

	/**
	 * 订阅事件
	 * @param eventType - 事件类型
	 * @param listener - 事件监听器（接收包含 type 和 data 的事件对象）
	 * @returns 取消订阅的函数
	 */
	public on<K extends keyof EventMap & keyof CanvasEventMap>(
		eventType: K,
		listener: (event: CanvasEvent<K>) => void,
	): () => void {
		if (!this.listeners.has(eventType)) {
			this.listeners.set(eventType, new Set())
		}

		const listeners = this.listeners.get(eventType)
		if (listeners) {
			listeners.add(listener as EventListener<CanvasEvent>)
			this.listenerSnapshots.delete(eventType)
		}

		// 如果特定事件已经触发过，立即执行回调
		if (
			this.memorizedEvents.has(eventType as keyof CanvasEventMap) &&
			this.emittedEvents.has(eventType)
		) {
			// 使用 setTimeout 确保异步执行，避免在订阅过程中同步执行导致的问题
			// 回调内再读取一次记忆数据：避免「退订→重订」时重放到订阅瞬间的旧 payload（例如扩展框已变大但 boundingRect 仍是旧的）
			setTimeout(() => {
				const latest = this.emittedEvents.get(eventType) as CanvasEvent<K> | undefined
				if (latest) listener(latest)
			}, 0)
		}

		// 返回取消订阅函数
		return () => {
			if (listeners) {
				listeners.delete(listener as EventListener<CanvasEvent>)
				this.listenerSnapshots.delete(eventType)
				if (listeners.size === 0) {
					this.listeners.delete(eventType)
				}
			}
		}
	}

	/**
	 * 订阅事件（只触发一次）
	 * @param eventType - 事件类型
	 * @param listener - 事件监听器（接收包含 type 和 data 的事件对象）
	 * @returns 取消订阅的函数
	 */
	public once<K extends keyof EventMap & keyof CanvasEventMap>(
		eventType: K,
		listener: (event: CanvasEvent<K>) => void,
	): () => void {
		// 如果特定事件已经触发过，立即执行回调
		if (
			this.memorizedEvents.has(eventType as keyof CanvasEventMap) &&
			this.emittedEvents.has(eventType)
		) {
			// 使用 setTimeout 确保异步执行，避免在订阅过程中同步执行导致的问题
			setTimeout(() => {
				const latest = this.emittedEvents.get(eventType) as CanvasEvent<K> | undefined
				if (latest) listener(latest)
			}, 0)
			// 返回一个空的取消订阅函数（no-op）
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			return () => {}
		}

		const wrappedListener = (event: CanvasEvent<K>) => {
			listener(event)
			unsubscribe()
		}

		const unsubscribe = this.on(eventType, wrappedListener)
		return unsubscribe
	}

	/**
	 * 取消订阅事件
	 * @param eventType - 事件类型
	 * @param listener - 事件监听器（可选，不传则取消该事件的所有监听器）
	 */
	public off<K extends keyof EventMap & keyof CanvasEventMap>(
		eventType: K,
		listener?: (event: CanvasEvent<K>) => void,
	): void {
		if (!this.listeners.has(eventType)) return

		const listeners = this.listeners.get(eventType)
		if (!listeners) return

		if (listener) {
			listeners.delete(listener as EventListener<CanvasEvent>)
			this.listenerSnapshots.delete(eventType)
			if (listeners.size === 0) {
				this.listeners.delete(eventType)
			}
		} else {
			// 如果没有指定 listener，则移除该事件的所有监听器
			this.listeners.delete(eventType)
			this.listenerSnapshots.delete(eventType)
		}
	}

	/**
	 * 发布事件
	 * @param event - 事件对象（包含 type 和 data）
	 */
	public emit<K extends keyof EventMap & keyof CanvasEventMap>(event: CanvasEvent<K>): void {
		const eventType = event.type

		// 只记录特定事件的触发状态
		if (this.memorizedEvents.has(eventType as keyof CanvasEventMap)) {
			this.emittedEvents.set(eventType, event)
		}

		const listeners = this.listeners.get(eventType)
		if (!listeners || listeners.size === 0) return

		// 快照保证派发过程中增删监听器不会改变当前轮；订阅未变化时可跨帧复用。
		let listenersCopy = this.listenerSnapshots.get(eventType)
		if (!listenersCopy) {
			listenersCopy = Array.from(listeners)
			this.listenerSnapshots.set(eventType, listenersCopy)
		}

		listenersCopy.forEach((listener) => {
			try {
				listener(event as CanvasEvent)
			} catch (error) {
				console.error(`Error in event listener for "${String(eventType)}":`, error)
			}
		})
	}

	/**
	 * 获取指定事件的监听器数量
	 * @param event - 事件名称
	 * @returns 监听器数量
	 */
	public listenerCount<K extends keyof EventMap & keyof CanvasEventMap>(event: K): number {
		return this.listeners.get(event)?.size ?? 0
	}

	/**
	 * 移除所有事件监听器
	 */
	public removeAllListeners(): void {
		this.listeners.clear()
		this.listenerSnapshots.clear()
		this.emittedEvents.clear()
	}

	/**
	 * 获取所有已注册的事件名称
	 */
	public eventNames(): Array<keyof EventMap> {
		return Array.from(this.listeners.keys())
	}
}
