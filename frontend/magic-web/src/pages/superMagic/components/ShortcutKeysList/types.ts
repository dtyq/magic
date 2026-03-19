import type { ShortcutActions } from "./constants"

// 重新导出 ShortcutActions
export { ShortcutActions } from "./constants"

// 快捷键匹配结果
export interface ShortcutMatchResult {
	action: ShortcutActions
	keyCombo: string
	scope?: string
}

// 快捷键执行上下文
export interface ShortcutContext {
	currentPage?: string
	selectedWorkspace?: any
	selectedProject?: any
	selectedTopic?: any
	isInputFocused?: boolean
	// 允许动态添加上下文属性
	[key: string]: any
}

// 快捷键动作处理器函数类型
export type ShortcutActionHandler = (context: ShortcutContext) => void | Promise<void>

// 全局快捷键Hook的Props
export interface UseGlobalShortcutsProps {
	enabled?: boolean
	onShortcutExecuted?: (action: ShortcutActions, keyCombo: string) => void
}

// 键盘事件解析结果
export interface ParsedKeyboardEvent {
	key: string
	modifiers: string[]
	keyCombo: string
}

// 快捷键配置验证结果
export interface ValidationResult {
	isValid: boolean
	duplicates: string[]
	conflicts: string[]
}
