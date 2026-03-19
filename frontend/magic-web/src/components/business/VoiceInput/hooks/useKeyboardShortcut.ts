import {
	getAllShortcutConfigs,
	ShortcutActions,
} from "@/pages/superMagic/components/ShortcutKeysList/constants"
import { useCallback, useEffect } from "react"

export interface KeyboardShortcutConfig {
	/** 是否启用快捷键 */
	enabled?: boolean
	/** 是否禁用 */
	disabled?: boolean
	/** 快捷键组合 (默认: Mac: ⌘+Shift+E, Windows/Linux: Ctrl+Shift+E) */
	keys?: {
		key: string
		metaKey?: boolean
		ctrlKey?: boolean
		shiftKey?: boolean
		altKey?: boolean
	}
	/** 回调函数 */
	onTrigger: () => void
}

/**
 * 检测当前平台是否为 Mac
 */
function isMacPlatform(): boolean {
	return typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0
}

/**
 * 获取平台对应的快捷键显示文本
 */
export function getHotkeyDisplayText(): string {
	const shortcuts = getAllShortcutConfigs()
	const shortcut = shortcuts.find((item) => item.actionId === ShortcutActions.TOGGLE_VOICE_INPUT)
	return isMacPlatform() ? (shortcut?.mac?.join("+") ?? "") : (shortcut?.windows?.join("+") ?? "")
}

/**
 * 键盘快捷键 Hook
 * 默认支持 Mac: ⌘+Shift+E, Windows/Linux: Ctrl+Shift+E
 * 已经废弃，使用 超级麦吉的全局快捷键 代替
 */
export function useKeyboardShortcut(config: KeyboardShortcutConfig) {
	const { enabled = true, disabled = false, keys, onTrigger } = config

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (!enabled || disabled) return

			const isMac = isMacPlatform()

			// 使用自定义键位配置或默认配置
			const keyConfig = keys || {
				key: "e",
				metaKey: isMac,
				ctrlKey: !isMac,
				shiftKey: true,
				altKey: false,
			}

			// 检查按键组合是否匹配
			const isKeyMatch = event.key.toLowerCase() === keyConfig.key.toLowerCase()
			const isMetaMatch =
				keyConfig.metaKey === undefined || event.metaKey === keyConfig.metaKey
			const isCtrlMatch =
				keyConfig.ctrlKey === undefined || event.ctrlKey === keyConfig.ctrlKey
			const isShiftMatch =
				keyConfig.shiftKey === undefined || event.shiftKey === keyConfig.shiftKey
			const isAltMatch = keyConfig.altKey === undefined || event.altKey === keyConfig.altKey

			if (isKeyMatch && isMetaMatch && isCtrlMatch && isShiftMatch && isAltMatch) {
				event.preventDefault()
				event.stopPropagation()
				onTrigger()
			}
		},
		[enabled, disabled, keys, onTrigger],
	)

	// 设置键盘事件监听器
	useEffect(() => {
		if (!enabled) return

		document.addEventListener("keydown", handleKeyDown, true)

		return () => {
			document.removeEventListener("keydown", handleKeyDown, true)
		}
	}, [enabled, handleKeyDown])

	return {
		hotkeyDisplay: getHotkeyDisplayText(),
	}
}
