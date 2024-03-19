import Konva from "konva"
import type { Canvas } from "../../Canvas"
import type { CursorType } from "../CursorManager"

/**
 * 工具配置接口
 */
export interface ToolOptions {
	canvas: Canvas
}

/**
 * 工具完成策略
 * 定义工具任务完成后的行为
 */
export const ToolCompletionStrategy = {
	/** 总是切换到选择工具 */
	ALWAYS_SWITCH_TO_SELECTION: "ALWAYS_SWITCH_TO_SELECTION",
	/** 恢复之前的工具 */
	RESTORE_PREVIOUS: "RESTORE_PREVIOUS",
	/** 保持激活状态 */
	STAY_ACTIVE: "STAY_ACTIVE",
} as const

export type ToolCompletionStrategy =
	(typeof ToolCompletionStrategy)[keyof typeof ToolCompletionStrategy]

/**
 * 工具元数据
 * 包含工具的描述信息和配置
 */
export interface ToolMetadata {
	/** 工具名称 */
	name: string
	/** 快捷键列表 */
	shortcuts?: string[]
	/** 工具描述 */
	description?: string
	/** 是否为临时工具（按住快捷键使用，松开后切换回选择工具） */
	isTemporary?: boolean
	/** 工具光标类型 */
	cursor: CursorType
}

/**
 * 工具基类
 * 所有画布工具都应该继承此类
 */
export abstract class BaseTool {
	protected canvas: Canvas
	protected toolLayer: Konva.Layer
	protected isActive = false

	constructor(options: ToolOptions) {
		const { canvas } = options
		this.canvas = canvas
		this.toolLayer = canvas.contentLayer
	}

	/**
	 * 激活工具
	 */
	public abstract activate(): void

	/**
	 * 停用工具
	 */
	public abstract deactivate(): void

	/**
	 * 检查工具是否激活
	 */
	public getIsActive(): boolean {
		return this.isActive
	}

	/**
	 * 获取工具元数据
	 * 子类应该重写此方法提供工具的描述信息
	 */
	public getMetadata(): ToolMetadata {
		return {
			name: "Unknown Tool",
			isTemporary: false,
			cursor: "default",
		}
	}

	/**
	 * 获取工具光标类型
	 */
	public getCursor(): CursorType {
		return this.getMetadata().cursor
	}

	/**
	 * 获取工具完成策略
	 * 子类可以重写此方法来定义任务完成后的行为
	 * 默认策略：总是切换到选择工具
	 */
	protected getCompletionStrategy(): ToolCompletionStrategy {
		return ToolCompletionStrategy.ALWAYS_SWITCH_TO_SELECTION
	}

	/**
	 * 任务完成时的统一处理
	 * 工具在完成任务时应该调用此方法
	 */
	protected onTaskComplete(): void {
		if (!this.canvas.toolManager) return

		// 如果是通过快捷键激活的临时工具，保持激活状态，等待按键松开
		const activationSource = this.canvas.toolManager.getActivationSource()
		if (activationSource === "keyboard" && this.getMetadata().isTemporary) {
			// 保持激活状态，不切换工具
			return
		}

		const strategy = this.getCompletionStrategy()

		switch (strategy) {
			case ToolCompletionStrategy.ALWAYS_SWITCH_TO_SELECTION:
				this.canvas.toolManager.switchToSelection()
				break
			case ToolCompletionStrategy.RESTORE_PREVIOUS:
				this.canvas.toolManager.restorePreviousTool()
				break
			case ToolCompletionStrategy.STAY_ACTIVE:
				// 不做任何切换
				break
		}
	}

	/**
	 * 销毁工具，清理资源
	 */
	public abstract destroy(): void
}
