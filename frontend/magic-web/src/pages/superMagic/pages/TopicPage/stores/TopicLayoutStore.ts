import { makeAutoObservable } from "mobx"
import { getResizeCollapseIntent } from "@/utils/resizableCollapse"
import {
	DEFAULT_MAX_WIDTH,
	PROJECT_SIDER_PANEL_STORAGE_KEY,
	TOPIC_HISTORY_RESIZE,
	DEFAULT_MIN_WIDTH,
	DEFAULT_WIDTH,
	LOW_RESOLUTION_VIEWPORT_WIDTH_PX,
	MESSAGE_PANEL_WIDTH_STORAGE_KEY,
	PROJECT_SIDER_WIDTH_STORAGE_KEY,
} from "../../../constants/resizablePanel"

type DragType = "project" | "message" | "history" | null

interface ConversationPanelState {
	collapsed?: boolean
	lastExpandedSize?: number | null
}

/** Where the project sider collapse preference lives, and its state before the user chooses. */
export interface ProjectSiderPanelPersistence {
	storageKey: string
	/** Used only when nothing has been saved under `storageKey` yet. */
	defaultCollapsed: boolean
}

export const DEFAULT_PROJECT_SIDER_PANEL_PERSISTENCE: ProjectSiderPanelPersistence = {
	storageKey: PROJECT_SIDER_PANEL_STORAGE_KEY,
	defaultCollapsed: false,
}

interface TopicLayoutStoreOptions {
	/** Lets a page keep its own sider collapse preference instead of the shared project one. */
	projectSiderPanelPersistence?: ProjectSiderPanelPersistence
	/** Controls whether the conversation collapse state is shared across page mounts. */
	persistConversationPanelState?: boolean
	/** Initial state for temporary layouts that do not restore the shared preference. */
	initialConversationPanelCollapsed?: boolean
	bufferedMessageCollapse?: boolean
	allowConversationPanelResize?: boolean
}

export interface HistoryDragResult {
	width: number
}

const CONVERSATION_PANEL_STORAGE_KEY = "supermagic-topic-conversation-panel"

export class TopicLayoutStore {
	projectSiderWidthPx: number = DEFAULT_WIDTH.PROJECT_SIDER
	messagePanelWidthPx: number = DEFAULT_WIDTH.MESSAGE_PANEL
	isConversationPanelCollapsed = false
	lastExpandedMessagePanelWidthPx: number | null = null
	isDraggingProjectSider = false
	isDraggingMessagePanel = false
	containerWidthPx = 0
	isProjectSiderCollapsed = false
	lastExpandedProjectSiderWidthPx = DEFAULT_WIDTH.PROJECT_SIDER
	isDraggingHistoryPanel = false
	historyDragWidthPx: number = TOPIC_HISTORY_RESIZE.default
	collapseProgress = 0
	isCollapseArmed = false
	private bufferedProjectDrag = false
	private dragStartHistoryWidthPx = 0
	private historyPreferredWidthPx = 0
	private historyDragPointerX = 0
	private historyMaxWidthPx: number = TOPIC_HISTORY_RESIZE.max

	readonly COLLAPSED_MESSAGE_PANEL_WIDTH = 24
	readonly COLLAPSE_TRIGGER_SIZE_EPSILON = 0.2
	readonly COLLAPSE_TRIGGER_DRAG_DISTANCE_RATIO = 1

	private activeDrag: DragType = null
	private dragStartX = 0
	private dragStartProjectSiderWidthPx = 0
	private dragStartMessagePanelWidthPx = 0
	private dragStartVisibleMessageWidthPx = 0
	private messageDragPointerX = 0
	private minSizeReachedPointerX: number | null = null
	private minSizeReachedPanelWidthPx: number | null = null
	private readonly persistConversationPanelState: boolean
	private readonly bufferedMessageCollapse: boolean
	private allowConversationPanelResize: boolean
	private readonly projectSiderPanelPersistence: ProjectSiderPanelPersistence

	/** Creates one layout state container with optional conversation-state persistence. */
	constructor({
		projectSiderPanelPersistence = DEFAULT_PROJECT_SIDER_PANEL_PERSISTENCE,
		persistConversationPanelState = true,
		initialConversationPanelCollapsed = false,
		bufferedMessageCollapse = false,
		allowConversationPanelResize = true,
	}: TopicLayoutStoreOptions = {}) {
		this.projectSiderPanelPersistence = projectSiderPanelPersistence
		this.persistConversationPanelState = persistConversationPanelState
		this.isConversationPanelCollapsed = initialConversationPanelCollapsed
		this.bufferedMessageCollapse = bufferedMessageCollapse
		this.allowConversationPanelResize = allowConversationPanelResize
		makeAutoObservable(this, {}, { autoBind: true })
		this.initFromStorage()
		if (!allowConversationPanelResize) this.isConversationPanelCollapsed = false
	}

	setConversationPanelResizeAllowed(allowed: boolean) {
		this.allowConversationPanelResize = allowed
		if (allowed) return
		if (this.activeDrag === "message") this.cancelDrag()
		// 预览隐藏后消息成为唯一主内容，不能保留一个可被迟到 pointerup 提交的收起意图。
		this.isConversationPanelCollapsed = false
	}

	initFromStorage() {
		this.projectSiderWidthPx = this.loadValidPixelWidth({
			storageKey: PROJECT_SIDER_WIDTH_STORAGE_KEY,
			defaultWidth: this.getInitialPanelWidth({
				defaultWidth: DEFAULT_WIDTH.PROJECT_SIDER,
				minWidth: DEFAULT_MIN_WIDTH.PROJECT_SIDER,
			}),
			minWidth: DEFAULT_MIN_WIDTH.PROJECT_SIDER,
			maxWidth: DEFAULT_MAX_WIDTH.PROJECT_SIDER,
		})
		this.messagePanelWidthPx = this.loadValidPixelWidth({
			storageKey: MESSAGE_PANEL_WIDTH_STORAGE_KEY,
			defaultWidth: this.getInitialPanelWidth({
				defaultWidth: DEFAULT_WIDTH.MESSAGE_PANEL,
				minWidth: DEFAULT_MIN_WIDTH.MESSAGE_PANEL,
			}),
			minWidth: DEFAULT_MIN_WIDTH.MESSAGE_PANEL,
			maxWidth: DEFAULT_MAX_WIDTH.MESSAGE_PANEL,
		})
		try {
			const saved = JSON.parse(
				localStorage.getItem(this.projectSiderPanelPersistence.storageKey) || "null",
			) as ConversationPanelState | null
			this.isProjectSiderCollapsed =
				typeof saved?.collapsed === "boolean"
					? saved.collapsed
					: this.projectSiderPanelPersistence.defaultCollapsed
			this.lastExpandedProjectSiderWidthPx =
				typeof saved?.lastExpandedSize === "number" &&
				Number.isFinite(saved.lastExpandedSize)
					? this.clampProjectWidth(saved.lastExpandedSize)
					: this.projectSiderWidthPx
		} catch {
			this.lastExpandedProjectSiderWidthPx = this.projectSiderWidthPx
		}
		if (this.persistConversationPanelState) {
			this.loadConversationPanelState()
		}
	}

	setContainerWidth(width: number) {
		if (!Number.isFinite(width) || width <= 0) return
		this.containerWidthPx = width
	}

	startDragProjectSider(clientX: number, buffered = false) {
		if (!Number.isFinite(clientX)) return
		this.bufferedProjectDrag = buffered
		this.activeDrag = "project"
		this.isDraggingProjectSider = true
		this.dragStartX = clientX
		this.dragStartProjectSiderWidthPx = this.projectSiderWidthPx
	}

	startDragMessagePanel(clientX: number, visibleWidth = this.messagePanelWidthPx) {
		if (
			!Number.isFinite(clientX) ||
			this.isConversationPanelCollapsed ||
			!this.allowConversationPanelResize
		)
			return
		this.activeDrag = "message"
		this.isDraggingMessagePanel = true
		this.dragStartX = clientX
		this.dragStartMessagePanelWidthPx = this.messagePanelWidthPx
		// 话题列可能压缩显示宽度；拖拽从可见边界起算，取消时仍恢复原偏好。
		this.dragStartVisibleMessageWidthPx = this.clampMessageWidth(visibleWidth)
		this.messageDragPointerX = clientX
		this.minSizeReachedPointerX = null
		this.minSizeReachedPanelWidthPx = null
	}

	updateDrag(clientX: number) {
		if (!Number.isFinite(clientX)) return

		if (this.activeDrag === "project") {
			const deltaX = clientX - this.dragStartX
			const rawWidth = this.dragStartProjectSiderWidthPx + deltaX
			this.projectSiderWidthPx = this.clampProjectWidth(rawWidth)
			if (this.bufferedProjectDrag)
				this.updateCollapseIntent(rawWidth, DEFAULT_MIN_WIDTH.PROJECT_SIDER)
			return
		}

		if (this.activeDrag === "history") {
			this.historyDragPointerX = clientX
			const rawWidth = this.dragStartHistoryWidthPx - (clientX - this.dragStartX)
			this.historyDragWidthPx = Math.max(
				TOPIC_HISTORY_RESIZE.min,
				Math.min(this.historyMaxWidthPx, rawWidth),
			)
			return
		}

		if (
			this.activeDrag !== "message" ||
			this.isConversationPanelCollapsed ||
			!this.allowConversationPanelResize
		) {
			return
		}

		const deltaX = clientX - this.dragStartX
		this.messageDragPointerX = clientX
		const startWidth = this.bufferedMessageCollapse
			? this.dragStartVisibleMessageWidthPx
			: this.dragStartMessagePanelWidthPx
		const rawWidth = startWidth - deltaX
		const nextWidth = this.clampMessageWidth(rawWidth)
		this.messagePanelWidthPx = nextWidth
		if (this.bufferedMessageCollapse) {
			this.updateCollapseIntent(rawWidth, DEFAULT_MIN_WIDTH.MESSAGE_PANEL)
			return
		}

		const minWidth = DEFAULT_MIN_WIDTH.MESSAGE_PANEL
		if (nextWidth <= minWidth + this.COLLAPSE_TRIGGER_SIZE_EPSILON) {
			if (this.minSizeReachedPointerX === null) {
				this.minSizeReachedPointerX = clientX
				this.minSizeReachedPanelWidthPx = nextWidth
				return
			}

			if (
				this.minSizeReachedPointerX !== null &&
				this.minSizeReachedPanelWidthPx !== null &&
				this.shouldAutoCollapseByDragDistance(
					clientX - this.minSizeReachedPointerX,
					this.minSizeReachedPanelWidthPx,
				)
			) {
				this.collapseConversationPanel()
				this.clearDragState()
			}
			return
		}

		this.minSizeReachedPointerX = null
		this.minSizeReachedPanelWidthPx = null
		this.lastExpandedMessagePanelWidthPx = nextWidth
	}

	startDragHistoryPanel(
		clientX: number,
		width: number,
		preferredWidth: number,
		maxWidth: number,
	) {
		if (!Number.isFinite(clientX)) return
		this.activeDrag = "history"
		this.isDraggingHistoryPanel = true
		this.dragStartX = clientX
		this.historyDragPointerX = clientX
		this.dragStartHistoryWidthPx = width
		this.historyPreferredWidthPx = preferredWidth
		this.historyDragWidthPx = width
		this.historyMaxWidthPx = maxWidth
	}

	private updateCollapseIntent(rawWidth: number, minWidth: number) {
		// 内容停在最小宽度；越界距离只表达意图，松开才提交收起。
		const intent = getResizeCollapseIntent(rawWidth, minWidth, this.isCollapseArmed)
		this.collapseProgress = intent.progress
		this.isCollapseArmed = intent.armed
	}

	collapseProjectSider() {
		if (this.isProjectSiderCollapsed) return
		this.lastExpandedProjectSiderWidthPx = this.projectSiderWidthPx
		this.isProjectSiderCollapsed = true
		this.saveProjectPanelState()
	}

	expandProjectSider() {
		this.projectSiderWidthPx = this.clampProjectWidth(this.lastExpandedProjectSiderWidthPx)
		this.isProjectSiderCollapsed = false
		this.saveProjectPanelState()
	}

	private saveProjectPanelState() {
		try {
			localStorage.setItem(
				this.projectSiderPanelPersistence.storageKey,
				JSON.stringify({
					collapsed: this.isProjectSiderCollapsed,
					lastExpandedSize: this.lastExpandedProjectSiderWidthPx,
				}),
			)
			this.saveWidth(PROJECT_SIDER_WIDTH_STORAGE_KEY, this.projectSiderWidthPx)
		} catch (error) {
			console.error("Failed to save project panel state:", error)
		}
	}

	endDrag(): HistoryDragResult | undefined {
		if (this.activeDrag === "history") {
			// 仅点击手柄时，不把窗口限制后的显示宽度覆盖为用户的新偏好。
			const result = {
				width:
					this.historyDragPointerX === this.dragStartX
						? this.historyPreferredWidthPx
						: this.historyDragWidthPx,
			}
			this.clearDragState()
			return result
		}
		if (this.activeDrag === "project" && this.bufferedProjectDrag && this.isCollapseArmed) {
			this.projectSiderWidthPx = this.dragStartProjectSiderWidthPx
			this.collapseProjectSider()
		}
		if (
			this.activeDrag === "message" &&
			this.bufferedMessageCollapse &&
			this.allowConversationPanelResize
		) {
			if (this.messageDragPointerX === this.dragStartX)
				this.messagePanelWidthPx = this.dragStartMessagePanelWidthPx
			if (this.isCollapseArmed) {
				this.messagePanelWidthPx = this.dragStartMessagePanelWidthPx
				this.lastExpandedMessagePanelWidthPx = this.dragStartMessagePanelWidthPx
				this.collapseConversationPanel()
			} else this.lastExpandedMessagePanelWidthPx = this.messagePanelWidthPx
		}
		if (!this.isDraggingProjectSider && !this.isDraggingMessagePanel) {
			return
		}

		this.persistWidths()
		this.saveConversationPanelState()
		this.clearDragState()
	}

	cancelDrag() {
		if (this.activeDrag === "project" && this.bufferedProjectDrag)
			this.projectSiderWidthPx = this.dragStartProjectSiderWidthPx
		if (this.activeDrag === "history") this.historyDragWidthPx = this.dragStartHistoryWidthPx
		if (this.activeDrag === "message" && this.bufferedMessageCollapse)
			this.messagePanelWidthPx = this.dragStartMessagePanelWidthPx
		// Browser-cancelled gestures should stop resizing without committing transient widths.
		this.clearDragState()
	}

	toggleConversationPanel() {
		if (this.isConversationPanelCollapsed) {
			this.expandConversationPanel()
			return
		}
		this.collapseConversationPanel()
	}

	expandConversationPanel() {
		const target = this.clampMessageWidth(
			this.lastExpandedMessagePanelWidthPx ?? this.messagePanelWidthPx,
		)
		this.messagePanelWidthPx = target
		this.isConversationPanelCollapsed = false
		this.saveConversationPanelState()
		this.persistWidths()
	}

	collapseConversationPanel() {
		if (!this.allowConversationPanelResize) return
		if (!this.isConversationPanelCollapsed) {
			if (
				this.messagePanelWidthPx >
				DEFAULT_MIN_WIDTH.MESSAGE_PANEL + this.COLLAPSE_TRIGGER_SIZE_EPSILON
			) {
				this.lastExpandedMessagePanelWidthPx = this.messagePanelWidthPx
			}
			this.isConversationPanelCollapsed = true
			this.saveConversationPanelState()
		}
	}

	ensureExpandedWhenDetailVisible(shouldShowDetailPanel: boolean) {
		if (shouldShowDetailPanel && this.isConversationPanelCollapsed) {
			this.expandConversationPanel()
		}
	}

	private persistWidths() {
		this.saveWidth(PROJECT_SIDER_WIDTH_STORAGE_KEY, this.projectSiderWidthPx)
		this.saveWidth(MESSAGE_PANEL_WIDTH_STORAGE_KEY, this.messagePanelWidthPx)
	}

	private loadValidPixelWidth({
		storageKey,
		defaultWidth,
		minWidth,
		maxWidth,
	}: {
		storageKey: string
		defaultWidth: number
		minWidth: number
		maxWidth: number
	}) {
		try {
			const savedValue = localStorage.getItem(storageKey)
			if (!savedValue) return defaultWidth
			const width = Number(savedValue)
			if (!Number.isFinite(width)) return defaultWidth
			// Ignore legacy percentage values and only accept valid pixel values.
			if (width < minWidth || width > maxWidth || width <= 100) return defaultWidth
			return width
		} catch (error) {
			console.error(`Failed to load panel width (${storageKey}):`, error)
			return defaultWidth
		}
	}

	/**
	 * Apply compact defaults only for first-time layouts. Persisted widths remain the
	 * user's explicit preference and are restored by loadValidPixelWidth above.
	 */
	private getInitialPanelWidth({
		defaultWidth,
		minWidth,
	}: {
		defaultWidth: number
		minWidth: number
	}) {
		if (typeof window === "undefined") return defaultWidth
		return window.innerWidth <= LOW_RESOLUTION_VIEWPORT_WIDTH_PX ? minWidth : defaultWidth
	}

	private saveWidth(storageKey: string, width: number) {
		try {
			localStorage.setItem(storageKey, String(Math.round(width)))
		} catch (error) {
			console.error(`Failed to persist panel width (${storageKey}):`, error)
		}
	}

	private loadConversationPanelState() {
		try {
			const saved = localStorage.getItem(CONVERSATION_PANEL_STORAGE_KEY)
			if (!saved) return

			const parsed = JSON.parse(saved) as ConversationPanelState
			this.isConversationPanelCollapsed = Boolean(parsed.collapsed)
			if (
				typeof parsed.lastExpandedSize === "number" &&
				Number.isFinite(parsed.lastExpandedSize)
			) {
				this.lastExpandedMessagePanelWidthPx = this.clampMessageWidth(
					parsed.lastExpandedSize,
				)
			}
		} catch (error) {
			console.error("Failed to load conversation panel state:", error)
		}
	}

	private saveConversationPanelState() {
		if (!this.persistConversationPanelState) return
		try {
			localStorage.setItem(
				CONVERSATION_PANEL_STORAGE_KEY,
				JSON.stringify({
					collapsed: this.isConversationPanelCollapsed,
					lastExpandedSize: this.lastExpandedMessagePanelWidthPx,
				}),
			)
		} catch (error) {
			console.error("Failed to save conversation panel state:", error)
		}
	}

	private clampProjectWidth(width: number) {
		return Math.max(
			DEFAULT_MIN_WIDTH.PROJECT_SIDER,
			Math.min(DEFAULT_MAX_WIDTH.PROJECT_SIDER, width),
		)
	}

	private clampMessageWidth(width: number) {
		return Math.max(
			DEFAULT_MIN_WIDTH.MESSAGE_PANEL,
			Math.min(DEFAULT_MAX_WIDTH.MESSAGE_PANEL, width),
		)
	}

	private getAutoCollapseDragDistance(panelWidthPx: number) {
		if (!Number.isFinite(panelWidthPx) || panelWidthPx <= 0) return 0
		return panelWidthPx * this.COLLAPSE_TRIGGER_DRAG_DISTANCE_RATIO
	}

	private shouldAutoCollapseByDragDistance(dragDistancePx: number, panelWidthPx: number) {
		return dragDistancePx >= this.getAutoCollapseDragDistance(panelWidthPx)
	}

	private clearDragState() {
		this.isDraggingHistoryPanel = false
		this.collapseProgress = 0
		this.isCollapseArmed = false
		this.activeDrag = null
		this.isDraggingProjectSider = false
		this.isDraggingMessagePanel = false
		this.minSizeReachedPointerX = null
		this.minSizeReachedPanelWidthPx = null
	}
}
