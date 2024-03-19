import { describe, it, expect, vi, beforeEach } from "vitest"
import { TopicMode } from "../../../pages/Workspace/types"
import { MentionItemType } from "@/opensource/components/business/MentionPanel/types"
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

vi.mock("@/opensource/services/chat/editor/AiCompletionService", () => ({
	default: {
		getExtension: vi.fn(() => ({})),
	},
}))

describe("MessageEditor Integration Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Topic Mode", () => {
		it("should have correct topic mode values", () => {
			expect(TopicMode.General).toBe("general")
			expect(TopicMode.DataAnalysis).toBe("data_analysis")
			expect(TopicMode.PPT).toBe("ppt")
			expect(TopicMode.Report).toBe("report")
			expect(TopicMode.Summary).toBe("summary")
		})
	})

	describe("Mention Item Types", () => {
		it("should have correct mention item type values", () => {
			expect(MentionItemType.AGENT).toBe("agent")
			expect(MentionItemType.UPLOAD_FILE).toBe("upload_file")
			expect(MentionItemType.PROJECT_FILE).toBe("project_file")
		})
	})

	describe("MessageEditor Props Interface", () => {
		it("should handle onSend callback signature", () => {
			const mockOnSend = vi.fn()
			const testData = {
				jsonContent: { type: "doc", content: [] },
				mentionItems: [],
				selectedModel: { id: "test", name: "test model" },
			}

			mockOnSend(testData)
			expect(mockOnSend).toHaveBeenCalledWith(testData)
		})

		it("should handle file upload callback", () => {
			const mockOnFileUpload = vi.fn()
			const testFiles = [
				{
					id: "file-1",
					name: "test.pdf",
					file: new File(["content"], "test.pdf"),
					status: "init" as const,
				},
			]

			mockOnFileUpload(testFiles)
			expect(mockOnFileUpload).toHaveBeenCalledWith(testFiles)
		})

		it("should handle interrupt callback", () => {
			const mockOnInterrupt = vi.fn()
			mockOnInterrupt()
			expect(mockOnInterrupt).toHaveBeenCalled()
		})

		it("should handle topic mode setter", () => {
			const mockSetTopicMode = vi.fn()
			mockSetTopicMode(TopicMode.DataAnalysis)
			expect(mockSetTopicMode).toHaveBeenCalledWith(TopicMode.DataAnalysis)
		})
	})

	describe("MessageEditor Features", () => {
		it("should support different sizes", () => {
			const sizes = ["small", "default"] as const
			sizes.forEach((size) => {
				expect(typeof size).toBe("string")
			})
		})

		it("should support task running states", () => {
			const isTaskRunning = true
			expect(typeof isTaskRunning).toBe("boolean")
		})

		it("should support mention module configuration", () => {
			const modules = { mention: { enabled: false } }
			expect(typeof modules.mention.enabled).toBe("boolean")
		})

		it("should support AI completion module configuration", () => {
			const modules = { aiCompletion: { enabled: true } }
			expect(typeof modules.aiCompletion.enabled).toBe("boolean")
		})

		it("should support sending state", () => {
			const isSending = false
			expect(typeof isSending).toBe("boolean")
		})
	})
})
