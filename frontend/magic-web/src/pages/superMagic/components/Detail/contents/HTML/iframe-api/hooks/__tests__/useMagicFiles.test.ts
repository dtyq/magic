import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { useMagicFiles } from "../useMagicFiles"
import magicToast from "@/components/base/MagicToaster/utils"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import type { TopicStore } from "@/pages/superMagic/stores/core/topic"

const defaultAgentSelectionMock = vi.hoisted(() => ({
	modeIdentifier: "general",
	isAvailable: true,
}))

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		loading: vi.fn(),
		success: vi.fn(),
		error: vi.fn(),
		warning: vi.fn(),
		destroy: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/components/MessageEditor/utils/fileConverter", () => ({
	base64ToFile: vi.fn((base64: string, filename: string) =>
		Promise.resolve(new File([base64], filename)),
	),
}))

vi.mock("@/services/superMagic/DefaultAgentSelectionService", () => ({
	getFallbackTopicModeIdentifier: () => defaultAgentSelectionMock.modeIdentifier,
	resolveAgentSelection: (modeIdentifier?: string) => {
		const resolvedMode = modeIdentifier || defaultAgentSelectionMock.modeIdentifier
		return {
			modeIdentifier: resolvedMode,
			topicPattern: resolvedMode,
		}
	},
	isAgentSelectionAvailable: () => defaultAgentSelectionMock.isAvailable,
}))

vi.mock("@/pages/superMagic/components/Detail/contents/HTML/utils/file-utils", () => ({
	resolveUploadPath: vi.fn((path: string) => path.replace(/^\.\//, "")),
}))

vi.mock("@/pages/superMagic/utils/topics", () => ({
	addMultipleFilesToCurrentChat: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		createTopic: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/services", () => ({
	default: {
		route: {
			navigateToState: vi.fn(),
		},
	},
}))

vi.mock("@/pages/superMagic/utils/isChatWorkspaceProject", () => ({
	isCachedChatWorkspaceProject: (project?: { workspace_id?: string } | null) =>
		project?.workspace_id === "chat-ws",
}))

vi.mock("@/pages/superMagic/stores/core", () => ({
	topicStore: {
		setSelectedTopic: vi.fn(),
	},
	workspaceStore: {
		selectedWorkspace: { id: "ws-1" },
	},
}))

vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: vi.fn(),
}))

// File downloads now enter through the access-bound client; keep the network
// dependency mocked while exercising the real useMagicFiles request/response flow.
vi.mock("@/pages/superMagic/fileAccess/fileApi", async () => {
	const { getTemporaryDownloadUrl } = await import("@/pages/superMagic/utils/api")
	return { useFileApi: () => ({ getTemporaryDownloadUrl }) }
})

vi.mock("@/pages/superMagic/utils/handleFIle", () => ({
	downloadFileWithAnchor: vi.fn(),
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		publish: vi.fn(),
	},
	PubSubEvents: {
		Super_Magic_Topic_Mode_Changed: "Super_Magic_Topic_Mode_Changed",
	},
}))

vi.mock("@/pages/superMagic/utils/projectAttachments/attachmentMutationWaiter", () => ({
	waitForProjectAttachmentChange: vi.fn((_projectId: string | undefined, options?: any) => {
		options?.callback?.()
		return Promise.resolve()
	}),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeIframeRef(postMessage = vi.fn()) {
	return {
		current: {
			contentWindow: { postMessage },
		} as unknown as HTMLIFrameElement,
	}
}

const targetOrigin = "https://sandbox.example.com"

function makeTopicStore(overrides: Partial<TopicStore> = {}) {
	return {
		topics: [],
		setTopics: vi.fn(),
		setSelectedTopic: vi.fn(),
		...overrides,
	} as unknown as TopicStore
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useMagicFiles", () => {
	let iframePostMessage: ReturnType<typeof vi.fn>
	let iframeRef: ReturnType<typeof makeIframeRef>
	let uploadImageFileToProject: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		vi.clearAllMocks()
		defaultAgentSelectionMock.modeIdentifier = "general"
		defaultAgentSelectionMock.isAvailable = true
		iframePostMessage = vi.fn()
		iframeRef = makeIframeRef(iframePostMessage)
		uploadImageFileToProject = vi.fn()
	})

	// ─── handleMagicUploadFiles ────────────────────────────────────────────────

	describe("handleMagicUploadFiles()", () => {
		it("未授权时不上传文件", async () => {
			const authorizePermission = vi.fn().mockResolvedValue(false)
			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					selectedProject: { id: "proj-1" },
					uploadImageFileToProject,
					authorizePermission,
				}),
			)

			await act(async () => {
				await result.current.handleMagicUploadFiles({
					type: "MAGIC_UPLOAD_FILES_REQUEST",
					requestId: "req-upload-denied",
					files: [
						{
							base64: "data",
							filename: "a.txt",
							path: "./a.txt",
							fileSize: 4,
							fileType: "text/plain",
						},
					],
				})
			})

			expect(authorizePermission).toHaveBeenCalledWith("project.files.upload")
			expect(uploadImageFileToProject).not.toHaveBeenCalled()
			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_UPLOAD_FILES_RESPONSE",
					requestId: "req-upload-denied",
					success: false,
				}),
				targetOrigin,
			)
		})

		it("selectedProject 为 null 时回复 No project selected", async () => {
			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					selectedProject: null,
					uploadImageFileToProject,
				}),
			)

			await act(async () => {
				await result.current.handleMagicUploadFiles({
					type: "MAGIC_UPLOAD_FILES_REQUEST",
					requestId: "req-1",
					files: [
						{
							base64: "data",
							filename: "a.txt",
							path: "./a.txt",
							fileSize: 4,
							fileType: "text/plain",
						},
					],
				})
			})

			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_UPLOAD_FILES_RESPONSE",
					requestId: "req-1",
					success: false,
					error: "No project selected",
				}),
				targetOrigin,
			)
		})

		it("分享场景在授权前返回项目上下文提示", async () => {
			const authorizePermission = vi.fn()
			const projectContextError = "分享场景下，该功能暂不支持，可尝试通过协作的方式进行分享。"
			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					selectedProject: null,
					projectContextUnavailableError: projectContextError,
					uploadImageFileToProject,
					authorizePermission,
				}),
			)

			await act(async () => {
				await result.current.handleMagicUploadFiles({
					type: "MAGIC_UPLOAD_FILES_REQUEST",
					requestId: "req-share-context",
					files: [
						{
							base64: "data",
							filename: "a.txt",
							path: "./a.txt",
							fileSize: 4,
							fileType: "text/plain",
						},
					],
				})
			})

			expect(authorizePermission).not.toHaveBeenCalled()
			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_UPLOAD_FILES_RESPONSE",
					requestId: "req-share-context",
					success: false,
					error: projectContextError,
				}),
				targetOrigin,
			)
		})

		it("files 为空数组时回复 Invalid request data", async () => {
			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					selectedProject: { id: "proj-1" },
					uploadImageFileToProject,
				}),
			)

			await act(async () => {
				await result.current.handleMagicUploadFiles({
					type: "MAGIC_UPLOAD_FILES_REQUEST",
					requestId: "req-2",
					files: [],
				})
			})

			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_UPLOAD_FILES_RESPONSE",
					requestId: "req-2",
					success: false,
					error: "Invalid request data",
				}),
				targetOrigin,
			)
		})

		it("上传成功时回复 success:true 并附带 results", async () => {
			uploadImageFileToProject.mockResolvedValueOnce({
				uploadedRelativeFilePath: "uploads/a.txt",
			})

			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					selectedProject: { id: "proj-1" },
					uploadImageFileToProject,
				}),
			)

			await act(async () => {
				await result.current.handleMagicUploadFiles({
					type: "MAGIC_UPLOAD_FILES_REQUEST",
					requestId: "req-3",
					files: [
						{
							base64: "data",
							filename: "a.txt",
							path: "./a.txt",
							fileSize: 4,
							fileType: "text/plain",
						},
					],
				})
			})

			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_UPLOAD_FILES_RESPONSE",
					requestId: "req-3",
					success: true,
					results: [
						expect.objectContaining({
							filename: "a.txt",
							success: true,
							relative_file_path: "uploads/a.txt",
						}),
					],
				}),
				targetOrigin,
			)
		})

		it("上传 loading toast 使用固定 key 避免重复展示", async () => {
			uploadImageFileToProject.mockResolvedValueOnce({
				uploadedRelativeFilePath: "uploads/a.txt",
			})

			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					selectedProject: { id: "proj-1" },
					uploadImageFileToProject,
				}),
			)

			await act(async () => {
				await result.current.handleMagicUploadFiles({
					type: "MAGIC_UPLOAD_FILES_REQUEST",
					requestId: "req-toast",
					files: [
						{
							base64: "data",
							filename: "a.txt",
							path: "./a.txt",
							fileSize: 4,
							fileType: "text/plain",
						},
					],
				})
			})

			expect(magicToast.loading).toHaveBeenCalledWith(
				expect.objectContaining({
					key: "html-magic-upload-files",
				}),
			)
		})

		it("单个文件上传失败时 results 中记录 success:false", async () => {
			uploadImageFileToProject.mockRejectedValueOnce(new Error("Upload error"))

			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					selectedProject: { id: "proj-1" },
					uploadImageFileToProject,
				}),
			)

			await act(async () => {
				await result.current.handleMagicUploadFiles({
					type: "MAGIC_UPLOAD_FILES_REQUEST",
					requestId: "req-4",
					files: [
						{
							base64: "data",
							filename: "fail.txt",
							path: "./fail.txt",
							fileSize: 4,
							fileType: "text/plain",
						},
					],
				})
			})

			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_UPLOAD_FILES_RESPONSE",
					requestId: "req-4",
					success: true,
					results: [
						expect.objectContaining({
							filename: "fail.txt",
							success: false,
							error: "Upload error",
						}),
					],
				}),
				targetOrigin,
			)
		})
	})

	// ─── handleMagicAddFilesToMessage ──────────────────────────────────────────

	describe("handleMagicAddFilesToMessage()", () => {
		it("未授权时不创建 topic", async () => {
			const { SuperMagicApi } = await import("@/apis")
			const authorizePermission = vi.fn().mockResolvedValue(false)
			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					selectedProject: { id: "proj-1", workspace_id: "ws-1" },
					attachmentList: [{ relative_file_path: "a.csv", file_id: "f-1" }],
					uploadImageFileToProject,
					authorizePermission,
				}),
			)

			await act(async () => {
				await result.current.handleMagicAddFilesToMessage({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_REQUEST",
					requestId: "req-add-denied",
					filePaths: ["a.csv"],
				})
			})

			expect(authorizePermission).toHaveBeenCalledWith("project.message.write")
			expect(SuperMagicApi.createTopic).not.toHaveBeenCalled()
			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE",
					requestId: "req-add-denied",
					success: false,
				}),
				targetOrigin,
			)
		})

		it("selectedProject 为 null 时回复 No project selected", async () => {
			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					selectedProject: null,
					uploadImageFileToProject,
				}),
			)

			await act(async () => {
				await result.current.handleMagicAddFilesToMessage({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_REQUEST",
					requestId: "req-5",
					filePaths: ["./a.csv"],
				})
			})

			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE",
					requestId: "req-5",
					success: false,
					error: "No project selected",
				}),
				targetOrigin,
			)
		})

		it("attachmentList 中找不到文件时回复 No files found", async () => {
			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					selectedProject: { id: "proj-1", workspace_id: "ws-1" },
					attachmentList: [],
					uploadImageFileToProject,
				}),
			)

			await act(async () => {
				await result.current.handleMagicAddFilesToMessage({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_REQUEST",
					requestId: "req-6",
					filePaths: ["./missing.csv"],
				})
			})

			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE",
					requestId: "req-6",
					success: false,
					error: "No files found",
				}),
				targetOrigin,
			)
		})

		it("未指定 agentMode 时使用配置的默认员工创建 topic", async () => {
			const { SuperMagicApi } = await import("@/apis")
			defaultAgentSelectionMock.modeIdentifier = "agent-default"
			vi.mocked(SuperMagicApi.createTopic).mockResolvedValueOnce(null as any)

			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					selectedProject: { id: "proj-1", workspace_id: "ws-1" },
					topicStore: makeTopicStore(),
					attachmentList: [{ relative_file_path: "a.csv", file_id: "f-1" }],
					uploadImageFileToProject,
				}),
			)

			await act(async () => {
				await result.current.handleMagicAddFilesToMessage({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_REQUEST",
					requestId: "req-default-agent",
					filePaths: ["a.csv"],
				})
			})

			expect(SuperMagicApi.createTopic).toHaveBeenCalledWith({
				project_id: "proj-1",
				topic_name: "",
				project_mode: "agent-default",
			})
		})

		it("员工不可用时拒绝创建 topic", async () => {
			const { SuperMagicApi } = await import("@/apis")
			defaultAgentSelectionMock.isAvailable = false

			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					selectedProject: { id: "proj-1", workspace_id: "ws-1" },
					attachmentList: [{ relative_file_path: "a.csv", file_id: "f-1" }],
					uploadImageFileToProject,
				}),
			)

			await act(async () => {
				await result.current.handleMagicAddFilesToMessage({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_REQUEST",
					requestId: "req-invalid-agent",
					filePaths: ["a.csv"],
					agentMode: "general",
				})
			})

			expect(SuperMagicApi.createTopic).not.toHaveBeenCalled()
			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE",
					requestId: "req-invalid-agent",
					success: false,
					error: "Invalid agentMode: general",
				}),
				targetOrigin,
			)
		})

		it("找到文件时创建 topic 并在 500ms 后回复 success:true", async () => {
			const { SuperMagicApi } = await import("@/apis")
			const { addMultipleFilesToCurrentChat } =
				await import("@/pages/superMagic/utils/topics")

			vi.mocked(SuperMagicApi.createTopic).mockResolvedValueOnce({ id: "topic-1" } as any)

			vi.useFakeTimers()

			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					selectedProject: { id: "proj-1", workspace_id: "ws-1" },
					topicStore: makeTopicStore(),
					attachmentList: [{ relative_file_path: "a.csv", file_id: "f-1" }],
					uploadImageFileToProject,
				}),
			)

			const addPromise = act(async () => {
				await result.current.handleMagicAddFilesToMessage({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_REQUEST",
					requestId: "req-7",
					filePaths: ["a.csv"],
				})
			})

			await addPromise

			// 回复和 addMultipleFilesToCurrentChat 在 500ms 后触发
			expect(iframePostMessage).not.toHaveBeenCalledWith(
				expect.objectContaining({ success: true }),
				targetOrigin,
			)

			await act(async () => {
				await vi.advanceTimersByTimeAsync(500)
			})

			expect(addMultipleFilesToCurrentChat).toHaveBeenCalledOnce()
			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE",
					requestId: "req-7",
					success: true,
				}),
				targetOrigin,
			)

			vi.useRealTimers()
		})

		it("createTopic 失败时回复 Failed to create topic", async () => {
			const { SuperMagicApi } = await import("@/apis")
			vi.mocked(SuperMagicApi.createTopic).mockResolvedValueOnce(null as any)

			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					selectedProject: { id: "proj-1", workspace_id: "ws-1" },
					topicStore: makeTopicStore(),
					attachmentList: [{ relative_file_path: "b.csv", file_id: "f-2" }],
					uploadImageFileToProject,
				}),
			)

			await act(async () => {
				await result.current.handleMagicAddFilesToMessage({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_REQUEST",
					requestId: "req-8",
					filePaths: ["b.csv"],
				})
			})

			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE",
					requestId: "req-8",
					success: false,
					error: "Failed to create topic",
				}),
				targetOrigin,
			)
		})

		it("uses the explicit project and scoped topic store", async () => {
			const { SuperMagicApi } = await import("@/apis")
			const { default: SuperMagicService } = await import("@/pages/superMagic/services")
			const scopedSelectedTopic = vi.fn()
			const scopedSetTopics = vi.fn()
			const scopedTopicStore = {
				topics: [{ id: "old-topic" }],
				setTopics: scopedSetTopics,
				setSelectedTopic: scopedSelectedTopic,
			} as unknown as TopicStore

			vi.mocked(SuperMagicApi.createTopic).mockResolvedValueOnce({
				id: "topic-scoped",
			} as any)
			vi.useFakeTimers()

			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					projectId: "explicit-project",
					selectedProject: { id: "explicit-project", workspace_id: "ws-1" },
					topicStore: scopedTopicStore,
					attachmentList: [{ relative_file_path: "a.csv", file_id: "f-1" }],
					uploadImageFileToProject,
				}),
			)

			await act(async () => {
				await result.current.handleMagicAddFilesToMessage({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_REQUEST",
					requestId: "req-scoped",
					filePaths: ["a.csv"],
				})
			})

			expect(SuperMagicApi.createTopic).toHaveBeenCalledWith(
				expect.objectContaining({ project_id: "explicit-project" }),
			)
			expect(scopedSelectedTopic).toHaveBeenCalledWith(
				expect.objectContaining({ id: "topic-scoped" }),
			)
			expect(scopedSetTopics).toHaveBeenCalledWith([
				expect.objectContaining({ id: "topic-scoped" }),
				{ id: "old-topic" },
			])
			expect(SuperMagicService.route.navigateToState).not.toHaveBeenCalled()

			vi.useRealTimers()
		})

		it("creates the topic in the host project while reading files from origin", async () => {
			const { SuperMagicApi } = await import("@/apis")
			vi.mocked(SuperMagicApi.createTopic).mockResolvedValueOnce({
				id: "topic-host",
			} as any)
			vi.useFakeTimers()

			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					projectId: "project-from-preview",
					selectedProject: { id: "project-current", workspace_id: "ws-1" },
					topicStore: makeTopicStore(),
					attachmentList: [{ relative_file_path: "a.csv", file_id: "f-1" }],
					uploadImageFileToProject,
				}),
			)

			await act(async () => {
				await result.current.handleMagicAddFilesToMessage({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_REQUEST",
					requestId: "req-host",
					filePaths: ["a.csv"],
				})
			})

			expect(SuperMagicApi.createTopic).toHaveBeenCalledWith(
				expect.objectContaining({ project_id: "project-current" }),
			)

			vi.useRealTimers()
		})

		it("rejects addFilesToMessage when the host project is missing", async () => {
			const { SuperMagicApi } = await import("@/apis")
			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					projectId: "project-from-preview",
					attachmentList: [{ relative_file_path: "a.csv", file_id: "f-1" }],
					uploadImageFileToProject,
				}),
			)

			await act(async () => {
				await result.current.handleMagicAddFilesToMessage({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_REQUEST",
					requestId: "req-no-host",
					filePaths: ["a.csv"],
				})
			})

			expect(SuperMagicApi.createTopic).not.toHaveBeenCalled()
			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE",
					requestId: "req-no-host",
					success: false,
					error: "No project selected",
				}),
				targetOrigin,
			)
		})

		it("rejects addFilesToMessage when the topic store is missing", async () => {
			const { SuperMagicApi } = await import("@/apis")
			const { topicStore } = await import("@/pages/superMagic/stores/core")
			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					projectId: "project-from-preview",
					selectedProject: { id: "project-current", workspace_id: "ws-1" },
					attachmentList: [{ relative_file_path: "a.csv", file_id: "f-1" }],
					uploadImageFileToProject,
				}),
			)

			await act(async () => {
				await result.current.handleMagicAddFilesToMessage({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_REQUEST",
					requestId: "req-no-store",
					filePaths: ["a.csv"],
				})
			})

			expect(SuperMagicApi.createTopic).not.toHaveBeenCalled()
			expect(topicStore.setSelectedTopic).not.toHaveBeenCalled()
			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE",
					requestId: "req-no-store",
					success: false,
					error: "No topic store",
				}),
				targetOrigin,
			)
		})

		it.each([
			["MagiClaw", TopicMode.MagiClaw],
			["Chat", TopicMode.Chat],
		] as const)(
			"adds files to the current %s topic instead of creating a new one",
			async (_label, projectMode) => {
				const { SuperMagicApi } = await import("@/apis")
				const { addMultipleFilesToCurrentChat } =
					await import("@/pages/superMagic/utils/topics")
				const { default: pubsub } = await import("@/utils/pubsub")
				const setSelectedTopic = vi.fn()
				const setTopics = vi.fn()
				const currentTopic = { id: "host-topic-1" }

				const { result } = renderHook(() =>
					useMagicFiles({
						iframeRef,
						targetOrigin,
						selectedProject: {
							id: "proj-1",
							workspace_id: "ws-1",
							project_mode: projectMode,
						},
						topicStore: makeTopicStore({
							topics: [currentTopic],
							selectedTopic: currentTopic as never,
							setTopics,
							setSelectedTopic,
						}),
						attachmentList: [{ relative_file_path: "a.csv", file_id: "f-1" }],
						uploadImageFileToProject,
					}),
				)

				await act(async () => {
					await result.current.handleMagicAddFilesToMessage({
						type: "MAGIC_ADD_FILES_TO_MESSAGE_REQUEST",
						requestId: "req-reuse-topic",
						filePaths: ["a.csv"],
					})
				})

				expect(SuperMagicApi.createTopic).not.toHaveBeenCalled()
				expect(setSelectedTopic).not.toHaveBeenCalled()
				expect(setTopics).not.toHaveBeenCalled()
				expect(pubsub.publish).not.toHaveBeenCalled()
				expect(addMultipleFilesToCurrentChat).toHaveBeenCalledOnce()
				expect(iframePostMessage).toHaveBeenCalledWith(
					expect.objectContaining({
						type: "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE",
						requestId: "req-reuse-topic",
						success: true,
					}),
					targetOrigin,
				)
			},
		)

		it("adds files to the current Chat workspace topic even without Chat project_mode", async () => {
			const { SuperMagicApi } = await import("@/apis")
			const { addMultipleFilesToCurrentChat } =
				await import("@/pages/superMagic/utils/topics")
			const { default: pubsub } = await import("@/utils/pubsub")
			const setSelectedTopic = vi.fn()
			const setTopics = vi.fn()
			const currentTopic = { id: "host-topic-2" }
			defaultAgentSelectionMock.isAvailable = false

			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					selectedProject: {
						id: "proj-1",
						workspace_id: "chat-ws",
						project_mode: TopicMode.General,
					},
					topicStore: makeTopicStore({
						topics: [currentTopic],
						selectedTopic: currentTopic as never,
						setTopics,
						setSelectedTopic,
					}),
					attachmentList: [{ relative_file_path: "a.csv", file_id: "f-1" }],
					uploadImageFileToProject,
				}),
			)

			await act(async () => {
				await result.current.handleMagicAddFilesToMessage({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_REQUEST",
					requestId: "req-chat-ws-reuse",
					filePaths: ["a.csv"],
					agentMode: "invalid-agent",
				})
			})

			expect(SuperMagicApi.createTopic).not.toHaveBeenCalled()
			expect(setSelectedTopic).not.toHaveBeenCalled()
			expect(setTopics).not.toHaveBeenCalled()
			expect(pubsub.publish).not.toHaveBeenCalled()
			expect(addMultipleFilesToCurrentChat).toHaveBeenCalledOnce()
			expect(magicToast.warning).toHaveBeenCalledWith(
				expect.objectContaining({
					key: "html-iframe-specified-agent-unavailable",
				}),
			)
			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE",
					requestId: "req-chat-ws-reuse",
					success: true,
				}),
				targetOrigin,
			)
		})

		it("rejects MagiClaw addFilesToMessage when the unique topic is missing", async () => {
			const { SuperMagicApi } = await import("@/apis")
			const { addMultipleFilesToCurrentChat } =
				await import("@/pages/superMagic/utils/topics")

			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					selectedProject: {
						id: "proj-1",
						workspace_id: "ws-1",
						project_mode: TopicMode.MagiClaw,
					},
					topicStore: makeTopicStore({ selectedTopic: null as never }),
					attachmentList: [{ relative_file_path: "a.csv", file_id: "f-1" }],
					uploadImageFileToProject,
				}),
			)

			await act(async () => {
				await result.current.handleMagicAddFilesToMessage({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_REQUEST",
					requestId: "req-claw-no-topic",
					filePaths: ["a.csv"],
				})
			})

			expect(SuperMagicApi.createTopic).not.toHaveBeenCalled()
			expect(addMultipleFilesToCurrentChat).not.toHaveBeenCalled()
			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE",
					requestId: "req-claw-no-topic",
					success: false,
					error: "No topic selected",
				}),
				targetOrigin,
			)
		})
	})

	// ─── handleMagicDownloadFiles ──────────────────────────────────────────────

	describe("handleMagicDownloadFiles()", () => {
		it("未授权时不获取下载链接", async () => {
			const { getTemporaryDownloadUrl } = await import("@/pages/superMagic/utils/api")
			const authorizePermission = vi.fn().mockResolvedValue(false)
			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					selectedProject: { id: "proj-1", workspace_id: "ws-1" },
					attachmentList: [{ relative_file_path: "a.pdf", file_id: "f-1" }],
					uploadImageFileToProject,
					authorizePermission,
				}),
			)

			await act(async () => {
				await result.current.handleMagicDownloadFiles({
					type: "MAGIC_DOWNLOAD_FILES_REQUEST",
					requestId: "req-download-denied",
					filePaths: ["a.pdf"],
				})
			})

			expect(authorizePermission).toHaveBeenCalledWith("project.files.download")
			expect(getTemporaryDownloadUrl).not.toHaveBeenCalled()
			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_DOWNLOAD_FILES_RESPONSE",
					requestId: "req-download-denied",
					success: false,
				}),
				targetOrigin,
			)
		})

		it("attachmentList 中找不到 file_id 时回复 No files found", async () => {
			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					selectedProject: { id: "proj-1" },
					attachmentList: [],
					uploadImageFileToProject,
				}),
			)

			await act(async () => {
				await result.current.handleMagicDownloadFiles({
					type: "MAGIC_DOWNLOAD_FILES_REQUEST",
					requestId: "req-9",
					filePaths: ["./missing.pdf"],
				})
			})

			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_DOWNLOAD_FILES_RESPONSE",
					requestId: "req-9",
					success: false,
					error: "No files found",
				}),
				targetOrigin,
			)
		})

		it("下载成功时调用 downloadFileWithAnchor 并回复 success:true", async () => {
			const { getTemporaryDownloadUrl } = await import("@/pages/superMagic/utils/api")
			const { downloadFileWithAnchor } = await import("@/pages/superMagic/utils/handleFIle")

			vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce([
				{ url: "https://example.com/file.pdf" },
			] as any)
			vi.mocked(downloadFileWithAnchor).mockResolvedValueOnce(undefined)

			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					selectedProject: { id: "proj-1" },
					attachmentList: [
						{
							relative_file_path: "report.pdf",
							file_id: "f-3",
							file_name: "report.pdf",
						},
					],
					uploadImageFileToProject,
				}),
			)

			await act(async () => {
				await result.current.handleMagicDownloadFiles({
					type: "MAGIC_DOWNLOAD_FILES_REQUEST",
					requestId: "req-10",
					filePaths: ["report.pdf"],
				})
			})

			expect(downloadFileWithAnchor).toHaveBeenCalledWith(
				"https://example.com/file.pdf",
				"report.pdf",
			)
			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_DOWNLOAD_FILES_RESPONSE",
					requestId: "req-10",
					success: true,
					result: expect.objectContaining({ successCount: 1, failedCount: 0 }),
				}),
				targetOrigin,
			)
		})

		it("getTemporaryDownloadUrl 返回空 url 时记录为失败", async () => {
			const { getTemporaryDownloadUrl } = await import("@/pages/superMagic/utils/api")

			vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce([{ url: "" }] as any)

			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					selectedProject: { id: "proj-1" },
					attachmentList: [{ relative_file_path: "doc.pdf", file_id: "f-4" }],
					uploadImageFileToProject,
				}),
			)

			await act(async () => {
				await result.current.handleMagicDownloadFiles({
					type: "MAGIC_DOWNLOAD_FILES_REQUEST",
					requestId: "req-11",
					filePaths: ["doc.pdf"],
				})
			})

			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_DOWNLOAD_FILES_RESPONSE",
					requestId: "req-11",
					success: false,
					result: expect.objectContaining({ successCount: 0, failedCount: 1 }),
				}),
				targetOrigin,
			)
		})

		it("filePaths 为空时回复 Invalid request data", async () => {
			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					targetOrigin,
					selectedProject: { id: "proj-1" },
					uploadImageFileToProject,
				}),
			)

			await act(async () => {
				await result.current.handleMagicDownloadFiles({
					type: "MAGIC_DOWNLOAD_FILES_REQUEST",
					requestId: "req-12",
					filePaths: [],
				})
			})

			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_DOWNLOAD_FILES_RESPONSE",
					requestId: "req-12",
					success: false,
					error: "Invalid request data",
				}),
				targetOrigin,
			)
		})
	})
})
