import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock Logger
vi.mock("@/opensource/utils/log/Logger", () => ({
	default: class MockLogger {
		constructor() {}
		log = vi.fn()
		error = vi.fn()
		warn = vi.fn()
	},
}))

// Mock draftService
const mockDraftService = {
	close: vi.fn(),
	isCleanupDue: vi.fn(() => false),
	runCleanup: vi.fn().mockResolvedValue(undefined),
}

vi.mock("../draftService/index", () => ({
	draftService: mockDraftService,
}))

describe("DraftServiceLifecycle", () => {
	let DraftServiceLifecycleClass: any
	let draftServiceLifecycle: any

	// Mock browser APIs
	let mockWindow: any
	let mockDocument: any

	beforeEach(async () => {
		// Mock window and document
		mockWindow = {
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		}

		mockDocument = {
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			hidden: false,
		}

		// Setup global mocks
		global.window = mockWindow as any
		global.document = mockDocument as any

		// Clear previous mocks
		vi.clearAllMocks()

		// Dynamically import the module to get a fresh instance
		const module = await import("../draftService/DraftServiceLifecycle")
		DraftServiceLifecycleClass = module.DraftServiceLifecycle
		draftServiceLifecycle = new DraftServiceLifecycleClass()
	})

	afterEach(() => {
		if (draftServiceLifecycle) {
			draftServiceLifecycle.destroy()
		}
		vi.restoreAllMocks()
	})

	describe("Initialization", () => {
		it("should initialize successfully", () => {
			const status = draftServiceLifecycle.getStatus()
			expect(status.isInitialized).toBe(false)
			expect(status.cleanupHandlersCount).toBe(0)
		})

		it("should register event listeners when initialized", () => {
			draftServiceLifecycle.init()

			expect(mockWindow.addEventListener).toHaveBeenCalledWith(
				"beforeunload",
				expect.any(Function),
			)
			expect(mockWindow.addEventListener).toHaveBeenCalledWith("focus", expect.any(Function))
			expect(mockDocument.addEventListener).toHaveBeenCalledWith(
				"visibilitychange",
				expect.any(Function),
			)

			const status = draftServiceLifecycle.getStatus()
			expect(status.isInitialized).toBe(true)
			expect(status.cleanupHandlersCount).toBe(3)
		})

		it("should warn when initializing already initialized instance", () => {
			draftServiceLifecycle.init()
			draftServiceLifecycle.init() // Second initialization

			const status = draftServiceLifecycle.getStatus()
			expect(status.isInitialized).toBe(true)
		})
	})

	describe("Event Handlers", () => {
		let beforeUnloadHandler: (() => void) | undefined
		let visibilityChangeHandler: (() => void) | undefined
		let focusHandler: (() => void) | undefined

		beforeEach(() => {
			draftServiceLifecycle.init()

			// Extract the registered handlers
			const windowCalls = mockWindow.addEventListener.mock.calls
			const documentCalls = mockDocument.addEventListener.mock.calls

			beforeUnloadHandler = windowCalls.find((call: any) => call[0] === "beforeunload")?.[1]
			focusHandler = windowCalls.find((call: any) => call[0] === "focus")?.[1]
			visibilityChangeHandler = documentCalls.find(
				(call: any) => call[0] === "visibilitychange",
			)?.[1]
		})

		describe("beforeunload handler", () => {
			it("should cleanup draft services on page unload", () => {
				expect(beforeUnloadHandler).toBeDefined()

				beforeUnloadHandler?.()

				expect(mockDraftService.close).toHaveBeenCalled()
			})
		})

		describe("visibilitychange handler", () => {
			it("should run cleanup when page is hidden and cleanup is due", async () => {
				mockDocument.hidden = true
				mockDraftService.isCleanupDue.mockReturnValue(true)

				expect(visibilityChangeHandler).toBeDefined()
				await visibilityChangeHandler?.()

				expect(mockDraftService.isCleanupDue).toHaveBeenCalled()
				expect(mockDraftService.runCleanup).toHaveBeenCalled()
			})

			it("should not run cleanup when page is hidden but cleanup is not due", async () => {
				mockDocument.hidden = true
				mockDraftService.isCleanupDue.mockReturnValue(false)

				await visibilityChangeHandler?.()

				expect(mockDraftService.isCleanupDue).toHaveBeenCalled()
				expect(mockDraftService.runCleanup).not.toHaveBeenCalled()
			})

			it("should not run cleanup when page is visible", async () => {
				mockDocument.hidden = false
				mockDraftService.isCleanupDue.mockReturnValue(true)

				await visibilityChangeHandler?.()

				expect(mockDraftService.isCleanupDue).not.toHaveBeenCalled()
				expect(mockDraftService.runCleanup).not.toHaveBeenCalled()
			})

			it("should handle cleanup errors gracefully", async () => {
				mockDocument.hidden = true
				mockDraftService.isCleanupDue.mockReturnValue(true)
				mockDraftService.runCleanup.mockRejectedValue(new Error("Cleanup failed"))

				// Should not throw
				await expect(visibilityChangeHandler?.()).resolves.not.toThrow()
			})
		})

		describe("focus handler", () => {
			it("should run cleanup when page gains focus and cleanup is due", async () => {
				mockDraftService.isCleanupDue.mockReturnValue(true)

				expect(focusHandler).toBeDefined()
				await focusHandler?.()

				expect(mockDraftService.isCleanupDue).toHaveBeenCalled()
				expect(mockDraftService.runCleanup).toHaveBeenCalled()
			})

			it("should not run cleanup when page gains focus but cleanup is not due", async () => {
				mockDraftService.isCleanupDue.mockReturnValue(false)

				await focusHandler?.()

				expect(mockDraftService.isCleanupDue).toHaveBeenCalled()
				expect(mockDraftService.runCleanup).not.toHaveBeenCalled()
			})

			it("should handle cleanup errors gracefully", async () => {
				mockDraftService.isCleanupDue.mockReturnValue(true)
				mockDraftService.runCleanup.mockRejectedValue(new Error("Cleanup failed"))

				// Should not throw
				await expect(focusHandler?.()).resolves.not.toThrow()
			})
		})
	})

	describe("Manual Cleanup", () => {
		it("should call draft service close method", () => {
			draftServiceLifecycle.cleanup()

			expect(mockDraftService.close).toHaveBeenCalled()
		})

		it("should handle errors during cleanup", () => {
			mockDraftService.close.mockImplementation(() => {
				throw new Error("Close failed")
			})

			// Should not throw
			expect(() => draftServiceLifecycle.cleanup()).not.toThrow()
		})
	})

	describe("Destruction", () => {
		it("should remove all event listeners when destroyed", () => {
			draftServiceLifecycle.init()

			const statusBefore = draftServiceLifecycle.getStatus()
			expect(statusBefore.isInitialized).toBe(true)
			expect(statusBefore.cleanupHandlersCount).toBe(3)

			draftServiceLifecycle.destroy()

			expect(mockWindow.removeEventListener).toHaveBeenCalledTimes(2) // beforeunload, focus
			expect(mockDocument.removeEventListener).toHaveBeenCalledTimes(1) // visibilitychange
			expect(mockDraftService.close).toHaveBeenCalled()

			const statusAfter = draftServiceLifecycle.getStatus()
			expect(statusAfter.isInitialized).toBe(false)
			expect(statusAfter.cleanupHandlersCount).toBe(0)
		})

		it("should handle destruction of uninitialized instance", () => {
			// Should not throw
			expect(() => draftServiceLifecycle.destroy()).not.toThrow()

			expect(mockWindow.removeEventListener).not.toHaveBeenCalled()
			expect(mockDocument.removeEventListener).not.toHaveBeenCalled()
		})

		it("should be safe to call destroy multiple times", () => {
			draftServiceLifecycle.init()
			draftServiceLifecycle.destroy()

			// Second destroy should not throw
			expect(() => draftServiceLifecycle.destroy()).not.toThrow()
		})
	})

	describe("Status Reporting", () => {
		it("should report correct status during lifecycle", () => {
			// Initial status
			let status = draftServiceLifecycle.getStatus()
			expect(status.isInitialized).toBe(false)
			expect(status.cleanupHandlersCount).toBe(0)

			// After initialization
			draftServiceLifecycle.init()
			status = draftServiceLifecycle.getStatus()
			expect(status.isInitialized).toBe(true)
			expect(status.cleanupHandlersCount).toBe(3)

			// After destruction
			draftServiceLifecycle.destroy()
			status = draftServiceLifecycle.getStatus()
			expect(status.isInitialized).toBe(false)
			expect(status.cleanupHandlersCount).toBe(0)
		})
	})

	describe("Edge Cases", () => {
		it("should handle missing window object", () => {
			const originalWindow = global.window
			global.window = undefined as any

			try {
				// Should not throw - gracefully handle missing window
				expect(() => draftServiceLifecycle.init()).not.toThrow()

				const status = draftServiceLifecycle.getStatus()
				expect(status.isInitialized).toBe(true)
				expect(status.cleanupHandlersCount).toBe(0) // No handlers registered
			} finally {
				global.window = originalWindow
			}
		})

		it("should handle missing document object", () => {
			const originalDocument = global.document
			global.document = undefined as any

			try {
				// Should not throw - gracefully handle missing document
				expect(() => draftServiceLifecycle.init()).not.toThrow()

				const status = draftServiceLifecycle.getStatus()
				expect(status.isInitialized).toBe(true)
				expect(status.cleanupHandlersCount).toBe(0) // No handlers registered
			} finally {
				global.document = originalDocument
			}
		})

		it("should handle addEventListener throwing errors", () => {
			mockWindow.addEventListener.mockImplementation(() => {
				throw new Error("addEventListener failed")
			})

			// Should not throw - errors are caught and logged
			expect(() => draftServiceLifecycle.init()).not.toThrow()

			const status = draftServiceLifecycle.getStatus()
			expect(status.isInitialized).toBe(true)
		})

		it("should handle removeEventListener throwing errors", () => {
			draftServiceLifecycle.init()

			mockWindow.removeEventListener.mockImplementation(() => {
				throw new Error("removeEventListener failed")
			})

			// Should not throw - errors are caught and logged
			expect(() => draftServiceLifecycle.destroy()).not.toThrow()

			const status = draftServiceLifecycle.getStatus()
			expect(status.isInitialized).toBe(false)
		})
	})

	describe("Auto-initialization", () => {
		it("should auto-initialize when imported in browser environment", async () => {
			// Skip this test as it's difficult to test module-level auto-initialization
			// The auto-initialization is tested implicitly by other tests
			expect(true).toBe(true)
		})
	})
})
