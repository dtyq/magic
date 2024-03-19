import type { LayerElement, ToolType, ToolKeyEvent, Marker } from "./types"
import type { IdentifyImageMarkResponse } from "../types.magic"
import type { LoadedResource } from "./utils/ImageResourceManager"

/**
 * 事件映射接口 - 定义所有可能的事件及其数据类型
 */
export interface CanvasEventMap {
	// 缩放相关事件
	"viewport:scale": { scale: number }
	"viewport:pan": { x: number; y: number }
	"viewport:reset": void

	// 元素相关事件
	"element:select": { elementIds: string[] }
	"element:deselect": void
	"element:hover": { elementId: string | null }
	"element:created": { elementId: string }
	"element:updated": { elementId: string; data: LayerElement }
	"element:rerendered": { elementId: string; data: LayerElement } // 元素节点重新渲染（不记录历史）
	"element:deleted": { elementId: string }
	"element:change": void // 任何元素变化时触发，用于触发UI更新
	"element:batchupdated": void // 批量更新完成事件
	"element:batchdeleted": { elementIds: string[] } // 批量删除完成事件
	"referenceImages:changed": { elementId: string } // 图片元素参考图增删（触发资源回收）

	// 临时元素相关事件
	"element:temporary:converted": { elementId: string } // 临时元素转为正式元素
	"element:temporary:deleted": { elementId: string } // 临时元素被删除

	// 元素交互事件
	"element:dblclick": { elementId: string; elementType: string }
	"element:contextmenu": { elementId: string; x: number; y: number }
	"element:image:infoButtonClick": { elementId: string }
	"element:image:resultUpdated": { elementId: string }
	"element:image:loaded": { elementId: string } // 图片加载完成事件
	"element:image:ossSrcReady": { elementId: string } // ossSrc 获取成功事件

	// 图片资源管理器事件
	"resource:image:loaded": { path: string; resource: LoadedResource } // 图片资源加载完成事件
	"resource:image:load-failed": { path: string } // 图片资源加载失败事件
	"resource:released": { path: string } // 资源释放事件（供缩略图服务清理缓存）

	// 元素拖拽相关事件（单元素）
	"element:dragstart": { elementId: string }
	"element:dragmove": { elementId: string }
	"element:dragend": { elementId: string }

	// 元素变换相关事件（多元素 - 通过 Transformer）
	"elements:transform:dragstart": { elementIds: string[] }
	"elements:transform:dragmove": { elementIds: string[] }
	"elements:transform:dragend": { elementIds: string[] }
	"elements:transform:anchorDragStart": { elementIds: string[]; activeAnchor: string }
	"elements:transform:anchorDragmove": { elementIds: string[]; activeAnchor: string }
	"elements:transform:anchorDragend": { elementIds: string[]; activeAnchor: string }

	// 框选相关事件
	"selection:start": void
	"selection:end": void

	// 选中元素位置事件
	"selection:position": {
		boundingRect: { x: number; y: number; width: number; height: number } | null
		elements: Array<{ elementId: string; x: number; y: number; width: number; height: number }>
	}

	// 吸附相关事件
	"snap:start": void
	"snap:end": void

	// 画布相关事件
	"canvas:ready": void
	"canvas:resize": { width: number; height: number }
	"canvas:clear": void
	"canvas:readonly": { readonly: boolean } // 只读状态变化事件
	"canvas:contextmenu": { x: number; y: number; canvasX: number; canvasY: number } // 画布空白区域右键菜单事件
	"document:loaded": void // 文档加载完成事件
	"document:restored": void // 文档恢复事件（撤销/恢复时触发，用于更新 UI 状态）

	// 画框相关事件
	"frame:created": { frameId: string }
	"frame:removed": { frameId: string }

	// 标记相关事件
	"marker:select": { id: string | null }
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
	"keyboard:meta:down": void
	"keyboard:meta:up": void
	"keyboard:select:all": void
	"keyboard:undo": void
	"keyboard:redo": void
	"keyboard:copy": void
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

	/** 记录已触发过的事件及其数据，用于支持"订阅时如果已触发则立即执行"的功能 */
	private emittedEvents: Map<keyof EventMap, CanvasEvent> = new Map()

	/** 需要记忆的事件列表（订阅时如果已触发则立即执行） */
	private readonly memorizedEvents: Set<keyof CanvasEventMap> = new Set([
		"canvas:ready",
		"selection:position",
		"resource:image:loaded",
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
		}

		// 如果特定事件已经触发过，立即执行回调
		if (
			this.memorizedEvents.has(eventType as keyof CanvasEventMap) &&
			this.emittedEvents.has(eventType)
		) {
			const event = this.emittedEvents.get(eventType) as CanvasEvent<K>
			// 使用 setTimeout 确保异步执行，避免在订阅过程中同步执行导致的问题
			setTimeout(() => listener(event), 0)
		}

		// 返回取消订阅函数
		return () => {
			if (listeners) {
				listeners.delete(listener as EventListener<CanvasEvent>)
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
			const event = this.emittedEvents.get(eventType) as CanvasEvent<K>
			// 使用 setTimeout 确保异步执行，避免在订阅过程中同步执行导致的问题
			setTimeout(() => listener(event), 0)
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
			if (listeners.size === 0) {
				this.listeners.delete(eventType)
			}
		} else {
			// 如果没有指定 listener，则移除该事件的所有监听器
			this.listeners.delete(eventType)
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

		// 复制监听器列表，避免在执行过程中被修改
		const listenersCopy = Array.from(listeners)

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
		this.emittedEvents.clear()
	}

	/**
	 * 获取所有已注册的事件名称
	 */
	public eventNames(): Array<keyof EventMap> {
		return Array.from(this.listeners.keys())
	}
}
