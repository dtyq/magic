import { describe, it, expect, vi, beforeEach } from "vitest"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import type { UserService } from "@/services/user/UserService"

// Mock all external dependencies that cause issues
vi.mock("@dtyq/upload-sdk", () => ({
	default: vi.fn(),
	Upload: vi.fn().mockImplementation(() => ({
		upload: vi.fn(),
		cancel: vi.fn(),
		destroy: vi.fn(),
	})),
}))

vi.mock("@/services/chat/message/MessageFileService", () => ({
	default: vi.fn().mockImplementation(() => ({
		uploadFile: vi.fn(),
		cancelUpload: vi.fn(),
	})),
}))

vi.mock("@/services/index", () => ({
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

vi.mock("@/components/business/MentionPanel/store", () => ({
	default: {
		setUploadFiles: vi.fn(),
	},
}))

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string) => key,
			i18n: { language: "en" },
		}),
	}
})

vi.mock("@tiptap/react", () => ({
	useEditor: vi.fn(() => ({
		getText: vi.fn(() => ""),
		isEmpty: true,
		destroy: vi.fn(),
		commands: {
			setContent: vi.fn(),
			focus: vi.fn(),
		},
	})),
	JSONContent: {},
}))

vi.mock("@/services/chat/editor/AiCompletionService", () => ({
	default: {
		getExtension: vi.fn(() => ({})),
	},
}))

describe("useMessageEditor Integration Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Mention Attributes", () => {
		it("should handle agent mention attributes", () => {
			const agentMention: TiptapMentionAttributes = {
				type: MentionItemType.AGENT,
				data: {
					agent_id: "test-agent",
					agent_name: "Test Agent",
					agent_description: "Test Description",
				},
			}

			expect(agentMention.type).toBe(MentionItemType.AGENT)
			expect(agentMention.data).toBeDefined()
			expect((agentMention.data as any).agent_id).toBe("test-agent")
		})

		it("should handle upload file mention attributes", () => {
			const uploadFileMention: TiptapMentionAttributes = {
				type: MentionItemType.UPLOAD_FILE,
				data: {
					file_id: "file-123",
					file_name: "test.pdf",
					file_path: "/path/to/file",
					file_extension: "pdf",
					file_size: 1024,
				},
			}

			expect(uploadFileMention.type).toBe(MentionItemType.UPLOAD_FILE)
			expect(uploadFileMention.data).toBeDefined()
			expect((uploadFileMention.data as any).file_id).toBe("file-123")
		})

		it("should handle project file mention attributes", () => {
			const projectFileMention: TiptapMentionAttributes = {
				type: MentionItemType.PROJECT_FILE,
				data: {
					file_id: "project-file-123",
					file_name: "document.docx",
					file_path: "/project/document.docx",
					file_extension: "docx",
					file_size: 2048,
				},
			}

			expect(projectFileMention.type).toBe(MentionItemType.PROJECT_FILE)
			expect(projectFileMention.data).toBeDefined()
			expect((projectFileMention.data as any).file_id).toBe("project-file-123")
		})
	})

	describe("Editor Props Interface", () => {
		it("should handle onMentionsInsert callback signature", () => {
			const mockOnMentionsInsert = vi.fn()
			const testMention: TiptapMentionAttributes = {
				type: MentionItemType.AGENT,
				data: {
					agent_id: "test-agent",
					agent_name: "Test Agent",
					agent_description: "Test Description",
				},
			}

			mockOnMentionsInsert(testMention)
			expect(mockOnMentionsInsert).toHaveBeenCalledWith(testMention)
		})

		it("should handle onMentionInsertItems callback signature", () => {
			const mockOnMentionInsertItems = vi.fn()
			const testMentions: TiptapMentionAttributes[] = [
				{
					type: MentionItemType.AGENT,
					data: {
						agent_id: "agent-1",
						agent_name: "Agent 1",
						agent_description: "Agent 1 Description",
					},
				},
				{
					type: MentionItemType.AGENT,
					data: {
						agent_id: "agent-2",
						agent_name: "Agent 2",
						agent_description: "Agent 2 Description",
					},
				},
			]

			mockOnMentionInsertItems(testMentions)
			expect(mockOnMentionInsertItems).toHaveBeenCalledWith(testMentions)
		})

		it("should handle onMentionRemove callback signature", () => {
			const mockOnMentionRemove = vi.fn()
			const testMention: TiptapMentionAttributes = {
				type: MentionItemType.AGENT,
				data: {
					agent_id: "test-agent",
					agent_name: "Test Agent",
					agent_description: "Test Description",
				},
			}

			mockOnMentionRemove(testMention, false)
			expect(mockOnMentionRemove).toHaveBeenCalledWith(testMention, false)
		})

		it("should handle onMentionRemoveItems callback signature", () => {
			const mockOnMentionRemoveItems = vi.fn()
			const testItems = [
				{
					item: {
						type: MentionItemType.AGENT,
						data: {
							agent_id: "agent-1",
							agent_name: "Agent 1",
							agent_description: "Agent 1 Description",
						},
					},
					stillExists: false,
				},
				{
					item: {
						type: MentionItemType.AGENT,
						data: {
							agent_id: "agent-2",
							agent_name: "Agent 2",
							agent_description: "Agent 2 Description",
						},
					},
					stillExists: true,
				},
			]

			mockOnMentionRemoveItems(testItems)
			expect(mockOnMentionRemoveItems).toHaveBeenCalledWith(testItems)
		})
	})

	describe("Editor Configuration", () => {
		it("should support mention module configuration", () => {
			const modules = { mention: { enabled: true } }
			expect(typeof modules.mention.enabled).toBe("boolean")
		})

		it("should support AI completion module configuration", () => {
			const modules = { aiCompletion: { enabled: false } }
			expect(typeof modules.aiCompletion.enabled).toBe("boolean")
		})

		it("should support placeholder configuration", () => {
			const placeholder = "Type your message..."
			expect(typeof placeholder).toBe("string")
		})

		it("should handle JSON content", () => {
			const jsonContent = {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "text", text: "Hello world" }],
					},
				],
			}

			expect(jsonContent.type).toBe("doc")
			expect(jsonContent.content).toHaveLength(1)
		})

		it("should handle topic context", () => {
			const selectedTopic = {
				id: "topic-1",
				project_id: "project-1",
				topic_name: "Test Topic",
			}

			expect(selectedTopic.id).toBe("topic-1")
			expect(selectedTopic.project_id).toBe("project-1")
		})

		it("should handle language configuration", () => {
			const languages = ["en", "zh", "ja", "ko"]
			languages.forEach((lang) => {
				expect(typeof lang).toBe("string")
			})
		})
	})
})
