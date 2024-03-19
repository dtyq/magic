import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { SidebarStore } from "../SidebarStore"
import { configure } from "mobx"

// Enable MobX strict mode for testing
configure({ enforceActions: "always" })

describe("SidebarStore", () => {
	let store: SidebarStore
	let resizeListeners: Array<() => void> = []

	beforeEach(() => {
		// Clear localStorage
		localStorage.clear()

		// Mock window.addEventListener to capture resize listener
		resizeListeners = []
		const originalAddEventListener = window.addEventListener
		vi.spyOn(window, "addEventListener").mockImplementation((event: string, handler: any) => {
			if (event === "resize") {
				resizeListeners.push(handler)
			}
			return originalAddEventListener.call(window, event, handler)
		})

		// Create new store instance
		store = new SidebarStore()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("Initialization", () => {
		it("should initialize with default values", () => {
			expect(store.collapsed).toBe(false)
			expect(store.activeWorkspace).toBeNull()
			expect(store.activeAgent).toBeNull()
			expect(store.expandedWorkspaces.size).toBe(0)
		})

		it("should initialize windowWidth from window.innerWidth", () => {
			expect(store.windowWidth).toBe(window.innerWidth)
		})

		it("should load state from localStorage", () => {
			const savedState = {
				collapsed: true,
				expandedWorkspaces: ["workspace-1", "workspace-2"],
			}
			localStorage.setItem("sidebar-state", JSON.stringify(savedState))

			const newStore = new SidebarStore()

			expect(newStore.collapsed).toBe(true)
			expect(newStore.expandedWorkspaces.has("workspace-1")).toBe(true)
			expect(newStore.expandedWorkspaces.has("workspace-2")).toBe(true)
		})
	})

	describe("Window Resize Handling", () => {
		it("should update windowWidth on window resize without MobX violations", () => {
			const initialWidth = store.windowWidth

			// Simulate window resize
			Object.defineProperty(window, "innerWidth", {
				writable: true,
				configurable: true,
				value: 1920,
			})

			// Trigger resize event
			resizeListeners.forEach((listener) => listener())

			expect(store.windowWidth).toBe(1920)
			expect(store.windowWidth).not.toBe(initialWidth)
		})

		it("should not throw MobX strict mode violations on resize", () => {
			// This test ensures the resize handler uses an action
			expect(() => {
				Object.defineProperty(window, "innerWidth", {
					writable: true,
					configurable: true,
					value: 1440,
				})

				resizeListeners.forEach((listener) => listener())
			}).not.toThrow()

			expect(store.windowWidth).toBe(1440)
		})
	})

	describe("Collapse/Expand", () => {
		it("should toggle collapsed state", () => {
			expect(store.collapsed).toBe(false)

			store.toggleCollapsed()
			expect(store.collapsed).toBe(true)

			store.toggleCollapsed()
			expect(store.collapsed).toBe(false)
		})

		it("should set collapsed state", () => {
			store.setCollapsed(true)
			expect(store.collapsed).toBe(true)

			store.setCollapsed(false)
			expect(store.collapsed).toBe(false)
		})

		it("should persist collapsed state to localStorage", () => {
			store.setCollapsed(true)

			const saved = localStorage.getItem("sidebar-state")
			expect(saved).toBeTruthy()

			const parsed = JSON.parse(saved!)
			expect(parsed.collapsed).toBe(true)
		})
	})

	describe("Active Menu", () => {
		it("should set active workspace", () => {
			store.setActiveWorkspace("workspace-123")
			expect(store.activeWorkspace).toBe("workspace-123")

			store.setActiveWorkspace(null)
			expect(store.activeWorkspace).toBeNull()
		})

		it("should set active agent", () => {
			store.setActiveAgent("agent-456")
			expect(store.activeAgent).toBe("agent-456")

			store.setActiveAgent(null)
			expect(store.activeAgent).toBeNull()
		})
	})

	describe("Workspace Expanded State", () => {
		it("should toggle workspace expanded state", () => {
			const workspaceId = "workspace-1"

			store.toggleWorkspaceExpanded(workspaceId)
			expect(store.expandedWorkspaces.has(workspaceId)).toBe(true)

			store.toggleWorkspaceExpanded(workspaceId)
			expect(store.expandedWorkspaces.has(workspaceId)).toBe(false)
		})

		it("should set workspace expanded state", () => {
			const workspaceId = "workspace-2"

			store.setWorkspaceExpanded(workspaceId, true)
			expect(store.expandedWorkspaces.has(workspaceId)).toBe(true)

			store.setWorkspaceExpanded(workspaceId, false)
			expect(store.expandedWorkspaces.has(workspaceId)).toBe(false)
		})

		it("should persist expanded workspaces to localStorage", () => {
			store.setWorkspaceExpanded("workspace-1", true)
			store.setWorkspaceExpanded("workspace-2", true)

			const saved = localStorage.getItem("sidebar-state")
			expect(saved).toBeTruthy()

			const parsed = JSON.parse(saved!)
			expect(parsed.expandedWorkspaces).toContain("workspace-1")
			expect(parsed.expandedWorkspaces).toContain("workspace-2")
		})
	})

	describe("Width Management", () => {
		it("should return default width when no saved value", () => {
			expect(store.width).toBe(store.DEFAULT_WIDTH)
		})

		it("should clamp width within min/max bounds", () => {
			// Test minimum
			store.setWidth(5)
			expect(store.width).toBeGreaterThanOrEqual(store.MIN_WIDTH_PERCENT)

			// Test maximum
			store.setWidth(80)
			expect(store.width).toBeLessThanOrEqual(store.MAX_WIDTH_PERCENT)
		})
	})

	describe("Computed Properties", () => {
		it("should calculate collapsedSizePercent based on windowWidth", () => {
			// Set a known window width
			Object.defineProperty(window, "innerWidth", {
				writable: true,
				configurable: true,
				value: 1000,
			})
			resizeListeners.forEach((listener) => listener())

			const expectedPercent = (store.COLLAPSED_WIDTH / 1000) * 100
			expect(store.collapsedSizePercent).toBeCloseTo(expectedPercent, 2)
		})

		it("should update collapsedSizePercent when windowWidth changes", () => {
			// Initial window width
			Object.defineProperty(window, "innerWidth", {
				writable: true,
				configurable: true,
				value: 1000,
			})
			resizeListeners.forEach((listener) => listener())

			const initialPercent = store.collapsedSizePercent

			// Change window width
			Object.defineProperty(window, "innerWidth", {
				writable: true,
				configurable: true,
				value: 2000,
			})
			resizeListeners.forEach((listener) => listener())

			const newPercent = store.collapsedSizePercent
			expect(newPercent).not.toBe(initialPercent)
			expect(newPercent).toBeCloseTo((store.COLLAPSED_WIDTH / 2000) * 100, 2)
		})
	})
})
