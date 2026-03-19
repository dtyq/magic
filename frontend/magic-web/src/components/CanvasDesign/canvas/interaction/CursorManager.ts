import type { Canvas } from "../Canvas"

/**
 * 光标类型
 */
export type CursorType =
	| "default"
	| "pointer"
	| "crosshair"
	| "grab"
	| "grabbing"
	| "text"
	| "move"
	| "ew-resize"
	| "ns-resize"
	| "nwse-resize"
	| "nesw-resize"

/**
 * 光标管理器 - 统一管理画布光标状态
 *
 * 职责：
 * 1. 记录当前工具光标
 * 2. 工具激活时设置工具光标
 * 3. 工具停用时恢复工具光标
 * 4. 处理 hover 等临时光标状态
 */
export class CursorManager {
	private canvas: Canvas
	private currentCursor: CursorType = "default"
	private toolCursor: CursorType = "default" // 当前工具的光标

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
	}

	/**
	 * 设置工具光标
	 * @param cursor 光标类型
	 */
	public setToolCursor(cursor: CursorType): void {
		this.toolCursor = cursor
		this.setCursor(cursor)
	}

	/**
	 * 恢复工具光标
	 */
	public restoreToolCursor(): void {
		const cursor = this.toolCursor
		this.setCursor(cursor)
	}

	/**
	 * 设置临时光标（用于 hover 等场景）
	 * @param cursor 光标类型
	 */
	public setTemporary(cursor: CursorType): void {
		this.setCursor(cursor)
	}

	/**
	 * 获取当前工具光标类型
	 */
	public getToolCursor(): CursorType {
		return this.toolCursor
	}

	/**
	 * 重置光标管理器
	 */
	public reset(): void {
		this.toolCursor = "default"
		this.setCursor("default")
	}

	/**
	 * 实际设置光标样式
	 */
	private setCursor(cursor: CursorType): void {
		const container = this.canvas.stage.container()
		if (container) {
			container.style.cursor = cursor
			this.currentCursor = cursor
		}
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		this.reset()
	}
}
