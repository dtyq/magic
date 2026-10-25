import type { Canvas } from "../core/Canvas"

/**
 * 用户动作分类
 */
export type UserActionCategory =
	| "edit" // 编辑操作
	| "layer" // 层级操作
	| "frame" // 画框操作
	| "element" // 元素状态操作
	| "align" // 对齐操作
	| "distribute" // 分布操作
	| "selection" // 选择操作
	| "view" // 视图操作
	| "conversation" // 对话操作
	| "download" // 下载操作

/**
 * 编辑操作的选项
 */
export interface EditActionOptions {
	/** 粘贴位置（用于 edit.paste 操作） */
	pastePosition?: { x: number; y: number }
	/** 剪贴板事件（用于 edit.paste 操作） */
	clipboardEvent?: ClipboardEvent
	/** 粘贴入口来源：快捷键或菜单按钮 */
	pasteSource?: "keyboard" | "menu"
}

export interface DuplicateActionOptions {
	/** 菜单打开时固定目标；快捷键省略时使用当前选区。 */
	elementIds?: string[]
}

/**
 * 创建画框操作的选项
 */
export interface FrameCreateActionOptions {
	/** 显式覆盖默认的动态内容边距；未传入时由 Frame 创建入口按内容短边的 8% 计算 */
	boundsExpansion?: number
}

/**
 * 视图操作的选项
 */
export interface ViewActionOptions {
	/** 要定位的元素ID数组（用于 view.focus-element 操作） */
	elementIds?: string[]
}

export interface LocateProjectFileActionOptions {
	/** 要定位项目文件的媒体元素 ID；省略时回退到当前单选元素 */
	elementId?: string
}

export interface ImageDiscardActionOptions {
	discarded: boolean
	/** 菜单打开时固定目标版本，执行时不重新解释当前选择。 */
	targets: Array<{ elementId: string; contentId: string }>
}

export interface DeleteImageFileActionOptions {
	/** 右键菜单打开时记录的目标元素；执行前仍会重新读取元素数据。 */
	elementId?: string
}

export interface DownloadActionOptions {
	/** default 对齐项目文件下载；normal 仅用于 AI 图片带水印下载。 */
	downloadMode?: "default" | "normal"
}

/** Automatic arrangement mode selected from the element tool menu. */
export interface ArrangeActionOptions {
	mode: "smart" | "layered" | "type-group" | "compact-grid" | "horizontal-row" | "vertical-column"
}

/**
 * 根据动作 ID 映射到对应的选项类型
 */
export interface UserActionOptionsMap {
	"image.set-discarded": ImageDiscardActionOptions
	"edit.duplicate": DuplicateActionOptions
	"edit.paste": EditActionOptions
	"frame.create": FrameCreateActionOptions
	"view.focus-element": ViewActionOptions
	"view.locate-project-file": LocateProjectFileActionOptions
	"edit.delete-image-file": DeleteImageFileActionOptions
	"download.image": DownloadActionOptions
	"download.image-no-watermark": DownloadActionOptions
	"download.frame": DownloadActionOptions
	"distribute.arrange": ArrangeActionOptions
}

/**
 * 用户动作接口（泛型版本，支持类型安全的选项）
 */
export interface UserAction<
	TId extends string = string,
	TOptions = TId extends keyof UserActionOptionsMap ? UserActionOptionsMap[TId] : undefined,
> {
	/** 动作唯一标识，与快捷键ID保持一致 */
	id: TId

	/** 动作分类 */
	category: UserActionCategory

	/** 判断当前是否可执行 */
	canExecute: (canvas: Canvas, options?: TOptions) => boolean

	/** 执行动作 */
	execute: (canvas: Canvas, options?: TOptions) => void | Promise<void>

	/** 可选：不可执行时的原因提示 */
	getDisabledReason?: (canvas: Canvas) => string | null
}
