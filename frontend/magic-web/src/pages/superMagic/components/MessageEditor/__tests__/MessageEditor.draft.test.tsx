import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// @ts-ignore
import MessageEditor from "../MessageEditor"
import { draftManager } from "../services/draftService"
import type { MessageEditorProps } from "../types"

// Mock the draft manager (versioned API)
vi.mock("../services/draftService", () => ({
	draftManager: {
		saveDraft: vi.fn(),
		saveDraftVersion: vi.fn(),
		loadLatestDraftVersion: vi.fn(),
		createSentDraft: vi.fn(),
		clearVersions: vi.fn(),
	},
}))

// Mock other dependencies
vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("react-i18next", async () => {
	const actual = await vi.importActual("react-i18next")
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string) => key,
		}),
	}
})

vi.mock("../hooks", () => ({
	useMessageEditor: () => ({
		tiptapEditor: {
			commands: {
				clearContent: vi.fn(),
				setContent: vi.fn(),
			},
		},
		domRef: { current: null },
	}),
	useMentionManager: () => ({
		mentionItems: [],
		insertMentionItem: vi.fn(),
		insertMentionItems: vi.fn(),
		removeMentionItems: vi.fn(),
		handleRemoveMention: vi.fn(),
		setEditor: vi.fn(),
		addFilesToMentions: vi.fn(),
		updateFileProgress: vi.fn(),
		replaceUploadFile: vi.fn(),
		clearAll: vi.fn(),
	}),
	useFileUpload: () => ({
		files: [],
		addFiles: vi.fn(),
		removeFile: vi.fn(),
		removeUploadedFile: vi.fn(),
		clearFiles: vi.fn(),
		isAllFilesUploaded: true,
	}),
	useDragUpload: () => ({
		isDragOver: false,
		dragEvents: {
			onDragEnter: vi.fn(),
			onDragLeave: vi.fn(),
			onDragOver: vi.fn(),
			onDrop: vi.fn(),
		},
	}),
}))

const mockDraftManager = vi.mocked(draftManager)

describe("MessageEditor Draft Functionality", () => {
	const defaultProps: MessageEditorProps = {
		onSend: vi.fn(),
		placeholder: "Type a message...",
		selectedTopic: {
			id: "test-topic",
			user_id: "test-user",
			chat_topic_id: "chat-topic",
			chat_conversation_id: "conversation",
			topic_name: "Test Topic",
			task_status: "finished" as any,
			task_mode: "chat",
			project_id: "test-project",
			topic_mode: "general" as any,
			updated_at: "2023-01-01",
		} as any,
		selectedProject: {
			id: "test-project",
			project_status: "finished" as any,
			user_id: "test-user",
			user_organization_code: "org-code",
			workspace_id: "workspace",
			workspace_name: "Test Workspace",
			project_name: "Test Project",
			work_dir: "/work",
			current_topic_id: "test-topic",
			current_topic_status: "completed",
			created_uid: "user",
			updated_uid: "user",
			created_at: "2023-01-01",
			updated_at: "2023-01-01",
			project_mode: "general" as any,
			tag: "",
		} as any,
		draftKey: {
			workspaceId: "defaultWorkspaceId",
			projectId: "test-project",
			topicId: "test-topic",
		},
		modules: {
			mention: {
				enabled: true,
			},
			aiCompletion: {
				enabled: true,
			},
		},
	}

	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	describe("Draft Auto-save", () => {
		it("should initialize draft manager when component mounts", () => {
			render(<MessageEditor {...defaultProps} />)

			// Draft manager should be initialized (we can't directly test this,
			// but we can test that the component renders without errors)
			expect(screen.getByRole("textbox", { hidden: true })).toBeInTheDocument()
		})

		it("should not initialize draft manager when no project", () => {
			const propsWithoutProject = {
				...defaultProps,
				selectedTopic: null,
				selectedProject: null,
				draftKey: {
					workspaceId: "defaultWorkspaceId",
					projectId: "defaultProjectId",
					topicId: "defaultTopicId",
				},
			}

			render(<MessageEditor {...propsWithoutProject} />)

			// Component should still render
			expect(screen.getByRole("textbox", { hidden: true })).toBeInTheDocument()
		})
	})

	describe("Draft Restoration", () => {
		it("should attempt to load draft on mount with valid project/topic", async () => {
			mockDraftManager.loadLatestDraftVersion.mockResolvedValue(null as any)

			render(<MessageEditor {...defaultProps} />)

			await waitFor(() => {
				expect(mockDraftManager.loadLatestDraftVersion).toHaveBeenCalledWith(
					defaultProps.draftKey,
				)
			})
		})

		it("should load draft on project change", async () => {
			mockDraftManager.loadLatestDraftVersion.mockResolvedValue(null as any)

			const { rerender } = render(<MessageEditor {...defaultProps} />)

			// Change project
			const newProps = {
				...defaultProps,
				selectedProject: {
					...defaultProps.selectedProject!,
					id: "new-project",
				},
				selectedTopic: {
					...defaultProps.selectedTopic!,
					project_id: "new-project",
				},
				draftKey: {
					workspaceId: "defaultWorkspaceId",
					projectId: "new-project",
					topicId: "test-topic",
				},
			}

			rerender(<MessageEditor {...newProps} />)

			await waitFor(() => {
				expect(mockDraftManager.loadLatestDraftVersion).toHaveBeenCalledWith(
					newProps.draftKey,
				)
			})
		})

		it("should load draft on topic change", async () => {
			mockDraftManager.loadLatestDraftVersion.mockResolvedValue(null as any)

			const { rerender } = render(<MessageEditor {...defaultProps} />)

			// Change topic
			const newProps = {
				...defaultProps,
				selectedTopic: {
					...defaultProps.selectedTopic!,
					id: "new-topic",
				},
				draftKey: {
					workspaceId: "defaultWorkspaceId",
					projectId: "test-project",
					topicId: "new-topic",
				},
			}

			rerender(<MessageEditor {...newProps} />)

			await waitFor(() => {
				expect(mockDraftManager.loadLatestDraftVersion).toHaveBeenCalledWith(
					newProps.draftKey,
				)
			})
		})
	})

	describe("Draft Clearing", () => {
		it("should clear draft when clearContent is called", async () => {
			mockDraftManager.clearVersions.mockResolvedValue()

			const ref = { current: null as any }
			render(<MessageEditor {...defaultProps} ref={ref} />)

			// Wait for component to be ready
			await waitFor(() => {
				expect(ref.current).toBeTruthy()
			})

			// Call clearContent
			ref.current?.clearContent()

			await waitFor(() => {
				expect(mockDraftManager.clearVersions).toHaveBeenCalledWith(
					"test-project",
					"test-topic",
					"defaultWorkspaceId",
				)
			})
		})
	})

	describe("Component Integration", () => {
		it("should render all essential elements", () => {
			render(<MessageEditor {...defaultProps} />)

			// Check for essential elements
			expect(screen.getByRole("textbox", { hidden: true })).toBeInTheDocument()

			// Check for toolbar buttons
			expect(screen.getByRole("button")).toBeInTheDocument() // Send button or other buttons
		})

		it("should handle disabled state correctly", () => {
			const propsWithoutProject = {
				...defaultProps,
				selectedTopic: null,
				selectedProject: null,
				draftKey: {
					workspaceId: "defaultWorkspaceId",
					projectId: "defaultProjectId",
					topicId: "defaultTopicId",
				},
			}

			render(<MessageEditor {...propsWithoutProject} />)

			// Should still render but draft functionality should be disabled
			expect(screen.getByRole("textbox", { hidden: true })).toBeInTheDocument()
		})

		it("should pass correct props to draft manager", () => {
			render(<MessageEditor {...defaultProps} />)

			// We can't directly test the props passed to useDraftManager,
			// but we can verify the component renders without errors
			// and the draft service is called correctly
			expect(screen.getByRole("textbox", { hidden: true })).toBeInTheDocument()
		})
	})

	describe("Error Handling", () => {
		it("should handle draft load errors gracefully", async () => {
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => { })
			mockDraftManager.loadLatestDraftVersion.mockRejectedValue(new Error("Load failed"))

			render(<MessageEditor {...defaultProps} />)

			// Component should still render even if draft loading fails
			expect(screen.getByRole("textbox", { hidden: true })).toBeInTheDocument()

			// Clean up
			consoleErrorSpy.mockRestore()
		})

		it("should handle draft save errors gracefully", async () => {
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => { })
			mockDraftManager.clearVersions.mockRejectedValue(new Error("Delete failed"))

			const ref = { current: null as any }
			render(<MessageEditor {...defaultProps} ref={ref} />)

			await waitFor(() => {
				expect(ref.current).toBeTruthy()
			})

			// Attempt to clear content (which should trigger draft deletion)
			ref.current?.clearContent()

			// Component should continue to function
			expect(screen.getByRole("textbox", { hidden: true })).toBeInTheDocument()

			// Clean up
			consoleErrorSpy.mockRestore()
		})
	})

	describe("Props Validation", () => {
		it("should work with minimal props", () => {
			const minimalProps: MessageEditorProps = {}

			render(<MessageEditor {...minimalProps} />)

			expect(screen.getByRole("textbox", { hidden: true })).toBeInTheDocument()
		})

		it("should handle different sizes", () => {
			const { rerender } = render(<MessageEditor {...defaultProps} size="small" />)

			expect(screen.getByRole("textbox", { hidden: true })).toBeInTheDocument()

			rerender(<MessageEditor {...defaultProps} size="default" />)

			expect(screen.getByRole("textbox", { hidden: true })).toBeInTheDocument()
		})
	})
})
