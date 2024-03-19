import type { ParsedKeyboardEvent, ValidationResult } from "../components/ShortcutKeysList/types"
import type { ShortcutKeyConfig } from "../components/ShortcutKeysList/constants"
import { logger as Logger } from "@/opensource/utils/log"

const logger = Logger.createLogger("ShortcutUtils", { enableConfig: { console: false } })

/**
 * 标准化键位组合
 * 将键位数组转换为标准化的字符串格式
 */
export function normalizeKeyCombo(keys: string[]): string {
	const modifiers: string[] = []
	const mainKeys: string[] = []

	keys.forEach((key) => {
		const normalizedKey = normalizeKey(key)
		if (isModifierKey(normalizedKey)) {
			modifiers.push(normalizedKey)
		} else {
			// 对非修饰键进行字母小写化处理
			const lowercaseKey = normalizeLetterCase(normalizedKey)
			mainKeys.push(lowercaseKey)
		}
	})

	// 修饰键排序确保一致性
	const sortedModifiers = modifiers.sort((a, b) => {
		const order = ["Ctrl", "Meta", "Alt", "Shift"]
		return order.indexOf(a) - order.indexOf(b)
	})

	// 去重
	return Array.from(new Set([...sortedModifiers, ...mainKeys])).join("+")
}

/**
 * 标准化单个按键
 * 处理不同平台和键名的差异
 */
export function normalizeKey(key: string): string {
	const keyMap: Record<string, string> = {
		// macOS修饰键符号标准化
		"⌘": "Meta",
		"⌃": "Ctrl",
		"⌥": "Alt",
		"⇧": "Shift",

		// 英文修饰键名称标准化
		Cmd: "Meta",
		Command: "Meta",
		Windows: "Meta",
		Ctrl: "Ctrl",
		Control: "Ctrl",
		Alt: "Alt",
		Option: "Alt",
		Shift: "Shift",

		// 方向键标准化
		"↑": "ArrowUp",
		"↓": "ArrowDown",
		"←": "ArrowLeft",
		"→": "ArrowRight",
		Up: "ArrowUp",
		Down: "ArrowDown",
		Left: "ArrowLeft",
		Right: "ArrowRight",

		// 特殊键标准化
		Return: "Enter",
		"↩": "Enter",
		Space: " ",
		Spacebar: " ",

		// 其他常见的macOS符号
		"⌫": "Backspace",
		"⌦": "Delete",
		"⇥": "Tab",
		"⎋": "Escape",
		"⌤": "Enter",
		"⌥⇧": "Alt+Shift",
	}

	return keyMap[key] || key
}

/**
 * 标准化字母大小写
 * 将 A-Za-z 字母统一转换为小写
 */
function normalizeLetterCase(key: string): string {
	// 检查是否为单个字母（A-Z 或 a-z）
	if (key.length === 1 && /[A-Za-z]/.test(key)) {
		return key.toLowerCase()
	}

	// 对于非字母键，保持原样
	return key
}

/**
 * 判断是否为修饰键
 */
export function isModifierKey(key: string): boolean {
	return ["Ctrl", "Meta", "Alt", "Shift"].includes(key)
}

/**
 * 解析键盘事件
 * 将 KeyboardEvent 转换为标准化的键位组合
 */
export function parseKeyboardEvent(event: KeyboardEvent): ParsedKeyboardEvent {
	const modifiers: string[] = []

	// 检测修饰键（顺序很重要）
	// 优先检查ctrlKey，因为在Mac上按⌃时ctrlKey为true
	if (event.ctrlKey) {
		modifiers.push("Ctrl")
	}

	if (event.metaKey) {
		modifiers.push("Meta")
	}

	if (event.altKey) {
		modifiers.push("Alt")
	}
	if (event.shiftKey) {
		modifiers.push("Shift")
	}

	// 处理主按键
	let key = event.key

	// 从event.code推断实际按键
	const actualKey = inferKeyFromCode(event.code)
	if (actualKey) {
		key = actualKey
		logger.log(`🔧 检测到Dead键，从code推断实际按键: ${event.code} -> ${key}`)
	} else {
		logger.warn(`⚠️ 无法从code推断按键: ${event.code}，跳过此快捷键`)
		// 如果无法推断，返回一个无效的组合
		key = "Unknown"
	}

	const keyCombo = normalizeKeyCombo([...modifiers, key])

	// 调试信息
	logger.log(`⌨️ 按键解析:`, {
		originalKey: event.key,
		code: event.code,
		inferredKey: key,
		modifiers,
		keyCombo,
		ctrlKey: event.ctrlKey,
		metaKey: event.metaKey,
		altKey: event.altKey,
		shiftKey: event.shiftKey,
	})

	return {
		key,
		modifiers,
		keyCombo,
	}
}

/**
 * 从 event.code 推断实际按键
 * 当 event.key 为 "Dead" 时使用
 */
function inferKeyFromCode(code: string): string | null {
	// 常见的键位码到键名的映射
	const codeToKeyMap: Record<string, string> = {
		KeyA: "a",
		KeyB: "b",
		KeyC: "c",
		KeyD: "d",
		KeyE: "e",
		KeyF: "f",
		KeyG: "g",
		KeyH: "h",
		KeyI: "i",
		KeyJ: "j",
		KeyK: "k",
		KeyL: "l",
		KeyM: "m",
		KeyN: "n",
		KeyO: "o",
		KeyP: "p",
		KeyQ: "q",
		KeyR: "r",
		KeyS: "s",
		KeyT: "t",
		KeyU: "u",
		KeyV: "v",
		KeyW: "w",
		KeyX: "x",
		KeyY: "y",
		KeyZ: "z",

		Digit0: "0",
		Digit1: "1",
		Digit2: "2",
		Digit3: "3",
		Digit4: "4",
		Digit5: "5",
		Digit6: "6",
		Digit7: "7",
		Digit8: "8",
		Digit9: "9",

		Space: " ",
		Enter: "Enter",
		Escape: "Escape",
		Backspace: "Backspace",
		Tab: "Tab",
		Slash: "/",

		ArrowUp: "ArrowUp",
		ArrowDown: "ArrowDown",
		ArrowLeft: "ArrowLeft",
		ArrowRight: "ArrowRight",
	}

	return codeToKeyMap[code] || null
}

/**
 * 验证快捷键配置
 * 检查是否有重复的快捷键组合
 */
export function validateShortcutConfig(configs: ShortcutKeyConfig[]): ValidationResult {
	const keyComboMap = new Map<string, ShortcutKeyConfig[]>()
	const duplicates: string[] = []

	// 分别检查 Mac 和 Windows 配置
	configs.forEach((config) => {
		if (!config.enabled) return

		// 检查 Mac 键位
		const macCombo = normalizeKeyCombo(config.mac)
		if (!keyComboMap.has(macCombo)) {
			keyComboMap.set(macCombo, [])
		}
		keyComboMap.get(macCombo)?.push(config)

		// 检查 Windows 键位
		const windowsCombo = normalizeKeyCombo(config.windows)
		if (!keyComboMap.has(windowsCombo)) {
			keyComboMap.set(windowsCombo, [])
		}
		keyComboMap.get(windowsCombo)?.push(config)
	})

	// 找出重复的键位组合
	keyComboMap.forEach((conflictConfigs, keyCombo) => {
		if (conflictConfigs.length > 1) {
			duplicates.push(keyCombo)
		}
	})

	// TODO: 可以添加系统快捷键冲突检测
	const conflicts: string[] = []

	return {
		isValid: duplicates.length === 0 && conflicts.length === 0,
		duplicates,
		conflicts,
	}
}

/**
 * 格式化快捷键组合为显示文本
 */
export function formatKeyCombo(keys: string[]): string {
	return keys.join("+")
}

/**
 * 强制阻止事件的默认行为和传播
 */
export function forcePreventDefault(event: KeyboardEvent): void {
	// 立即阻止默认行为
	event.preventDefault()
	event.stopPropagation()
	event.stopImmediatePropagation()

	// 尝试通过返回 false 进一步阻止
	return false as any
}
