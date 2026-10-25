import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useFilePathAttachmentDownload } from "../useFilePathAttachmentDownload"
import { createElement, type PropsWithChildren } from "react"
import { FileAccessProvider } from "@/pages/superMagic/providers/FileAccessProvider"

const downloadFileMock = vi.fn()
const publishDownloadFileByPathMock = vi.fn()

const projectFilesStoreMock = {
	workspaceFilesList: [] as Array<Record<string, unknown>>,
}

vi.mock("@/pages/superMagic/components/MessageList/context", () => ({
	useMessageListContext: () => ({ projectFilesStore: projectFilesStoreMock }),
}))

vi.mock("../useMessageAttachmentDownload", () => ({
	useMessageAttachmentDownload: () => downloadFileMock,
}))

vi.mock(
	"@/pages/superMagic/components/MessageList/utils/attachmentByFilePath",
	async (importOriginal) => ({
		...(await importOriginal<object>()),
		downloadFileByPath: (...args: unknown[]) => publishDownloadFileByPathMock(...args),
	}),
)

describe("useFilePathAttachmentDownload", () => {
	it("blocks both direct download and the path event after scope changes", () => {
		let download = true
		const wrapper = ({ children }: PropsWithChildren) =>
			createElement(FileAccessProvider, { permissions: { download } }, children)
		const { result, rerender } = renderHook(() => useFilePathAttachmentDownload(), { wrapper })
		download = false
		rerender()
		act(() =>
			result.current({
				filePath: "denied.md",
				fileName: "denied.md",
				fileExt: "md",
				__byPath: true,
			}),
		)
		expect(downloadFileMock).not.toHaveBeenCalled()
		expect(publishDownloadFileByPathMock).not.toHaveBeenCalled()
	})
	beforeEach(() => {
		downloadFileMock.mockReset()
		publishDownloadFileByPathMock.mockReset()
		projectFilesStoreMock.workspaceFilesList = []
	})

	it("downloads the matching workspace file", () => {
		projectFilesStoreMock.workspaceFilesList = [
			{
				file_id: "page-html",
				relative_file_path: "site/page.html",
			},
		]
		const attachment = {
			filePath: "site/page.html",
			fileName: "page.html",
			fileExt: "html",
			__byPath: true as const,
		}
		const { result } = renderHook(() => useFilePathAttachmentDownload())

		act(() => result.current(attachment))

		expect(downloadFileMock).toHaveBeenCalledWith("page-html")
		expect(publishDownloadFileByPathMock).not.toHaveBeenCalled()
	})

	it("keeps the existing path event as fallback", () => {
		const attachment = {
			filePath: "site/missing.html",
			fileName: "missing.html",
			fileExt: "html",
			__byPath: true as const,
		}
		const { result } = renderHook(() => useFilePathAttachmentDownload())

		act(() => result.current(attachment))

		expect(publishDownloadFileByPathMock).toHaveBeenCalledWith(attachment)
		expect(downloadFileMock).not.toHaveBeenCalled()
	})
})
