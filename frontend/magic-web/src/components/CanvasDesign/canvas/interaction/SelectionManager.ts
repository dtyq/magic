import { calculateNodesRect } from "../utils/utils"
import type { Canvas } from "../Canvas"

/**
 * 选中管理器 - 管理选中状态
 * 职责：
 * 1. 管理元素的选中状态
 * 2. 发出选中相关事件
 * 3. 计算并发出选中元素的位置信息
 */
export class SelectionManager {
	private canvas: Canvas

	// 选中状态管理
	private selectedIds: Set<string> = new Set()

	// 记录是否正在吸附
	private isSnapping: boolean = false

	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas
		// 设置事件监听器
		this.setupEventListeners()
	}

	/**
	 * 设置选中相关的事件监听
	 */
	private setupEventListeners(): void {
		// 监听选中事件，发出选中元素位置信息
		this.canvas.eventEmitter.on("element:select", () => {
			this.emitSelectionPosition()
		})

		// 监听取消选中事件，发出空的选中位置信息
		this.canvas.eventEmitter.on("element:deselect", () => {
			this.emitSelectionPosition()
		})

		// 处理元素变化的共享逻辑
		const handleElementChange = ({ data }: { data: { elementId: string } }) => {
			const { elementId } = data
			if (this.isSelected(elementId)) {
				// 重新发出选中事件，让 TransformManager 更新 Transformer
				const selectedIds = this.getSelectedIds()
				this.canvas.eventEmitter.emit({
					type: "element:select",
					data: { elementIds: selectedIds },
				})
			}
		}

		// 监听元素数据更新事件
		this.canvas.eventEmitter.on("element:updated", handleElementChange)

		// 监听元素重新渲染事件
		this.canvas.eventEmitter.on("element:rerendered", handleElementChange)

		// 监听拖拽移动事件，实时更新选中元素位置信息
		this.canvas.eventEmitter.on("elements:transform:dragmove", () => {
			if (this.hasSelection()) {
				this.emitSelectionPosition()
			}
		})

		// 监听缩放移动事件，实时更新选中元素位置信息
		this.canvas.eventEmitter.on("elements:transform:anchorDragmove", () => {
			if (this.hasSelection()) {
				this.emitSelectionPosition()
			}
		})

		// 监听视口变化事件，更新选中元素位置信息（用于 UI 层跟随视口移动）
		this.canvas.eventEmitter.on("viewport:scale", () => {
			if (this.hasSelection()) {
				this.emitSelectionPosition()
			}
		})

		this.canvas.eventEmitter.on("viewport:pan", () => {
			if (this.hasSelection()) {
				this.emitSelectionPosition()
			}
		})

		// 监听吸附开始事件，标记正在吸附
		this.canvas.eventEmitter.on("snap:start", () => {
			this.isSnapping = true
		})

		// 监听吸附结束事件，取消吸附标记并更新位置
		this.canvas.eventEmitter.on("snap:end", () => {
			this.isSnapping = false
			// 吸附完成后立即更新一次位置
			if (this.hasSelection()) {
				this.emitSelectionPosition()
			}
		})

		// 监听元素删除事件，如果删除的元素被选中，取消选中
		this.canvas.eventEmitter.on("element:deleted", ({ data }) => {
			const { elementId } = data
			if (this.isSelected(elementId)) {
				this.deselect(elementId)
			}
		})
	}

	// ==================== 选中状态管理 ====================

	/**
	 * 选中单个元素
	 * @param elementId 元素ID
	 * @param append 是否追加到已选中列表（默认false，会清空之前的选中）
	 * @param autoFocus 是否自动让画布容器获得焦点（默认true）
	 */
	public select(elementId: string, append = false, autoFocus = true): void {
		// 保存之前的选中状态，用于比较
		const previousIds = new Set(this.selectedIds)

		if (!append) {
			this.selectedIds.clear()
		}
		this.selectedIds.add(elementId)

		// 比较新的选中状态和之前的选中状态是否一样（忽略顺序）
		const currentIds = new Set(this.selectedIds)
		const isSame = this.isSetEqual(previousIds, currentIds)

		// 如果选中状态没有变化，不触发 emit
		if (!isSame) {
			this.emitSelectionChange()
		}

		if (autoFocus) {
			this.focusCanvasContainer()
		}
	}

	/**
	 * 选中多个元素
	 * @param elementIds 元素ID数组
	 * @param append 是否追加到已选中列表（默认false，会清空之前的选中）
	 * @param autoFocus 是否自动让画布容器获得焦点（默认true）
	 */
	public selectMultiple(elementIds: string[], append = false, autoFocus = true): void {
		// 保存之前的选中状态，用于比较
		const previousIds = new Set(this.selectedIds)

		if (!append) {
			this.selectedIds.clear()
		}
		elementIds.forEach((id) => this.selectedIds.add(id))

		// 比较新的选中状态和之前的选中状态是否一样（忽略顺序）
		const currentIds = new Set(this.selectedIds)
		const isSame = this.isSetEqual(previousIds, currentIds)

		// 如果选中状态没有变化，不触发 emit
		if (!isSame) {
			this.emitSelectionChange()
		}

		if (autoFocus) {
			this.focusCanvasContainer()
		}
	}

	/**
	 * 取消选中单个元素
	 * @param elementId 元素ID
	 */
	public deselect(elementId: string): void {
		// 如果元素不在选中列表中，不需要触发 emit
		if (!this.selectedIds.has(elementId)) {
			return
		}
		this.selectedIds.delete(elementId)
		this.emitSelectionChange()
	}

	/**
	 * 取消所有选中
	 */
	/**
	 * 取消所有选中的元素
	 */
	public deselectAll(): void {
		if (this.selectedIds.size === 0) return
		this.selectedIds.clear()
		this.canvas.eventEmitter.emit({ type: "element:deselect", data: undefined })
	}

	/**
	 * 切换元素的选中状态
	 * @param elementId 元素ID
	 */
	public toggle(elementId: string): void {
		if (this.selectedIds.has(elementId)) {
			this.deselect(elementId)
		} else {
			this.select(elementId, true)
		}
	}

	/**
	 * 检查元素是否被选中
	 * @param elementId 元素ID
	 */
	public isSelected(elementId: string): boolean {
		return this.selectedIds.has(elementId)
	}

	/**
	 * 获取所有选中的元素ID
	 */
	public getSelectedIds(): string[] {
		return Array.from(this.selectedIds)
	}

	/**
	 * 获取选中元素的数量
	 */
	public getSelectionCount(): number {
		return this.selectedIds.size
	}

	/**
	 * 检查是否有选中的元素
	 */
	public hasSelection(): boolean {
		return this.selectedIds.size > 0
	}

	/**
	 * 比较两个 Set 是否相等（忽略顺序）
	 */
	private isSetEqual(set1: Set<string>, set2: Set<string>): boolean {
		if (set1.size !== set2.size) {
			return false
		}
		// 检查 set1 中的每个元素是否都在 set2 中
		// 由于大小相同，如果 set1 的所有元素都在 set2 中，则两个 Set 相等
		for (const item of set1) {
			if (!set2.has(item)) {
				return false
			}
		}
		return true
	}

	/**
	 * 发出选中状态变化事件
	 */
	private emitSelectionChange(): void {
		const elementIds = this.getSelectedIds()
		if (elementIds.length > 0) {
			this.canvas.eventEmitter.emit({ type: "element:select", data: { elementIds } })
		} else {
			this.canvas.eventEmitter.emit({ type: "element:deselect", data: undefined })
		}
	}

	/**
	 * 让画布容器获得焦点，以便快捷键生效
	 */
	private focusCanvasContainer(): void {
		// 使用 requestAnimationFrame 延迟执行，避免在某些场景下立即执行导致问题
		requestAnimationFrame(() => {
			const container = this.canvas.stage.container()
			if (container && container.tabIndex >= 0) {
				container.focus()
			}
		})
	}

	/**
	 * 计算并发出选中元素的位置信息
	 */
	private emitSelectionPosition(): void {
		// 如果正在吸附，跳过位置更新，避免抖动
		if (this.isSnapping) {
			return
		}

		const selectedIds = this.getSelectedIds()

		// 如果没有选中元素，发出空的位置信息
		if (selectedIds.length === 0) {
			this.canvas.eventEmitter.emit({
				type: "selection:position",
				data: {
					boundingRect: null,
					elements: [],
				},
			})
			return
		}

		// 使用 NodeAdapter 获取选中元素的节点
		const adapter = this.canvas.elementManager.getNodeAdapter()
		const nodes = adapter.getNodesForTransform(selectedIds)

		if (nodes.length === 0) {
			this.canvas.eventEmitter.emit({
				type: "selection:position",
				data: {
					boundingRect: null,
					elements: [],
				},
			})
			return
		}

		// 计算所有选中元素的总体边界矩形（排除装饰性元素）
		// 传递 elementManager 以支持 Element 的自定义边界计算
		let boundingRect: { x: number; y: number; width: number; height: number } | null = null
		boundingRect = calculateNodesRect(nodes, this.canvas.stage, this.canvas.elementManager)

		// 计算每个元素的位置信息（相对于 layer 的坐标）
		// 使用 calculateNodesRect 为每个元素单独计算，确保排除装饰性元素
		// 传递 elementManager 以支持 Element 的自定义边界计算
		const elements = nodes.map((node) => {
			const elementRect = calculateNodesRect(
				[node],
				this.canvas.stage,
				this.canvas.elementManager,
			)
			if (elementRect) {
				return {
					elementId: node.id(),
					x: elementRect.x,
					y: elementRect.y,
					width: elementRect.width,
					height: elementRect.height,
				}
			} else {
				// 如果计算失败，回退到直接获取（不应该发生）
				const clientRect = node.getClientRect({
					relativeTo: node.getLayer() || undefined,
				})
				return {
					elementId: node.id(),
					x: clientRect.x,
					y: clientRect.y,
					width: clientRect.width,
					height: clientRect.height,
				}
			}
		})

		// 发出选中元素位置信息
		const positionData = {
			boundingRect,
			elements,
		}

		this.canvas.eventEmitter.emit({ type: "selection:position", data: positionData })
	}

	// ==================== 销毁 ====================

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		// 移除事件监听器
		this.canvas.eventEmitter.off("element:select")
		this.canvas.eventEmitter.off("element:deselect")
		this.canvas.eventEmitter.off("element:updated")
		this.canvas.eventEmitter.off("elements:transform:dragmove")
		this.canvas.eventEmitter.off("elements:transform:anchorDragmove")
		this.canvas.eventEmitter.off("viewport:scale")
		this.canvas.eventEmitter.off("viewport:pan")
		this.canvas.eventEmitter.off("snap:start")
		this.canvas.eventEmitter.off("snap:end")
		this.canvas.eventEmitter.off("element:deleted")
	}
}
