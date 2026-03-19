import type { BaseTool } from "./tools/BaseTool"
import { ToolTypeEnum, type ToolType, ElementTypeEnum } from "../types"
import { SelectionTool } from "./tools/SelectionTool"
import { PanTool } from "./tools/PanTool"
import { ShapeTool } from "./tools/ShapeTool"
import { FrameTool } from "./tools/FrameTool"
import { TextTool } from "./tools/TextTool"
import { MarkerTool } from "./tools/MarkerTool"
import { ImageGeneratorTool } from "./tools/ImageGeneratorTool"
import type { Canvas } from "../Canvas"

/**
 * 工具激活来源
 */
export type ToolActivationSource = "keyboard" | "ui" | null

/**
 * 工具管理器 - 管理画布工具的激活和切换
 */
export class ToolManager {
	private canvas: Canvas

	private activeTool: BaseTool | null = null
	private previousTool: BaseTool | null = null // 记录切换工具前的工具
	private toolActivationSource: ToolActivationSource = null // 记录工具激活来源

	// 工具实例
	private selectionTool: SelectionTool
	private panTool: PanTool
	private rectTool: ShapeTool
	private ellipseTool: ShapeTool
	private triangleTool: ShapeTool
	private starTool: ShapeTool
	private frameTool: FrameTool
	private textTool: TextTool
	private markerTool: MarkerTool
	private imageGeneratorTool: ImageGeneratorTool

	/**
	 * 构造函数
	 */
	constructor(options: { canvas: Canvas }) {
		const { canvas } = options

		this.canvas = canvas

		// 创建所有工具实例
		this.selectionTool = new SelectionTool({
			canvas,
		})

		this.panTool = new PanTool({
			canvas,
		})

		this.rectTool = new ShapeTool({
			canvas,
			shapeType: ElementTypeEnum.Rectangle,
		})

		this.ellipseTool = new ShapeTool({
			canvas,
			shapeType: ElementTypeEnum.Ellipse,
		})

		this.triangleTool = new ShapeTool({
			canvas,
			shapeType: ElementTypeEnum.Triangle,
		})

		this.starTool = new ShapeTool({
			canvas,
			shapeType: ElementTypeEnum.Star,
		})

		this.frameTool = new FrameTool({
			canvas,
		})

		this.textTool = new TextTool({
			canvas,
		})

		this.markerTool = new MarkerTool({
			canvas,
		})

		this.imageGeneratorTool = new ImageGeneratorTool({
			canvas,
		})

		// 监听只读状态变化
		this.canvas.eventEmitter.on("canvas:readonly", () => {
			// 如果切换到只读模式，强制切换到选择工具
			if (
				this.canvas.readonly &&
				this.activeTool !== this.selectionTool &&
				this.activeTool !== this.panTool
			) {
				this.setActiveTool(this.selectionTool)
			}
		})

		// 激活默认工具
		const defaultToolType = ToolTypeEnum.Select
		const defaultTool = this.getToolByType(defaultToolType) || this.selectionTool
		defaultTool.activate()
		this.setActiveTool(defaultTool)
	}

	/**
	 * 根据工具类型获取工具实例
	 */
	private getToolByType(toolType: ToolType): BaseTool | null {
		switch (toolType) {
			case ToolTypeEnum.Select:
				return this.selectionTool
			case ToolTypeEnum.Hand:
				return this.panTool
			case ToolTypeEnum.Rect:
				return this.rectTool
			case ToolTypeEnum.Ellipse:
				return this.ellipseTool
			case ToolTypeEnum.Triangle:
				return this.triangleTool
			case ToolTypeEnum.Star:
				return this.starTool
			case ToolTypeEnum.Frame:
				return this.frameTool
			case ToolTypeEnum.Text:
				return this.textTool
			case ToolTypeEnum.Marker:
				return this.markerTool
			case ToolTypeEnum.ImageGenerator:
				return this.imageGeneratorTool
			default:
				return null
		}
	}

	/**
	 * 设置当前激活的工具
	 * @param tool 工具实例
	 * @param source 工具激活来源（keyboard: 快捷键, ui: UI点击）
	 */
	public setActiveTool(tool: BaseTool | null, source?: ToolActivationSource): void {
		// 如果设置的工具与当前工具相同，不做处理
		if (this.activeTool === tool) return

		// 使用 PermissionManager 统一判断：只读模式下只允许选择工具和平移工具
		if (this.canvas.readonly && tool !== this.selectionTool && tool !== this.panTool) {
			return
		}

		// 如果切换到非选择工具，取消所有元素的选中
		if (tool !== this.selectionTool && tool !== null) {
			this.canvas.selectionManager.deselectAll()
		}

		// 停用当前工具
		if (this.activeTool) {
			this.activeTool.deactivate()
		}

		// 激活新工具
		if (tool) {
			tool.activate()
			// 设置工具光标
			const cursor = tool.getCursor()
			this.canvas.cursorManager.setToolCursor(cursor)
		} else {
			// 没有工具时，恢复默认光标
			this.canvas.cursorManager.setToolCursor("default")
		}

		this.activeTool = tool
		// 记录激活来源（如果没有指定，则保持为 null）
		this.toolActivationSource = source !== undefined ? source : null
		this.emitToolChangeEvent()
	}

	/**
	 * 获取当前激活的工具
	 */
	public getActiveTool(): BaseTool | null {
		return this.activeTool
	}

	/**
	 * 获取当前工具的激活来源
	 */
	public getActivationSource(): ToolActivationSource {
		return this.toolActivationSource
	}

	/**
	 * 保存当前工具为上一个工具（用于临时工具）
	 */
	public savePreviousTool(): void {
		// 只有当没有保存过工具时才保存，避免键盘重复事件覆盖
		if (this.activeTool && !this.previousTool) {
			this.previousTool = this.activeTool
		}
	}

	/**
	 * 恢复上一个工具
	 */
	public restorePreviousTool(): void {
		if (this.previousTool) {
			// 使用 setActiveTool 来保持逻辑一致性（包括取消选中）
			this.setActiveTool(this.previousTool)
			this.previousTool = null
			// 重置激活来源
			this.toolActivationSource = null
		} else {
			this.setActiveTool(null)
		}
	}

	/**
	 * 停用当前工具（不设置新工具）
	 */
	public deactivateCurrentTool(): void {
		if (this.activeTool) {
			this.activeTool.deactivate()
			this.activeTool = null
			this.emitToolChangeEvent()
		}
	}

	/**
	 * 触发工具变化事件
	 */
	private emitToolChangeEvent(): void {
		// 将工具实例转换为工具类型标识
		let toolType: ToolType | null = null
		if (this.activeTool === this.selectionTool) {
			toolType = ToolTypeEnum.Select
		} else if (this.activeTool === this.panTool) {
			toolType = ToolTypeEnum.Hand
		} else if (this.activeTool === this.rectTool) {
			toolType = ToolTypeEnum.Rect
		} else if (this.activeTool === this.ellipseTool) {
			toolType = ToolTypeEnum.Ellipse
		} else if (this.activeTool === this.triangleTool) {
			toolType = ToolTypeEnum.Triangle
		} else if (this.activeTool === this.starTool) {
			toolType = ToolTypeEnum.Star
		} else if (this.activeTool === this.frameTool) {
			toolType = ToolTypeEnum.Frame
		} else if (this.activeTool === this.textTool) {
			toolType = ToolTypeEnum.Text
		} else if (this.activeTool === this.markerTool) {
			toolType = ToolTypeEnum.Marker
		} else if (this.activeTool === this.imageGeneratorTool) {
			toolType = ToolTypeEnum.ImageGenerator
		}

		this.canvas.eventEmitter.emit({ type: "tool:change", data: { tool: toolType } })
	}

	/**
	 * 获取选择工具
	 */
	public getSelectionTool(): SelectionTool {
		return this.selectionTool
	}

	/**
	 * 获取画布平移工具
	 */
	public getPanTool(): PanTool {
		return this.panTool
	}

	/**
	 * 获取矩形工具
	 */
	public getRectTool(): ShapeTool {
		return this.rectTool
	}

	/**
	 * 获取圆形工具
	 */
	public getEllipseTool(): ShapeTool {
		return this.ellipseTool
	}

	/**
	 * 获取三角形工具
	 */
	public getTriangleTool(): ShapeTool {
		return this.triangleTool
	}

	/**
	 * 获取星形工具
	 */
	public getStarTool(): ShapeTool {
		return this.starTool
	}

	/**
	 * 获取画框工具
	 */
	public getFrameTool(): FrameTool {
		return this.frameTool
	}

	/**
	 * 获取文本工具
	 */
	public getTextTool(): TextTool {
		return this.textTool
	}

	/**
	 * 获取标记工具
	 */
	public getMarkerTool(): MarkerTool {
		return this.markerTool
	}

	/**
	 * 获取图像生成工具
	 */
	public getImageGeneratorTool(): ImageGeneratorTool {
		return this.imageGeneratorTool
	}

	/**
	 * 根据工具类型设置激活的工具
	 * @param toolType 工具类型
	 * @param source 工具激活来源
	 */
	public setActiveToolByType(toolType: ToolType, source?: ToolActivationSource): void {
		const tool = this.getToolByType(toolType)
		if (tool) {
			this.setActiveTool(tool, source)
		}
	}

	/**
	 * 切换到选择工具
	 * 这是一个便捷方法，用于工具完成任务后切换回选择工具
	 */
	public switchToSelection(): void {
		this.setActiveTool(this.selectionTool)
	}

	/**
	 * 获取工具名称（用于调试和日志）
	 */
	private getToolName(tool: BaseTool): string {
		return tool.getMetadata().name
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		// 移除事件监听器
		this.canvas.eventEmitter.off("canvas:readonly")

		if (this.activeTool) {
			this.activeTool.deactivate()
		}
		this.activeTool = null
		this.previousTool = null
		this.toolActivationSource = null

		// 销毁所有工具实例
		this.selectionTool.destroy()
		this.panTool.destroy()
		this.rectTool.destroy()
		this.ellipseTool.destroy()
		this.triangleTool.destroy()
		this.starTool.destroy()
		this.frameTool.destroy()
		this.textTool.destroy()
		this.markerTool.destroy()
		this.imageGeneratorTool.destroy()
	}
}
