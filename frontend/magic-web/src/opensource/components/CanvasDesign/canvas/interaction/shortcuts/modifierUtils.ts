/**
 * 修饰键工具函数
 * 提供统一的修饰键检查方法，支持跨平台
 */

/**
 * 检查事件是否包含 Mod 键（Mac 上是 Command，其他平台是 Ctrl）
 */
export function hasModKey(
	e: KeyboardEvent | MouseEvent | { metaKey: boolean; ctrlKey: boolean },
): boolean {
	return e.metaKey || e.ctrlKey
}

/**
 * 检查事件是否为多选操作（Mod 或 Shift）
 */
export function isMultiSelectEvent(
	e: KeyboardEvent | MouseEvent | { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean },
): boolean {
	return hasModKey(e) || e.shiftKey
}

/**
 * 检查是否按下 Shift 键
 */
export function hasShiftKey(e: KeyboardEvent | MouseEvent | { shiftKey: boolean }): boolean {
	return e.shiftKey
}

/**
 * 检查是否按下 Alt 键
 */
export function hasAltKey(e: KeyboardEvent | MouseEvent | { altKey: boolean }): boolean {
	return e.altKey
}
