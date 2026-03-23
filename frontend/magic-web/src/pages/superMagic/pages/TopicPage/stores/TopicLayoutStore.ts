import { makeAutoObservable } from "mobx"
import {
	DEFAULT_MAX_WIDTH,
	DEFAULT_MIN_WIDTH,
	DEFAULT_WIDTH,
	MESSAGE_PANEL_WIDTH_STORAGE_KEY,
	PROJECT_SIDER_WIDTH_STORAGE_KEY,
} from "../../../constants/resizablePanel"

type DragType = "project" | "message" | null

interface ConversationPanelState {
	collapsed?: boolean
	lastExpandedSize?: number | null
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

	readonly COLLAPSED_MESSAGE_PANEL_WIDTH = 40
	readonly COLLAPSE_TRIGGER_SIZE_EPSILON = 0.2
	readonly COLLAPSE_TRIGGER_DRAG_DISTANCE_RATIO = 1

	private activeDrag: DragType = null
	private dragStartX = 0
	private dragStartProjectSiderWidthPx = 0
	private dragStartMessagePanelWidthPx = 0
	private minSizeReachedPointerX: number | null = null
	private minSizeReachedPanelWidthPx: number | null = null

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
		this.initFromStorage()
	}

	initFromStorage() {
		this.projectSiderWidthPx = this.loadValidPixelWidth({
			storageKey: PROJECT_SIDER_WIDTH_STORAGE_KEY,
			defaultWidth: DEFAULT_WIDTH.PROJECT_SIDER,
			minWidth: DEFAULT_MIN_WIDTH.PROJECT_SIDER,
			maxWidth: DEFAULT_MAX_WIDTH.PROJECT_SIDER,
		})
		this.messagePanelWidthPx = this.loadValidPixelWidth({
			storageKey: MESSAGE_PANEL_WIDTH_STORAGE_KEY,
			defaultWidth: DEFAULT_WIDTH.MESSAGE_PANEL,
			minWidth: DEFAULT_MIN_WIDTH.MESSAGE_PANEL,
			maxWidth: DEFAULT_MAX_WIDTH.MESSAGE_PANEL,
		})
		this.loadConversationPanelState()
	}

	setContainerWidth(width: number) {
		if (!Number.isFinite(width) || width <= 0) return
		this.containerWidthPx = width
	}

	startDragProjectSider(clientX: number) {
		if (!Number.isFinite(clientX)) return
		this.activeDrag = "project"
		this.isDraggingProjectSider = true
		this.dragStartX = clientX
		this.dragStartProjectSiderWidthPx = this.projectSiderWidthPx
	}

	startDragMessagePanel(clientX: number) {
		if (!Number.isFinite(clientX) || this.isConversationPanelCollapsed) return
		this.activeDrag = "message"
		this.isDraggingMessagePanel = true
		this.dragStartX = clientX
		this.dragStartMessagePanelWidthPx = this.messagePanelWidthPx
		this.minSizeReachedPointerX = null
		this.minSizeReachedPanelWidthPx = null
	}

	updateDrag(clientX: number) {
		if (!Number.isFinite(clientX)) return

		if (this.activeDrag === "project") {
			const deltaX = clientX - this.dragStartX
			this.projectSiderWidthPx = this.clampProjectWidth(
				this.dragStartProjectSiderWidthPx + deltaX,
			)
			return
		}

		if (this.activeDrag !== "message" || this.isConversationPanelCollapsed) {
			return
		}

		const deltaX = clientX - this.dragStartX
		const nextWidth = this.clampMessageWidth(this.dragStartMessagePanelWidthPx - deltaX)
		this.messagePanelWidthPx = nextWidth

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

	endDrag() {
		if (!this.isDraggingProjectSider && !this.isDraggingMessagePanel) {
			return
		}

		this.persistWidths()
		this.saveConversationPanelState()
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
		this.activeDrag = null
		this.isDraggingProjectSider = false
		this.isDraggingMessagePanel = false
		this.minSizeReachedPointerX = null
		this.minSizeReachedPanelWidthPx = null
	}
}
