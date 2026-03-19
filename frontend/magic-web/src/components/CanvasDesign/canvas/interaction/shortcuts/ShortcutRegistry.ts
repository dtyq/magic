import type { ShortcutDefinition, ModifierAlias, PlatformModifier } from "./types"

/**
 * 快捷键注册表 - 管理所有快捷键定义和跨平台适配
 */
export class ShortcutRegistry {
	private shortcuts = new Map<string, ShortcutDefinition>()
	private platform: "mac" | "windows" | "linux"

	constructor() {
		this.platform = this.detectPlatform()
	}

	/**
	 * 检测当前平台
	 */
	private detectPlatform(): "mac" | "windows" | "linux" {
		const userAgent = navigator.userAgent.toLowerCase()
		if (userAgent.includes("mac")) return "mac"
		if (userAgent.includes("win")) return "windows"
		return "linux"
	}

	/**
	 * 获取当前平台
	 */
	public getPlatform(): "mac" | "windows" | "linux" {
		return this.platform
	}

	/**
	 * 注册快捷键
	 */
	public register(definition: ShortcutDefinition): void {
		this.shortcuts.set(definition.id, definition)
	}

	/**
	 * 批量注册快捷键
	 */
	public registerAll(definitions: ShortcutDefinition[]): void {
		definitions.forEach((def) => this.register(def))
	}

	/**
	 * 获取快捷键定义
	 */
	public get(id: string): ShortcutDefinition | undefined {
		return this.shortcuts.get(id)
	}

	/**
	 * 获取所有快捷键
	 */
	public getAll(): ShortcutDefinition[] {
		return Array.from(this.shortcuts.values())
	}

	/**
	 * 根据分类获取快捷键
	 */
	public getByCategory(category: ShortcutDefinition["category"]): ShortcutDefinition[] {
		return this.getAll().filter((s) => s.category === category)
	}

	/**
	 * 将别名修饰键转换为平台特定的修饰键
	 */
	public resolvePlatformModifiers(modifiers: ModifierAlias[]): PlatformModifier[] {
		return modifiers.map((mod) => {
			if (mod === "mod") {
				return this.platform === "mac" ? "meta" : "ctrl"
			}
			return mod as PlatformModifier
		})
	}

	/**
	 * 格式化快捷键显示（用于 UI）
	 */
	public formatShortcut(definition: ShortcutDefinition): string {
		const modifiers = definition.modifiers || []
		const symbols = modifiers.map((mod) => {
			if (mod === "mod") {
				return this.platform === "mac" ? "⌘" : "Ctrl"
			}
			if (mod === "shift") return this.platform === "mac" ? "⇧" : "Shift"
			if (mod === "alt") return this.platform === "mac" ? "⌥" : "Alt"
			return mod
		})

		const keyDisplay = definition.key.toUpperCase()
		return [...symbols, keyDisplay].join(this.platform === "mac" ? "" : "+")
	}

	/**
	 * 检查事件是否匹配快捷键定义
	 */
	public matchEvent(
		definition: ShortcutDefinition,
		key: string,
		eventModifiers: PlatformModifier[],
	): boolean {
		// 检查主键
		if (definition.key.toLowerCase() !== key.toLowerCase()) {
			return false
		}

		// 解析平台特定的修饰键
		const requiredModifiers = this.resolvePlatformModifiers(definition.modifiers || [])

		// 检查修饰键数量
		if (requiredModifiers.length !== eventModifiers.length) {
			return false
		}

		// 检查每个修饰键
		return requiredModifiers.every((mod) => eventModifiers.includes(mod))
	}

	/**
	 * 根据快捷键 ID 查找匹配的定义
	 */
	public findByEvent(key: string, eventModifiers: PlatformModifier[]): ShortcutDefinition | null {
		for (const definition of this.shortcuts.values()) {
			if (this.matchEvent(definition, key, eventModifiers)) {
				return definition
			}
		}
		return null
	}
}

// 创建全局单例
export const shortcutRegistry = new ShortcutRegistry()
