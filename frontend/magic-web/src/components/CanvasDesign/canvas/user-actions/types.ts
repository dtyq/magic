import type { Canvas } from "../Canvas"

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
}

/**
 * 视图操作的选项
 */
export interface ViewActionOptions {
	/** 要定位的元素ID数组（用于 view.focus-element 操作） */
	elementIds?: string[]
}

/**
 * 根据动作 ID 映射到对应的选项类型
 */
export interface UserActionOptionsMap {
	"edit.paste": EditActionOptions
	"view.focus-element": ViewActionOptions
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
	canExecute: (canvas: Canvas) => boolean

	/** 执行动作 */
	execute: (canvas: Canvas, options?: TOptions) => void | Promise<void>

	/** 可选：不可执行时的原因提示 */
	getDisabledReason?: (canvas: Canvas) => string | null
}
