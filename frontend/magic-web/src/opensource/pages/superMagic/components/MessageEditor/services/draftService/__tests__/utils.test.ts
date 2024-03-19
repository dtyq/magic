import { describe, it, expect, vi, beforeEach } from "vitest"
import {
	hasMeaningfulData,
	genDraftVersionId,
	generateKey,
	generateVersionKey,
	generateLegacyKey,
	isEqualData,
} from "../utils"
import type { DraftKey } from "../../../types"

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

// Mock formatTime utility
vi.mock("@/opensource/utils/string", () => ({
	formatTime: vi.fn((timestamp: number, format: string) => {
		// Simple mock implementation
		const date = new Date(timestamp * 1000)
		return (
			date.getFullYear().toString() +
			(date.getMonth() + 1).toString().padStart(2, "0") +
			date.getDate().toString().padStart(2, "0") +
			date.getHours().toString().padStart(2, "0") +
			date.getMinutes().toString().padStart(2, "0")
		)
	}),
}))

describe("utils", () => {
	describe("hasMeaningfulData", () => {
		it("should return true for content with text", () => {
			const data = {
				value: {
					type: "doc",
					content: [
						{
							type: "paragraph",
							content: [{ type: "text", text: "Hello world" }],
						},
					],
				},
				mentionItems: [],
			}

			expect(hasMeaningfulData(data)).toBe(true)
		})

		it("should return true for data with mentions", () => {
			const data = {
				value: undefined,
				mentionItems: [{ type: "mention", attrs: { type: "user", data: { id: "123" } } }],
			}

			expect(hasMeaningfulData(data)).toBe(true)
		})

		it("should return false for empty paragraphs", () => {
			const data = {
				value: {
					type: "doc",
					content: [{ type: "paragraph" }],
				},
				mentionItems: [],
			}

			expect(hasMeaningfulData(data)).toBe(false)
		})

		it("should return false for empty content", () => {
			const data = {
				value: {
					type: "doc",
					content: [],
				},
				mentionItems: [],
			}

			expect(hasMeaningfulData(data)).toBe(false)
		})

		it("should return false for undefined value and no mentions", () => {
			const data = {
				value: undefined,
				mentionItems: [],
			}

			expect(hasMeaningfulData(data)).toBe(false)
		})

		it("should return false for null value and no mentions", () => {
			const data = {
				value: null,
				mentionItems: [],
			}

			expect(hasMeaningfulData(data)).toBe(false)
		})

		it("should return true for non-paragraph content", () => {
			const data = {
				value: {
					type: "doc",
					content: [
						{
							type: "codeBlock",
							content: [],
						},
					],
				},
				mentionItems: [],
			}

			expect(hasMeaningfulData(data)).toBe(true)
		})
	})

	describe("genDraftVersionId", () => {
		it("should generate version id based on current timestamp", () => {
			// Mock Date.now
			const mockTime = 1234567890000 // 2009-02-13 23:31:30 UTC
			vi.spyOn(Date, "now").mockReturnValue(mockTime)

			const versionId = genDraftVersionId()

			// The exact time might vary due to timezone, but should be a valid format
			expect(versionId).toMatch(/^\d{12}$/) // YYYYMMDDHHMM format
			expect(versionId.length).toBe(12)

			vi.restoreAllMocks()
		})
	})

	describe("generateKey", () => {
		it("should generate key with workspace", () => {
			const draftKey: DraftKey = {
				workspaceId: "workspace-123",
				projectId: "project-456",
				topicId: "topic-789",
			}

			const key = generateKey(draftKey)

			expect(key).toBe("test-org/test-user/workspace-123/project-456:topic-789")
		})

		it("should use 'global' when workspaceId is undefined", () => {
			const draftKey: DraftKey = {
				workspaceId: undefined as any,
				projectId: "project-456",
				topicId: "topic-789",
			}

			const key = generateKey(draftKey)

			expect(key).toBe("test-org/test-user/global/project-456:topic-789")
		})

		it("should use 'global' when workspaceId is empty string", () => {
			const draftKey: DraftKey = {
				workspaceId: "",
				projectId: "project-456",
				topicId: "topic-789",
			}

			const key = generateKey(draftKey)

			expect(key).toBe("test-org/test-user/global/project-456:topic-789")
		})
	})

	describe("generateVersionKey", () => {
		it("should generate version key with workspace and version", () => {
			const draftKey: DraftKey = {
				workspaceId: "workspace-123",
				projectId: "project-456",
				topicId: "topic-789",
			}
			const versionId = "v1.0"

			const key = generateVersionKey(draftKey, versionId)

			expect(key).toBe("test-org/test-user/workspace-123/project-456:topic-789:v1.0")
		})

		it("should use 'global' when workspaceId is undefined", () => {
			const draftKey: DraftKey = {
				workspaceId: undefined as any,
				projectId: "project-456",
				topicId: "topic-789",
			}
			const versionId = "v1.0"

			const key = generateVersionKey(draftKey, versionId)

			expect(key).toBe("test-org/test-user/global/project-456:topic-789:v1.0")
		})
	})

	describe("generateLegacyKey", () => {
		it("should generate legacy key without workspace dimension", () => {
			const draftKey: DraftKey = {
				workspaceId: "workspace-123",
				projectId: "project-456",
				topicId: "topic-789",
			}

			const key = generateLegacyKey(draftKey)

			expect(key).toBe("test-org/test-user/project-456:topic-789")
		})

		it("should generate same key regardless of workspaceId", () => {
			const draftKey1: DraftKey = {
				workspaceId: "workspace-123",
				projectId: "project-456",
				topicId: "topic-789",
			}

			const draftKey2: DraftKey = {
				workspaceId: "different-workspace",
				projectId: "project-456",
				topicId: "topic-789",
			}

			const key1 = generateLegacyKey(draftKey1)
			const key2 = generateLegacyKey(draftKey2)

			expect(key1).toBe(key2)
			expect(key1).toBe("test-org/test-user/project-456:topic-789")
		})
	})

	describe("isEqualData", () => {
		it("should return true for equal data", () => {
			const data1 = {
				value: {
					type: "doc",
					content: [
						{
							type: "paragraph",
							content: [{ type: "text", text: "Hello" }],
						},
					],
				},
				mentionItems: [{ type: "mention", attrs: { type: "user", data: { id: "123" } } }],
			}

			const data2 = {
				value: {
					type: "doc",
					content: [
						{
							type: "paragraph",
							content: [{ type: "text", text: "Hello" }],
						},
					],
				},
				mentionItems: [{ type: "mention", attrs: { type: "user", data: { id: "123" } } }],
			}

			expect(isEqualData(data1, data2)).toBe(true)
		})

		it("should return false for different values", () => {
			const data1 = {
				value: {
					type: "doc",
					content: [
						{
							type: "paragraph",
							content: [{ type: "text", text: "Hello" }],
						},
					],
				},
				mentionItems: [],
			}

			const data2 = {
				value: {
					type: "doc",
					content: [
						{
							type: "paragraph",
							content: [{ type: "text", text: "World" }],
						},
					],
				},
				mentionItems: [],
			}

			expect(isEqualData(data1, data2)).toBe(false)
		})

		it("should return false for different mention items", () => {
			const data1 = {
				value: undefined,
				mentionItems: [{ type: "mention", attrs: { type: "user", data: { id: "123" } } }],
			}

			const data2 = {
				value: undefined,
				mentionItems: [{ type: "mention", attrs: { type: "user", data: { id: "456" } } }],
			}

			expect(isEqualData(data1, data2)).toBe(false)
		})

		it("should return false when latest version is null", () => {
			const data1 = {
				value: {
					type: "doc",
					content: [
						{
							type: "paragraph",
							content: [{ type: "text", text: "Hello" }],
						},
					],
				},
				mentionItems: [],
			}

			expect(isEqualData(data1, null)).toBe(false)
		})

		it("should return true for both undefined values", () => {
			const data1 = {
				value: undefined,
				mentionItems: [],
			}

			const data2 = {
				value: undefined,
				mentionItems: [],
			}

			expect(isEqualData(data1, data2)).toBe(true)
		})

		it("should handle complex nested objects", () => {
			const data1 = {
				value: {
					type: "doc",
					content: [
						{
							type: "paragraph",
							content: [
								{ type: "text", text: "Hello " },
								{ type: "text", text: "world", marks: [{ type: "bold" }] },
							],
						},
					],
				},
				mentionItems: [
					{
						type: "mention",
						attrs: {
							type: "user",
							data: { id: "123", name: "John", avatar: "url" },
						},
					},
				],
			}

			const data2 = {
				value: {
					type: "doc",
					content: [
						{
							type: "paragraph",
							content: [
								{ type: "text", text: "Hello " },
								{ type: "text", text: "world", marks: [{ type: "bold" }] },
							],
						},
					],
				},
				mentionItems: [
					{
						type: "mention",
						attrs: {
							type: "user",
							data: { id: "123", name: "John", avatar: "url" },
						},
					},
				],
			}

			expect(isEqualData(data1, data2)).toBe(true)
		})
	})
})
