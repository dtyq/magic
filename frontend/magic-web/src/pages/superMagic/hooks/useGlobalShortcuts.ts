import { useCallback, useEffect, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { isMac } from "@/utils/devices"
import { getAllShortcutConfigs } from "../components/ShortcutKeysList/constants"
import { forcePreventDefault, normalizeKeyCombo, parseKeyboardEvent } from "../utils/shortcutUtils"
import type {
	ShortcutActions,
	UseGlobalShortcutsProps,
	ShortcutContext,
	ShortcutActionHandler,
} from "../components/ShortcutKeysList/types"

// 简化的全局注册器
class ShortcutRegistry {
	private handlers = new Map<ShortcutActions, ShortcutActionHandler[]>()
	private contextProviders = new Map<string, () => any>()
	private debounceTimers = new Map<ShortcutActions, NodeJS.Timeout>()
	private readonly DEBOUNCE_DELAY = 300 // 300ms 防抖

	// 注册快捷键处理器
	register(action: ShortcutActions, handler: ShortcutActionHandler): () => void {
		if (!this.handlers.has(action)) {
			this.handlers.set(action, [])
		}
		this.handlers.get(action)?.push(handler)

		// 返回清理函数
		return () => {
			const handlers = this.handlers.get(action)
			if (handlers) {
				const index = handlers.indexOf(handler)
				if (index > -1) {
					handlers.splice(index, 1)
				}
			}
		}
	}

	// 注册上下文提供器
	registerContext(key: string, getValue: () => any): () => void {
		this.contextProviders.set(key, getValue)
		return () => {
			this.contextProviders.delete(key)
		}
	}

	// 构建上下文
	buildContext(): ShortcutContext {
		const context: ShortcutContext = {}
		this.contextProviders.forEach((getValue, key) => {
			try {
				context[key] = getValue()
			} catch (error) {
				console.error(`Error getting context ${key}:`, error)
			}
		})
		return context
	}

	// 执行动作（带防抖，按注册顺序执行所有处理器）
	async execute(action: ShortcutActions): Promise<void> {
		const handlers = this.handlers.get(action)
		if (!handlers || handlers.length === 0) {
			return
		}

		// 清除之前的定时器
		const existingTimer = this.debounceTimers.get(action)
		if (existingTimer) {
			clearTimeout(existingTimer)
		}

		// 设置新的防抖定时器
		const timer = setTimeout(async () => {
			const context = this.buildContext()

			// 按注册顺序执行所有处理器
			for (const handler of handlers) {
				try {
					await handler(context)
				} catch (error) {
					console.error(`Error executing shortcut ${action}:`, error)
				}
			}

			// 清理定时器
			this.debounceTimers.delete(action)
		}, this.DEBOUNCE_DELAY)

		this.debounceTimers.set(action, timer)
	}

	// 检查是否有处理器
	hasHandler(action: ShortcutActions): boolean {
		const handlers = this.handlers.get(action)
		return !!(handlers && handlers.length > 0)
	}

	// 清理所有防抖定时器
	cleanup(): void {
		this.debounceTimers.forEach((timer) => {
			clearTimeout(timer)
		})
		this.debounceTimers.clear()
	}
}

// 全局实例
const shortcutRegistry = new ShortcutRegistry()

export function useGlobalShortcuts(props: UseGlobalShortcutsProps = {}) {
	const { enabled = true, onShortcutExecuted } = props
	const [isActive, setIsActive] = useState(enabled)

	// 构建快捷键映射表
	const shortcutMap = new Map()
	getAllShortcutConfigs().forEach((config) => {
		if (!config.enabled) return
		const keys = isMac ? config.mac : config.windows
		const keyCombo = normalizeKeyCombo(keys)
		shortcutMap.set(keyCombo, config)
	})

	// 匹配快捷键
	const matchShortcut = useCallback((event: KeyboardEvent) => {
		try {
			const parsed = parseKeyboardEvent(event)
			const config = shortcutMap.get(parsed.keyCombo)

			if (!config) return null

			return {
				action: config.actionId,
				keyCombo: parsed.keyCombo,
			}
		} catch (error) {
			console.error("Error matching shortcut:", error)
			return null
		}
	}, [])

	// 键盘事件处理器
	const handleKeyDown = useMemoizedFn(async (event: KeyboardEvent) => {
		if (!isActive) return

		// 匹配快捷键
		const match = matchShortcut(event)
		if (!match) return

		// 检查是否有处理器
		if (!shortcutRegistry.hasHandler(match.action)) return

		// 阻止默认行为
		forcePreventDefault(event)

		// 触发回调（立即反馈）
		if (onShortcutExecuted) {
			onShortcutExecuted(match.action, match.keyCombo)
		}

		// 执行动作（带防抖）
		await shortcutRegistry.execute(match.action)
	})

	// 状态更新
	useEffect(() => {
		setIsActive(enabled)
	}, [enabled])

	// 设置全局键盘事件监听器
	useEffect(() => {
		if (!isActive) return

		document.addEventListener("keydown", handleKeyDown, {
			passive: false,
			capture: true,
		})

		return () => {
			document.removeEventListener("keydown", handleKeyDown, { capture: true })
		}
	}, [isActive, handleKeyDown])

	// 组件卸载时清理防抖定时器
	useEffect(() => {
		return () => {
			shortcutRegistry.cleanup()
		}
	}, [])

	return {
		isActive,
		enableShortcuts: useCallback(() => setIsActive(true), []),
		disableShortcuts: useCallback(() => setIsActive(false), []),
	}
}

// 注册单个快捷键
export function useRegisterShortcut(action: ShortcutActions, handler: ShortcutActionHandler): void {
	useEffect(() => {
		const cleanup = shortcutRegistry.register(action, handler)
		return cleanup
	}, [action, handler])
}

// 注册上下文提供器
export function useRegisterContext<T>(key: string, getValue: () => T): void {
	useEffect(() => {
		const cleanup = shortcutRegistry.registerContext(key, getValue)
		return cleanup
	}, [key, getValue])
}
