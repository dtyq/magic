import type { CanvasDocument } from "../../document/types"
import type { Canvas } from "../../core/Canvas"

/**
 * 历史记录项
 */
interface HistoryItem {
	/** 文档快照 */
	snapshot: CanvasDocument
	/** 时间戳 */
	timestamp: number
}

export interface HistoryManagerSnapshot {
	historyStackSize: number
	currentIndex: number
	undoStackSize: number
	redoStackSize: number
	enabled: boolean
	applyingHistory: boolean
	pendingDebounce: boolean
	recordCount: number
	skippedRecordCount: number
	lastRecordDurationMs: number
	averageRecordDurationMs: number
	lastSnapshotElementCount: number
}

function now(): number {
	return typeof performance === "undefined" ? Date.now() : performance.now()
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
	private maxHistorySize: number = 30

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

	/** 正在执行的原子操作层数；事务内的事件只标记脏状态。 */
	private transactionDepth = 0
	private transactionDirty = false

	/** 防抖延迟（毫秒） */
	private debounceDelay = 300

	private recordCount = 0

	private skippedRecordCount = 0

	private lastRecordDurationMs = 0

	private totalRecordDurationMs = 0

	private lastSnapshotElementCount = 0

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

		this.canvas.eventEmitter.on("element:deleted", ({ data }) => {
			if (data.persistence === "runtime-only") return
			this.recordHistoryImmediate()
		})

		// 监听需要防抖记录历史的事件（更新）
		this.canvas.eventEmitter.on("element:updated", ({ data }) => {
			const excluded =
				data.historyPolicy === "exclude" ||
				this.canvas.elementManager.getTemporaryElementMetadata(data.elementId)
					?.historyPolicy === "exclude"
			if (excluded) {
				return
			}
			this.recordHistoryDebounced()
		})

		// 监听批量更新完成事件
		this.canvas.eventEmitter.on("element:batchupdated", () => {
			this.recordHistoryImmediate()
		})

		this.canvas.eventEmitter.on("connection:change", () => {
			this.recordHistoryImmediate()
		})

		this.canvas.eventEmitter.on("upload:pending-change", () => {
			this.emitHistoryStateChange()
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
		if (this.transactionDepth > 0) {
			this.transactionDirty = true
			return
		}
		// 清除防抖定时器
		if (this.debounceTimer !== null) {
			window.clearTimeout(this.debounceTimer)
			this.debounceTimer = null
		}

		this.doRecordHistory()
	}

	/** 文件已在服务端改名，撤销移动或尺寸时仍应使用新引用，不能恢复已不存在的旧路径。 */
	public applyExternalFileRename(
		updateDocument: (document: CanvasDocument) => CanvasDocument,
	): void {
		this.historyStack = this.historyStack.map((item) => ({
			...item,
			snapshot: updateDocument(item.snapshot),
		}))
	}

	/**
	 * 防抖记录历史
	 */
	public recordHistoryDebounced(): void {
		if (this.transactionDepth > 0) {
			this.transactionDirty = true
			return
		}
		if (!this.isEnabled || this.isApplyingHistory) {
			this.skippedRecordCount += 1
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
	 * 将一组元素/连接变更合并成一条历史记录。
	 * 回调返回 null 或 shouldRecord 返回 false 时，不产生新的历史记录。
	 */
	public runTransaction<T>(callback: () => T, shouldRecord?: (result: T) => boolean): T {
		this.transactionDepth += 1
		let result!: T
		let completed = false
		try {
			result = callback()
			completed = true
			return result
		} finally {
			this.transactionDepth -= 1
			this.completeTransaction(result, completed, shouldRecord)
		}
	}

	/**
	 * 将跨异步边界的一组元素/连接变更合并成一条历史记录。
	 *
	 * 生成提交会在请求完成后异步确认，普通 runTransaction 无法覆盖 await
	 * 之后触发的事件，因此提供异步版本复用同一事务语义。
	 */
	public async runAsyncTransaction<T>(
		callback: () => Promise<T>,
		shouldRecord?: (result: T) => boolean,
	): Promise<T> {
		this.transactionDepth += 1
		let result!: T
		let completed = false
		try {
			result = await callback()
			completed = true
			return result
		} finally {
			this.transactionDepth -= 1
			this.completeTransaction(result, completed, shouldRecord)
		}
	}

	private completeTransaction<T>(
		result: T,
		completed: boolean,
		shouldRecord?: (result: T) => boolean,
	): void {
		if (this.transactionDepth !== 0) return

		const shouldCommit = completed && (shouldRecord ? shouldRecord(result) : true)
		const shouldRecordHistory = shouldCommit && this.transactionDirty
		this.transactionDirty = false
		if (shouldRecordHistory) {
			this.recordHistoryImmediate()
		}
	}

	/**
	 * 执行记录历史的核心逻辑
	 */
	private doRecordHistory(): void {
		if (!this.isEnabled || this.isApplyingHistory) {
			this.skippedRecordCount += 1
			return
		}

		// 获取历史快照：保留上传占位，排除从未被后端确认的生成结果占位。
		const startedAt = now()
		const snapshot = this.canvas.exportDocument({ includeTemporary: true })
		const durationMs = now() - startedAt
		this.recordCount += 1
		this.lastRecordDurationMs = durationMs
		this.totalRecordDurationMs += durationMs
		this.lastSnapshotElementCount = snapshot.elements?.length ?? 0

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
		if (this.canvas.canvasFileUploadManager.cancelLatestPendingUpload()) {
			this.emitHistoryStateChange()
			return
		}

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
			this.canvas.loadDocumentSmart(item.snapshot)

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
		return this.getUndoStackSize() > 0
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
		return (
			Math.max(this.currentIndex, 0) +
			this.canvas.canvasFileUploadManager.getPendingUndoCount()
		)
	}

	/**
	 * 获取恢复栈大小
	 */
	public getRedoStackSize(): number {
		return this.historyStack.length - 1 - this.currentIndex
	}

	public getSnapshot(): HistoryManagerSnapshot {
		return {
			historyStackSize: this.historyStack.length,
			currentIndex: this.currentIndex,
			undoStackSize: this.getUndoStackSize(),
			redoStackSize: this.getRedoStackSize(),
			enabled: this.isEnabled,
			applyingHistory: this.isApplyingHistory,
			pendingDebounce: this.debounceTimer !== null,
			recordCount: this.recordCount,
			skippedRecordCount: this.skippedRecordCount,
			lastRecordDurationMs: this.lastRecordDurationMs,
			averageRecordDurationMs:
				this.recordCount > 0 ? this.totalRecordDurationMs / this.recordCount : 0,
			lastSnapshotElementCount: this.lastSnapshotElementCount,
		}
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
