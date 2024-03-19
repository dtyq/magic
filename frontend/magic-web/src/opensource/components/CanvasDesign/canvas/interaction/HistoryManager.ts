import type { CanvasDocument } from "../types"
import type { Canvas } from "../Canvas"

/**
 * 历史记录项
 */
interface HistoryItem {
	/** 文档快照 */
	snapshot: CanvasDocument
	/** 时间戳 */
	timestamp: number
}

/**
 * 历史管理器 - 管理撤销/恢复功能
 * 职责：
 * 1. 记录画布状态快照
 * 2. 提供撤销/恢复功能
 * 3. 管理历史记录栈
 *
 * 设计：使用单一历史栈 + 当前索引指针
 * - historyStack[0...currentIndex] 是可以撤销的历史
 * - historyStack[currentIndex+1...end] 是可以恢复的历史
 */
export class HistoryManager {
	private canvas: Canvas
	private maxHistorySize: number = 50

	/** 历史栈 - 存储所有历史状态 */
	private historyStack: HistoryItem[] = []

	/** 当前历史位置索引 */
	private currentIndex = -1

	/** 是否正在应用历史记录（避免在应用历史时再次记录） */
	private isApplyingHistory = false

	/** 是否启用历史记录 */
	private isEnabled = true

	/** 防抖定时器 */
	private debounceTimer: number | null = null

	/** 防抖延迟（毫秒） */
	private debounceDelay = 300

	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas

		this.setupEventListeners()
	}

	/**
	 * 设置事件监听
	 */
	private setupEventListeners(): void {
		// 监听需要立即记录历史的事件（创建和删除）
		this.canvas.eventEmitter.on("element:created", () => {
			this.recordHistoryImmediate()
		})

		this.canvas.eventEmitter.on("element:deleted", () => {
			this.recordHistoryImmediate()
		})

		// 监听需要防抖记录历史的事件（更新）
		this.canvas.eventEmitter.on("element:updated", () => {
			this.recordHistoryDebounced()
		})

		// 监听批量更新完成事件
		this.canvas.eventEmitter.on("element:batchupdated", () => {
			this.recordHistoryImmediate()
		})

		// 监听撤销/恢复快捷键
		this.canvas.eventEmitter.on("keyboard:undo", () => {
			this.canvas.userActionRegistry.execute("edit.undo")
		})

		this.canvas.eventEmitter.on("keyboard:redo", () => {
			this.canvas.userActionRegistry.execute("edit.redo")
		})
	}

	/**
	 * 立即记录当前状态到历史
	 */
	public recordHistoryImmediate(): void {
		// 清除防抖定时器
		if (this.debounceTimer !== null) {
			window.clearTimeout(this.debounceTimer)
			this.debounceTimer = null
		}

		this.doRecordHistory()
	}

	/**
	 * 防抖记录历史
	 */
	public recordHistoryDebounced(): void {
		if (!this.isEnabled || this.isApplyingHistory) {
			return
		}

		// 清除之前的定时器
		if (this.debounceTimer !== null) {
			window.clearTimeout(this.debounceTimer)
		}

		// 设置新的定时器
		this.debounceTimer = window.setTimeout(() => {
			this.doRecordHistory()
			this.debounceTimer = null
		}, this.debounceDelay)
	}

	/**
	 * 执行记录历史的核心逻辑
	 */
	private doRecordHistory(): void {
		if (!this.isEnabled || this.isApplyingHistory) {
			return
		}

		// 获取当前文档快照（包含临时元素，以便撤销时能正确恢复）
		const snapshot = this.canvas.elementManager.exportDocument({ includeTemporary: true })

		// 创建历史记录项
		const historyItem: HistoryItem = {
			snapshot,
			timestamp: Date.now(),
		}

		// 如果当前不在历史栈的末尾，删除后面的所有历史（新操作会清除"未来"）
		if (this.currentIndex < this.historyStack.length - 1) {
			this.historyStack = this.historyStack.slice(0, this.currentIndex + 1)
		}

		// 添加新的历史记录
		this.historyStack.push(historyItem)
		this.currentIndex = this.historyStack.length - 1

		// 限制栈大小
		if (this.historyStack.length > this.maxHistorySize) {
			this.historyStack.shift()
			this.currentIndex--
		}

		// 发布历史状态变化事件
		this.emitHistoryStateChange()
	}

	/**
	 * 撤销
	 */
	public undo(): void {
		if (!this.canUndo()) {
			return
		}

		// 如果有待处理的防抖记录，先执行（确保最新的修改被记录）
		if (this.debounceTimer !== null) {
			window.clearTimeout(this.debounceTimer)
			this.debounceTimer = null
			this.doRecordHistory()
		}

		// 回退到上一个状态
		this.currentIndex--
		const previousItem = this.historyStack[this.currentIndex]

		if (previousItem) {
			this.applyHistoryItem(previousItem)
		}

		// 发布历史状态变化事件
		this.emitHistoryStateChange()
	}

	/**
	 * 恢复
	 */
	public redo(): void {
		if (!this.canRedo()) {
			return
		}

		// 前进到下一个状态
		this.currentIndex++
		const nextItem = this.historyStack[this.currentIndex]

		if (nextItem) {
			this.applyHistoryItem(nextItem)
		}

		// 发布历史状态变化事件
		this.emitHistoryStateChange()
	}

	/**
	 * 应用历史记录项
	 */
	private applyHistoryItem(item: HistoryItem): void {
		this.isApplyingHistory = true

		try {
			// 使用智能加载，只更新变化的元素，避免全量重新渲染
			this.canvas.elementManager.loadDocumentSmart(item.snapshot)

			// 触发选中元素位置更新
			// 因为 loadDocument 使用批量模式，不会触发 element:updated 事件
			// 所以需要手动触发 element:select 事件来更新选中元素的位置信息和 Transformer
			const selectedIds = this.canvas.selectionManager.getSelectedIds()
			if (selectedIds.length > 0) {
				this.canvas.eventEmitter.emit({
					type: "element:select",
					data: { elementIds: selectedIds },
				})
			}
		} finally {
			this.isApplyingHistory = false
		}
	}

	/**
	 * 是否可以撤销
	 */
	public canUndo(): boolean {
		return this.currentIndex > 0
	}

	/**
	 * 是否可以恢复
	 */
	public canRedo(): boolean {
		return this.currentIndex < this.historyStack.length - 1
	}

	/**
	 * 获取撤销栈大小
	 */
	public getUndoStackSize(): number {
		return this.currentIndex
	}

	/**
	 * 获取恢复栈大小
	 */
	public getRedoStackSize(): number {
		return this.historyStack.length - 1 - this.currentIndex
	}

	/**
	 * 清空历史记录
	 */
	public clear(): void {
		this.historyStack = []
		this.currentIndex = -1
		this.emitHistoryStateChange()
	}

	/**
	 * 启用历史记录
	 */
	public enable(): void {
		this.isEnabled = true
	}

	/**
	 * 禁用历史记录
	 */
	public disable(): void {
		this.isEnabled = false
	}

	/**
	 * 发布历史状态变化事件
	 */
	private emitHistoryStateChange(): void {
		this.canvas.eventEmitter.emit({
			type: "history:statechange",
			data: {
				canUndo: this.canUndo(),
				canRedo: this.canRedo(),
				undoStackSize: this.getUndoStackSize(),
				redoStackSize: this.getRedoStackSize(),
			},
		})
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		// 清除防抖定时器
		if (this.debounceTimer !== null) {
			window.clearTimeout(this.debounceTimer)
			this.debounceTimer = null
		}
		this.clear()
	}
}
