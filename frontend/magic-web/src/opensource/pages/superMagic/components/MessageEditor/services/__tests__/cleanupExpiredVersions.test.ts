import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { IndexedDBDraftService } from "../draftService/IndexedDBDraftService"
import { LocalStorageDraftService } from "../draftService/LocalStorageDraftService"
import type { DraftKey, DraftData } from "../../types"

// Mock Logger
vi.mock("@/opensource/utils/log/Logger", () => ({
	default: class MockLogger {
		constructor() {}
		log = vi.fn()
		error = vi.fn()
		warn = vi.fn()
	},
}))

// Mock userStore
vi.mock("@/opensource/models/user", () => ({
	userStore: {
		user: {
			userInfo: {
				organization_code: "test-org",
				user_id: "test-user",
			},
		},
	},
}))

describe("cleanupExpiredVersions with retentionDays parameter", () => {
	let localStorageMock: any

	const testDraftKey: DraftKey = {
		workspaceId: "test-workspace",
		projectId: "test-project",
		topicId: "test-topic",
	}

	const createTestDraftData = (
		timestamp: number,
		isAutoSaved = true,
	): Omit<DraftData, "createdAt" | "updatedAt"> => ({
		workspaceId: testDraftKey.workspaceId,
		projectId: testDraftKey.projectId,
		topicId: testDraftKey.topicId,
		value: { type: "doc", content: [] },
		mentionItems: [],
		versionId: `version-${timestamp}`,
		versionTimestamp: timestamp,
		isAutoSaved,
	})

	beforeEach(() => {
		// Mock localStorage
		localStorageMock = {
			getItem: vi.fn(),
			setItem: vi.fn(),
			removeItem: vi.fn(),
			clear: vi.fn(),
			length: 0,
			key: vi.fn(),
			__setStore: function (store: Record<string, string>) {
				const keys = Object.keys(store)
				this.length = keys.length
				this.getItem.mockImplementation((k: string) => store[k] || null)
				this.key.mockImplementation((i: number) => keys[i] || null)
			},
		}
		Object.defineProperty(window, "localStorage", { value: localStorageMock })
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("LocalStorageDraftService", () => {
		let service: LocalStorageDraftService

		beforeEach(() => {
			service = new LocalStorageDraftService()
		})

		it("should cleanup versions older than default 7 days", async () => {
			const now = Date.now()
			const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000
			const sixDaysAgo = now - 6 * 24 * 60 * 60 * 1000

			const expiredVersionKey = "MessageEditorDraftVersions-expired"
			const recentVersionKey = "MessageEditorDraftVersions-recent"

			const expiredData = createTestDraftData(eightDaysAgo)
			const recentData = createTestDraftData(sixDaysAgo)

			localStorageMock.__setStore({
				[expiredVersionKey]: JSON.stringify(expiredData),
				[recentVersionKey]: JSON.stringify(recentData),
			})

			await service.cleanupExpiredVersions() // No parameter, should use default 7 days

			expect(localStorageMock.removeItem).toHaveBeenCalledWith(expiredVersionKey)
			expect(localStorageMock.removeItem).not.toHaveBeenCalledWith(recentVersionKey)
		})

		it("should cleanup versions older than custom retention days", async () => {
			const now = Date.now()
			const fourDaysAgo = now - 4 * 24 * 60 * 60 * 1000
			const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000

			const expiredVersionKey = "MessageEditorDraftVersions-expired"
			const recentVersionKey = "MessageEditorDraftVersions-recent"

			const expiredData = createTestDraftData(fourDaysAgo)
			const recentData = createTestDraftData(twoDaysAgo)

			localStorageMock.__setStore({
				[expiredVersionKey]: JSON.stringify(expiredData),
				[recentVersionKey]: JSON.stringify(recentData),
			})

			await service.cleanupExpiredVersions(3) // Custom 3 days retention

			expect(localStorageMock.removeItem).toHaveBeenCalledWith(expiredVersionKey)
			expect(localStorageMock.removeItem).not.toHaveBeenCalledWith(recentVersionKey)
		})

		it("should cleanup auto-saved drafts older than retention period", async () => {
			const now = Date.now()
			const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000
			const sixDaysAgo = now - 6 * 24 * 60 * 60 * 1000

			const expiredDraftKey = "MessageEditorDraftsV2-expired"
			const recentDraftKey = "MessageEditorDraftsV2-recent"
			const manualDraftKey = "MessageEditorDraftsV2-manual"

			const expiredAutoSaved = {
				...createTestDraftData(eightDaysAgo),
				updatedAt: eightDaysAgo,
			}
			const recentAutoSaved = { ...createTestDraftData(sixDaysAgo), updatedAt: sixDaysAgo }
			const manualDraft = {
				...createTestDraftData(eightDaysAgo),
				isAutoSaved: false,
				updatedAt: eightDaysAgo,
			}

			localStorageMock.__setStore({
				[expiredDraftKey]: JSON.stringify(expiredAutoSaved),
				[recentDraftKey]: JSON.stringify(recentAutoSaved),
				[manualDraftKey]: JSON.stringify(manualDraft),
			})

			await service.cleanupExpiredVersions(7)

			expect(localStorageMock.removeItem).toHaveBeenCalledWith(expiredDraftKey)
			expect(localStorageMock.removeItem).not.toHaveBeenCalledWith(recentDraftKey)
			expect(localStorageMock.removeItem).not.toHaveBeenCalledWith(manualDraftKey) // Manual drafts should not be cleaned
		})

		it("should handle invalid JSON data gracefully", async () => {
			const validVersionKey = "MessageEditorDraftVersions-valid"
			const invalidVersionKey = "MessageEditorDraftVersions-invalid"

			localStorageMock.__setStore({
				[validVersionKey]: JSON.stringify(
					createTestDraftData(Date.now() - 8 * 24 * 60 * 60 * 1000),
				),
				[invalidVersionKey]: "invalid json",
			})

			// Should not throw
			await expect(service.cleanupExpiredVersions()).resolves.not.toThrow()

			expect(localStorageMock.removeItem).toHaveBeenCalledWith(validVersionKey)
			expect(localStorageMock.removeItem).not.toHaveBeenCalledWith(invalidVersionKey)
		})

		it("should handle edge case with zero retention days", async () => {
			const now = Date.now()
			const oneHourAgo = now - 60 * 60 * 1000

			const versionKey = "MessageEditorDraftVersions-recent"
			const versionData = createTestDraftData(oneHourAgo)

			localStorageMock.__setStore({
				[versionKey]: JSON.stringify(versionData),
			})

			await service.cleanupExpiredVersions(0) // Zero days retention

			expect(localStorageMock.removeItem).toHaveBeenCalledWith(versionKey)
		})
	})

	describe("IndexedDBDraftService", () => {
		let service: IndexedDBDraftService
		let mockDB: any
		let mockTransaction: any
		let mockStore: any
		let mockVersionsStore: any
		let mockIndex: any
		let mockCursor: any

		beforeEach(() => {
			service = new IndexedDBDraftService()

			// Mock IndexedDB objects
			mockCursor = {
				value: null,
				delete: vi.fn(),
				continue: vi.fn(),
			}

			mockIndex = {
				openCursor: vi.fn((range) => {
					const request = {
						onsuccess: null as any,
						onerror: null as any,
						result: mockCursor,
					}
					// Simulate cursor iteration
					setTimeout(() => {
						if (request.onsuccess) {
							request.onsuccess({ target: request })
						}
					}, 0)
					return request
				}),
			}

			mockStore = {
				index: vi.fn(() => mockIndex),
			}

			mockVersionsStore = {
				index: vi.fn(() => mockIndex),
			}

			mockTransaction = {
				objectStore: vi.fn((storeName: string) => {
					return storeName === "draftVersions" ? mockVersionsStore : mockStore
				}),
				oncomplete: null as any,
				onerror: null as any,
			}

			mockDB = {
				transaction: vi.fn(() => mockTransaction),
			}

			// Mock initDB method
			const originalInitDB = service["initDB"]
			service["initDB"] = vi.fn().mockResolvedValue(mockDB)

			// Mock IDBKeyRange
			global.IDBKeyRange = {
				upperBound: vi.fn((value) => ({ upper: value })),
			} as any
		})

		it("should use default retention period of 7 days", async () => {
			const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000
			const expectedThreshold = Date.now() - sevenDaysInMs

			await service.cleanupExpiredVersions()

			expect(global.IDBKeyRange.upperBound).toHaveBeenCalledWith(expect.any(Number))

			// Verify the timestamp is approximately correct (within 1 second)
			const actualThreshold = (global.IDBKeyRange.upperBound as any).mock.calls[0][0]
			expect(Math.abs(actualThreshold - expectedThreshold)).toBeLessThan(1000)
		})

		it("should use custom retention days parameter", async () => {
			const customDays = 3
			const customPeriodInMs = customDays * 24 * 60 * 60 * 1000
			const expectedThreshold = Date.now() - customPeriodInMs

			await service.cleanupExpiredVersions(customDays)

			expect(global.IDBKeyRange.upperBound).toHaveBeenCalledWith(expect.any(Number))

			const actualThreshold = (global.IDBKeyRange.upperBound as any).mock.calls[0][0]
			expect(Math.abs(actualThreshold - expectedThreshold)).toBeLessThan(1000)
		})

		it("should cleanup both version store and main store", async () => {
			await service.cleanupExpiredVersions(5)

			expect(mockDB.transaction).toHaveBeenCalledWith(["draftVersions"], "readwrite")
			expect(mockTransaction.objectStore).toHaveBeenCalledWith("draftVersions")
			expect(mockTransaction.objectStore).toHaveBeenCalledWith("drafts")
			expect(mockVersionsStore.index).toHaveBeenCalledWith("versionTimestamp")
			expect(mockStore.index).toHaveBeenCalledWith("updatedAt")
		})

		it("should handle errors gracefully", async () => {
			const error = new Error("IndexedDB error")
			service["initDB"] = vi.fn().mockRejectedValue(error)

			// Should not throw, just log error
			await expect(service.cleanupExpiredVersions()).resolves.not.toThrow()
		})

		it("should handle cursor iteration correctly", async () => {
			const mockVersionData = {
				versionId: "test-version",
				versionTimestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days old
				isAutoSaved: true,
			}

			const mockDraftData = {
				isAutoSaved: true,
				updatedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
			}

			let versionsCursorCalled = false
			let draftsCursorCalled = false

			mockIndex.openCursor = vi.fn((range) => {
				const request = {
					onsuccess: null as any,
					onerror: null as any,
					result: null as any,
				}

				setTimeout(() => {
					if (request.onsuccess) {
						if (!versionsCursorCalled) {
							// First call is for versions
							versionsCursorCalled = true
							request.result = {
								value: mockVersionData,
								delete: vi.fn(),
								continue: vi.fn(() => {
									// End versions cursor
									setTimeout(() => {
										request.result = null
										if (request.onsuccess)
											request.onsuccess({ target: request })
									}, 5)
								}),
							}
						} else if (!draftsCursorCalled) {
							// Second call is for drafts
							draftsCursorCalled = true
							request.result = {
								value: mockDraftData,
								delete: vi.fn(),
								continue: vi.fn(() => {
									// End drafts cursor
									setTimeout(() => {
										request.result = null
										if (request.onsuccess)
											request.onsuccess({ target: request })
									}, 5)
								}),
							}
						} else {
							// All subsequent calls return null
							request.result = null
						}
						request.onsuccess({ target: request })
					}
				}, 5)

				return request
			})

			await service.cleanupExpiredVersions(7)

			// Allow time for async operations
			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(mockIndex.openCursor).toHaveBeenCalledTimes(2) // Once for versions, once for drafts
		})
	})
})
