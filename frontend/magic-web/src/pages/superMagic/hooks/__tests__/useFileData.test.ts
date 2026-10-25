import { createElement, type ReactNode } from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import { FileAccessProvider } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import {
	createSessionFileAccess,
	createShareFileAccess,
} from "@/pages/superMagic/fileAccess/fileAccessContext"
import { downloadFileContent, getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import {
	FileSaveQueue,
	createMemoryFileSavePersistence,
	getFileSaveQueue,
	resetFileSaveQueueForTests,
} from "@/pages/superMagic/components/Detail/services/fileSaveQueue"
import { useFileData } from "../useFileData"
import { shadow } from "@/utils/shadow"

const isShareRouteState = vi.hoisted(() => ({ current: false }))

vi.mock("ahooks", async (importOriginal) => {
	const react = await import("react")
	const actual = await importOriginal<typeof import("ahooks")>()
	return {
		...actual,
		useDebounceEffect: (fn: () => void, deps?: unknown[]) => {
			react.useEffect(fn, deps)
		},
	}
})

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getFileHistoryVersions: vi.fn(),
		rollbackFileVersion: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: vi.fn(),
	downloadFileContent: vi.fn(),
}))

vi.mock("../useShareRoute", () => ({
	default: () => ({ isShareRoute: isShareRouteState.current }),
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		subscribe: vi.fn(),
		publish: vi.fn(),
		unsubscribe: vi.fn(),
	},
	PubSubEvents: {
		Change_Preview_File: "Change_Preview_File",
	},
}))

vi.mock("@/pages/superMagic/stores", () => ({
	superMagicStore: {
		subscribe: vi.fn(() => () => undefined),
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		loading: vi.fn(),
		destroy: vi.fn(),
		success: vi.fn(),
		error: vi.fn(),
	},
}))

const getFileHistoryVersionsMock = vi.mocked(SuperMagicApi.getFileHistoryVersions)
const getTemporaryDownloadUrlMock = vi.mocked(getTemporaryDownloadUrl)
const downloadFileContentMock = vi.mocked(downloadFileContent)

describe("useFileData", () => {
	beforeEach(() => {
		isShareRouteState.current = false
		getFileHistoryVersionsMock.mockReset()
		getTemporaryDownloadUrlMock.mockReset()
		downloadFileContentMock.mockReset()
		getFileHistoryVersionsMock.mockResolvedValue({ list: [{ version: 1 }] } as never)
		getTemporaryDownloadUrlMock.mockResolvedValue([
			{ file_id: "file-1", url: "https://oss.test/file-1" },
		] as never)
		downloadFileContentMock.mockResolvedValue("<html></html>")
		resetFileSaveQueueForTests(
			new FileSaveQueue({ persistence: createMemoryFileSavePersistence() }),
		)
	})

	describe("with an unsynced save draft", () => {
		function enqueuePendingSave(content: string, enableShadow = false) {
			const queue = getFileSaveQueue()
			queue.enqueue({
				fileId: "file-1",
				content,
				enableShadow,
				persist: () => new Promise(() => undefined),
			})
		}

		it("keeps loaded fileData as raw content and prefers the draft text", async () => {
			enqueuePendingSave("<html>draft</html>")
			const { result } = renderHook(() => useFileData({ file_id: "file-1" }))
			await waitFor(() => expect(result.current.loadStatus).toBe("ready"))
			expect(result.current.fileData).toBe("<html>draft</html>")
			expect(typeof result.current.fileData).toBe("string")
		})

		it("applies a recovered draft as raw content before the download settles", async () => {
			downloadFileContentMock.mockReturnValue(new Promise(() => undefined))
			enqueuePendingSave("<html>recovered</html>")
			const { result } = renderHook(() => useFileData({ file_id: "file-1" }))
			await waitFor(() => expect(result.current.fileData).toBe("<html>recovered</html>"))
		})

		it("never exposes a shadowed code draft while reloading after save and exit", async () => {
			const content = "const value = 42;"
			enqueuePendingSave(shadow(content), true)
			let finishDownload: ((value: string) => void) | undefined
			downloadFileContentMock.mockReturnValue(
				new Promise<string>((resolve) => {
					finishDownload = resolve
				}),
			)
			const renderedContent: unknown[] = []
			const { result, unmount } = renderHook(() => {
				const data = useFileData({ file_id: "file-1" })
				renderedContent.push(data.fileData)
				return data
			})
			await waitFor(() => expect(result.current.fileData).toBe(content))
			await waitFor(() => expect(finishDownload).toBeDefined())
			await act(async () => {
				finishDownload?.("const value = 0;")
			})
			await waitFor(() => expect(result.current.loadStatus).toBe("ready"))
			expect(result.current.fileData).toBe(content)
			expect(
				renderedContent
					.filter((value) => typeof value === "string")
					.every((value) => value === content),
			).toBe(true)
			expect(renderedContent).not.toContain(shadow(content))
			unmount()
			await getFileSaveQueue().restoreRemote("file-1")
		})
	})

	it.each(["<html></html>", ""])(
		"keeps loaded content %j when switching to another file and back",
		async (content) => {
			downloadFileContentMock.mockResolvedValue(content)
			const { result, rerender } = renderHook(
				({ activeFileId }) => useFileData({ file_id: "file-1", activeFileId }),
				{ initialProps: { activeFileId: "file-1" } },
			)
			await waitFor(() => expect(result.current.fileData).toBe(content))
			const urlRequests = getTemporaryDownloadUrlMock.mock.calls.length
			const historyRequests = getFileHistoryVersionsMock.mock.calls.length
			rerender({ activeFileId: "other.js" })
			await waitFor(() => expect(result.current.loadStatus).toBe("ready"))
			rerender({ activeFileId: "file-1" })
			await waitFor(() => expect(result.current.loadStatus).toBe("ready"))
			expect(result.current.fileData).toBe(content)
			expect(downloadFileContentMock).toHaveBeenCalledTimes(1)
			expect(getTemporaryDownloadUrlMock).toHaveBeenCalledTimes(urlRequests)
			expect(getFileHistoryVersionsMock).toHaveBeenCalledTimes(historyRequests)
		},
	)

	it("refreshes cached content when the file revision changes", async () => {
		const { result, rerender } = renderHook(
			({ updatedAt }) =>
				useFileData({ file_id: "file-1", activeFileId: "file-1", updatedAt }),
			{ initialProps: { updatedAt: "first" } },
		)
		await waitFor(() => expect(result.current.fileData).toBe("<html></html>"))
		downloadFileContentMock.mockResolvedValue("<html>updated</html>")
		rerender({ updatedAt: "second" })
		await waitFor(() => expect(result.current.fileData).toBe("<html>updated</html>"))
		expect(result.current.loadStatus).toBe("ready")
	})

	it("reports failures, keeps the preview, and downloads again when retrying the same version", async () => {
		const { result } = renderHook(() => useFileData({ file_id: "file-1" }))
		await waitFor(() => expect(result.current.loadStatus).toBe("ready"))
		downloadFileContentMock.mockRejectedValueOnce(new Error("offline"))
		await act(async () => {
			await result.current.changeFileVersion(2)
		})
		expect(result.current.loadStatus).toBe("error")
		expect(result.current.fileData).toBe("<html></html>")
		await act(async () => {
			await result.current.changeFileVersion(2)
		})
		expect(result.current.loadStatus).toBe("ready")
		expect(downloadFileContentMock).toHaveBeenCalledTimes(3)
		expect(result.current.fileVersion).toBe(2)
	})

	it("does not let a slow older version replace the latest requested version", async () => {
		const { result } = renderHook(() => useFileData({ file_id: "file-1" }))
		await waitFor(() => expect(result.current.loadStatus).toBe("ready"))
		let finishOld: (value: string) => void = () => undefined
		downloadFileContentMock.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finishOld = resolve
				}),
		)
		let previous: Promise<unknown> | undefined
		act(() => {
			previous = result.current.changeFileVersion(2)
		})
		await waitFor(() => expect(downloadFileContentMock).toHaveBeenCalledTimes(2))
		downloadFileContentMock.mockResolvedValueOnce("newest")
		await act(async () => {
			await result.current.changeFileVersion(3)
		})
		await act(async () => {
			finishOld("obsolete")
			await previous
		})
		expect(result.current.fileData).toBe("newest")
		expect(result.current.fileVersion).toBe(3)
	})

	it("keeps an explicit version selection when an earlier history lookup finishes late", async () => {
		const { result } = renderHook(() => useFileData({ file_id: "file-1" }))
		await waitFor(() => expect(result.current.loadStatus).toBe("ready"))
		let finishHistory: (value: never) => void = () => undefined
		getFileHistoryVersionsMock.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finishHistory = resolve
				}),
		)
		let history: Promise<unknown> | undefined
		act(() => {
			history = result.current.fetchFileVersions("file-1", true)
		})
		await act(async () => {
			await result.current.changeFileVersion(4)
		})
		await act(async () => {
			finishHistory({ list: [{ version: 8 }] } as never)
			await history
		})
		expect(result.current.fileVersion).toBe(4)
		expect(downloadFileContentMock).toHaveBeenCalledTimes(2)
	})

	it("acknowledges a successful reload even when the bytes did not change", async () => {
		const { result } = renderHook(() => useFileData({ file_id: "file-1" }))
		await waitFor(() => expect(result.current.loadStatus).toBe("ready"))
		const previousRevision = result.current.loadRevision
		await act(async () => {
			await result.current.refreshFile()
		})
		expect(result.current.loadRevision).toBeGreaterThan(previousRevision)
		expect(result.current.loadStatus).toBe("ready")
		expect(downloadFileContentMock).toHaveBeenCalledTimes(2)
	})

	it("does not let a pending refresh take over a later history selection", async () => {
		const { result } = renderHook(() => useFileData({ file_id: "file-1" }))
		await waitFor(() => expect(result.current.loadStatus).toBe("ready"))
		let finishHistory: (value: never) => void = () => undefined
		getFileHistoryVersionsMock.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finishHistory = resolve
				}),
		)
		let refresh: Promise<unknown> | undefined
		act(() => {
			refresh = result.current.refreshFile()
		})
		await act(async () => {
			await result.current.changeFileVersion(4)
		})
		await act(async () => {
			finishHistory({ list: [{ version: 8 }] } as never)
			await refresh
		})
		expect(result.current.fileVersion).toBe(4)
		expect(downloadFileContentMock).toHaveBeenCalledTimes(2)
	})

	it("loads project files via history versions when the active tab matches", async () => {
		renderHook(() =>
			useFileData({
				file_id: "file-1",
				activeFileId: "file-1",
			}),
		)

		await waitFor(() => {
			expect(getFileHistoryVersionsMock).toHaveBeenCalledWith({
				file_id: "file-1",
				page_size: 10,
			})
		})
	})

	it("loads history versions without downloading content for an external text session", async () => {
		renderHook(() =>
			useFileData({
				file_id: "file-1",
				activeFileId: "stale-file",
				isTabActive: true,
				enabled: true,
				loadContent: false,
				content: "session content",
			}),
		)

		await waitFor(() => {
			expect(getFileHistoryVersionsMock).toHaveBeenCalledWith({
				file_id: "file-1",
				page_size: 10,
			})
		})
		expect(getTemporaryDownloadUrlMock).not.toHaveBeenCalled()
		expect(downloadFileContentMock).not.toHaveBeenCalled()
	})

	it("does not load history versions for an inactive cached tab", async () => {
		renderHook(() =>
			useFileData({
				file_id: "file-1",
				activeFileId: "file-1",
				isTabActive: false,
			}),
		)

		expect(getFileHistoryVersionsMock).not.toHaveBeenCalled()
	})

	it("does not read a share file while an external session supplies its content", async () => {
		const access = createShareFileAccess({ token: "share-token", projectId: "origin-project" })
		const { result, rerender } = renderHook(
			({ enabled }) => useFileData({ file_id: "file-1", isSharePreview: true, enabled }),
			{
				initialProps: { enabled: false },
				wrapper: ({ children }: { children: ReactNode }) =>
					createElement(FileAccessProvider, { value: access }, children),
			},
		)
		expect(result.current.loading).toBe(false)
		expect(getTemporaryDownloadUrlMock).not.toHaveBeenCalled()
		expect(getFileHistoryVersionsMock).not.toHaveBeenCalled()
		rerender({ enabled: true })
		await waitFor(() =>
			expect(getTemporaryDownloadUrlMock).toHaveBeenCalledWith({
				file_ids: ["file-1"],
				access,
			}),
		)
	})

	it("skips history versions on share routes even without isSharePreview", async () => {
		isShareRouteState.current = true
		const access = createShareFileAccess({
			token: "share-token",
			projectId: "origin-project",
			topicId: "share-topic",
		})

		renderHook(
			() =>
				useFileData({
					file_id: "file-1",
					activeFileId: "file-1",
				}),
			{
				wrapper: ({ children }: { children: ReactNode }) =>
					createElement(FileAccessProvider, { value: access }, children),
			},
		)

		await waitFor(() => {
			expect(getTemporaryDownloadUrlMock).toHaveBeenCalledWith({
				file_ids: ["file-1"],
				access,
			})
		})
		expect(getFileHistoryVersionsMock).not.toHaveBeenCalled()
	})

	it("does not request share file urls before share access is ready", async () => {
		isShareRouteState.current = true

		renderHook(() =>
			useFileData({
				file_id: "file-1",
				activeFileId: "file-1",
			}),
		)

		await Promise.resolve()
		expect(getTemporaryDownloadUrlMock).not.toHaveBeenCalled()
		expect(getFileHistoryVersionsMock).not.toHaveBeenCalled()
	})

	it("loads session files on a published micro-app share route", async () => {
		isShareRouteState.current = true
		const access = createSessionFileAccess({
			projectId: "runtime-project",
			topicId: "topic-1",
		})

		const { result } = renderHook(
			() =>
				useFileData({
					file_id: "file-1",
					activeFileId: "file-1",
				}),
			{
				wrapper: ({ children }: { children: ReactNode }) =>
					createElement(FileAccessProvider, { value: access }, children),
			},
		)

		await waitFor(() => {
			expect(getFileHistoryVersionsMock).toHaveBeenCalledWith({
				file_id: "file-1",
				page_size: 10,
			})
		})
		await waitFor(() => {
			expect(result.current.loading).toBe(false)
		})
		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledWith({
			file_ids: ["file-1"],
			access,
		})
	})

	it("requests share file urls once share access arrives", async () => {
		isShareRouteState.current = true
		const access = createShareFileAccess({
			token: "share-token",
			projectId: "origin-project",
			topicId: "share-topic",
		})
		let currentAccess: ReturnType<typeof createShareFileAccess> | null = null

		const { rerender } = renderHook(
			() =>
				useFileData({
					file_id: "file-1",
					activeFileId: "file-1",
				}),
			{
				wrapper: ({ children }: { children: ReactNode }) =>
					createElement(FileAccessProvider, { value: currentAccess }, children),
			},
		)

		expect(getTemporaryDownloadUrlMock).not.toHaveBeenCalled()

		currentAccess = access
		rerender()

		await waitFor(() => {
			expect(getTemporaryDownloadUrlMock).toHaveBeenCalledWith({
				file_ids: ["file-1"],
				access,
			})
		})
	})

	it("keeps share preview content mounted when only the share token rotates", async () => {
		isShareRouteState.current = true
		let currentAccess = createShareFileAccess({
			token: "share-token-1",
			projectId: "origin-project",
			topicId: "share-topic",
		})

		const { result, rerender } = renderHook(
			() =>
				useFileData({
					file_id: "file-1",
					activeFileId: "file-1",
					isSharePreview: true,
				}),
			{
				wrapper: ({ children }: { children: ReactNode }) =>
					createElement(FileAccessProvider, { value: currentAccess }, children),
			},
		)

		await waitFor(() => {
			expect(result.current.fileData).toBe("<html></html>")
			expect(result.current.loading).toBe(false)
		})

		getTemporaryDownloadUrlMock.mockResolvedValue([
			{ file_id: "file-1", url: "https://oss.test/file-1-refreshed" },
		] as never)

		currentAccess = createShareFileAccess({
			token: "share-token-2",
			projectId: "origin-project",
			topicId: "share-topic",
		})
		rerender()

		await waitFor(() => {
			expect(getTemporaryDownloadUrlMock).toHaveBeenCalledTimes(2)
		})
		// Soft refresh must not blank the preview while the share token rotates.
		expect(result.current.loading).toBe(false)
		expect(result.current.fileData).toBe("<html></html>")
	})
})
