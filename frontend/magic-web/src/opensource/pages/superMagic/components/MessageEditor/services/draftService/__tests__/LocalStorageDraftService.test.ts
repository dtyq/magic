import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { LocalStorageDraftService } from "../LocalStorageDraftService"
import type { DraftKey, DraftData } from "../../../types"

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

// Mock localStorage
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

describe("LocalStorageDraftService", () => {
	let service: LocalStorageDraftService
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
		service = new LocalStorageDraftService()
	})

	afterEach(() => {
		service.close()
	})

	describe("saveDraft", () => {
		it("should save draft data to localStorage", async () => {
			await service.saveDraft(testKey, testDraftData)

			expect(localStorageMock.setItem).toHaveBeenCalledTimes(1)
			const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
			expect(storedData.value).toEqual(testDraftData.value)
			expect(storedData.mentionItems).toEqual(testDraftData.mentionItems)
			expect(storedData.createdAt).toBeDefined()
			expect(storedData.updatedAt).toBeDefined()
		})

		it("should skip saving when data is equal to latest version", async () => {
			// Mock loadLatestDraftVersion to return existing data
			const existingData: DraftData = {
				...testDraftData,
				createdAt: Date.now() - 1000,
				updatedAt: Date.now() - 500,
			}
			vi.spyOn(service, "loadLatestDraftVersion").mockResolvedValue(existingData)

			await service.saveDraft(testKey, testDraftData)

			// Should not call setItem because data is equal
			expect(localStorageMock.setItem).not.toHaveBeenCalled()
		})

		it("should save when data is different from latest version", async () => {
			// Mock loadLatestDraftVersion to return different data
			const existingData: DraftData = {
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
			vi.spyOn(service, "loadLatestDraftVersion").mockResolvedValue(existingData)

			await service.saveDraft(testKey, testDraftData)

			expect(localStorageMock.setItem).toHaveBeenCalledTimes(1)
		})

		it("should save when no latest version exists", async () => {
			vi.spyOn(service, "loadLatestDraftVersion").mockResolvedValue(null)

			await service.saveDraft(testKey, testDraftData)

			expect(localStorageMock.setItem).toHaveBeenCalledTimes(1)
		})

		it("should preserve createdAt when updating existing draft", async () => {
			const originalCreatedAt = Date.now() - 2000
			localStorageMock.setItem(
				"test-org/test-user/workspace-123/project-456:topic-789",
				JSON.stringify({
					...testDraftData,
					createdAt: originalCreatedAt,
					updatedAt: Date.now() - 1000,
				}),
			)

			vi.spyOn(service, "loadLatestDraftVersion").mockResolvedValue(null)

			await service.saveDraft(testKey, {
				...testDraftData,
				value: {
					type: "doc",
					content: [
						{
							type: "paragraph",
							content: [{ type: "text", text: "Updated content" }],
						},
					],
				},
			})

			const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
			expect(storedData.createdAt).toBe(originalCreatedAt)
			expect(storedData.updatedAt).toBeGreaterThan(originalCreatedAt)
		})
	})

	describe("loadDraft", () => {
		it("should load draft data from localStorage", async () => {
			const draftData: DraftData = {
				...testDraftData,
				createdAt: Date.now() - 1000,
				updatedAt: Date.now() - 500,
			}
			localStorageMock.setItem(
				"test-org/test-user/workspace-123/project-456:topic-789",
				JSON.stringify(draftData),
			)

			const result = await service.loadDraft(testKey)

			expect(result).toEqual(draftData)
		})

		it("should return null when draft does not exist", async () => {
			const result = await service.loadDraft(testKey)
			expect(result).toBeNull()
		})

		it("should load legacy draft when new format does not exist", async () => {
			const legacyData: DraftData = {
				...testDraftData,
				createdAt: Date.now() - 1000,
				updatedAt: Date.now() - 500,
			}
			localStorageMock.setItem(
				"test-org/test-user/project-456:topic-789",
				JSON.stringify(legacyData),
			)

			const result = await service.loadDraft(testKey)

			expect(result).toEqual(legacyData)
		})
	})

	describe("deleteDraft", () => {
		it("should delete draft from localStorage", async () => {
			localStorageMock.setItem(
				"test-org/test-user/workspace-123/project-456:topic-789",
				JSON.stringify(testDraftData),
			)

			await service.deleteDraft(testKey)

			expect(localStorageMock.removeItem).toHaveBeenCalledWith(
				"test-org/test-user/workspace-123/project-456:topic-789",
			)
			expect(localStorageMock.removeItem).toHaveBeenCalledWith(
				"test-org/test-user/project-456:topic-789",
			)
		})
	})

	describe("deleteDraftVersions", () => {
		it("should delete all draft versions with correct key handling", async () => {
			// Setup test data with versions
			const baseKey = "test-org/test-user/workspace-123/project-456:topic-789"
			const versionKey1 =
				baseKey.replace("MessageEditorDraftsV2", "MessageEditorDraftVersions") + ":version1"
			const versionKey2 =
				baseKey.replace("MessageEditorDraftsV2", "MessageEditorDraftVersions") + ":version2"

			localStorageMock.__setStore({
				[versionKey1]: JSON.stringify({ ...testDraftData, versionId: "version1" }),
				[versionKey2]: JSON.stringify({ ...testDraftData, versionId: "version2" }),
				"other-key": JSON.stringify({ ...testDraftData }),
			})

			// Mock localStorage.key() to return our test keys
			localStorageMock.key.mockImplementation((index: number) => {
				const keys = [versionKey1, versionKey2, "other-key"]
				return keys[index] || null
			})

			await service.deleteDraftVersions(testKey)

			expect(localStorageMock.removeItem).toHaveBeenCalledWith(versionKey1)
			expect(localStorageMock.removeItem).toHaveBeenCalledWith(versionKey2)
			expect(localStorageMock.removeItem).not.toHaveBeenCalledWith("other-key")
		})
	})

	describe("clearAllDrafts", () => {
		it("should clear all drafts with correct key handling", async () => {
			const draftKey1 = "MessageEditorDraftsV2-draft1"
			const draftKey2 = "MessageEditorDraftsV2-draft2"
			const otherKey = "other-prefix-key"

			localStorageMock.__setStore({
				[draftKey1]: JSON.stringify(testDraftData),
				[draftKey2]: JSON.stringify(testDraftData),
				[otherKey]: JSON.stringify(testDraftData),
			})

			// Mock localStorage.key() to return our test keys
			localStorageMock.key.mockImplementation((index: number) => {
				const keys = [draftKey1, draftKey2, otherKey]
				return keys[index] || null
			})

			await service.clearAllDrafts()

			expect(localStorageMock.removeItem).toHaveBeenCalledWith(draftKey1)
			expect(localStorageMock.removeItem).toHaveBeenCalledWith(draftKey2)
			expect(localStorageMock.removeItem).not.toHaveBeenCalledWith(otherKey)
		})
	})

	describe("cleanupExpiredVersions", () => {
		it("should cleanup expired versions with correct key handling", async () => {
			const now = Date.now()
			const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
			const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000

			const recentVersionKey = "MessageEditorDraftVersions-recent"
			const expiredVersionKey = "MessageEditorDraftVersions-expired"
			const expiredDraftKey = "MessageEditorDraftsV2-expired"
			const otherKey = "other-key"

			const recentVersionData = {
				...testDraftData,
				versionTimestamp: now - 1000,
				updatedAt: now - 1000,
			}

			const expiredVersionData = {
				...testDraftData,
				versionTimestamp: eightDaysAgo,
				updatedAt: eightDaysAgo,
			}

			const expiredDraftData = {
				...testDraftData,
				isAutoSaved: true,
				updatedAt: eightDaysAgo,
			}

			localStorageMock.__setStore({
				[recentVersionKey]: JSON.stringify(recentVersionData),
				[expiredVersionKey]: JSON.stringify(expiredVersionData),
				[expiredDraftKey]: JSON.stringify(expiredDraftData),
				[otherKey]: JSON.stringify(testDraftData),
			})

			// Mock localStorage.key() to return our test keys
			localStorageMock.key.mockImplementation((index: number) => {
				const keys = [recentVersionKey, expiredVersionKey, expiredDraftKey, otherKey]
				return keys[index] || null
			})

			await service.cleanupExpiredVersions()

			expect(localStorageMock.removeItem).not.toHaveBeenCalledWith(recentVersionKey)
			expect(localStorageMock.removeItem).toHaveBeenCalledWith(expiredVersionKey)
			expect(localStorageMock.removeItem).toHaveBeenCalledWith(expiredDraftKey)
			expect(localStorageMock.removeItem).not.toHaveBeenCalledWith(otherKey)
		})

		it("should handle invalid JSON data gracefully", async () => {
			const invalidKey = "MessageEditorDraftVersions-invalid"
			localStorageMock.__setStore({
				[invalidKey]: "invalid-json",
			})

			// Mock localStorage.key() to return our test key
			localStorageMock.key.mockImplementation((index: number) => {
				return index === 0 ? invalidKey : null
			})

			// Should not throw error
			await expect(service.cleanupExpiredVersions()).resolves.toBeUndefined()
			expect(localStorageMock.removeItem).not.toHaveBeenCalledWith(invalidKey)
		})
	})

	describe("saveDraftVersion", () => {
		it("should save draft version to localStorage", async () => {
			const versionData = {
				...testDraftData,
				versionId: "test-version",
				versionTimestamp: Date.now(),
				isAutoSaved: false,
			}

			await service.saveDraftVersion(testKey, versionData)

			expect(localStorageMock.setItem).toHaveBeenCalledTimes(1)
			const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
			expect(storedData.versionId).toBe("test-version")
			expect(storedData.isAutoSaved).toBe(false)
		})

		it("should skip saving when version data equals latest version", async () => {
			const versionData = {
				...testDraftData,
				versionId: "test-version",
				versionTimestamp: Date.now(),
				isAutoSaved: false,
			}

			vi.spyOn(service, "loadLatestDraftVersion").mockResolvedValue({
				...versionData,
				createdAt: Date.now() - 1000,
				updatedAt: Date.now() - 500,
			})

			await service.saveDraftVersion(testKey, versionData)

			expect(localStorageMock.setItem).not.toHaveBeenCalled()
		})
	})

	describe("loadDraftVersions", () => {
		it("should load and sort draft versions correctly", async () => {
			const version1 = {
				...testDraftData,
				versionId: "version1",
				versionTimestamp: 1000,
				isAutoSaved: true,
				createdAt: 900,
				updatedAt: 1000,
			}

			const version2 = {
				...testDraftData,
				versionId: "version2",
				versionTimestamp: 2000,
				isAutoSaved: false,
				createdAt: 1900,
				updatedAt: 2000,
			}

			const baseKey = "test-org/test-user/workspace-123/project-456:topic-789"
			const versionKey1 =
				baseKey.replace("MessageEditorDraftsV2", "MessageEditorDraftVersions") + ":version1"
			const versionKey2 =
				baseKey.replace("MessageEditorDraftsV2", "MessageEditorDraftVersions") + ":version2"

			localStorageMock.__setStore({
				[versionKey1]: JSON.stringify(version1),
				[versionKey2]: JSON.stringify(version2),
			})

			// Mock localStorage.key() to return our version keys
			localStorageMock.key.mockImplementation((index: number) => {
				const keys = [versionKey1, versionKey2]
				return keys[index] || null
			})

			const result = await service.loadDraftVersions(testKey)

			expect(result).toHaveLength(2)
			// Should be sorted by versionTimestamp descending (newest first)
			expect(result[0].versionId).toBe("version2")
			expect(result[1].versionId).toBe("version1")
			expect(result[0].versionTimestamp).toBe(2000)
			expect(result[1].versionTimestamp).toBe(1000)
		})
	})

	describe("loadDraftByVersion", () => {
		it("should load specific draft version", async () => {
			const versionData = {
				...testDraftData,
				versionId: "test-version",
				versionTimestamp: Date.now(),
				isAutoSaved: true,
				createdAt: Date.now() - 1000,
				updatedAt: Date.now() - 500,
			}

			const baseKey = "test-org/test-user/workspace-123/project-456:topic-789"
			const versionKey =
				baseKey.replace("MessageEditorDraftsV2", "MessageEditorDraftVersions") +
				":test-version"

			localStorageMock.setItem(versionKey, JSON.stringify(versionData))

			const result = await service.loadDraftByVersion(testKey, "test-version")

			expect(result).toEqual(versionData)
		})

		it("should return null when version does not exist", async () => {
			const result = await service.loadDraftByVersion(testKey, "non-existent")
			expect(result).toBeNull()
		})
	})

	describe("deleteDraftVersion", () => {
		it("should delete specific draft version", async () => {
			const baseKey = "test-org/test-user/workspace-123/project-456:topic-789"
			const versionKey =
				baseKey.replace("MessageEditorDraftsV2", "MessageEditorDraftVersions") +
				":test-version"

			localStorageMock.setItem(versionKey, JSON.stringify(testDraftData))

			await service.deleteDraftVersion(testKey, "test-version")

			expect(localStorageMock.removeItem).toHaveBeenCalledWith(versionKey)
		})
	})
})
