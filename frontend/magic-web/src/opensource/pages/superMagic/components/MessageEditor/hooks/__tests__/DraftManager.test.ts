import { describe, it, expect, beforeEach, vi } from "vitest"

// @ts-ignore
import { DraftManager, DraftService, isIndexedDBAvailable } from "../../services/draftService"
import type { DraftData, DraftServiceInterface, DraftKey } from "../../types"

// Mock logger
vi.mock("@/opensource/utils/log/Logger", () => ({
	default: class MockLogger {
		constructor() {}
		log = vi.fn()
		error = vi.fn()
		warn = vi.fn()
	},
}))

// Mock user store for utils
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

// Create mock draft service
const createMockDraftService = (): DraftServiceInterface => ({
	saveDraft: vi.fn(),
	loadDraft: vi.fn(),
	deleteDraft: vi.fn(),
	clearAllDrafts: vi.fn(),
	close: vi.fn(),
	saveDraftVersion: vi.fn(),
	loadDraftVersions: vi.fn(),
	loadDraftByVersion: vi.fn(),
	deleteDraftVersion: vi.fn(),
	deleteDraftVersions: vi.fn(),
	cleanupExpiredVersions: vi.fn(),
	loadLatestDraftVersion: vi.fn(),
})

describe("DraftManager", () => {
	let mockDraftService: DraftServiceInterface
	let draftManager: DraftManager

	beforeEach(() => {
		vi.clearAllMocks()
		mockDraftService = createMockDraftService()
		draftManager = new DraftManager(mockDraftService)
	})

	const defaultDraftData = {
		workspaceId: "test-workspace",
		projectId: "test-project",
		topicId: "test-topic",
		value: undefined as any,
		mentionItems: [],
	}

	const meaningfulDraftData = {
		workspaceId: "test-workspace",
		projectId: "test-project",
		topicId: "test-topic",
		value: {
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text: "test content" }] }],
		},
		mentionItems: [],
	}

	describe("Initialization", () => {
		it("should initialize with provided draft service", () => {
			expect(draftManager).toBeDefined()
			expect(draftManager.saveDraft).toBeDefined()
			expect(draftManager.loadLatestDraftVersion).toBeDefined()
			expect(draftManager.clearVersions).toBeDefined()
		})

		it("should create throttled save draft function", () => {
			const throttleSaveDraft = draftManager.createThrottledSaveDraft()
			expect(throttleSaveDraft).toBeDefined()
			expect(typeof throttleSaveDraft).toBe("function")
		})
	})

	describe("Save Draft", () => {
		it("should save draft with meaningful data", async () => {
			const mockSaveDraftVersion = vi.fn().mockResolvedValue(undefined)
			mockDraftService.saveDraftVersion = mockSaveDraftVersion

			await draftManager.saveDraft(meaningfulDraftData)

			expect(mockSaveDraftVersion).toHaveBeenCalledWith(
				{
					workspaceId: "test-workspace",
					projectId: "test-project",
					topicId: "test-topic",
				},
				expect.objectContaining({
					value: meaningfulDraftData.value,
					mentionItems: [],
					workspaceId: "test-workspace",
					projectId: "test-project",
					topicId: "test-topic",
				}),
			)
		})

		it("should save draft even with empty data", async () => {
			const mockSaveDraftVersion = vi.fn().mockResolvedValue(undefined)
			mockDraftService.saveDraftVersion = mockSaveDraftVersion

			await draftManager.saveDraft(defaultDraftData)

			expect(mockSaveDraftVersion).toHaveBeenCalledWith(
				{
					workspaceId: "test-workspace",
					projectId: "test-project",
					topicId: "test-topic",
				},
				expect.objectContaining({
					value: undefined,
					mentionItems: [],
					workspaceId: "test-workspace",
					projectId: "test-project",
					topicId: "test-topic",
				}),
			)
		})

		it("should handle save errors", async () => {
			const error = new Error("Save failed")
			mockDraftService.saveDraftVersion = vi.fn().mockRejectedValue(error)

			// Errors are caught internally; caller does not receive rejection
			await expect(draftManager.saveDraft(meaningfulDraftData)).resolves.toBeUndefined()
		})

		it("should coalesce when already saving (perform final save after in-flight)", async () => {
			const mockSaveDraftVersion = vi
				.fn()
				.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)))
			mockDraftService.saveDraftVersion = mockSaveDraftVersion

			// Start two saves in parallel
			const promise1 = draftManager.saveDraft(meaningfulDraftData)
			const promise2 = draftManager.saveDraft(meaningfulDraftData)

			await Promise.all([promise1, promise2])

			// In-flight save completes, then pending latest save runs once more
			expect(mockSaveDraftVersion).toHaveBeenCalledTimes(2)
		})
	})

	describe("Load Latest Draft Version", () => {
		it("should load existing draft", async () => {
			const mockDraft: DraftData = {
				workspaceId: "test-workspace",
				projectId: "test-project",
				topicId: "test-topic",
				value: {
					type: "doc",
					content: [
						{ type: "paragraph", content: [{ type: "text", text: "saved content" }] },
					],
				},
				mentionItems: [],
				createdAt: 1000,
				updatedAt: 2000,
			}

			const mockLoadLatestDraftVersion = vi.fn().mockResolvedValue(mockDraft)
			mockDraftService.loadLatestDraftVersion = mockLoadLatestDraftVersion

			const result = await draftManager.loadLatestDraftVersion({
				workspaceId: "test-workspace",
				projectId: "test-project",
				topicId: "test-topic",
			})

			expect(result).toEqual(mockDraft)
			expect(mockLoadLatestDraftVersion).toHaveBeenCalledWith({
				workspaceId: "test-workspace",
				projectId: "test-project",
				topicId: "test-topic",
			})
		})

		it("should return null when no draft exists", async () => {
			const mockLoadLatestDraftVersion = vi.fn().mockResolvedValue(null)
			mockDraftService.loadLatestDraftVersion = mockLoadLatestDraftVersion

			const result = await draftManager.loadLatestDraftVersion({
				workspaceId: "test-workspace",
				projectId: "test-project",
				topicId: "test-topic",
			})

			expect(result).toBeNull()
		})

		it("should propagate load errors", async () => {
			const error = new Error("Load failed")
			mockDraftService.loadLatestDraftVersion = vi.fn().mockRejectedValue(error)

			await expect(
				draftManager.loadLatestDraftVersion({
					workspaceId: "test-workspace",
					projectId: "test-project",
					topicId: "test-topic",
				}),
			).rejects.toThrow("Load failed")
		})
	})

	describe("Clear Draft", () => {
		it("should clear draft versions", async () => {
			const mockDeleteDraftVersions = vi.fn().mockResolvedValue(undefined)
			mockDraftService.deleteDraftVersions = mockDeleteDraftVersions

			await draftManager.clearVersions({
				workspaceId: "test-workspace",
				projectId: "test-project",
				topicId: "test-topic",
			})

			expect(mockDeleteDraftVersions).toHaveBeenCalledWith({
				workspaceId: "test-workspace",
				projectId: "test-project",
				topicId: "test-topic",
			})
		})

		it("should handle clear errors gracefully", async () => {
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const error = new Error("Clear failed")
			mockDraftService.deleteDraftVersions = vi.fn().mockRejectedValue(error)

			// Should not throw
			await draftManager.clearVersions({
				workspaceId: "test-workspace",
				projectId: "test-project",
				topicId: "test-topic",
			})

			consoleErrorSpy.mockRestore()
		})
	})

	describe("Throttled Save", () => {
		it("should throttle multiple save calls", async () => {
			vi.useRealTimers()
			const mockSaveDraftVersion = vi.fn().mockResolvedValue(undefined)
			mockDraftService.saveDraftVersion = mockSaveDraftVersion

			const throttleSaveDraft = draftManager.createThrottledSaveDraft(100)

			// Make multiple rapid calls
			throttleSaveDraft(meaningfulDraftData)
			throttleSaveDraft(meaningfulDraftData)
			throttleSaveDraft(meaningfulDraftData)

			// Wait for throttle delay
			await new Promise((resolve) => setTimeout(resolve, 150))

			// Should only be called once due to throttling
			expect(mockSaveDraftVersion).toHaveBeenCalledTimes(1)
		})
	})

	describe("Meaningful Data Detection", () => {
		it("should detect meaningful content", async () => {
			const mockSaveDraftVersion = vi.fn().mockResolvedValue(undefined)
			mockDraftService.saveDraftVersion = mockSaveDraftVersion

			await draftManager.saveDraft(meaningfulDraftData)

			expect(mockSaveDraftVersion).toHaveBeenCalled()
		})

		it("should detect meaningful mentions", async () => {
			const mockSaveDraftVersion = vi.fn().mockResolvedValue(undefined)
			mockDraftService.saveDraftVersion = mockSaveDraftVersion

			const draftWithMentions = {
				...defaultDraftData,
				mentionItems: [
					{ type: "mention", attrs: { type: "text" as any, data: {} as any } },
				],
			}

			await draftManager.saveDraft(draftWithMentions)

			expect(mockSaveDraftVersion).toHaveBeenCalled()
		})

		it("should save empty content as well", async () => {
			const mockSaveDraftVersion = vi.fn().mockResolvedValue(undefined)
			mockDraftService.saveDraftVersion = mockSaveDraftVersion

			const emptyDraft = {
				...defaultDraftData,
				value: { type: "doc", content: [{ type: "paragraph" }] },
			}

			await draftManager.saveDraft(emptyDraft)

			expect(mockSaveDraftVersion).toHaveBeenCalledWith(
				{
					workspaceId: "test-workspace",
					projectId: "test-project",
					topicId: "test-topic",
				},
				expect.objectContaining({
					value: emptyDraft.value,
					mentionItems: [],
					workspaceId: "test-workspace",
					projectId: "test-project",
					topicId: "test-topic",
				}),
			)
		})
	})

	describe("isIndexedDBAvailable", () => {
		it("should return true when IndexedDB is available", () => {
			const originalIndexedDB = global.indexedDB
			Object.defineProperty(global, "indexedDB", {
				value: {},
				configurable: true,
				writable: true,
			})

			expect(isIndexedDBAvailable()).toBe(true)

			// Restore original
			Object.defineProperty(global, "indexedDB", {
				value: originalIndexedDB,
				configurable: true,
				writable: true,
			})
		})

		it("should return false when IndexedDB is not available", () => {
			const originalIndexedDB = global.indexedDB
			Object.defineProperty(global, "indexedDB", {
				value: undefined,
				configurable: true,
				writable: true,
			})

			expect(isIndexedDBAvailable()).toBe(false)

			// Restore original
			Object.defineProperty(global, "indexedDB", {
				value: originalIndexedDB,
				configurable: true,
				writable: true,
			})
		})

		it("should return false when IndexedDB throws an error", () => {
			const originalIndexedDB = global.indexedDB
			Object.defineProperty(global, "indexedDB", {
				get: () => {
					throw new Error("SecurityError")
				},
				configurable: true,
			})

			expect(isIndexedDBAvailable()).toBe(false)

			// Restore original
			Object.defineProperty(global, "indexedDB", {
				value: originalIndexedDB,
				configurable: true,
				writable: true,
			})
		})
	})

	describe("Version Management", () => {
		it("should delete specific draft version", async () => {
			const mockDeleteDraftVersion = vi.fn().mockResolvedValue(undefined)
			mockDraftService.deleteDraftVersion = mockDeleteDraftVersion

			const draftKey: DraftKey = {
				workspaceId: "test-workspace",
				projectId: "test-project",
				topicId: "test-topic",
			}

			await draftManager.deleteDraftVersion(draftKey, "version-1")

			expect(mockDeleteDraftVersion).toHaveBeenCalledWith(draftKey, "version-1")
		})

		it("should load latest draft version", async () => {
			const mockDraft: DraftData = {
				workspaceId: "test-workspace",
				projectId: "test-project",
				topicId: "test-topic",
				value: { type: "doc", content: [] },
				mentionItems: [],
				createdAt: 1000,
				updatedAt: 2000,
				versionId: "latest",
			}

			mockDraftService.loadLatestDraftVersion = vi.fn().mockResolvedValue(mockDraft)

			const result = await draftManager.loadLatestDraftVersion({
				workspaceId: "test-workspace",
				projectId: "test-project",
				topicId: "test-topic",
			})

			expect(result).toEqual(mockDraft)
		})
	})

	describe("Workspace Handling", () => {
		it("should handle undefined workspaceId as 'global'", async () => {
			const draftWithoutWorkspace = {
				projectId: "test-project",
				topicId: "test-topic",
				value: meaningfulDraftData.value,
				mentionItems: [],
			}

			const mockSaveDraftVersion = vi.fn().mockResolvedValue(undefined)
			mockDraftService.saveDraftVersion = mockSaveDraftVersion

			await draftManager.saveDraft(draftWithoutWorkspace)

			expect(mockSaveDraftVersion).toHaveBeenCalledWith(
				expect.objectContaining({
					workspaceId: undefined,
					projectId: "test-project",
					topicId: "test-topic",
				}),
				expect.objectContaining({
					workspaceId: "global",
					projectId: "test-project",
					topicId: "test-topic",
				}),
			)
		})

		it("should preserve workspaceId when provided", async () => {
			const mockSaveDraftVersion = vi.fn().mockResolvedValue(undefined)
			mockDraftService.saveDraftVersion = mockSaveDraftVersion

			await draftManager.saveDraft(meaningfulDraftData)

			expect(mockSaveDraftVersion).toHaveBeenCalledWith(
				expect.objectContaining({
					workspaceId: "test-workspace",
				}),
				expect.objectContaining({
					workspaceId: "test-workspace",
				}),
			)
		})
	})

	describe("DraftService", () => {
		it("should initialize with IndexedDB when available", () => {
			const originalIndexedDB = global.indexedDB
			Object.defineProperty(global, "indexedDB", {
				value: {},
				configurable: true,
				writable: true,
			})

			const service = new DraftService()
			const info = service.getStorageInfo()
			expect(info.type).toBe("indexeddb")
			expect(info.isIndexedDB).toBe(true)

			// Restore original
			Object.defineProperty(global, "indexedDB", {
				value: originalIndexedDB,
				configurable: true,
				writable: true,
			})
		})

		it("should initialize with localStorage when IndexedDB not available", () => {
			const originalIndexedDB = global.indexedDB
			Object.defineProperty(global, "indexedDB", {
				value: undefined,
				configurable: true,
				writable: true,
			})

			const service = new DraftService()
			const info = service.getStorageInfo()
			expect(info.type).toBe("localstorage")
			expect(info.isIndexedDB).toBe(false)

			// Restore original
			Object.defineProperty(global, "indexedDB", {
				value: originalIndexedDB,
				configurable: true,
				writable: true,
			})
		})
	})
})
