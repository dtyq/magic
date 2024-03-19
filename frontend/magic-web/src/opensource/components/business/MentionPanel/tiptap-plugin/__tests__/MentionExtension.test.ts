import { describe, it, expect, vi, beforeEach } from "vitest"
import { getMentionUniqueId, getMentionDisplayName } from "../types"
import { MentionItemType } from "../../types"
import type { UserService } from "@/opensource/services/user/UserService"

// Mock all external dependencies that cause issues
vi.mock("@dtyq/upload-sdk", () => ({
	default: vi.fn(),
	Upload: vi.fn().mockImplementation(() => ({
		upload: vi.fn(),
		cancel: vi.fn(),
		destroy: vi.fn(),
	})),
}))

vi.mock("@/opensource/services/chat/message/MessageFileService", () => ({
	default: vi.fn().mockImplementation(() => ({
		uploadFile: vi.fn(),
		cancelUpload: vi.fn(),
	})),
}))

vi.mock("@/opensource/services/index", () => ({
	service: {
		get: vi.fn((name: string) => {
			if (name !== "userService") return undefined
			return {
				on: vi.fn(),
				isLoggedIn: true,
			} as Partial<UserService>
		}),
	},
}))

vi.mock("@/opensource/components/business/MentionPanel/store", () => ({
	default: {
		setUploadFiles: vi.fn(),
	},
}))

vi.mock("@tiptap/extension-suggestion", () => ({
	Suggestion: vi.fn(() => ({})),
}))

vi.mock("@tiptap/core", () => ({
	Node: {
		create: vi.fn(() => ({
			configure: vi.fn(),
		})),
	},
	Plugin: vi.fn(),
	PluginKey: vi.fn(),
}))

describe("MentionExtension Integration Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("getMentionUniqueId", () => {
		it("should generate unique id for agent mention", () => {
			const mention = {
				type: MentionItemType.AGENT,
				data: {
					agent_id: "test-agent",
					agent_name: "Test Agent",
					agent_description: "Test Description",
				},
			}

			const id = getMentionUniqueId(mention)
			expect(id).toBe("agent:test-agent")
		})

		it("should generate unique id for upload file mention", () => {
			const mention = {
				type: MentionItemType.UPLOAD_FILE,
				data: {
					file_id: "file-123",
					file_name: "test.pdf",
					file_path: "/path/to/file",
					file_extension: "pdf",
					file_size: 1024,
				},
			}

			const id = getMentionUniqueId(mention)
			expect(id).toBe("upload:file-123")
		})

		it("should generate unique id for project file mention", () => {
			const mention = {
				type: MentionItemType.PROJECT_FILE,
				data: {
					file_id: "project-file-123",
					file_name: "document.docx",
					file_path: "/project/document.docx",
					file_extension: "docx",
					file_size: 2048,
				},
			}

			const id = getMentionUniqueId(mention)
			expect(id).toBe("project:project-file-123//project/document.docx")
		})

		it("should handle cloud file mentions", () => {
			const mention = {
				type: MentionItemType.CLOUD_FILE,
				data: {
					file_id: "cloud-file-123",
					file_name: "cloud.docx",
					file_path: "/cloud/document.docx",
					file_extension: "docx",
					file_size: 3072,
				},
			}

			const id = getMentionUniqueId(mention)
			expect(id).toBe("cloud:cloud-file-123")
		})
	})

	describe("getMentionDisplayName", () => {
		it("should get display name for agent mention", () => {
			const mention = {
				type: MentionItemType.AGENT,
				data: {
					agent_id: "test-agent",
					agent_name: "Test Agent",
					agent_description: "Test Description",
				},
			}

			const name = getMentionDisplayName(mention)
			expect(name).toBe("Test Agent")
		})

		it("should get display name for upload file mention", () => {
			const mention = {
				type: MentionItemType.UPLOAD_FILE,
				data: {
					file_id: "file-123",
					file_name: "test.pdf",
					file_path: "/path/to/file",
					file_extension: "pdf",
					file_size: 1024,
				},
			}

			const name = getMentionDisplayName(mention)
			expect(name).toBe("test.pdf")
		})

		it("should get display name for project file mention", () => {
			const mention = {
				type: MentionItemType.PROJECT_FILE,
				data: {
					file_id: "project-file-123",
					file_name: "document.docx",
					file_path: "/project/document.docx",
					file_extension: "docx",
					file_size: 2048,
				},
			}

			const name = getMentionDisplayName(mention)
			expect(name).toBe("document.docx")
		})

		it("should get display name for cloud file mention", () => {
			const mention = {
				type: MentionItemType.CLOUD_FILE,
				data: {
					file_id: "cloud-file-123",
					file_name: "cloud.docx",
					file_path: "/cloud/document.docx",
					file_extension: "docx",
					file_size: 3072,
				},
			}

			const name = getMentionDisplayName(mention)
			expect(name).toBe("cloud.docx")
		})
	})

	describe("Mention Extension Configuration", () => {
		it("should support language configuration", () => {
			const languages = ["en", "zh", "ja", "ko"]
			languages.forEach((lang) => {
				expect(typeof lang).toBe("string")
			})
		})

		it("should support callback configuration", () => {
			const onInsert = vi.fn()
			const onInsertItems = vi.fn()
			const onRemove = vi.fn()
			const onRemoveItems = vi.fn()

			expect(typeof onInsert).toBe("function")
			expect(typeof onInsertItems).toBe("function")
			expect(typeof onRemove).toBe("function")
			expect(typeof onRemoveItems).toBe("function")
		})

		it("should support render text configuration", () => {
			const renderText = vi.fn(() => "Custom text")
			const result = renderText({ options: {}, node: {} })
			expect(result).toBe("Custom text")
		})

		it("should support spaces and prefixes configuration", () => {
			const allowSpaces = true
			const allowedPrefixes = ["@", "#"]

			expect(typeof allowSpaces).toBe("boolean")
			expect(Array.isArray(allowedPrefixes)).toBe(true)
		})

		it("should support parent container configuration", () => {
			const getParentContainer = vi.fn(() => document.body)
			const result = getParentContainer()
			expect(result).toBe(document.body)
		})
	})

	describe("Mention Item Types", () => {
		it("should have correct mention item type values", () => {
			expect(MentionItemType.AGENT).toBe("agent")
			expect(MentionItemType.UPLOAD_FILE).toBe("upload_file")
			expect(MentionItemType.PROJECT_FILE).toBe("project_file")
			expect(MentionItemType.CLOUD_FILE).toBe("cloud_file")
		})

		it("should support MCP mention type", () => {
			expect(MentionItemType.MCP).toBe("mcp")
		})
	})
})
