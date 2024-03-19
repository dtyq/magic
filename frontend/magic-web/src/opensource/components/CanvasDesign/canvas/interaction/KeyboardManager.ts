import type { Canvas } from "../Canvas"
import type { ToolKey, ToolKeyEvent } from "../types"
import { shortcutRegistry } from "./shortcuts/ShortcutRegistry"
import { SHORTCUTS } from "./shortcuts/shortcuts"
import type { PlatformModifier } from "./shortcuts/types"

/**
 * 快捷键管理器 - 监听键盘事件并分发
 */
export class KeyboardManager {
	private canvas: Canvas

	private isEnabled = false
	private container?: HTMLElement

	/** paste 事件处理函数引用 */
	private handlePaste?: (e: ClipboardEvent) => void

	/** 捕获阶段的键盘事件处理函数引用 */
	private captureKeyDownHandler?: (e: KeyboardEvent) => void

	/** 工具快捷键列表（临时工具） */
	private readonly TEMPORARY_TOOL_KEYS: ToolKey[] = ["h", "t", "f", "a", "m", "space"]

	/** 快捷键 ID 到事件类型的映射 */
	private readonly shortcutIdToEventType: Record<string, string> = {
		// 工具快捷键
		"tool.selection": "keyboard:tool",
		"tool.escape": "keyboard:escape",
		"tool.pan": "keyboard:tool",
		"tool.pan.space": "keyboard:tool",
		"tool.text": "keyboard:tool",
		"tool.frame": "keyboard:tool",
		"tool.image-generator": "keyboard:tool",
		"tool.marker": "keyboard:tool",
		// 编辑快捷键
		"edit.delete": "keyboard:delete",
		"edit.delete.backspace": "keyboard:delete",
		"edit.undo": "keyboard:undo",
		"edit.redo": "keyboard:redo",
		"edit.copy": "keyboard:copy",
		"edit.copy-png": "keyboard:copy-png",
		"edit.paste": "keyboard:paste",
		// 选择快捷键
		"selection.select-all": "keyboard:select:all",
		// 视图快捷键
		"view.zoom-in": "keyboard:zoom:in",
		"view.zoom-out": "keyboard:zoom:out",
		"view.zoom-fit": "keyboard:zoom:fit",
		// 画框快捷键
		"frame.create": "keyboard:frame:create",
		"frame.remove": "keyboard:frame:remove",
		// 层级快捷键
		"layer.move-up": "keyboard:layer:move-up",
		"layer.move-down": "keyboard:layer:move-down",
		"layer.move-to-top": "keyboard:layer:move-to-top",
		"layer.move-to-bottom": "keyboard:layer:move-to-bottom",
		// 可见性和锁定快捷键
		"element.toggle-visible": "keyboard:element:toggle-visible",
		"element.toggle-lock": "keyboard:element:toggle-lock",
		// 对话快捷键
		"conversation.add-to-current": "keyboard:conversation:add-to-current",
		// 对齐快捷键
		"align.left": "keyboard:align:left",
		"align.horizontal-center": "keyboard:align:horizontal-center",
		"align.right": "keyboard:align:right",
		"align.top": "keyboard:align:top",
		"align.vertical-center": "keyboard:align:vertical-center",
		"align.bottom": "keyboard:align:bottom",
		// 分布快捷键
		"distribute.horizontal": "keyboard:distribute:horizontal",
		"distribute.vertical": "keyboard:distribute:vertical",
		"distribute.auto-layout": "keyboard:distribute:auto-layout",
	}

	/**
	 * 构造函数
	 */
	constructor(options: { canvas: Canvas; container?: HTMLElement }) {
		const { canvas, container } = options

		this.canvas = canvas
		this.container = container

		this.handleKeyDown = this.handleKeyDown.bind(this)
		this.handleKeyUp = this.handleKeyUp.bind(this)

		// 注册所有快捷键
		shortcutRegistry.registerAll(SHORTCUTS)

		// 设置 paste 事件监听
		this.setupPasteListener()

		// 启用键盘监听
		this.enable()
	}

	/**
	 * 设置 paste 事件监听器
	 */
	private setupPasteListener(): void {
		if (!this.container) return

		this.handlePaste = (e: ClipboardEvent) => {
			// 检查是否在输入框中，如果是则不处理
			const activeElement = document.activeElement
			if (
				activeElement &&
				(activeElement instanceof HTMLInputElement ||
					activeElement instanceof HTMLTextAreaElement ||
					(activeElement instanceof HTMLElement && activeElement.isContentEditable))
			) {
				return
			}

			// 触发 keyboard:paste 事件，传递 ClipboardEvent
			// 注意：必须在 preventDefault() 之前触发，否则 clipboardData 会被清空
			this.canvas.eventEmitter.emit({
				type: "keyboard:paste",
				data: e,
			})

			// 阻止默认粘贴行为
			e.preventDefault()
		}

		this.container.addEventListener("paste", this.handlePaste)
	}

	/**
	 * 启用快捷键管理器
	 */
	public enable(): void {
		if (this.isEnabled) return
		this.isEnabled = true
		this.attachListeners()
	}

	/**
	 * 禁用快捷键管理器
	 */
	public disable(): void {
		if (!this.isEnabled) return
		this.isEnabled = false
		this.detachListeners()
	}

	/**
	 * 附加事件监听器
	 */
	private attachListeners(): void {
		if (!this.isEnabled) return
		// 添加捕获阶段的监听器，在捕获阶段处理快捷键以避免被 Radix UI ContextMenu 拦截
		this.captureKeyDownHandler = (e: KeyboardEvent) => {
			// 在捕获阶段处理快捷键，避免被 Radix UI ContextMenu 拦截
			// 只处理带修饰键的快捷键（菜单导航通常不需要修饰键）
			if ((e.metaKey || e.ctrlKey) && !e.repeat) {
				// 如果用户在输入框中，不处理
				if (this.isInputElement(e.target)) {
					return
				}

				const key = this.normalizeKey(this.getKeyFromEvent(e))
				const modifiers = this.getModifiers(e)

				// 检查是否匹配我们的快捷键
				const matchedDefinition = shortcutRegistry.findByEvent(
					key,
					modifiers as PlatformModifier[],
				)

				if (matchedDefinition && matchedDefinition.preventDefault) {
					// 阻止默认行为和传播，防止浏览器或 Radix UI 拦截
					e.preventDefault()
					e.stopImmediatePropagation()

					// 直接处理快捷键，跳过冒泡阶段的处理
					const eventType = this.shortcutIdToEventType[matchedDefinition.id]
					if (eventType) {
						this.emitShortcutEvent(eventType, key)
					}
					return
				}
			}
		}
		window.addEventListener("keydown", this.captureKeyDownHandler, true) // 捕获阶段
		window.addEventListener("keydown", this.handleKeyDown)
		window.addEventListener("keyup", this.handleKeyUp)
	}

	/**
	 * 移除事件监听器
	 */
	private detachListeners(): void {
		if (this.captureKeyDownHandler) {
			window.removeEventListener("keydown", this.captureKeyDownHandler, true)
			this.captureKeyDownHandler = undefined
		}
		window.removeEventListener("keydown", this.handleKeyDown)
		window.removeEventListener("keyup", this.handleKeyUp)
	}

	/**
	 * 处理按键按下事件
	 */
	private handleKeyDown(e: KeyboardEvent): void {
		if (!this.isEnabled) return

		// 忽略按键重复事件（按住键盘时的重复触发）
		// 所有快捷键都是一次性的，不需要持续触发
		if (e.repeat) {
			return
		}

		// 如果用户在输入框中，不处理快捷键
		if (this.isInputElement(e.target)) {
			return
		}

		// 如果设置了容器，检查容器是否有焦点或者焦点在容器内
		if (this.container) {
			const activeElement = document.activeElement
			const containsActive = this.container.contains(activeElement)
			if (activeElement !== this.container && !containsActive) {
				return
			}
		}

		// 使用 code 来检测物理按键，这样可以正确处理 Shift + 数字键的情况
		const key = this.normalizeKey(this.getKeyFromEvent(e))
		const modifiers = this.getModifiers(e)

		// 发布通用按键事件
		this.canvas.eventEmitter.emit({
			type: "keyboard:keydown",
			data: {
				key,
				modifiers,
				originalEvent: e,
			},
		})

		// 处理 Shift 键
		if (e.key === "Shift") {
			this.canvas.eventEmitter.emit({ type: "keyboard:shift:down", data: undefined })
			return
		}

		// 处理 Meta/Command 键（Mac 上是 Meta，Windows/Linux 上是 Meta 或 Ctrl）
		// 注意：只在单独按下 Meta 键时触发，不与其他键组合时触发
		if (e.key === "Meta" && !e.shiftKey && !e.altKey && !e.ctrlKey) {
			this.canvas.eventEmitter.emit({ type: "keyboard:meta:down", data: undefined })
			return
		}

		// 使用快捷键注册表查找匹配的快捷键
		const matchedDefinition = shortcutRegistry.findByEvent(key, modifiers as PlatformModifier[])

		if (matchedDefinition) {
			if (matchedDefinition.preventDefault) {
				e.preventDefault()
			}

			// 根据快捷键 ID 获取事件类型并分发
			const eventType = this.shortcutIdToEventType[matchedDefinition.id]
			if (eventType) {
				this.emitShortcutEvent(eventType, key)
			}
		}
	}

	/**
	 * 分发快捷键事件
	 */
	private emitShortcutEvent(eventType: string, key: string): void {
		// 只读模式下允许的快捷键：缩放、复制、平移工具(space)、选择工具(v)
		const allowedInReadonly = [
			"keyboard:zoom:in",
			"keyboard:zoom:out",
			"keyboard:zoom:fit",
			"keyboard:copy",
			"keyboard:copy-png",
		]

		// 只读模式下允许的工具快捷键
		const allowedToolKeys = ["space", "v", "h"]

		// 使用 PermissionManager 统一判断：只读模式下只允许部分快捷键
		if (this.canvas.readonly) {
			// 如果是工具快捷键，只允许 space(平移)、v(选择)、h(平移)
			if (eventType === "keyboard:tool" && !allowedToolKeys.includes(key)) {
				return
			}
			// 如果是其他快捷键，检查是否在允许列表中
			if (eventType !== "keyboard:tool" && !allowedInReadonly.includes(eventType)) {
				return
			}
		}

		switch (eventType) {
			case "keyboard:tool":
				this.canvas.eventEmitter.emit({
					type: "keyboard:tool",
					data: { key: key as ToolKeyEvent },
				})
				break
			case "keyboard:escape":
				this.canvas.eventEmitter.emit({ type: "keyboard:escape", data: undefined })
				break
			case "keyboard:delete":
				this.canvas.eventEmitter.emit({ type: "keyboard:delete", data: undefined })
				break
			case "keyboard:zoom:in":
				this.canvas.eventEmitter.emit({ type: "keyboard:zoom:in", data: undefined })
				break
			case "keyboard:zoom:out":
				this.canvas.eventEmitter.emit({ type: "keyboard:zoom:out", data: undefined })
				break
			case "keyboard:zoom:fit":
				this.canvas.eventEmitter.emit({ type: "keyboard:zoom:fit", data: undefined })
				break
			case "keyboard:select:all":
				this.canvas.eventEmitter.emit({ type: "keyboard:select:all", data: undefined })
				break
			case "keyboard:undo":
				this.canvas.eventEmitter.emit({ type: "keyboard:undo", data: undefined })
				break
			case "keyboard:redo":
				this.canvas.eventEmitter.emit({ type: "keyboard:redo", data: undefined })
				break
			case "keyboard:copy":
				this.canvas.eventEmitter.emit({ type: "keyboard:copy", data: undefined })
				break
			case "keyboard:copy-png":
				this.canvas.eventEmitter.emit({ type: "keyboard:copy-png", data: undefined })
				break
			case "keyboard:paste":
				// keyboard:paste 由 container 的 paste 事件监听器触发，不在这里处理
				// 这里不需要做任何事情，因为 Ctrl+V 会自动触发浏览器的 paste 事件
				break
			case "keyboard:frame:create":
				this.canvas.eventEmitter.emit({ type: "keyboard:frame:create", data: undefined })
				break
			case "keyboard:frame:remove":
				this.canvas.eventEmitter.emit({ type: "keyboard:frame:remove", data: undefined })
				break
			// 层级快捷键
			case "keyboard:layer:move-up":
				this.canvas.eventEmitter.emit({ type: "keyboard:layer:move-up", data: undefined })
				break
			case "keyboard:layer:move-down":
				this.canvas.eventEmitter.emit({ type: "keyboard:layer:move-down", data: undefined })
				break
			case "keyboard:layer:move-to-top":
				this.canvas.eventEmitter.emit({
					type: "keyboard:layer:move-to-top",
					data: undefined,
				})
				break
			case "keyboard:layer:move-to-bottom":
				this.canvas.eventEmitter.emit({
					type: "keyboard:layer:move-to-bottom",
					data: undefined,
				})
				break
			// 可见性和锁定快捷键
			case "keyboard:element:toggle-visible":
				this.canvas.eventEmitter.emit({
					type: "keyboard:element:toggle-visible",
					data: undefined,
				})
				break
			case "keyboard:element:toggle-lock":
				this.canvas.eventEmitter.emit({
					type: "keyboard:element:toggle-lock",
					data: undefined,
				})
				break
			// 对齐快捷键
			case "keyboard:align:left":
				this.canvas.eventEmitter.emit({ type: "keyboard:align:left", data: undefined })
				break
			case "keyboard:align:horizontal-center":
				this.canvas.eventEmitter.emit({
					type: "keyboard:align:horizontal-center",
					data: undefined,
				})
				break
			case "keyboard:align:right":
				this.canvas.eventEmitter.emit({ type: "keyboard:align:right", data: undefined })
				break
			case "keyboard:align:top":
				this.canvas.eventEmitter.emit({ type: "keyboard:align:top", data: undefined })
				break
			case "keyboard:align:vertical-center":
				this.canvas.eventEmitter.emit({
					type: "keyboard:align:vertical-center",
					data: undefined,
				})
				break
			case "keyboard:align:bottom":
				this.canvas.eventEmitter.emit({ type: "keyboard:align:bottom", data: undefined })
				break
			// 分布快捷键
			case "keyboard:distribute:horizontal":
				this.canvas.eventEmitter.emit({
					type: "keyboard:distribute:horizontal",
					data: undefined,
				})
				break
			case "keyboard:distribute:vertical":
				this.canvas.eventEmitter.emit({
					type: "keyboard:distribute:vertical",
					data: undefined,
				})
				break
			case "keyboard:distribute:auto-layout":
				this.canvas.eventEmitter.emit({
					type: "keyboard:distribute:auto-layout",
					data: undefined,
				})
				break
			// 对话快捷键
			case "keyboard:conversation:add-to-current":
				this.canvas.eventEmitter.emit({
					type: "keyboard:conversation:add-to-current",
					data: undefined,
				})
				break
		}
	}

	/**
	 * 处理按键释放事件
	 */
	private handleKeyUp(e: KeyboardEvent): void {
		if (!this.isEnabled) return

		// 如果用户在输入框中，不处理快捷键
		if (this.isInputElement(e.target)) {
			return
		}

		// 如果设置了容器，检查容器是否有焦点或者焦点在容器内
		if (this.container) {
			const activeElement = document.activeElement
			if (activeElement !== this.container && !this.container.contains(activeElement)) {
				return
			}
		}

		// 使用 code 来检测物理按键，这样可以正确处理 Shift + 数字键的情况
		const key = this.normalizeKey(this.getKeyFromEvent(e))
		const modifiers = this.getModifiers(e)

		// 发布通用按键释放事件
		this.canvas.eventEmitter.emit({
			type: "keyboard:keyup",
			data: {
				key,
				modifiers,
				originalEvent: e,
			},
		})

		// 处理 Shift 键
		if (e.key === "Shift") {
			this.canvas.eventEmitter.emit({ type: "keyboard:shift:up", data: undefined })
			return
		}

		// 处理 Meta/Command 键释放
		if (e.key === "Meta") {
			this.canvas.eventEmitter.emit({ type: "keyboard:meta:up", data: undefined })
			return
		}

		// 处理临时工具快捷键释放
		if (modifiers.length === 0 && this.TEMPORARY_TOOL_KEYS.includes(key as ToolKey)) {
			e.preventDefault()
			// 通过事件通知需要恢复之前的工具
			this.canvas.eventEmitter.emit({
				type: "keyboard:tool",
				data: { key: `${key}-up` as ToolKeyEvent },
			})
		}
	}

	/**
	 * 从键盘事件中获取键值
	 * 优先使用 code（物理按键），这样可以正确处理 Shift + 数字键的情况
	 * @param e 键盘事件
	 */
	private getKeyFromEvent(e: KeyboardEvent): string {
		// 对于数字键，使用 code 来检测物理按键位置
		// 例如：Shift + 1 时，e.key 可能是 "!"，但 e.code 是 "Digit1"
		if (e.code && e.code.startsWith("Digit")) {
			// 提取数字，例如 "Digit1" -> "1"
			return e.code.replace("Digit", "")
		}
		// 对于等号键，需要特殊处理
		// Shift + = 时，e.key 是 "+"，e.code 是 "Equal"
		// 直接按 = 时，e.key 是 "="，e.code 是 "Equal"
		if (e.code === "Equal") {
			// 如果按下了 Shift，返回 "+"，否则返回 "="
			return e.shiftKey ? "+" : "="
		}
		// 对于 Delete 和 Backspace 键，使用 code 来检测物理按键位置
		// 这样可以跨平台一致地处理（Mac 上 Delete 键的 e.key 是 "Backspace"）
		if (e.code === "Delete") {
			return "Delete"
		}
		if (e.code === "Backspace") {
			return "Backspace"
		}
		// 对于其他键，使用 key（这样可以正确处理特殊字符）
		return e.key
	}

	/**
	 * 标准化键值
	 * @param key 原始键值
	 */
	private normalizeKey(key: string): string {
		// 将空格键标准化为 'space'
		if (key === " ") {
			return "space"
		}
		// 处理等号键（通常与 Shift + = 组合产生 +）
		if (key === "=") {
			return "+"
		}
		return key.toLowerCase()
	}

	/**
	 * 获取修饰键数组
	 * @param e 键盘事件
	 */
	private getModifiers(e: KeyboardEvent): string[] {
		const modifiers: string[] = []
		if (e.metaKey) {
			modifiers.push("meta")
		}
		if (e.ctrlKey) {
			modifiers.push("ctrl")
		}
		if (e.shiftKey) {
			modifiers.push("shift")
		}
		if (e.altKey) {
			modifiers.push("alt")
		}
		return modifiers
	}

	/**
	 * 检查目标元素是否为输入元素
	 * @param target 目标元素
	 */
	private isInputElement(target: EventTarget | null): boolean {
		if (!target || !(target instanceof HTMLElement)) {
			return false
		}

		const tagName = target.tagName.toLowerCase()
		const isInput = tagName === "input" || tagName === "textarea"
		const isContentEditable = target.isContentEditable

		return isInput || isContentEditable
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		this.disable()

		// 移除 paste 事件监听器
		if (this.container && this.handlePaste) {
			this.container.removeEventListener("paste", this.handlePaste)
			this.handlePaste = undefined
		}
	}
}
