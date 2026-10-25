import Konva from "konva"
import { ElementTypeEnum, type LayerElement } from "../../document/types"
import type { Canvas } from "../../core/Canvas"
import type { CanvasEvent, CanvasEventMap } from "../../core/EventEmitter"
import {
	getMediaLabelLayout,
	invalidateMediaLabelLayouts,
	type MediaLabelLayout,
	type MediaLabelRect,
} from "./mediaLabelLayout"

/**
 * One label synchronization transaction shares media-row layouts between the name and size
 * managers. The context is intentionally short-lived so geometry or content changes cannot leak
 * a layout into a later frame.
 */
export interface LabelLayoutSyncContext {
	readonly mediaLayouts: Map<string, MediaLabelLayout | null>
}

interface VisibleLabelQueryCache {
	viewportGeneration: number
	candidateIds: string[]
	candidateRevision: number
}

interface SharedLabelSyncState {
	rafId: number | null
	modes: Set<VisibleLabelSyncMode>
	reason: string
}

type VisibleLabelSyncMode = "existing" | "full" | "window"

/**
 * Geometry changes during a transform do not all need a text/layout reconcile.
 * Keeping this distinction explicit prevents a drag frame from entering the media
 * spatial-query path while still allowing resize and commit events to settle labels.
 */
type DirtyLabelSyncMode = "position-only" | "full" | "anchor"

/**
 * 标签配置
 */
export interface LabelConfig {
	/** 字体大小（像素） */
	fontSize: number
	/** 文本颜色 */
	textColor: string
	/** 字体族 */
	fontFamily: string
	/** 标签距离元素的距离（像素） */
	offsetTop: number
	/** 标签左侧对齐偏移（像素） */
	offsetLeft: number
}

/**
 * 标签可见性配置
 */
export interface LabelVisibilityConfig {
	/** 哪些元素类型需要显示标签 */
	elementTypes: Set<string>
	/** 哪些元素类型一直显示（如 Frame） */
	alwaysVisibleTypes: Set<string>
	/** 哪些元素类型在选中或 hover 时显示（如 Image） */
	hoverOrSelectTypes: Set<string>
	/** 哪些交互标签受“媒体标签常驻”设置影响；未配置时兼容旧行为 */
	alwaysVisibleWhenMediaLabelsEnabledTypes?: Set<string>
}

export interface LabelSize {
	width: number
	height: number
}

export interface LabelBounds extends LabelSize {
	x: number
	y: number
}

/**
 * 基础标签管理器配置
 */
export interface BaseLabelManagerConfig {
	/** 画布实例 */
	canvas: Canvas
	/** 标签样式配置 */
	labelConfig: LabelConfig
	/** 标签可见性配置 */
	visibilityConfig: LabelVisibilityConfig
}

class LabelCandidateIndex {
	private typeBuckets = new Map<string, Set<string>>()
	private elementTypesById = new Map<string, string>()
	private queryCache = new Map<string, ReadonlySet<string>>()
	private dirty = true
	private revision = 0

	constructor(private readonly canvas: Canvas) {}

	public markDirty(): void {
		if (this.dirty) return
		this.dirty = true
		this.queryCache.clear()
		this.revision += 1
	}

	public syncElement(elementId: string): void {
		if (this.dirty) return
		const element = this.canvas.elementManager.getElementInstance(elementId)
		const elementType = element?.getData().type
		const previousElementType = this.elementTypesById.get(elementId)
		if (previousElementType === elementType) return

		if (previousElementType) {
			const previousBucket = this.typeBuckets.get(previousElementType)
			previousBucket?.delete(elementId)
			if (previousBucket?.size === 0) {
				this.typeBuckets.delete(previousElementType)
			}
			this.elementTypesById.delete(elementId)
		}
		if (!elementType) {
			this.queryCache.clear()
			this.revision += 1
			return
		}
		let bucket = this.typeBuckets.get(elementType)
		if (!bucket) {
			bucket = new Set()
			this.typeBuckets.set(elementType, bucket)
		}
		bucket.add(elementId)
		this.elementTypesById.set(elementId, elementType)
		this.queryCache.clear()
		this.revision += 1
	}

	public removeElement(elementId: string): void {
		if (this.dirty) return
		const elementType = this.elementTypesById.get(elementId)
		if (!elementType) return
		const bucket = this.typeBuckets.get(elementType)
		bucket?.delete(elementId)
		if (bucket?.size === 0) {
			this.typeBuckets.delete(elementType)
		}
		this.elementTypesById.delete(elementId)
		this.queryCache.clear()
		this.revision += 1
	}

	public getCandidateIds(elementTypes: Set<string>): ReadonlySet<string> {
		this.rebuildIfNeeded()
		const cacheKey = this.getElementTypesCacheKey(elementTypes)
		const cached = this.queryCache.get(cacheKey)
		if (cached) return cached

		const result = new Set<string>()
		for (const elementType of elementTypes) {
			const bucket = this.typeBuckets.get(elementType)
			if (bucket) {
				bucket.forEach((elementId) => result.add(elementId))
			}
		}
		this.queryCache.set(cacheKey, result)
		return result
	}

	public getRevision(): number {
		this.rebuildIfNeeded()
		return this.revision
	}

	private rebuildIfNeeded(): void {
		if (!this.dirty) return
		this.typeBuckets.clear()
		this.elementTypesById.clear()
		this.queryCache.clear()
		for (const elementId of this.canvas.elementManager.getAllElementIds()) {
			const element = this.canvas.elementManager.getElementInstance(elementId)
			const elementType = element?.getData().type
			if (!elementType) continue
			let bucket = this.typeBuckets.get(elementType)
			if (!bucket) {
				bucket = new Set()
				this.typeBuckets.set(elementType, bucket)
			}
			bucket.add(elementId)
			this.elementTypesById.set(elementId, elementType)
		}
		this.dirty = false
		this.revision += 1
	}

	private getElementTypesCacheKey(elementTypes: Set<string>): string {
		return Array.from(elementTypes).sort().join("|")
	}
}

/**
 * 基础标签管理器抽象类
 * 职责：
 * 1. 在独立的 Layer 上渲染元素的标签
 * 2. 监听元素变化，同步更新标签
 * 3. 管理标签的可见性
 * 4. 处理标签的位置和缩放
 */
export abstract class BaseLabelManager {
	protected canvas: Canvas
	protected labelConfig: LabelConfig
	protected visibilityConfig: LabelVisibilityConfig

	// 存储每个元素的标签
	protected labelMap: Map<string, Konva.Group> = new Map()

	// 追踪上一次 hover 的元素 ID
	protected lastHoveredElementId: string | null = null
	private visibleLabelSyncRafId: number | null = null
	private pendingVisibleLabelSyncModes = new Set<VisibleLabelSyncMode>()
	private pendingVisibleLabelSyncReason = "unknown"
	private visibleLabelQueryCache: VisibleLabelQueryCache | null = null
	private lastSyncedViewportScale: number | null = null
	private labelZIndexes = new Map<string, number>()
	private labelCandidateIndex: LabelCandidateIndex
	private eventUnsubscribers: Array<() => void> = []
	private destroyed = false
	private mediaLabelsAlwaysVisible = false
	private labelMeasureNode: Konva.Text | null = null
	private intrinsicLabelSizes = new WeakMap<object, { text: string; size: LabelSize }>()

	// 静态注册表，用于不同 LabelManager 之间的协调
	protected static labelManagers: BaseLabelManager[] = []
	/** One event is delivered to both name and size managers; reconcile it once per Canvas. */
	private static processedDirtySyncEvents = new WeakSet<object>()
	/** Scale/end events are shared so name and size labels use one RAF and one lifecycle pass. */
	private static sharedSyncStates = new WeakMap<Canvas, SharedLabelSyncState>()
	private static candidateIndexRefs = new WeakMap<
		Canvas,
		{ index: LabelCandidateIndex; refCount: number }
	>()

	public static createLabelLayoutSyncContext(): LabelLayoutSyncContext {
		return { mediaLayouts: new Map() }
	}

	constructor(options: BaseLabelManagerConfig) {
		const { canvas } = options
		this.canvas = canvas
		this.labelConfig = options.labelConfig
		this.visibilityConfig = options.visibilityConfig
		this.labelCandidateIndex = BaseLabelManager.acquireCandidateIndex(canvas)

		// 注册到静态列表
		BaseLabelManager.labelManagers.push(this)

		this.setupEventListeners()
	}

	private static acquireCandidateIndex(canvas: Canvas): LabelCandidateIndex {
		let ref = BaseLabelManager.candidateIndexRefs.get(canvas)
		if (!ref) {
			ref = { index: new LabelCandidateIndex(canvas), refCount: 0 }
			BaseLabelManager.candidateIndexRefs.set(canvas, ref)
		}
		ref.refCount += 1
		return ref.index
	}

	private static releaseCandidateIndex(canvas: Canvas): void {
		const ref = BaseLabelManager.candidateIndexRefs.get(canvas)
		if (!ref) return
		if (ref.refCount <= 1) {
			BaseLabelManager.candidateIndexRefs.delete(canvas)
			return
		}
		ref.refCount -= 1
	}

	private static scheduleSharedVisibleLabelSync(
		canvas: Canvas,
		reason: string,
		mode: VisibleLabelSyncMode,
	): void {
		let state = BaseLabelManager.sharedSyncStates.get(canvas)
		if (!state) {
			state = { rafId: null, modes: new Set(), reason: "unknown" }
			BaseLabelManager.sharedSyncStates.set(canvas, state)
		}
		state.modes.add(mode)
		state.reason = reason
		if (state.rafId !== null) return

		const schedule =
			typeof requestAnimationFrame === "function"
				? requestAnimationFrame
				: (callback: FrameRequestCallback) =>
						globalThis.setTimeout(
							() => callback(performance.now()),
							16,
						) as unknown as number
		state.rafId = schedule(() => {
			const pendingModes = new Set(state?.modes)
			const pendingReason = state?.reason ?? "unknown"
			if (!state) return
			state.rafId = null
			state.modes.clear()
			state.reason = "unknown"
			const layoutContext = BaseLabelManager.createLabelLayoutSyncContext()

			const managers = BaseLabelManager.labelManagers.filter(
				(manager) => manager.canvas === canvas && !manager.destroyed,
			)
			if (pendingModes.has("full")) {
				managers.forEach((manager) =>
					manager.syncVisibleLabels(pendingReason, layoutContext),
				)
				return
			}
			if (pendingModes.has("window")) {
				managers.forEach((manager) =>
					manager.syncLabelWindow(pendingReason, true, layoutContext),
				)
			}
			if (pendingModes.has("existing")) {
				managers.forEach((manager) =>
					manager.syncExistingLabels(pendingReason, layoutContext),
				)
			}
		})
	}

	private static cancelSharedVisibleLabelSync(canvas: Canvas): void {
		const state = BaseLabelManager.sharedSyncStates.get(canvas)
		if (!state) return
		if (
			BaseLabelManager.labelManagers.some(
				(manager) => manager.canvas === canvas && !manager.destroyed,
			)
		)
			return
		if (state.rafId !== null) {
			const cancel =
				typeof cancelAnimationFrame === "function"
					? cancelAnimationFrame
					: (id: number) => globalThis.clearTimeout(id)
			cancel(state.rafId)
		}
		BaseLabelManager.sharedSyncStates.delete(canvas)
	}

	private listen<K extends keyof CanvasEventMap>(
		eventType: K,
		listener: (event: CanvasEvent<K>) => void,
	): void {
		this.eventUnsubscribers.push(this.canvas.eventEmitter.on(eventType, listener))
	}

	protected requestOverlayDraw(reason: string): void {
		this.canvas.runtimeScheduler.requestLayerDraw("overlay", {
			source: this.constructor.name,
			reason,
			priority: "input",
		})
	}

	private scheduleVisibleLabelSync(
		reason: string,
		mode: VisibleLabelSyncMode,
		invalidatedElementIds?: Iterable<string>,
	): void {
		if (invalidatedElementIds) {
			invalidateMediaLabelLayouts(this.canvas, invalidatedElementIds)
		}
		this.pendingVisibleLabelSyncModes.add(mode)
		this.pendingVisibleLabelSyncReason = reason
		if (this.visibleLabelSyncRafId !== null) return
		const schedule =
			typeof requestAnimationFrame === "function"
				? requestAnimationFrame
				: (callback: FrameRequestCallback) =>
						globalThis.setTimeout(
							() => callback(performance.now()),
							16,
						) as unknown as number
		this.visibleLabelSyncRafId = schedule(() => {
			const pendingModes = new Set(this.pendingVisibleLabelSyncModes)
			const pendingReason = this.pendingVisibleLabelSyncReason
			this.visibleLabelSyncRafId = null
			this.pendingVisibleLabelSyncModes.clear()
			this.pendingVisibleLabelSyncReason = "unknown"
			const layoutContext = BaseLabelManager.createLabelLayoutSyncContext()
			if (pendingModes.has("full")) {
				this.syncVisibleLabels(pendingReason, layoutContext)
				return
			}
			if (pendingModes.has("window")) {
				this.syncLabelWindow(pendingReason, true, layoutContext)
			}
			if (pendingModes.has("existing")) {
				this.syncExistingLabels(pendingReason, layoutContext)
			}
		})
	}

	private cancelVisibleLabelSync(): void {
		if (this.visibleLabelSyncRafId !== null) {
			const cancel =
				typeof cancelAnimationFrame === "function"
					? cancelAnimationFrame
					: (id: number) => globalThis.clearTimeout(id)
			cancel(this.visibleLabelSyncRafId)
		}
		this.visibleLabelSyncRafId = null
		this.pendingVisibleLabelSyncModes.clear()
		this.pendingVisibleLabelSyncReason = "unknown"
	}

	private markLabelCandidatesDirty(): void {
		this.labelCandidateIndex.markDirty()
		this.visibleLabelQueryCache = null
	}

	private syncLabelCandidateForElement(elementId: string): void {
		this.labelCandidateIndex.syncElement(elementId)
	}

	/**
	 * 获取标签文本（由子类实现）
	 */
	protected abstract getLabelText(elementId: string): string

	/**
	 * 计算标签位置（由子类实现，返回相对于元素边界矩形的偏移）
	 */
	protected abstract calculateLabelPosition(
		boundingRect: { x: number; y: number; width: number; height: number },
		labelSize: { width: number; height: number },
		inverseScale: number,
	): { x: number; y: number }

	/**
	 * 返回标签在自身坐标系中的布局尺寸。
	 * 子类可以覆盖它来包含图标或其它局部布局；基类默认使用文本尺寸。
	 */
	protected getLabelSize(labelGroup: Konva.Group): LabelSize | null {
		const textNode = labelGroup.findOne("Text") as Konva.Text | null
		if (!textNode) return null
		return {
			width: textNode.width(),
			height: textNode.height(),
		}
	}

	protected getLabelBounds(labelGroup: Konva.Group): LabelBounds | null {
		const labelSize = this.getLabelSize(labelGroup)
		if (!labelSize) return null

		return {
			x: labelGroup.x(),
			y: labelGroup.y(),
			width: labelSize.width * labelGroup.scaleX(),
			height: labelSize.height * labelGroup.scaleY(),
		}
	}

	/** Returns the current rendered label size in local coordinates. */
	public getLabelSizeForElement(elementId: string): LabelSize | null {
		const labelGroup = this.labelMap.get(elementId)
		return labelGroup ? this.getLabelSize(labelGroup) : null
	}

	/** Returns whether the label currently has a rendered Konva group. */
	public isLabelVisibleForElement(elementId: string): boolean {
		return this.labelMap.get(elementId)?.visible() === true
	}

	/** Recomputes one label after a sibling manager changes its available width. */
	public refreshLabelLayout(
		elementId: string,
		skipBatchDraw = false,
		context?: LabelLayoutSyncContext,
	): boolean {
		return this.updateLabelPosition(elementId, skipBatchDraw, context)
	}

	/**
	 * Recompute a set of mounted labels after one atomic geometry transaction.
	 * Batch updates do not emit one `element:updated` event per child, so callers
	 * use this method to keep already-rendered labels attached to their elements
	 * and schedule a single overlay draw for the whole transaction.
	 */
	public refreshLabelLayouts(
		elementIds: readonly string[],
		context = BaseLabelManager.createLabelLayoutSyncContext(),
	): void {
		invalidateMediaLabelLayouts(this.canvas, elementIds)
		let requiresDraw = false
		for (const elementId of new Set(elementIds)) {
			requiresDraw = this.refreshLabelLayout(elementId, true, context) || requiresDraw
		}
		if (requiresDraw) this.requestOverlayDraw("batch-geometry")
		this.scheduleVisibleLabelSync("element-window", "window")
	}

	/** 完整文本度量不依赖可见性、节点是否创建或上一次省略宽度。 */
	protected getIntrinsicLabelSize(elementId: string): LabelSize {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) return { width: 0, height: this.labelConfig.fontSize }
		const text = this.getLabelText(elementId)
		const cached = this.intrinsicLabelSizes.get(element)
		if (cached?.text === text) return cached.size
		this.labelMeasureNode ??= new Konva.Text({
			fontSize: this.labelConfig.fontSize,
			fontFamily: this.labelConfig.fontFamily,
		})
		const size = this.labelMeasureNode.measureSize(text)
		this.intrinsicLabelSizes.set(element, { text, size })
		return size
	}

	/** 默认无附加操作；名称管理器可在标签内部提供固定宽度的 Konva 操作区。 */
	protected getLabelOperationScreenWidth(elementId: string): number {
		void elementId
		return 0
	}

	protected getLabelGap(): number {
		return 0
	}

	/**
	 * Returns the optional footprint before the name text. The default is empty so existing
	 * callers remain text-only; NameLabelManager supplies its cached icon footprint.
	 */
	protected getLabelLeadingSize(elementId: string): LabelSize {
		void elementId
		return { width: 0, height: 0 }
	}

	protected getMediaRowLayout(
		elementId: string,
		boundsOverride?: MediaLabelRect,
		context?: LabelLayoutSyncContext,
	): MediaLabelLayout | null {
		if (context?.mediaLayouts.has(elementId)) {
			return context.mediaLayouts.get(elementId) ?? null
		}
		const element = this.canvas.elementManager.getElementInstance(elementId)
		const type = element?.getData().type
		if (type !== ElementTypeEnum.Image && type !== ElementTypeEnum.Video) return null
		const nameManager: BaseLabelManager = this.canvas.nameLabelManager
		const sizeManager: BaseLabelManager = this.canvas.sizeLabelManager
		if (!nameManager || !sizeManager) return null
		const nameLeadingSize = nameManager.getLabelLeadingSize(elementId)
		const layout = getMediaLabelLayout(this.canvas, elementId, {
			name: nameManager.getIntrinsicLabelSize(elementId),
			size: element?.supportsSizeEditing()
				? sizeManager.getIntrinsicLabelSize(elementId)
				: { width: 0, height: sizeManager.labelConfig.fontSize },
			fontSize: nameManager.labelConfig.fontSize,
			offsetTop: Math.max(
				nameManager.labelConfig.offsetTop,
				sizeManager.labelConfig.offsetTop,
			),
			gap: nameManager.getLabelGap(),
			operationScreenWidth: nameManager.getLabelOperationScreenWidth(elementId),
			nameLeadingWidth: nameLeadingSize.width,
			nameLeadingHeight: nameLeadingSize.height,
			boundsOverride,
		})
		context?.mediaLayouts.set(elementId, layout)
		return layout
	}

	/**
	 * 在应用共同缩放后调整标签的局部布局。
	 * 子类可以只收窄文字宽度，不改变原始文本，保留重命名等完整文本场景。
	 */
	protected updateLabelLayout(
		elementId: string,
		element: ReturnType<typeof this.canvas.elementManager.getElementInstance>,
		labelGroup: Konva.Group,
		boundingRect: { x: number; y: number; width: number; height: number },
		inverseScale: number,
		mediaLayout?: MediaLabelLayout | null,
		context?: LabelLayoutSyncContext,
	): boolean {
		void elementId
		void element
		void labelGroup
		void boundingRect
		void inverseScale
		void mediaLayout
		void context
		return false
	}

	/** 媒体按共同几何预算缩小；其它类型继续保持原来的固定屏幕字号。 */
	private getEffectiveInverseScale(
		elementId: string,
		viewportScale: number,
		mediaLayout?: MediaLabelLayout | null,
		context?: LabelLayoutSyncContext,
	): number {
		const safeViewportScale =
			Number.isFinite(viewportScale) && viewportScale > 0 ? viewportScale : 1
		const resolvedMediaLayout =
			mediaLayout ?? this.getMediaRowLayout(elementId, undefined, context)
		if (resolvedMediaLayout) return resolvedMediaLayout.inverseScale

		// Keep media labels readable without letting a tiny thumbnail receive a
		// full-size label after a deep zoom-out when the sibling managers are not
		// available yet (for example during Canvas bootstrap).
		const element = this.canvas.elementManager.getElementInstance(elementId)
		const type = element?.getData().type
		if (type === ElementTypeEnum.Image || type === ElementTypeEnum.Video) {
			const bounds = element?.getBoundingRect()
			if (bounds?.height && this.labelConfig.fontSize > 0) {
				return Math.min(
					1 / safeViewportScale,
					bounds.height / (this.labelConfig.fontSize * 4),
				)
			}
		}
		return 1 / safeViewportScale
	}

	/**
	 * 更新图片和视频标签的显示模式，并立即同步现有及当前视口内的标签。
	 * 常驻模式需要把媒体加入候选索引，否则缩小时标签尚未创建就无法显示。
	 */
	public setMediaLabelsAlwaysVisible(alwaysVisible: boolean, syncLabels = true): void {
		if (this.mediaLabelsAlwaysVisible === alwaysVisible) return
		this.mediaLabelsAlwaysVisible = alwaysVisible
		if (syncLabels) this.syncMediaLabelsVisibility()
	}

	/** Canvas 先统一标题与分辨率的模式，再沿用现有同步和清理流程。 */
	public syncMediaLabelsVisibility(): void {
		this.visibleLabelQueryCache = null
		this.syncVisibleLabels("media-label-visibility")
	}

	public isMediaLabelsAlwaysVisible(): boolean {
		return this.mediaLabelsAlwaysVisible
	}

	protected shouldTreatAsAlwaysVisible(elementType: string): boolean {
		const mediaAlwaysVisibleTypes =
			this.visibilityConfig.alwaysVisibleWhenMediaLabelsEnabledTypes ??
			this.visibilityConfig.hoverOrSelectTypes
		return (
			this.visibilityConfig.alwaysVisibleTypes.has(elementType) ||
			(this.mediaLabelsAlwaysVisible && mediaAlwaysVisibleTypes.has(elementType))
		)
	}

	/**
	 * 设置事件监听器
	 */
	private setupEventListeners(): void {
		// 监听元素创建
		this.listen("element:created", (event) => {
			this.syncLabelCandidateForElement(event.data.elementId)
			const layoutContext = BaseLabelManager.createLabelLayoutSyncContext()
			if (
				this.labelMap.has(event.data.elementId) ||
				this.shouldCreateLabelImmediately(event.data.elementId)
			) {
				this.createOrUpdateLabel(event.data.elementId, undefined, layoutContext)
			}
			this.scheduleVisibleLabelSync("media-geometry", "window", [event.data.elementId])
		})

		// 监听元素删除
		this.listen("element:deleted", (event) => {
			this.labelCandidateIndex.removeElement(event.data.elementId)
			this.removeLabel(event.data.elementId)
			this.scheduleVisibleLabelSync("media-geometry", "window", [event.data.elementId])
		})

		// 处理拖拽移动事件
		// 监听拖拽移动事件
		this.listen("elements:transform:dragmove", (event) => {
			this.syncDirtyLabelsForEvent(
				event,
				event.data.elementIds,
				"transform-dragmove",
				"position-only",
			)
		})

		// 监听缩放移动事件
		this.listen("elements:transform:anchorDragmove", (event) => {
			this.syncDirtyLabelsForEvent(
				event,
				event.data.elementIds,
				"transform-anchor-dragmove",
				"anchor",
			)
		})

		this.listen("elements:transform:dragend", (event) => {
			this.syncDirtyLabelsForEvent(event, event.data.elementIds, "transform-dragend", "full")
			BaseLabelManager.scheduleSharedVisibleLabelSync(this.canvas, "transform-end", "full")
		})

		this.listen("elements:transform:anchorDragend", (event) => {
			this.syncDirtyLabelsForEvent(
				event,
				event.data.elementIds,
				"transform-anchor-dragend",
				"full",
			)
			BaseLabelManager.scheduleSharedVisibleLabelSync(this.canvas, "transform-end", "full")
		})

		// 监听元素数据更新（属性变化，如名称变化或 zIndex 变化）
		this.listen("element:updated", (event) => {
			this.syncLabelCandidateForElement(event.data.elementId)
			this.syncDirtyLabelsForEvent(event, [event.data.elementId], "element-updated", "full")
			this.scheduleVisibleLabelSync("element-window", "window")
		})

		// 监听元素重新渲染（位置、尺寸变化等）
		this.listen("element:rerendered", (event) => {
			this.syncLabelCandidateForElement(event.data.elementId)
			this.syncDirtyLabelsForEvent(
				event,
				[event.data.elementId],
				"element-rerendered",
				"full",
			)
			this.scheduleVisibleLabelSync("element-window", "window")
		})

		// 监听选择变化
		this.listen("element:select", (event) => {
			const layoutContext = BaseLabelManager.createLabelLayoutSyncContext()
			let createdLabel = false
			event.data.elementIds.forEach((elementId) => {
				createdLabel =
					this.createOrUpdateLabel(
						elementId,
						{
							skipReorder: true,
							skipNotify: true,
						},
						layoutContext,
					) || createdLabel
			})
			if (createdLabel) {
				this.reorderAllLabels()
			}
			this.updateLabelsVisibilityForElements(
				event.data.elementIds,
				"selection",
				layoutContext,
			)
		})

		this.listen("element:deselect", (event) => {
			const elementIds = event.data?.elementIds
			// Older integrations can emit a payload-less deselect as a recovery signal. It is
			// outside the normal SelectionManager path, so keep the explicit full fallback there.
			if (!elementIds?.length) {
				this.updateAllLabelsVisibility()
				return
			}
			this.updateLabelsVisibilityForElements(elementIds, "deselection")
		})

		// 监听 hover 变化
		this.listen("element:hover", (event) => {
			const newHoveredId = event.data.elementId
			const layoutContext = BaseLabelManager.createLabelLayoutSyncContext()

			// 如果有之前 hover 的元素，更新其可见性
			if (this.lastHoveredElementId) {
				this.updateLabelVisibility(
					this.lastHoveredElementId,
					false,
					undefined,
					layoutContext,
				)
			}

			// 如果有新 hover 的元素，更新其可见性
			if (newHoveredId) {
				const createdLabel = this.createOrUpdateLabel(
					newHoveredId,
					{
						skipReorder: true,
						skipNotify: true,
					},
					layoutContext,
				)
				if (createdLabel) {
					this.reorderAllLabels()
				}
			}

			// 更新追踪的 hover 元素
			this.lastHoveredElementId = newHoveredId
		})

		// Scale 只更新已实例化标签；视口工作集在手势结束后统一收缩/扩展，避免每帧查询。
		this.listen("viewport:scale", () => {
			BaseLabelManager.scheduleSharedVisibleLabelSync(
				this.canvas,
				"viewport-scale",
				"existing",
			)
		})

		this.listen("viewport:changed", ({ data }) => {
			if (data.phase === "end") {
				BaseLabelManager.scheduleSharedVisibleLabelSync(this.canvas, "viewport-end", "full")
			}
		})

		// 监听文档恢复事件（撤销/恢复时触发）
		this.listen("document:restored", () => {
			this.markLabelCandidatesDirty()
			this.pruneMissingLabels()
			this.syncVisibleLabels("document-restored")
		})

		// 监听裁剪模式进入/退出事件，更新标签可见性
		this.listen("crop:enter", ({ data }) => {
			const layoutContext = BaseLabelManager.createLabelLayoutSyncContext()
			this.createOrUpdateLabel(data.elementId, undefined, layoutContext)
			this.updateLabelsVisibilityForElements(
				this.getInteractionAffectedElementIds(data.elementId),
				"crop-enter",
				layoutContext,
			)
		})

		this.listen("crop:exit", ({ data }) => {
			const layoutContext = BaseLabelManager.createLabelLayoutSyncContext()
			this.createOrUpdateLabel(data.elementId, undefined, layoutContext)
			this.updateLabelsVisibilityForElements(
				this.getInteractionAffectedElementIds(data.elementId),
				"crop-exit",
				layoutContext,
			)
		})

		this.listen("extend:enter", ({ data }) => {
			const layoutContext = BaseLabelManager.createLabelLayoutSyncContext()
			this.createOrUpdateLabel(data.elementId, undefined, layoutContext)
			this.updateLabelsVisibilityForElements(
				this.getInteractionAffectedElementIds(data.elementId),
				"extend-enter",
				layoutContext,
			)
		})

		this.listen("extend:exit", ({ data }) => {
			const layoutContext = BaseLabelManager.createLabelLayoutSyncContext()
			this.createOrUpdateLabel(data.elementId, undefined, layoutContext)
			this.updateLabelsVisibilityForElements(
				this.getInteractionAffectedElementIds(data.elementId),
				"extend-exit",
				layoutContext,
			)
		})

		this.listen("eraser:enter", ({ data }) => {
			const layoutContext = BaseLabelManager.createLabelLayoutSyncContext()
			this.createOrUpdateLabel(data.elementId, undefined, layoutContext)
			this.updateLabelsVisibilityForElements(
				this.getInteractionAffectedElementIds(data.elementId),
				"eraser-enter",
				layoutContext,
			)
		})

		this.listen("eraser:exit", ({ data }) => {
			const layoutContext = BaseLabelManager.createLabelLayoutSyncContext()
			this.createOrUpdateLabel(data.elementId, undefined, layoutContext)
			this.updateLabelsVisibilityForElements(
				this.getInteractionAffectedElementIds(data.elementId),
				"eraser-exit",
				layoutContext,
			)
		})
	}

	/**
	 * 创建或更新标签
	 */
	protected createOrUpdateLabel(
		elementId: string,
		options?: {
			skipReorder?: boolean
			skipNotify?: boolean
			skipBatchDraw?: boolean
			forceCreate?: boolean
		},
		context?: LabelLayoutSyncContext,
	): boolean {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) {
			this.removeLabel(elementId)
			return false
		}

		// 检查元素是否需要显示标签
		if (!this.shouldShowLabel(elementId)) {
			this.removeLabel(elementId)
			return false
		}

		let labelGroup = this.labelMap.get(elementId)
		if (
			!labelGroup &&
			!options?.forceCreate &&
			this.calculateBaseVisibility(elementId, element) !== true
		) {
			return false
		}

		const node = element.getNode()
		if (!node) {
			this.removeLabel(elementId)
			return false
		}

		// 获取或创建标签
		const createdLabel = !labelGroup
		const previousZIndex = this.labelZIndexes.get(elementId)
		const currentZIndex = element.getData().zIndex ?? 0
		if (!labelGroup) {
			labelGroup = this.createLabel(elementId)
			this.labelMap.set(elementId, labelGroup)
			this.canvas.overlayLayer.add(labelGroup)
		}
		this.labelZIndexes.set(elementId, currentZIndex)

		// 新标签或 zIndex 实际变化时才重新排序。
		if (
			!options?.skipReorder &&
			(createdLabel || (previousZIndex !== undefined && previousZIndex !== currentZIndex))
		) {
			this.reorderAllLabels(options?.skipBatchDraw || !labelGroup.visible())
		}

		// 更新标签位置（内部会调用 updateLabelVisibility）
		this.updateLabelPosition(elementId, options?.skipBatchDraw, context)
		// Both managers receive the same element event. A newly mounted sibling needs one
		// relayout, but an existing always-visible media label must not relayout its sibling
		// on every update; the shared transform/scale pass handles that case.
		if (createdLabel) {
			this.updateOtherLabelPositions(elementId, options?.skipBatchDraw, context)
		}

		// 通知其他 LabelManager 也更新该元素的可见性（单个更新，需要立即 batchDraw）
		if (!options?.skipNotify) {
			this.notifyOtherManagersUpdateVisibility(elementId, false, context)
		}

		return createdLabel
	}

	/**
	 * 当第二种标签刚创建时，重新布局同一元素上已经存在的其它标签，
	 * 让名称和尺寸标签从首次渲染开始就共享同一个自适应比例。
	 */
	private updateOtherLabelPositions(
		elementId: string,
		skipBatchDraw = false,
		context?: LabelLayoutSyncContext,
	): void {
		for (const manager of BaseLabelManager.labelManagers) {
			if (manager === this || manager.canvas !== this.canvas) continue
			if (!manager.labelMap.has(elementId)) continue
			manager.updateLabelPosition(elementId, skipBatchDraw, context)
		}
	}

	/**
	 * 创建标签节点
	 */
	protected createLabel(elementId: string): Konva.Group {
		const labelText = this.getLabelText(elementId)

		// 创建标签容器 Group
		const labelGroup = new Konva.Group({
			listening: false,
			visible: false, // 默认隐藏
			name: `label-${elementId}`,
		})

		// 创建文本节点
		const textNode = new Konva.Text({
			text: labelText,
			fontSize: this.labelConfig.fontSize,
			fontFamily: this.labelConfig.fontFamily,
			fill: this.labelConfig.textColor,
			listening: false,
		})

		labelGroup.add(textNode)

		return labelGroup
	}

	/**
	 * 更新标签文本
	 */
	protected updateLabelText(labelGroup: Konva.Group, text: string): boolean {
		const textNode = labelGroup.findOne("Text") as Konva.Text
		if (!textNode || textNode.text() === text) return false
		textNode.text(text)
		return true
	}

	/**
	 * Updates label content before layout. Structured label implementations can
	 * override this hook and keep content resolution out of viewport hot paths.
	 */
	protected updateLabelContent(elementId: string, labelGroup: Konva.Group): boolean {
		return this.updateLabelText(labelGroup, this.getLabelText(elementId))
	}

	/**
	 * 递归更新 Frame 子元素的标签位置
	 * @param children - 子元素列表
	 * @param skipBatchDraw - 是否跳过 batchDraw（用于递归调用时统一在最外层调用）
	 */
	protected updateLabelsForFrameChildren(
		children: LayerElement[],
		skipBatchDraw = false,
		context?: LabelLayoutSyncContext,
	): void {
		children.forEach((child) => {
			// 更新当前子元素的标签位置（批量更新模式）
			this.updateLabelPosition(child.id, true, context)

			// 如果子元素也是 Frame 或 Group，递归更新其子元素（递归时跳过 batchDraw）
			if ("children" in child && child.children && child.children.length > 0) {
				this.updateLabelsForFrameChildren(child.children, true, context)
			}
		})
		// 只在最外层调用时执行 batchDraw
		if (!skipBatchDraw) {
			this.requestOverlayDraw("frame-children-labels")
		}
	}

	/**
	 * 更新标签位置
	 * @param elementId - 元素 ID
	 * @param skipBatchDraw - 是否跳过 batchDraw（用于批量更新时统一调用）
	 */
	protected updateLabelPosition(
		elementId: string,
		skipBatchDraw = false,
		context?: LabelLayoutSyncContext,
	): boolean {
		const labelGroup = this.labelMap.get(elementId)
		if (!labelGroup) {
			return false
		}

		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) {
			return false
		}

		// 关闭常驻后先移除非交互标签，避免移除前仍为整批媒体度量文本、布局和计算遮挡。
		// 悬浮、选中与重命名标签继续由原有保留规则处理。
		if (
			!this.shouldRetainLabel(
				elementId,
				element,
				this.calculateBaseVisibility(elementId, element),
			)
		) {
			return this.updateLabelVisibility(elementId, skipBatchDraw)
		}

		// 更新标签内容；名称标签会复用事件阶段缓存，避免 transform/viewport 热路径
		// 重复解析生成状态和测量自然宽度。
		let layoutChanged = this.updateLabelContent(elementId, labelGroup)

		// 使用元素的 getBoundingRect 方法获取边界矩形
		const boundingRect = element.getBoundingRect()
		if (!boundingRect) {
			if (layoutChanged && labelGroup.visible() && !skipBatchDraw) {
				this.requestOverlayDraw("label-layout")
			}
			return layoutChanged && labelGroup.visible()
		}

		// 获取 viewport 缩放，并在标签即将超出元素可用宽度时限制反向缩放。
		const viewportScale = this.canvas.stage.scaleX()
		const safeViewportScale =
			Number.isFinite(viewportScale) && viewportScale > 0 ? viewportScale : 1
		const desiredInverseScale = 1 / safeViewportScale
		// Resolve the shared media row once for this label update. Name and size managers
		// otherwise ask the spatial layout cache for the same element several times.
		const mediaLayout = this.getMediaRowLayout(elementId, boundingRect, context)

		// 先按常规字号收窄名称文本，避免正常缩放时为了容纳长标题而缩小整行文字。
		layoutChanged =
			this.updateLabelLayout(
				elementId,
				element,
				labelGroup,
				boundingRect,
				desiredInverseScale,
				mediaLayout,
				context,
			) || layoutChanged

		const inverseScale = this.getEffectiveInverseScale(
			elementId,
			viewportScale,
			mediaLayout,
			context,
		)

		// 应用反向缩放
		if (labelGroup.scaleX() !== inverseScale || labelGroup.scaleY() !== inverseScale) {
			labelGroup.scale({ x: inverseScale, y: inverseScale })
			layoutChanged = true
		}

		// 反向缩放在极小画布下可能再次改变可用局部宽度，再同步一次省略布局。
		layoutChanged =
			this.updateLabelLayout(
				elementId,
				element,
				labelGroup,
				boundingRect,
				inverseScale,
				mediaLayout,
				context,
			) || layoutChanged

		// 获取文本节点以计算标签尺寸
		const textNode = labelGroup.findOne("Text") as Konva.Text
		if (!textNode) {
			return false
		}

		const labelSize = this.getLabelSize(labelGroup)
		if (!labelSize) return false

		// 调用子类实现的位置计算方法
		const position = this.calculateLabelPosition(boundingRect, labelSize, inverseScale)

		if (labelGroup.x() !== position.x || labelGroup.y() !== position.y) {
			labelGroup.position(position)
			layoutChanged = true
		}

		// 位置更新后，立即更新可见性（因为位置变化可能影响可见性判断）
		const visibilityChanged = this.updateLabelVisibility(elementId, true, mediaLayout, context)
		const requiresDraw = visibilityChanged || (layoutChanged && labelGroup.visible())
		if (requiresDraw && !skipBatchDraw) {
			this.requestOverlayDraw("label-layout")
		}
		return requiresDraw
	}

	/**
	 * Move an already-laid-out label with its element without touching text, media-row
	 * sizing, visibility, or spatial candidates. Transform nodes expose their live bounds
	 * before the geometry cache is committed, so this is sufficient for drag frames and
	 * keeps nested Frame/Group labels visually attached to the moving parent.
	 */
	protected updateLabelPositionOnly(elementId: string, skipBatchDraw = false): boolean {
		const labelGroup = this.labelMap.get(elementId)
		if (!labelGroup) return false

		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) return false

		const boundingRect = element.getBoundingRect()
		if (!boundingRect) return false

		const labelSize = this.getLabelSize(labelGroup)
		if (!labelSize) return false

		const groupScale = labelGroup.scaleX()
		const inverseScale = Number.isFinite(groupScale) && groupScale > 0 ? groupScale : 1
		const position = this.calculateLabelPosition(boundingRect, labelSize, inverseScale)
		const positionChanged = labelGroup.x() !== position.x || labelGroup.y() !== position.y
		if (!positionChanged) return false

		labelGroup.position(position)
		if (labelGroup.visible() && !skipBatchDraw) {
			this.requestOverlayDraw("label-position")
		}
		return labelGroup.visible()
	}

	/**
	 * 计算基础可见性（包括裁剪状态检查和配置的可见性规则）
	 * @param elementId - 元素 ID
	 * @param element - 元素实例
	 * @returns 基础可见性结果，如果为 null 表示元素不存在，如果为 true/false 表示基础可见性
	 */
	protected calculateBaseVisibility(
		elementId: string,
		element: ReturnType<typeof this.canvas.elementManager.getElementInstance>,
	): boolean | null {
		if (!element) {
			return null
		}

		// 标签位于独立 Overlay Layer，必须同时遵守元素自身和祖先的隐藏状态。
		if (this.canvas.elementManager.isElementVisibleInDataTree?.(elementId) === false)
			return false

		// 检查是否在裁剪状态下，如果是裁剪的元素，强制显示标签
		const croppingElementId = this.canvas.cropManager.getCroppingElementId()
		if (croppingElementId === elementId) {
			return true
		}

		const extendingElementId = this.canvas.extendManager.getExtendingElementId()
		if (extendingElementId === elementId) {
			return false
		}

		const erasingElementId = this.canvas.eraserManager.getErasingElementId()
		if (erasingElementId === elementId) {
			return true
		}

		const elementData = element.getData()
		const elementType = elementData.type

		// 检查是否为一直显示的类型
		if (this.shouldTreatAsAlwaysVisible(elementType)) {
			return true
		}
		// 检查是否为选中或 hover 时显示的类型
		if (this.visibilityConfig.hoverOrSelectTypes.has(elementType)) {
			const isSelected = this.canvas.selectionManager.isSelected(elementId)
			const hoveredId = this.canvas.hoverManager.getHoveredElementId()
			// 指针进入 Konva 名称标签后，仍按同一媒体行的悬浮处理，避免标签闪隐。
			const isHovered =
				hoveredId === elementId ||
				this.canvas.nameLabelManager?.isLabelPointerHovered(elementId) === true

			// 如果有元素正在裁剪，且当前元素不是正在裁剪的元素，则hover时不显示标签
			if (croppingElementId && croppingElementId !== elementId && isHovered && !isSelected) {
				return false
			}

			// 如果有元素正在橡皮擦，且当前元素不是正在橡皮擦的元素，则 hover 时不显示标签
			if (erasingElementId && erasingElementId !== elementId && isHovered && !isSelected) {
				return false
			}

			return isHovered || isSelected
		}

		return false
	}

	/**
	 * 计算自定义可见性（由子类重写以添加特殊逻辑）
	 * @param elementId - 元素 ID
	 * @param element - 元素实例
	 * @param labelGroup - 标签组
	 * @param baseVisibility - 基础可见性
	 * @returns 自定义可见性，如果返回 null 表示不修改基础可见性
	 */
	protected calculateCustomVisibility(
		elementId: string,
		element: ReturnType<typeof this.canvas.elementManager.getElementInstance>,
		labelGroup: Konva.Group,
		baseVisibility: boolean,
		mediaLayout?: MediaLabelLayout | null,
	): boolean | null {
		void elementId
		void element
		void labelGroup
		void baseVisibility
		void mediaLayout
		// 默认不修改基础可见性，子类可以重写此方法
		return null
	}

	/**
	 * 更新标签可见性（模板方法）
	 * @param elementId - 元素 ID
	 * @param skipBatchDraw - 是否跳过 batchDraw（用于批量更新时统一调用）
	 */
	protected updateLabelVisibility(
		elementId: string,
		skipBatchDraw = false,
		mediaLayout?: MediaLabelLayout | null,
		context?: LabelLayoutSyncContext,
	): boolean {
		const labelGroup = this.labelMap.get(elementId)
		if (!labelGroup) {
			return false
		}

		const element = this.canvas.elementManager.getElementInstance(elementId)

		// 计算基础可见性
		const baseVisibility = this.calculateBaseVisibility(elementId, element)
		const wasVisible = labelGroup.visible()

		if (!this.shouldRetainLabel(elementId, element, baseVisibility)) {
			this.removeLabel(elementId)
			if (wasVisible && !skipBatchDraw) {
				this.requestOverlayDraw("label-visibility")
			}
			return wasVisible
		}

		let shouldShow = false
		const resolvedMediaLayout =
			mediaLayout ?? this.getMediaRowLayout(elementId, undefined, context)
		if (baseVisibility) {
			// 计算自定义可见性（子类可以重写以添加特殊逻辑）
			const customVisibility = this.calculateCustomVisibility(
				elementId,
				element,
				labelGroup,
				baseVisibility,
				resolvedMediaLayout,
			)
			shouldShow = customVisibility !== null ? customVisibility : baseVisibility
		}

		if (shouldShow && this.isMediaLabelRowCovered(elementId, resolvedMediaLayout, context))
			shouldShow = false
		if (shouldShow && resolvedMediaLayout?.hasSpace === false) shouldShow = false

		if (labelGroup.visible() === shouldShow) return false
		labelGroup.visible(shouldShow)

		// 触发重绘（批量更新时跳过，由调用方统一调用）
		if (!skipBatchDraw) {
			this.requestOverlayDraw("label-visibility")
		}
		return true
	}

	/**
	 * 交互型标签只在 hover/选中期间保留，避免浏览大量媒体后积累隐藏 Konva 节点。
	 * 子类可为编辑态标签覆盖此规则。
	 */
	protected shouldRetainLabel(
		elementId: string,
		element: ReturnType<typeof this.canvas.elementManager.getElementInstance>,
		baseVisibility: boolean | null,
	): boolean {
		if (!element || baseVisibility === null) return false
		if (this.shouldTreatAsAlwaysVisible(element.getData().type)) return true
		return baseVisibility || this.shouldRetainHiddenLabel(elementId)
	}

	protected shouldRetainHiddenLabel(elementId: string): boolean {
		void elementId
		return false
	}

	/** 读取局部尺寸而非上一帧缩放后的边界，隐藏或缩放不改变分辨率预留空间。 */
	protected getOtherLabelSizes(elementId: string): LabelSize[] {
		const sizes: LabelSize[] = []
		for (const manager of BaseLabelManager.labelManagers) {
			if (manager === this || manager.canvas !== this.canvas) continue
			const group = manager.labelMap.get(elementId)
			const size = group ? manager.getLabelSize(group) : null
			if (size) sizes.push(size)
		}
		return sizes
	}

	/**
	 * 标签层位于媒体层之上，因此需要显式遵守同父级媒体的遮挡关系。
	 * 任一标签被上层媒体覆盖时整行隐藏；不依赖标签当前 visible，移开后可以恢复。
	 */
	private isMediaLabelRowCovered(
		elementId: string,
		mediaLayout?: MediaLabelLayout | null,
		context?: LabelLayoutSyncContext,
	): boolean {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) return false
		const data = element.getData()
		if (data.type !== ElementTypeEnum.Image && data.type !== ElementTypeEnum.Video) return false
		const parentId = this.canvas.elementManager.findParentIdForElement(elementId)
		for (const manager of BaseLabelManager.labelManagers) {
			if (manager.canvas !== this.canvas) continue
			// 尺寸已让位给标题时，其隐藏节点不参与整行遮挡判断。
			if (
				manager === this.canvas.sizeLabelManager &&
				!(mediaLayout ?? this.getMediaRowLayout(elementId, undefined, context))?.showSize
			)
				continue
			const group = manager.labelMap.get(elementId)
			const size = group ? manager.getLabelSize(group) : null
			if (!group || !size) continue
			const bounds = {
				x: group.x(),
				y: group.y(),
				width: size.width * group.scaleX(),
				height: size.height * group.scaleY(),
			}
			// The media row layout already queried a conservative spatial window for this
			// element. Reuse those candidates during visibility checks instead of issuing a
			// second R-tree query for every name/size label on every scale frame.
			const candidates =
				mediaLayout?.candidateIds ??
				this.canvas.geometryCacheManager.queryElementIdsByExpandedRect(bounds, 0)
			for (const candidateId of candidates) {
				if (candidateId === elementId) continue
				const candidate = this.canvas.elementManager.getElementInstance(candidateId)
				if (!candidate) continue
				const candidateData = candidate.getData()
				if (
					candidateData.type !== ElementTypeEnum.Image &&
					candidateData.type !== ElementTypeEnum.Video
				)
					continue
				if ((candidateData.zIndex ?? 0) <= (data.zIndex ?? 0)) continue
				if (this.canvas.elementManager.findParentIdForElement(candidateId) !== parentId)
					continue
				const node = candidate.getNode()
				if (!node?.isVisible() || node.getAbsoluteOpacity() === 0) continue
				const candidateBounds = candidate.getBoundingRect()
				if (candidateBounds && this.checkRectOverlap(bounds, candidateBounds, 0))
					return true
			}
		}
		return false
	}

	/**
	 * 获取其他 LabelManager 的标签位置信息
	 */
	protected getOtherLabelBounds(
		elementId: string,
		excludeManager: BaseLabelManager,
	): Array<{ x: number; y: number; width: number; height: number }> {
		const bounds: Array<{ x: number; y: number; width: number; height: number }> = []

		for (const manager of BaseLabelManager.labelManagers) {
			if (manager === excludeManager) continue

			const labelGroup = manager.labelMap.get(elementId)
			if (labelGroup && labelGroup.visible()) {
				const textNode = labelGroup.findOne("Text") as Konva.Text
				if (textNode) {
					const scaleX = labelGroup.scaleX()
					const scaleY = labelGroup.scaleY()
					bounds.push({
						x: labelGroup.x(),
						y: labelGroup.y(),
						width: textNode.width() * scaleX,
						height: textNode.height() * scaleY,
					})
				}
			}
		}

		return bounds
	}

	/**
	 * 检测两个矩形是否重叠
	 */
	protected checkRectOverlap(
		rect1: { x: number; y: number; width: number; height: number },
		rect2: { x: number; y: number; width: number; height: number },
		padding: number = 2,
	): boolean {
		return (
			rect1.x < rect2.x + rect2.width + padding &&
			rect1.x + rect1.width + padding > rect2.x &&
			rect1.y < rect2.y + rect2.height + padding &&
			rect1.y + rect1.height + padding > rect2.y
		)
	}

	/**
	 * 检测标签是否超出元素宽度
	 */
	protected checkLabelExceedsElementWidth(
		labelBounds: { x: number; width: number },
		elementBounds: { x: number; width: number },
	): boolean {
		const labelRight = labelBounds.x + labelBounds.width
		const elementRight = elementBounds.x + elementBounds.width
		return labelRight > elementRight
	}

	/**
	 * 检查其他 LabelManager 的标签是否因为超出元素宽度而隐藏
	 */
	protected checkOtherLabelHiddenDueToWidth(
		elementId: string,
		excludeManager: BaseLabelManager,
		elementBounds: { x: number; width: number },
	): boolean {
		for (const manager of BaseLabelManager.labelManagers) {
			if (manager === excludeManager) continue

			const labelGroup = manager.labelMap.get(elementId)
			// 如果标签存在但不可见
			if (labelGroup && !labelGroup.visible()) {
				const labelBounds = manager.getLabelBounds(labelGroup)
				if (
					labelBounds &&
					manager.checkLabelExceedsElementWidth(labelBounds, elementBounds)
				) {
					return true
				}
			}
		}
		return false
	}

	/**
	 * 更新所有标签的可见性
	 */
	protected updateAllLabelsVisibility(): void {
		let visibilityChanged = false
		for (const elementId of this.labelMap.keys()) {
			visibilityChanged = this.updateLabelVisibility(elementId, true) || visibilityChanged
		}
		if (visibilityChanged) {
			this.requestOverlayDraw("all-labels-visibility")
		}
	}

	/**
	 * Re-evaluates only labels whose interaction state can change. Selection and edit-mode events do
	 * not change every element's visibility rule, so scanning the entire mounted label map here only
	 * adds work to the input path. The full method above remains an explicit recovery fallback.
	 */
	protected updateLabelsVisibilityForElements(
		elementIds: Iterable<string>,
		reason: string,
		context = BaseLabelManager.createLabelLayoutSyncContext(),
	): void {
		let visibilityChanged = false
		for (const elementId of this.collectActiveLabelElementIds(elementIds)) {
			visibilityChanged =
				this.updateLabelVisibility(elementId, true, undefined, context) || visibilityChanged
		}
		if (visibilityChanged) this.requestOverlayDraw(`${reason}-labels-visibility`)
	}

	/**
	 * Labels that are always eligible by type are created from the spatial window instead of from
	 * every element lifecycle event. Interaction labels still need an immediate creation path so a
	 * freshly selected or hovered element never waits for a viewport drain.
	 */
	private shouldCreateLabelImmediately(elementId: string): boolean {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) return false
		return (
			this.shouldRetainLabelForInteraction(elementId) ||
			!this.shouldTreatAsAlwaysVisible(element.getData().type)
		)
	}

	/**
	 * A label outside the buffered spatial window is retained only while it is needed for an active
	 * interaction. This bounds the overlay node count while preserving selection, hover and editing.
	 */
	private shouldRetainLabelForInteraction(elementId: string): boolean {
		if (this.shouldRetainHiddenLabel(elementId)) return true
		if (this.canvas.selectionManager?.isSelected(elementId)) return true
		if (this.canvas.hoverManager?.getHoveredElementId() === elementId) return true
		if (this.canvas.cropManager?.getCroppingElementId() === elementId) return true
		if (this.canvas.extendManager?.getExtendingElementId() === elementId) return true
		return this.canvas.eraserManager?.getErasingElementId() === elementId
	}

	private getInteractionAffectedElementIds(elementId: string): string[] {
		return [
			elementId,
			this.lastHoveredElementId,
			this.canvas.hoverManager?.getHoveredElementId(),
		].filter((id): id is string => Boolean(id))
	}

	/**
	 * Finds only mounted labels affected by a changed element or one of its ancestors.
	 * Walking the document tree here would make moving a Frame with thousands of children
	 * proportional to the whole subtree even when only a small label window is mounted.
	 */
	private collectActiveLabelElementIds(elementIds: Iterable<string>): Set<string> {
		const rootIds = new Set(elementIds)
		const relatedElementIds = new Set<string>()
		const ancestorRootIds = new Set<string>()

		for (const elementId of rootIds) {
			const element = this.canvas.elementManager.getElementInstance(elementId)
			if (this.labelMap.has(elementId) || element) {
				relatedElementIds.add(elementId)
			}
			const elementData = element?.getData()
			if (
				elementData &&
				"children" in elementData &&
				Array.isArray(elementData.children) &&
				elementData.children.length > 0
			) {
				ancestorRootIds.add(elementId)
			}
		}

		// Leaf transforms are the common path. Avoid scanning the whole active label map
		// unless a changed element can actually move descendants with it.
		if (ancestorRootIds.size === 0) return relatedElementIds

		for (const labelElementId of this.labelMap.keys()) {
			if (relatedElementIds.has(labelElementId)) continue

			const visitedParents = new Set<string>()
			let parentId = this.canvas.elementManager.findParentIdForElement(labelElementId)
			while (parentId && !visitedParents.has(parentId)) {
				if (ancestorRootIds.has(parentId)) {
					relatedElementIds.add(labelElementId)
					break
				}
				visitedParents.add(parentId)
				parentId = this.canvas.elementManager.findParentIdForElement(parentId)
			}
		}

		return relatedElementIds
	}

	/** Reconciles the bounded label workset without touching the local geometry of retained labels. */
	private syncLabelWindow(
		reason: string,
		requestDraw = true,
		context = BaseLabelManager.createLabelLayoutSyncContext(),
	): boolean {
		const candidateIds = new Set(this.getVisibleLabelCandidateIds())
		let changed = false

		for (const elementId of Array.from(this.labelMap.keys())) {
			if (candidateIds.has(elementId) || this.shouldRetainLabelForInteraction(elementId))
				continue
			this.removeLabel(elementId)
			changed = true
		}

		for (const elementId of candidateIds) {
			if (this.labelMap.has(elementId)) continue
			const created = this.createOrUpdateLabel(
				elementId,
				{
					skipReorder: true,
					skipNotify: true,
					skipBatchDraw: true,
				},
				context,
			)
			changed = created || changed
		}

		if (changed) {
			this.reorderAllLabels(true)
			if (requestDraw) this.requestOverlayDraw(`visible-label-window:${reason}`)
		}
		return changed
	}

	/**
	 * EventEmitter sends the same event object to both label managers. Reconcile the shared dirty
	 * workset once, then let each manager update its own mounted nodes so media layout caches are
	 * reused instead of invalidated and rebuilt twice in one transform frame.
	 */
	private syncDirtyLabelsForEvent(
		event: object,
		elementIds: Iterable<string>,
		reason: string,
		mode: DirtyLabelSyncMode,
	): void {
		if (BaseLabelManager.processedDirtySyncEvents.has(event)) return
		BaseLabelManager.processedDirtySyncEvents.add(event)
		const ids = Array.from(new Set(elementIds))
		if (mode !== "position-only") {
			const affectedElementIds = new Set(ids)
			for (const manager of BaseLabelManager.labelManagers) {
				if (manager.canvas !== this.canvas) continue
				manager
					.collectActiveLabelElementIds(ids)
					.forEach((elementId) => affectedElementIds.add(elementId))
			}
			invalidateMediaLabelLayouts(this.canvas, affectedElementIds)
		}
		const layoutContext = BaseLabelManager.createLabelLayoutSyncContext()

		for (const manager of BaseLabelManager.labelManagers) {
			if (manager.canvas === this.canvas)
				manager.syncDirtyLabels(ids, reason, mode, layoutContext)
		}
	}

	/**
	 * Reconciles only mounted labels whose geometry or label content changed. A frame update follows
	 * the parent chain of the mounted workset instead of enumerating every document child.
	 */
	private syncDirtyLabels(
		elementIds: readonly string[],
		reason: string,
		mode: DirtyLabelSyncMode,
		context: LabelLayoutSyncContext,
	): void {
		const rootElementIds = new Set(elementIds)
		const relatedElementIds = this.collectActiveLabelElementIds(elementIds)

		let requiresDraw = false
		let createdLabel = false
		let zOrderChanged = false
		for (const elementId of relatedElementIds) {
			const element = this.canvas.elementManager.getElementInstance(elementId)
			if (!element) {
				this.removeLabel(elementId)
				continue
			}
			if (!this.labelMap.has(elementId)) {
				if (this.shouldCreateLabelImmediately(elementId)) {
					const created = this.createOrUpdateLabel(
						elementId,
						{
							skipReorder: true,
							skipNotify: true,
							skipBatchDraw: true,
						},
						context,
					)
					createdLabel = created || createdLabel
					requiresDraw = created || requiresDraw
				}
				continue
			}
			const currentZIndex = element.getData().zIndex ?? 0
			const previousZIndex = this.labelZIndexes.get(elementId)
			if (previousZIndex !== undefined && previousZIndex !== currentZIndex) {
				zOrderChanged = true
			}
			this.labelZIndexes.set(elementId, currentZIndex)
			const positionOnly =
				mode === "position-only" || (mode === "anchor" && !rootElementIds.has(elementId))
			requiresDraw =
				(positionOnly
					? this.updateLabelPositionOnly(elementId, true)
					: this.updateLabelPosition(elementId, true, context)) || requiresDraw
		}

		if (createdLabel || zOrderChanged) this.reorderAllLabels(true)
		if (requiresDraw) this.requestOverlayDraw(`dirty-labels:${reason}`)
	}

	private getVisibleLabelCandidateIds(): string[] {
		const viewportSnapshot = this.canvas.viewportQueryCoordinator.getSnapshot()
		const candidateRevision = this.labelCandidateIndex.getRevision()
		const cached = this.visibleLabelQueryCache
		if (
			cached &&
			cached.candidateRevision === candidateRevision &&
			cached.viewportGeneration === viewportSnapshot.generation
		) {
			return cached.candidateIds
		}

		const elementIds = this.getLabelCandidateElementIds()
		const candidateIds = viewportSnapshot.labelElementIds.filter((elementId) =>
			elementIds.has(elementId),
		)
		this.visibleLabelQueryCache = {
			viewportGeneration: viewportSnapshot.generation,
			candidateIds,
			candidateRevision,
		}
		return candidateIds
	}

	private getLabelCandidateElementIds(): ReadonlySet<string> {
		const candidateTypes = new Set(this.visibilityConfig.alwaysVisibleTypes)
		if (this.mediaLabelsAlwaysVisible) {
			const mediaAlwaysVisibleTypes =
				this.visibilityConfig.alwaysVisibleWhenMediaLabelsEnabledTypes ??
				this.visibilityConfig.hoverOrSelectTypes
			mediaAlwaysVisibleTypes.forEach((elementType) => candidateTypes.add(elementType))
		}
		return this.labelCandidateIndex.getCandidateIds(candidateTypes)
	}

	private updateExistingLabels(
		skipBatchDraw = true,
		context = BaseLabelManager.createLabelLayoutSyncContext(),
	): boolean {
		const elementIds = Array.from(this.labelMap.keys())
		let requiresDraw = false

		for (const elementId of elementIds) {
			requiresDraw =
				this.updateLabelPosition(elementId, skipBatchDraw, context) || requiresDraw
		}

		return requiresDraw
	}

	private syncExistingLabels(
		reason: string,
		context = BaseLabelManager.createLabelLayoutSyncContext(),
	): void {
		const currentViewportScale = this.canvas.stage.scaleX()
		if (this.lastSyncedViewportScale === currentViewportScale) return
		if (this.updateExistingLabels(true, context)) {
			this.requestOverlayDraw(`visible-labels:${reason}`)
		}
		this.lastSyncedViewportScale = currentViewportScale
	}

	private syncVisibleLabels(
		reason: string,
		context = BaseLabelManager.createLabelLayoutSyncContext(),
	): void {
		let requiresDraw = this.syncLabelWindow(reason, false, context)
		const currentViewportScale = this.canvas.stage.scaleX()
		const shouldUpdateExistingLabels =
			this.lastSyncedViewportScale === null ||
			this.lastSyncedViewportScale !== currentViewportScale ||
			reason === "document-restored" ||
			reason === "locale" ||
			reason === "media-label-visibility" ||
			reason === "transform-end"

		if (shouldUpdateExistingLabels) {
			requiresDraw = this.updateExistingLabels(true, context) || requiresDraw
		}

		if (reason === "document-restored") {
			this.reorderAllLabels(true)
			requiresDraw = this.labelMap.size > 0 || requiresDraw
		}

		if (requiresDraw) {
			this.requestOverlayDraw(`visible-labels:${reason}`)
		}
		this.lastSyncedViewportScale = currentViewportScale
	}

	private pruneMissingLabels(): void {
		for (const elementId of Array.from(this.labelMap.keys())) {
			if (!this.canvas.elementManager.hasElement(elementId)) {
				this.removeLabel(elementId)
			}
		}
	}

	/**
	 * 通知其他 LabelManager 更新指定元素的可见性
	 * @param elementId - 元素 ID
	 * @param skipBatchDraw - 是否跳过 batchDraw（用于批量更新时统一调用）
	 */
	private notifyOtherManagersUpdateVisibility(
		elementId: string,
		skipBatchDraw = false,
		context?: LabelLayoutSyncContext,
	): boolean {
		let visibilityChanged = false
		for (const manager of BaseLabelManager.labelManagers) {
			if (manager !== this && manager.labelMap.has(elementId)) {
				visibilityChanged =
					manager.updateLabelVisibility(elementId, skipBatchDraw, undefined, context) ||
					visibilityChanged
			}
		}
		return visibilityChanged
	}

	/**
	 * 移除标签
	 */
	protected removeLabel(elementId: string): void {
		const labelGroup = this.labelMap.get(elementId)
		if (labelGroup) {
			labelGroup.destroy()
			this.labelMap.delete(elementId)
			this.labelZIndexes.delete(elementId)
		}
	}

	/**
	 * 判断元素是否需要显示标签
	 */
	protected shouldShowLabel(elementId: string): boolean {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) {
			return false
		}

		const elementType = element.getData().type

		// 检查元素类型是否在配置的类型集合中
		return this.visibilityConfig.elementTypes.has(elementType)
	}

	/**
	 * 重新排列所有标签的层级顺序
	 * 根据元素的 zIndex 来调整标签在 labelLayer 中的顺序
	 */
	protected reorderAllLabels(skipBatchDraw = false): void {
		// 获取所有有标签的元素，并按 zIndex 升序排序（zIndex 小的在底层）
		const elementIdsWithLabels = Array.from(this.labelMap.keys())
		const sortedElementIds = elementIdsWithLabels
			.map((id) => {
				const element = this.canvas.elementManager.getElementInstance(id)
				return {
					id,
					zIndex: element?.getData().zIndex ?? 0,
				}
			})
			.sort((a, b) => a.zIndex - b.zIndex)
			.map((item) => item.id)

		// 按照排序后的顺序，依次将标签移到顶部
		// 这样最终的顺序就是 zIndex 从小到大
		for (const elementId of sortedElementIds) {
			const labelGroup = this.labelMap.get(elementId)
			if (labelGroup) {
				labelGroup.moveToTop()
			}
		}

		if (!skipBatchDraw) {
			this.requestOverlayDraw("label-z-order")
		}
	}

	/**
	 * 初始化所有现有元素的标签
	 */
	public initializeAllLabels(): void {
		this.syncVisibleLabels("initialize")
	}

	/**
	 * 画布翻译函数切换后，刷新已存在标签的文案与布局（如默认元素名、尺寸标签）
	 */
	public refreshAfterLocaleChange(): void {
		this.syncVisibleLabels("locale")
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		if (this.destroyed) return
		this.destroyed = true
		this.cancelVisibleLabelSync()
		for (const unsubscribe of this.eventUnsubscribers) {
			unsubscribe()
		}
		this.eventUnsubscribers = []
		BaseLabelManager.releaseCandidateIndex(this.canvas)
		BaseLabelManager.cancelSharedVisibleLabelSync(this.canvas)

		// 从静态列表中移除
		const index = BaseLabelManager.labelManagers.indexOf(this)
		if (index > -1) {
			BaseLabelManager.labelManagers.splice(index, 1)
		}

		// 清理所有标签
		for (const labelGroup of this.labelMap.values()) {
			labelGroup.destroy()
		}
		this.labelMap.clear()
		this.labelMeasureNode?.destroy()
		this.labelMeasureNode = null
		this.labelZIndexes.clear()
		this.visibleLabelQueryCache = null
		this.lastSyncedViewportScale = null

		// 清理追踪的 hover 元素
		this.lastHoveredElementId = null
	}
}
