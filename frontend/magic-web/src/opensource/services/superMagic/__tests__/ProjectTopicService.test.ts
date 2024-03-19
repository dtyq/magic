import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TopicMode } from "@/opensource/pages/superMagic/pages/Workspace/types"

// Mock dependencies
vi.mock("@/opensource/models/user", () => ({
	userStore: {
		user: {
			organizationCode: "test-org",
			userInfo: {
				user_id: "test-user-123",
			},
		},
	},
}))

vi.mock("@/opensource/utils/storage", () => ({
	platformKey: (str: string) => `MAGIC:${str}`,
}))

// Mock localStorage
const mockLocalStorage = {
	store: {} as Record<string, string>,
	getItem: vi.fn((key: string) => mockLocalStorage.store[key] || null),
	setItem: vi.fn((key: string, value: string) => {
		mockLocalStorage.store[key] = value
	}),
	removeItem: vi.fn((key: string) => {
		delete mockLocalStorage.store[key]
	}),
	clear: vi.fn(() => {
		mockLocalStorage.store = {}
	}),
}

// Mock window.localStorage
Object.defineProperty(window, "localStorage", {
	value: mockLocalStorage,
	writable: true,
})

// Import the service after mocking
import ProjectTopicService from "../ProjectTopicService"

describe("ProjectTopicService", () => {
	beforeEach(() => {
		// Clear localStorage mock before each test
		mockLocalStorage.clear()
		vi.clearAllMocks()

		// Reset the service instance
		ProjectTopicService.projectTopicModeMap = new Map()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("Constructor", () => {
		it("should initialize with empty map when localStorage is empty", () => {
			// Arrange
			mockLocalStorage.store = {}

			// Act - Create new service instance
			const service = new (ProjectTopicService.constructor as any)()

			// Assert
			expect(service.projectTopicModeMap.size).toBe(0)
		})

		it("should initialize with data from localStorage", () => {
			// Arrange
			const testData = [
				["workspace1/project1", TopicMode.General],
				["workspace2/project2", TopicMode.DataAnalysis],
			]
			mockLocalStorage.store[
				"MAGIC:super_magic/default_project_topic_mode/test-org/test-user-123"
			] = JSON.stringify(testData)

			// Act
			const service = new (ProjectTopicService.constructor as any)()

			// Assert
			expect(service.projectTopicModeMap.size).toBe(2)
			expect(service.projectTopicModeMap.get("workspace1/project1")).toBe(TopicMode.General)
			expect(service.projectTopicModeMap.get("workspace2/project2")).toBe(
				TopicMode.DataAnalysis,
			)
		})

		it("should initialize with empty map when localStorage contains invalid JSON", () => {
			// Arrange
			mockLocalStorage.store[
				"MAGIC:super_magic/default_project_topic_mode/test-org/test-user-123"
			] = "invalid json"

			// Act
			const service = new (ProjectTopicService.constructor as any)()

			// Assert
			expect(service.projectTopicModeMap.size).toBe(0)
		})
	})

	describe("globalTopicModeLocaleStorageKey", () => {
		it("should generate correct localStorage key for global topic mode", () => {
			// Act
			const key = ProjectTopicService.globalTopicModeLocaleStorageKey()

			// Assert
			expect(key).toBe("MAGIC:super_magic/default_topic_mode/test-org/test-user-123")
		})
	})

	describe("projectTopicModeLocaleStorageKey", () => {
		it("should generate correct localStorage key for project topic mode", () => {
			// Act
			const key = ProjectTopicService.projectTopicModeLocaleStorageKey()

			// Assert
			expect(key).toBe("MAGIC:super_magic/default_project_topic_mode/test-org/test-user-123")
		})
	})

	describe("genProjectTopicModeCacheKey", () => {
		it("should generate correct cache key for project topic mode", () => {
			// Act
			const key = ProjectTopicService.genProjectTopicModeCacheKey(
				"workspace123",
				"project456",
			)

			// Assert
			expect(key).toBe("workspace123/project456")
		})
	})

	describe("isTopicModeValid", () => {
		it("should return true for valid topic modes", () => {
			// Act & Assert
			expect(ProjectTopicService.isTopicModeValid(TopicMode.General)).toBe(true)
			expect(ProjectTopicService.isTopicModeValid(TopicMode.DataAnalysis)).toBe(true)
			expect(ProjectTopicService.isTopicModeValid(TopicMode.PPT)).toBe(true)
			expect(ProjectTopicService.isTopicModeValid(TopicMode.Report)).toBe(true)
			expect(ProjectTopicService.isTopicModeValid(TopicMode.Summary)).toBe(true)
		})

		it("should return false for invalid topic modes", () => {
			// Act & Assert
			expect(ProjectTopicService.isTopicModeValid("invalid" as TopicMode)).toBe(false)
			expect(ProjectTopicService.isTopicModeValid("" as TopicMode)).toBe(false)
			expect(ProjectTopicService.isTopicModeValid(undefined as any)).toBe(false)
			expect(ProjectTopicService.isTopicModeValid(null as any)).toBe(false)
		})
	})

	describe("getGlobalTopicMode", () => {
		it("should return stored global topic mode", () => {
			// Arrange
			const key = "MAGIC:super_magic/default_topic_mode/test-org/test-user-123"
			mockLocalStorage.store[key] = JSON.stringify(TopicMode.DataAnalysis)

			// Act
			const result = ProjectTopicService.getGlobalTopicMode()

			// Assert
			expect(result).toBe(TopicMode.DataAnalysis)
		})

		it("should return General mode when no stored value exists", () => {
			// Arrange
			mockLocalStorage.store = {}

			// Act
			const result = ProjectTopicService.getGlobalTopicMode()

			// Assert
			expect(result).toBe(TopicMode.General)
			expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
				"MAGIC:super_magic/default_topic_mode/test-org/test-user-123",
				JSON.stringify(TopicMode.General),
			)
		})

		it("should return General mode when stored value is invalid JSON", () => {
			// Arrange
			const key = "MAGIC:super_magic/default_topic_mode/test-org/test-user-123"
			mockLocalStorage.store[key] = "invalid json"

			// Act
			const result = ProjectTopicService.getGlobalTopicMode()

			// Assert
			expect(result).toBe(TopicMode.General)
		})

		it("should return General mode when stored value is not a valid topic mode", () => {
			// Arrange
			const key = "MAGIC:super_magic/default_topic_mode/test-org/test-user-123"
			mockLocalStorage.store[key] = JSON.stringify("invalid_mode")

			// Act
			const result = ProjectTopicService.getGlobalTopicMode()

			// Assert
			expect(result).toBe(TopicMode.General)
		})
	})

	describe("setGlobalTopicMode", () => {
		it("should store global topic mode in localStorage", () => {
			// Act
			ProjectTopicService.setGlobalTopicMode(TopicMode.PPT)

			// Assert
			expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
				"MAGIC:super_magic/default_topic_mode/test-org/test-user-123",
				JSON.stringify(TopicMode.PPT),
			)
		})
	})

	describe("getProjectDefaultTopicMode", () => {
		it("should return stored project topic mode", () => {
			// Arrange
			ProjectTopicService.projectTopicModeMap.set("workspace1/project1", TopicMode.Report)

			// Act
			const result = ProjectTopicService.getProjectDefaultTopicMode("workspace1", "project1")

			// Assert
			expect(result).toBe(TopicMode.Report)
		})

		it("should return global topic mode when project mode is not stored", () => {
			// Arrange
			const globalKey = "MAGIC:super_magic/default_topic_mode/test-org/test-user-123"
			mockLocalStorage.store[globalKey] = JSON.stringify(TopicMode.Summary)

			// Act
			const result = ProjectTopicService.getProjectDefaultTopicMode("workspace1", "project1")

			// Assert
			expect(result).toBe(TopicMode.Summary)
			expect(ProjectTopicService.projectTopicModeMap.get("workspace1/project1")).toBe(
				TopicMode.Summary,
			)
		})

		it("should return global topic mode when stored project mode is invalid", () => {
			// Arrange
			ProjectTopicService.projectTopicModeMap.set("workspace1/project1", "invalid" as any)
			const globalKey = "MAGIC:super_magic/default_topic_mode/test-org/test-user-123"
			mockLocalStorage.store[globalKey] = JSON.stringify(TopicMode.DataAnalysis)

			// Act
			const result = ProjectTopicService.getProjectDefaultTopicMode("workspace1", "project1")

			// Assert
			expect(result).toBe(TopicMode.DataAnalysis)
		})
	})

	describe("setProjectDefaultTopicMode", () => {
		it("should store project topic mode in memory and localStorage", () => {
			// Act
			ProjectTopicService.setProjectDefaultTopicMode("workspace1", "project1", TopicMode.PPT)

			// Assert
			expect(ProjectTopicService.projectTopicModeMap.get("workspace1/project1")).toBe(
				TopicMode.PPT,
			)
			expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
				"MAGIC:super_magic/default_project_topic_mode/test-org/test-user-123",
				JSON.stringify([["workspace1/project1", TopicMode.PPT]]),
			)
		})

		it("should update existing project topic mode", () => {
			// Arrange
			ProjectTopicService.projectTopicModeMap.set("workspace1/project1", TopicMode.General)
			ProjectTopicService.projectTopicModeMap.set(
				"workspace2/project2",
				TopicMode.DataAnalysis,
			)

			// Act
			ProjectTopicService.setProjectDefaultTopicMode(
				"workspace1",
				"project1",
				TopicMode.Report,
			)

			// Assert
			expect(ProjectTopicService.projectTopicModeMap.get("workspace1/project1")).toBe(
				TopicMode.Report,
			)
			expect(ProjectTopicService.projectTopicModeMap.get("workspace2/project2")).toBe(
				TopicMode.DataAnalysis,
			)
			expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
				"MAGIC:super_magic/default_project_topic_mode/test-org/test-user-123",
				JSON.stringify([
					["workspace1/project1", TopicMode.Report],
					["workspace2/project2", TopicMode.DataAnalysis],
				]),
			)
		})
	})

	describe("Integration tests", () => {
		it("should handle complete workflow of setting and getting project topic mode", () => {
			// Arrange - Set global mode first
			ProjectTopicService.setGlobalTopicMode(TopicMode.DataAnalysis)

			// Act & Assert - Get project mode should return global mode initially
			let result = ProjectTopicService.getProjectDefaultTopicMode("workspace1", "project1")
			expect(result).toBe(TopicMode.DataAnalysis)

			// Act - Set specific project mode
			ProjectTopicService.setProjectDefaultTopicMode("workspace1", "project1", TopicMode.PPT)

			// Assert - Get project mode should return project-specific mode
			result = ProjectTopicService.getProjectDefaultTopicMode("workspace1", "project1")
			expect(result).toBe(TopicMode.PPT)
		})

		it("should handle multiple projects with different topic modes", () => {
			// Arrange & Act
			ProjectTopicService.setProjectDefaultTopicMode(
				"workspace1",
				"project1",
				TopicMode.General,
			)
			ProjectTopicService.setProjectDefaultTopicMode(
				"workspace1",
				"project2",
				TopicMode.DataAnalysis,
			)
			ProjectTopicService.setProjectDefaultTopicMode("workspace2", "project1", TopicMode.PPT)

			// Assert
			expect(ProjectTopicService.getProjectDefaultTopicMode("workspace1", "project1")).toBe(
				TopicMode.General,
			)
			expect(ProjectTopicService.getProjectDefaultTopicMode("workspace1", "project2")).toBe(
				TopicMode.DataAnalysis,
			)
			expect(ProjectTopicService.getProjectDefaultTopicMode("workspace2", "project1")).toBe(
				TopicMode.PPT,
			)
		})
	})

	describe("Edge cases", () => {
		it("should handle empty workspace and project IDs", () => {
			// Act
			const cacheKey = ProjectTopicService.genProjectTopicModeCacheKey("", "")

			// Assert
			expect(cacheKey).toBe("/")
		})

		it("should handle localStorage errors gracefully", () => {
			// Arrange
			mockLocalStorage.getItem.mockImplementationOnce(() => {
				throw new Error("localStorage error")
			})

			// Act & Assert - Should return default value and not throw error
			const result = ProjectTopicService.getGlobalTopicMode()
			expect(result).toBe(TopicMode.General)
		})

		it("should handle localStorage setItem errors gracefully", () => {
			// Arrange
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			mockLocalStorage.setItem.mockImplementationOnce(() => {
				throw new Error("localStorage error")
			})

			// Act & Assert - Should not throw error and should log warning
			expect(() => ProjectTopicService.setGlobalTopicMode(TopicMode.General)).not.toThrow()
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				"Failed to save global topic mode to localStorage:",
				expect.any(Error),
			)

			consoleWarnSpy.mockRestore()
		})

		it("should handle localStorage setItem errors gracefully in setProjectDefaultTopicMode", () => {
			// Arrange
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			mockLocalStorage.setItem.mockImplementationOnce(() => {
				throw new Error("localStorage error")
			})

			// Act & Assert - Should not throw error and should log warning
			expect(() =>
				ProjectTopicService.setProjectDefaultTopicMode("ws1", "proj1", TopicMode.PPT),
			).not.toThrow()
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				"Failed to save project topic mode to localStorage:",
				expect.any(Error),
			)

			// Verify that the in-memory map was still updated
			expect(ProjectTopicService.projectTopicModeMap.get("ws1/proj1")).toBe(TopicMode.PPT)

			consoleWarnSpy.mockRestore()
		})
	})
})
