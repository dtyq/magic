import type { Canvas } from "../Canvas"
import { EraserCursorRenderer } from "./EraserCursorRenderer"

/**
 * 光标类型
 */
export type CursorType =
	| "default"
	| "eraser"
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
	private eraserModeActive = false

	private eraserElementId: string | null = null
	private eraserCursorRenderer: EraserCursorRenderer | null = null

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
	}

	/**
	 * 设置工具光标
	 * @param cursor 光标类型
	 */
	public setToolCursor(cursor: CursorType): void {
		this.toolCursor = cursor
		if (!this.eraserModeActive) {
			this.setCursor(cursor)
		}
	}

	/**
	 * 恢复工具光标
	 */
	public restoreToolCursor(): void {
		if (this.eraserModeActive) {
			this.setCursor("eraser")
			return
		}
		this.setCursor(this.toolCursor)
	}

	/**
	 * 设置临时光标（用于 hover 等场景）
	 * @param cursor 光标类型
	 */
	public setTemporary(cursor: CursorType): void {
		if (this.eraserModeActive) return
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
		this.exitEraserMode()
		this.toolCursor = "default"
		this.setCursor("default")
	}

	public enterEraserMode(options: { elementId: string; radius: number }): void {
		const { elementId, radius } = options
		const shouldRecreateCursor = this.eraserElementId !== elementId
		this.eraserModeActive = true
		this.eraserElementId = elementId
		if (shouldRecreateCursor) {
			this.destroyEraserCursor()
		}
		this.ensureEraserCursor(radius)
		this.setCursor("eraser")
		this.updateEraserCursorFromStagePointer()
		this.eraserCursorRenderer?.show()
	}

	public exitEraserMode(): void {
		this.eraserModeActive = false
		this.hideEraserCursor()
		this.destroyEraserCursor()
		this.eraserElementId = null
		this.restoreToolCursor()
	}

	public updateEraserCursorPosition(point: { x: number; y: number }): void {
		if (!this.eraserElementId) return
		this.ensureEraserCursor()
		this.eraserCursorRenderer?.updatePosition(point)
	}

	public updateEraserCursorRadius(radius: number): void {
		if (!this.eraserElementId) return
		this.ensureEraserCursor(radius)
		this.eraserCursorRenderer?.updateRadius(radius)
	}

	public syncEraserCursorTransform(): void {
		this.eraserCursorRenderer?.syncTransform()
	}

	public showEraserCursor(): void {
		if (!this.eraserModeActive || !this.eraserElementId) return
		this.ensureEraserCursor()
		this.eraserCursorRenderer?.show()
		this.setCursor("eraser")
	}

	public hideEraserCursor(): void {
		this.eraserCursorRenderer?.hide()
	}

	public updateEraserCursorFromStagePointer(): void {
		this.eraserCursorRenderer?.updatePositionFromStagePointer()
	}

	private ensureEraserCursor(radius?: number): void {
		if (!this.eraserElementId) return
		if (!this.eraserCursorRenderer) {
			this.eraserCursorRenderer = new EraserCursorRenderer({
				canvas: this.canvas,
				elementId: this.eraserElementId,
			})
		}
		this.eraserCursorRenderer.ensure({ radius })
	}

	private destroyEraserCursor(): void {
		this.eraserCursorRenderer?.destroy()
		this.eraserCursorRenderer = null
	}

	/**
	 * 实际设置光标样式
	 */
	private setCursor(cursor: CursorType): void {
		const container = this.canvas.stage.container()
		if (container) {
			container.style.cursor = cursor === "eraser" ? "none" : cursor
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
