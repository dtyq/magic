import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { IndexedDBDraftService } from "../IndexedDBDraftService"
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

describe("IndexedDBDraftService", () => {
	let service: IndexedDBDraftService
	const testKey: DraftKey = {
		workspaceId: "workspace-123",
		projectId: "project-456",
		topicId: "topic-789",
	}

	const testDraftData: Omit<DraftData, "createdAt" | "updatedAt"> = {
		workspaceId: "workspace-123",
		projectId: "project-456",
		topicId: "topic-789",
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
	}

	beforeEach(() => {
		vi.clearAllMocks()
		service = new IndexedDBDraftService()
	})

	afterEach(() => {
		service.close()
	})

	describe("Interface consistency", () => {
		it("should implement DraftServiceInterface", () => {
			expect(typeof service.saveDraft).toBe("function")
			expect(typeof service.loadDraft).toBe("function")
			expect(typeof service.deleteDraft).toBe("function")
			expect(typeof service.clearAllDrafts).toBe("function")
			expect(typeof service.close).toBe("function")
			expect(typeof service.saveDraftVersion).toBe("function")
			expect(typeof service.loadDraftVersions).toBe("function")
			expect(typeof service.loadDraftByVersion).toBe("function")
			expect(typeof service.deleteDraftVersion).toBe("function")
			expect(typeof service.cleanupExpiredVersions).toBe("function")
		})

		it("should be instantiable", () => {
			expect(service).toBeDefined()
			expect(service).toBeInstanceOf(IndexedDBDraftService)
		})
	})

	describe("saveDraft", () => {
		it("should save draft data successfully", async () => {
			// Mock the db.drafts table
			const mockDraftsTable = {
				get: vi.fn().mockResolvedValue(null),
				put: vi.fn().mockResolvedValue(undefined),
			}

			const mockDB = {
				drafts: mockDraftsTable,
				open: vi.fn().mockResolvedValue(undefined),
				close: vi.fn(),
			}

			vi.spyOn(service as any, "db", "get").mockReturnValue(mockDB)

			await service.saveDraft(testKey, testDraftData)

			// Verify put was called
			expect(mockDraftsTable.put).toHaveBeenCalled()
			const putCall = mockDraftsTable.put.mock.calls[0][0]
			expect(putCall).toHaveProperty("projectId", testKey.projectId)
			expect(putCall).toHaveProperty("topicId", testKey.topicId)
		})

		it("should preserve createdAt when updating existing draft", async () => {
			const existingCreatedAt = Date.now() - 10000
			// Mock the db.drafts table with existing draft
			const mockDraftsTable = {
				get: vi.fn().mockResolvedValue({
					createdAt: existingCreatedAt,
					updatedAt: Date.now() - 5000,
				}),
				put: vi.fn().mockResolvedValue(undefined),
			}

			const mockDB = {
				drafts: mockDraftsTable,
				open: vi.fn().mockResolvedValue(undefined),
				close: vi.fn(),
			}

			vi.spyOn(service as any, "db", "get").mockReturnValue(mockDB)

			await service.saveDraft(testKey, testDraftData)

			// Verify put was called with preserved createdAt
			expect(mockDraftsTable.put).toHaveBeenCalled()
			const putCall = mockDraftsTable.put.mock.calls[0][0]
			expect(putCall).toHaveProperty("createdAt", existingCreatedAt)
		})
	})

	describe("saveDraftVersion", () => {
		it("should skip saving when version data equals latest version", async () => {
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

			vi.spyOn(service, "loadLatestDraftVersion").mockResolvedValue(existingVersionData)
			vi.spyOn(service as any, "loadFirstDifferentTimeVersion").mockResolvedValue(
				existingVersionData,
			)

			const mockVersionsTable = {
				get: vi.fn().mockResolvedValue(null),
				put: vi.fn().mockResolvedValue(undefined),
				delete: vi.fn().mockResolvedValue(undefined),
			}

			const mockDB = {
				draftVersions: mockVersionsTable,
				open: vi.fn().mockResolvedValue(undefined),
				close: vi.fn(),
			}

			vi.spyOn(service as any, "db", "get").mockReturnValue(mockDB)

			await expect(service.saveDraftVersion(testKey, versionData)).resolves.toBeUndefined()

			// Should not call put since data is equal
			expect(mockVersionsTable.put).not.toHaveBeenCalled()
		})

		it("should save when version data is different", async () => {
			const versionData = {
				...testDraftData,
				versionId: "test-version",
				versionTimestamp: Date.now(),
				isAutoSaved: false,
			}

			vi.spyOn(service, "loadLatestDraftVersion").mockResolvedValue(null)
			vi.spyOn(service as any, "loadFirstDifferentTimeVersion").mockResolvedValue(null)

			const mockVersionsTable = {
				get: vi.fn().mockResolvedValue(null),
				put: vi.fn().mockResolvedValue(undefined),
			}

			const mockDB = {
				draftVersions: mockVersionsTable,
				open: vi.fn().mockResolvedValue(undefined),
				close: vi.fn(),
			}

			vi.spyOn(service as any, "db", "get").mockReturnValue(mockDB)

			await service.saveDraftVersion(testKey, versionData)

			// Verify put was called
			expect(mockVersionsTable.put).toHaveBeenCalled()
			const putCall = mockVersionsTable.put.mock.calls[0][0]
			expect(putCall).toHaveProperty("versionId", "test-version")
			expect(putCall).toHaveProperty("projectId", testKey.projectId)
		})
	})

	describe("Error handling", () => {
		it("should handle errors gracefully", async () => {
			// Test that cleanup doesn't throw
			await expect(service.cleanupExpiredVersions()).resolves.toBeUndefined()
		})

		it("should return null for missing data", async () => {
			// Mock the db.drafts table to return no data
			const mockDraftsTable = {
				get: vi.fn().mockResolvedValue(undefined),
			}

			const mockDB = {
				drafts: mockDraftsTable,
				open: vi.fn().mockResolvedValue(undefined),
				close: vi.fn(),
			}

			vi.spyOn(service as any, "db", "get").mockReturnValue(mockDB)

			const result = await service.loadDraft(testKey)
			expect(result).toBeNull()
		})
	})

	describe("loadProjectDraftVersions", () => {
		it("should implement loadProjectDraftVersions method", () => {
			expect(typeof service.loadProjectDraftVersions).toBe("function")
		})

		it("should load versions across all topics in a project", async () => {
			// This is a basic test to ensure the method exists and returns an array
			const result = await service.loadProjectDraftVersions({
				workspaceId: "workspace-123",
				projectId: "project-456",
			})

			expect(Array.isArray(result)).toBe(true)
		})

		it("should accept offset and limit parameters", async () => {
			const result = await service.loadProjectDraftVersions(
				{
					workspaceId: "workspace-123",
					projectId: "project-456",
				},
				0,
				10,
			)

			expect(Array.isArray(result)).toBe(true)
		})
	})
})
