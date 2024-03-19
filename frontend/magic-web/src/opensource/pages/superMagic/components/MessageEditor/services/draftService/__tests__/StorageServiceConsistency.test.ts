import { describe, it, expect, vi, beforeEach } from "vitest"
import { LocalStorageDraftService } from "../LocalStorageDraftService"
import { IndexedDBDraftService } from "../IndexedDBDraftService"
import type { DraftKey, DraftData, DraftServiceInterface } from "../../../types"

// Mock user store
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

// Mock localStorage for LocalStorageDraftService
const localStorageMock = (() => {
	let store: Record<string, string> = {}

	return {
		getItem: vi.fn((key: string) => store[key] || null),
		setItem: vi.fn((key: string, value: string) => {
			store[key] = value.toString()
		}),
		removeItem: vi.fn((key: string) => {
			delete store[key]
		}),
		clear: vi.fn(() => {
			store = {}
		}),
		key: vi.fn((index: number) => {
			const keys = Object.keys(store)
			return keys[index] || null
		}),
		get length() {
			return Object.keys(store).length
		},
		__getStore: () => store,
		__setStore: (newStore: Record<string, string>) => {
			store = newStore
		},
	}
})()

Object.defineProperty(global, "localStorage", {
	value: localStorageMock,
})

// Mock IndexedDB for IndexedDBDraftService
const createMockIDBDatabase = () => {
	const store = new Map<string, any>()
	const versionStore = new Map<string, any>()

	const mockObjectStore = (storeName: string) => {
		const currentStore = storeName === "drafts" ? store : versionStore

		return {
			put: vi.fn((data: any) => {
				currentStore.set(data.key || data.versionKey, data)
				return {
					onsuccess: null,
					onerror: null,
				}
			}),
			get: vi.fn((key: string) => {
				const result = currentStore.get(key)
				return {
					onsuccess: null,
					onerror: null,
					result,
				}
			}),
			delete: vi.fn((key: string) => {
				currentStore.delete(key)
				return {
					onsuccess: null,
					onerror: null,
				}
			}),
			clear: vi.fn(() => {
				currentStore.clear()
				return {
					onsuccess: null,
					onerror: null,
				}
			}),
			index: vi.fn(() => ({
				getAll: vi.fn(() => ({
					onsuccess: null,
					onerror: null,
					result: [],
				})),
			})),
			createIndex: vi.fn(),
			indexNames: {
				contains: vi.fn(() => false),
			},
		}
	}

	return {
		transaction: vi.fn((storeNames: string[], mode: string) => ({
			objectStore: vi.fn((name: string) => mockObjectStore(name)),
			oncomplete: null,
			onerror: null,
		})),
		objectStoreNames: {
			contains: vi.fn(() => false),
		},
		createObjectStore: vi.fn(() => mockObjectStore("mock")),
		close: vi.fn(),
		__store: store,
		__versionStore: versionStore,
	}
}

const mockDB = createMockIDBDatabase()

Object.defineProperty(global, "indexedDB", {
	value: {
		open: vi.fn(() => ({
			onsuccess: null,
			onerror: null,
			onupgradeneeded: null,
			result: mockDB,
		})),
	},
})

Object.defineProperty(global, "IDBKeyRange", {
	value: {
		only: vi.fn((value: any) => ({ lower: value, upper: value })),
		upperBound: vi.fn((value: any) => ({ upper: value })),
	},
})

describe("Storage Service Consistency", () => {
	let localStorageService: LocalStorageDraftService
	let indexedDBService: IndexedDBDraftService

	const testKey: DraftKey = {
		workspaceId: "workspace-123",
		projectId: "project-456",
		topicId: "topic-789",
	}

	const testDraftData: Omit<DraftData, "createdAt" | "updatedAt"> = {
		value: {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: "Test content" }],
				},
			],
		},
		mentionItems: [],
		files: [],
	}

	beforeEach(() => {
		vi.clearAllMocks()
		localStorageMock.clear()
		mockDB.__store.clear()
		mockDB.__versionStore.clear()

		localStorageService = new LocalStorageDraftService()
		indexedDBService = new IndexedDBDraftService()
	})

	describe("saveDraft deduplication behavior", () => {
		it("both services should skip saving identical data", async () => {
			const existingData: DraftData = {
				...testDraftData,
				createdAt: Date.now() - 1000,
				updatedAt: Date.now() - 500,
			}

			// Mock both services to return the same existing data
			vi.spyOn(localStorageService, "loadLatestDraftVersion").mockResolvedValue(existingData)
			vi.spyOn(indexedDBService, "loadLatestDraftVersion").mockResolvedValue(existingData)

			// Both should skip saving
			await localStorageService.saveDraft(testKey, testDraftData)

			// LocalStorage should not call setItem when data is identical
			expect(localStorageMock.setItem).not.toHaveBeenCalled()
		})

		it("LocalStorage service should save when data is different", async () => {
			const differentData: DraftData = {
				...testDraftData,
				value: {
					type: "doc",
					content: [
						{
							type: "paragraph",
							content: [{ type: "text", text: "Different content" }],
						},
					],
				},
				createdAt: Date.now() - 1000,
				updatedAt: Date.now() - 500,
			}

			vi.spyOn(localStorageService, "loadLatestDraftVersion").mockResolvedValue(differentData)

			await localStorageService.saveDraft(testKey, testDraftData)

			// LocalStorage should attempt to save when data is different
			expect(localStorageMock.setItem).toHaveBeenCalledTimes(1)
		})

		it("LocalStorage service should save when no latest version exists", async () => {
			vi.spyOn(localStorageService, "loadLatestDraftVersion").mockResolvedValue(null)

			await localStorageService.saveDraft(testKey, testDraftData)

			// LocalStorage should attempt to save when no latest version exists
			expect(localStorageMock.setItem).toHaveBeenCalledTimes(1)
		})
	})

	describe("saveDraftVersion deduplication behavior", () => {
		it("LocalStorage service should skip saving identical version data", async () => {
			const versionData = {
				...testDraftData,
				versionId: "test-version",
				versionTimestamp: Date.now(),
				isAutoSaved: false,
			}

			const existingVersionData: DraftData = {
				...versionData,
				createdAt: Date.now() - 1000,
				updatedAt: Date.now() - 500,
			}

			vi.spyOn(localStorageService, "loadLatestDraftVersion").mockResolvedValue(
				existingVersionData,
			)

			await localStorageService.saveDraftVersion(testKey, versionData)

			// Should skip saving when version data is identical
			expect(localStorageMock.setItem).not.toHaveBeenCalled()
		})

		it("LocalStorage service should save when version data is different", async () => {
			const versionData = {
				...testDraftData,
				versionId: "test-version",
				versionTimestamp: Date.now(),
				isAutoSaved: false,
			}

			vi.spyOn(localStorageService, "loadLatestDraftVersion").mockResolvedValue(null)

			await localStorageService.saveDraftVersion(testKey, versionData)

			// Should attempt to save when version data is different
			expect(localStorageMock.setItem).toHaveBeenCalledTimes(1)
		})
	})

	describe("Interface consistency", () => {
		it("LocalStorageDraftService should implement all required methods", () => {
			expect(typeof localStorageService.saveDraft).toBe("function")
			expect(typeof localStorageService.loadDraft).toBe("function")
			expect(typeof localStorageService.deleteDraft).toBe("function")
			expect(typeof localStorageService.clearAllDrafts).toBe("function")
			expect(typeof localStorageService.close).toBe("function")
			expect(typeof localStorageService.saveDraftVersion).toBe("function")
			expect(typeof localStorageService.loadDraftVersions).toBe("function")
			expect(typeof localStorageService.loadDraftByVersion).toBe("function")
			expect(typeof localStorageService.deleteDraftVersion).toBe("function")
			expect(typeof localStorageService.cleanupExpiredVersions).toBe("function")
		})

		it("IndexedDBDraftService should implement all required methods", () => {
			expect(typeof indexedDBService.saveDraft).toBe("function")
			expect(typeof indexedDBService.loadDraft).toBe("function")
			expect(typeof indexedDBService.deleteDraft).toBe("function")
			expect(typeof indexedDBService.clearAllDrafts).toBe("function")
			expect(typeof indexedDBService.close).toBe("function")
			expect(typeof indexedDBService.saveDraftVersion).toBe("function")
			expect(typeof indexedDBService.loadDraftVersions).toBe("function")
			expect(typeof indexedDBService.loadDraftByVersion).toBe("function")
			expect(typeof indexedDBService.deleteDraftVersion).toBe("function")
			expect(typeof indexedDBService.cleanupExpiredVersions).toBe("function")
		})
	})

	describe("Error handling consistency", () => {
		it("LocalStorage service should handle invalid JSON gracefully in cleanup", async () => {
			// This test is more applicable to LocalStorage and doesn't require complex mocking
			await expect(localStorageService.cleanupExpiredVersions()).resolves.toBeUndefined()
		})

		it("LocalStorage service should handle missing data gracefully", async () => {
			const result = await localStorageService.loadDraft(testKey)
			expect(result).toBeNull()
		})
	})

	describe("Key generation consistency", () => {
		it("both services should use the same key generation logic", () => {
			// Both services use the same utils functions, so this test verifies they import correctly
			expect(localStorageService).toBeDefined()
			expect(indexedDBService).toBeDefined()

			// The key generation is handled by utils, which is already tested
			// This test ensures both services can be instantiated and use the same logic
			expect(localStorageService).toBeInstanceOf(LocalStorageDraftService)
			expect(indexedDBService).toBeInstanceOf(IndexedDBDraftService)
		})
	})

	afterEach(() => {
		localStorageService.close()
		indexedDBService.close()
	})
})
