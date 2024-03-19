import { makeAutoObservable } from "mobx"

const STORAGE_KEY = "supermagic-topic-conversation-panel"

interface ConversationPanelState {
	collapsed?: boolean
	lastExpandedSize?: number | null
}

export class ConversationPanelStore {
	collapsed = false
	lastExpandedSize: number | null = null

	readonly COLLAPSED_WIDTH = 40
	readonly COLLAPSE_TRIGGER_SIZE_EPSILON = 0.2
	readonly COLLAPSE_TRIGGER_DRAG_DISTANCE_RATIO = 1

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
		this.loadFromStorage()
	}

	setCollapsed(collapsed: boolean) {
		this.collapsed = collapsed
		this.saveToStorage()
	}

	toggleCollapsed() {
		this.collapsed = !this.collapsed
		this.saveToStorage()
	}

	setLastExpandedSize(size: number) {
		if (!Number.isFinite(size) || size <= 0) return
		this.lastExpandedSize = size
		this.saveToStorage()
	}

	getExpandedSize(defaultSize: number) {
		return this.lastExpandedSize ?? defaultSize
	}

	getCollapsedSizePercent(containerWidth: number) {
		if (!containerWidth) return 4
		const collapsedSizePercent = (this.COLLAPSED_WIDTH / containerWidth) * 100
		return Math.max(2, Math.min(8, collapsedSizePercent))
	}

	shouldAutoCollapse(size: number, minSize: number) {
		return size <= minSize + this.COLLAPSE_TRIGGER_SIZE_EPSILON
	}

	getAutoCollapseDragDistance(panelWidthPx: number) {
		if (!Number.isFinite(panelWidthPx) || panelWidthPx <= 0) return 0
		return panelWidthPx * this.COLLAPSE_TRIGGER_DRAG_DISTANCE_RATIO
	}

	shouldAutoCollapseByDragDistance(dragDistancePx: number, panelWidthPx: number) {
		return dragDistancePx >= this.getAutoCollapseDragDistance(panelWidthPx)
	}

	private loadFromStorage() {
		try {
			const saved = localStorage.getItem(STORAGE_KEY)
			if (!saved) return
			const parsed = JSON.parse(saved) as ConversationPanelState
			this.collapsed = parsed.collapsed ?? false
			this.lastExpandedSize = parsed.lastExpandedSize ?? null
		} catch (error) {
			console.error("Failed to load conversation panel state:", error)
		}
	}

	private saveToStorage() {
		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					collapsed: this.collapsed,
					lastExpandedSize: this.lastExpandedSize,
				}),
			)
		} catch (error) {
			console.error("Failed to save conversation panel state:", error)
		}
	}
}

export const conversationPanelStore = new ConversationPanelStore()
