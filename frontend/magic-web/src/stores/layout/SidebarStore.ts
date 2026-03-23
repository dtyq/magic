import { makeAutoObservable, computed, untracked } from "mobx"
import { resizablePanelStore } from "./ResizablePanelStore"

const STORAGE_KEY = "sidebar-state"
const SIDEBAR_WIDTH_KEY = "sidebar-width"

export class SidebarStore {
	// Sidebar collapse state
	collapsed: boolean = false

	// Window width for responsive calculations
	windowWidth: number = window.innerWidth

	// Min/Max width constraints (in percentage)
	readonly MIN_WIDTH_PERCENT = 12
	readonly MAX_WIDTH_PERCENT = 50
	readonly COLLAPSED_WIDTH = 48
	readonly DEFAULT_WIDTH_PX = 256
	readonly AUTO_COLLAPSE_MIN_VIEWPORT_WIDTH_PX = 1728

	// Min main content width; collapse sidebar if viewport is too narrow
	readonly MIN_MAIN_CONTENT_WIDTH_PX = 720

	// Responsive: in 768–1024 viewport, scale down min main so sidebar isn't over-compressed
	readonly NARROW_VIEWPORT_MIN = 768
	readonly NARROW_VIEWPORT_MAX = 1024
	readonly NARROW_VIEWPORT_MIN_MAIN_PX = 480

	// Active menu item
	activeWorkspace: string | null = null
	activeAgent: string | null = null

	// Workspace expanded state (for lazy loading)
	expandedWorkspaces: Set<string> = new Set()

	constructor() {
		makeAutoObservable(
			this,
			{
				collapsedSizePercent: computed,
				// width is a plain method, not computed, to avoid MobX tracking
			},
			{ autoBind: true },
		)
		this.loadFromStorage()
		this.setupWindowResize()
	}

	// Width getter - reads from ResizablePanelStore's non-observable cache
	// Uses untracked to prevent MobX from tracking this as a dependency
	get width(): number {
		return untracked(() => {
			// First check ResizablePanelStore's memory cache (fastest)
			const cached = resizablePanelStore.panelSizes.get(SIDEBAR_WIDTH_KEY)
			if (cached !== undefined) {
				return cached
			}

			// If not in cache, read from localStorage
			const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY)
			if (saved) {
				const value = parseFloat(saved)
				if (!isNaN(value) && value > 0 && value <= 100) {
					// Cache it for next time
					resizablePanelStore.panelSizes.set(SIDEBAR_WIDTH_KEY, value)
					return value
				}
			}

			// Keep the first-open width stable across large screens.
			return this.getDefaultWidthPercent()
		})
	}

	private getDefaultWidthPercent = () => {
		if (!this.windowWidth) return this.MIN_WIDTH_PERCENT

		const defaultWidthPercent = (this.DEFAULT_WIDTH_PX / this.windowWidth) * 100
		return Math.max(
			this.MIN_WIDTH_PERCENT,
			Math.min(this.MAX_WIDTH_PERCENT, defaultWidthPercent),
		)
	}

	// Computed: collapsed width as percentage
	get collapsedSizePercent(): number {
		return (this.COLLAPSED_WIDTH / this.windowWidth) * 100
	}

	// Update window width (must be an action for MobX strict mode)
	private setWindowWidth = (width: number) => {
		this.windowWidth = width
	}

	// Update window width on resize
	private setupWindowResize = () => {
		const handleResize = () => {
			this.setWindowWidth(window.innerWidth)
		}

		window.addEventListener("resize", handleResize)

		// Cleanup function (should be called when store is disposed)
		return () => {
			window.removeEventListener("resize", handleResize)
		}
	}

	/** Responsive min main content width: 720px on wide screens, scales down in 768–1024 range */
	getMinMainContentWidthPx = (viewWidth: number): number => {
		if (viewWidth >= this.NARROW_VIEWPORT_MAX) return this.MIN_MAIN_CONTENT_WIDTH_PX
		if (viewWidth <= this.NARROW_VIEWPORT_MIN) return this.NARROW_VIEWPORT_MIN_MAIN_PX
		const t =
			(viewWidth - this.NARROW_VIEWPORT_MIN) /
			(this.NARROW_VIEWPORT_MAX - this.NARROW_VIEWPORT_MIN)
		return (
			this.NARROW_VIEWPORT_MIN_MAIN_PX +
			t * (this.MIN_MAIN_CONTENT_WIDTH_PX - this.NARROW_VIEWPORT_MIN_MAIN_PX)
		)
	}

	getAutoCollapseThresholdPx = (viewWidth: number, sidebarWidthPx: number): number => {
		const minMain = this.getMinMainContentWidthPx(viewWidth)
		return Math.max(this.AUTO_COLLAPSE_MIN_VIEWPORT_WIDTH_PX, sidebarWidthPx + minMain)
	}

	// Collapse sidebar only if the viewport is too narrow to show both
	collapseIfNarrow = () => {
		const viewWidth = window.innerWidth
		const sidebarWidthPx = (this.width / 100) * viewWidth
		const autoCollapseThreshold = this.getAutoCollapseThresholdPx(viewWidth, sidebarWidthPx)
		if (viewWidth <= autoCollapseThreshold) {
			this.setCollapsed(true)
		}
	}

	// Toggle collapse/expand
	toggleCollapsed = () => {
		this.collapsed = !this.collapsed
		this.saveToStorage()
	}

	// Set collapsed state
	setCollapsed = (collapsed: boolean) => {
		this.collapsed = collapsed
		this.saveToStorage()
	}

	// Set width (during resize) - uses ResizablePanelStore for throttling and delayed save
	setWidth = (width: number) => {
		const clampedWidth = Math.max(
			this.MIN_WIDTH_PERCENT,
			Math.min(this.MAX_WIDTH_PERCENT, width),
		)

		// Use ResizablePanelStore for throttled updates and delayed localStorage save
		// The actual UI width is managed by react-resizable-panels internally
		// No internal state update to avoid triggering MobX reactions during drag
		resizablePanelStore.updatePanelSize(SIDEBAR_WIDTH_KEY, clampedWidth)
	}

	// Force persist current width immediately (useful on unmount or navigation)
	persistWidth = () => {
		resizablePanelStore.persistPanelSize(SIDEBAR_WIDTH_KEY)
	}

	// Set active menu
	setActiveWorkspace = (id: string | null) => {
		this.activeWorkspace = id
	}

	setActiveAgent = (id: string | null) => {
		this.activeAgent = id
	}

	// Toggle workspace expanded state
	toggleWorkspaceExpanded = (workspaceId: string) => {
		if (this.expandedWorkspaces.has(workspaceId)) {
			this.expandedWorkspaces.delete(workspaceId)
		} else {
			this.expandedWorkspaces.add(workspaceId)
		}
		this.saveToStorage()
	}

	// Set workspace expanded state
	setWorkspaceExpanded = (workspaceId: string, expanded: boolean) => {
		if (expanded) {
			this.expandedWorkspaces.add(workspaceId)
		} else {
			this.expandedWorkspaces.delete(workspaceId)
		}
		this.saveToStorage()
	}

	// Persistence (width is now handled by ResizablePanelStore)
	private loadFromStorage = () => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY)
			if (saved) {
				const { collapsed, expandedWorkspaces } = JSON.parse(saved)
				this.collapsed = collapsed ?? false
				// Convert array back to Set
				if (Array.isArray(expandedWorkspaces)) {
					this.expandedWorkspaces = new Set(expandedWorkspaces)
				}
			}
			// Width is loaded automatically by ResizablePanelStore via computed getter
		} catch (error) {
			console.error("Failed to load sidebar state:", error)
		}
	}

	private saveToStorage = () => {
		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					collapsed: this.collapsed,
					// Width is saved separately by ResizablePanelStore
					// Convert Set to array for storage
					expandedWorkspaces: Array.from(this.expandedWorkspaces),
				}),
			)
		} catch (error) {
			console.error("Failed to save sidebar state:", error)
		}
	}
}

export const sidebarStore = new SidebarStore()
