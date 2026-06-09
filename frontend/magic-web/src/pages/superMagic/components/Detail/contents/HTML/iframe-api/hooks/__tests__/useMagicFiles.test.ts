import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { useMagicFiles } from "../useMagicFiles"
import magicToast from "@/components/base/MagicToaster/utils"

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		loading: vi.fn(),
		success: vi.fn(),
		error: vi.fn(),
		destroy: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/components/MessageEditor/utils/fileConverter", () => ({
	base64ToFile: vi.fn((base64: string, filename: string) =>
		Promise.resolve(new File([base64], filename)),
	),
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

vi.mock("@/pages/superMagic/utils/handleFIle", () => ({
	downloadFileWithAnchor: vi.fn(),
}))

vi.mock("mobx", () => ({
	runInAction: vi.fn((fn: () => void) => fn()),
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		publish: vi.fn(),
	},
	PubSubEvents: {
		Update_Attachments: "Update_Attachments",
		Super_Magic_Topic_Mode_Changed: "Super_Magic_Topic_Mode_Changed",
	},
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeIframeRef(postMessage = vi.fn()) {
	return {
		current: {
			contentWindow: { postMessage },
		} as unknown as HTMLIFrameElement,
	}
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useMagicFiles", () => {
	let iframePostMessage: ReturnType<typeof vi.fn>
	let iframeRef: ReturnType<typeof makeIframeRef>
	let uploadImageFileToProject: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		vi.clearAllMocks()
		iframePostMessage = vi.fn()
		iframeRef = makeIframeRef(iframePostMessage)
		uploadImageFileToProject = vi.fn()
	})

	// ─── handleMagicUploadFiles ────────────────────────────────────────────────

	describe("handleMagicUploadFiles()", () => {
		it("selectedProject 为 null 时回复 No project selected", async () => {
			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
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
				"*",
			)
		})

		it("files 为空数组时回复 Invalid request data", async () => {
			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
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
				"*",
			)
		})

		it("上传成功时回复 success:true 并附带 results", async () => {
			uploadImageFileToProject.mockResolvedValueOnce({
				uploadedRelativeFilePath: "uploads/a.txt",
			})

			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
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
				"*",
			)
		})

		it("上传 loading toast 使用固定 key 避免重复展示", async () => {
			uploadImageFileToProject.mockResolvedValueOnce({
				uploadedRelativeFilePath: "uploads/a.txt",
			})

			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
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
				"*",
			)
		})
	})

	// ─── handleMagicAddFilesToMessage ──────────────────────────────────────────

	describe("handleMagicAddFilesToMessage()", () => {
		it("selectedProject 为 null 时回复 No project selected", async () => {
			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
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
				"*",
			)
		})

		it("attachmentList 中找不到文件时回复 No files found", async () => {
			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
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
				"*",
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
					selectedProject: { id: "proj-1", workspace_id: "ws-1" },
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
				"*",
			)

			await act(async () => {
				vi.advanceTimersByTime(500)
			})

			expect(addMultipleFilesToCurrentChat).toHaveBeenCalledOnce()
			expect(iframePostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE",
					requestId: "req-7",
					success: true,
				}),
				"*",
			)

			vi.useRealTimers()
		})

		it("createTopic 失败时回复 Failed to create topic", async () => {
			const { SuperMagicApi } = await import("@/apis")
			vi.mocked(SuperMagicApi.createTopic).mockResolvedValueOnce(null as any)

			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
					selectedProject: { id: "proj-1", workspace_id: "ws-1" },
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
				"*",
			)
		})
	})

	// ─── handleMagicDownloadFiles ──────────────────────────────────────────────

	describe("handleMagicDownloadFiles()", () => {
		it("attachmentList 中找不到 file_id 时回复 No files found", async () => {
			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
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
				"*",
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
				"*",
			)
		})

		it("getTemporaryDownloadUrl 返回空 url 时记录为失败", async () => {
			const { getTemporaryDownloadUrl } = await import("@/pages/superMagic/utils/api")

			vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce([{ url: "" }] as any)

			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
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
				"*",
			)
		})

		it("filePaths 为空时回复 Invalid request data", async () => {
			const { result } = renderHook(() =>
				useMagicFiles({
					iframeRef,
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
				"*",
			)
		})
	})
})
