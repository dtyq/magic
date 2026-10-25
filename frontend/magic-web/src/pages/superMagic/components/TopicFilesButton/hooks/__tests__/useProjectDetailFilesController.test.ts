import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useProjectDetailFilesController } from "../useProjectDetailFilesController"
import type { AttachmentItem } from "../types"
import { toggleAttachmentSelection } from "../../utils/mobileAttachmentTreeSelection"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: vi.fn(),
		error: vi.fn(),
	},
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		createFile: vi.fn(),
		saveFileContent: vi.fn(),
		deleteFiles: vi.fn(),
	},
}))

vi.mock("../useDuplicateFileHandler", () => ({
	useDuplicateFileHandler: () => ({
		modalVisible: false,
		currentFileName: "",
		totalDuplicates: 0,
		handleCancel: vi.fn(),
		handleReplace: vi.fn(),
		handleKeepBoth: vi.fn(),
	}),
}))

const openDeleteConfirm = vi.fn()

vi.mock("../useMobileDeleteConfirmSheet", () => ({
	useMobileDeleteConfirmSheet: () => ({
		deleteConfirmNode: null,
		openDeleteConfirm,
	}),
}))

vi.mock("../useUploadWithModal", () => ({
	useUploadWithModal: () => ({
		uploadModalVisible: false,
		selectedUploadFiles: [],
		isUploadingFolder: false,
		handleCustomUploadFile: vi.fn(),
		handleCustomUploadFolder: vi.fn(),
		handleUploadModalSubmit: vi.fn(),
		handleUploadModalClose: vi.fn(),
	}),
}))

const openBatchMoveByFileIds = vi.fn()

vi.mock("../useMoveFile", () => ({
	useMoveFile: () => ({
		openBatchMoveByFileIds,
		selectorConfig: {
			visible: false,
			pendingMoveFileIds: [],
		},
	}),
}))

describe("useProjectDetailFilesController", () => {
	const attachments: AttachmentItem[] = [
		{
			file_id: "folder-1",
			name: "Mock Folder",
			is_directory: true,
			relative_file_path: "/Mock Folder",
			children: [
				{
					file_id: "child-file-1",
					name: "Mock Child",
					is_directory: false,
					relative_file_path: "/Mock Folder/Mock Child",
				},
			],
		},
	]

	it("refreshes attachments after creating a folder", async () => {
		vi.mocked(SuperMagicApi.createFile).mockResolvedValue({ file_id: "created-folder-1" })
		const onUpdateAttachments = vi.fn()

		const { result } = renderHook(() =>
			useProjectDetailFilesController({
				projectId: "project-1",
				attachments,
				setIsSelectMode: vi.fn(),
				onUpdateAttachments,
			}),
		)

		await act(async () => {
			await result.current.createFolder(undefined, "new-folder")
		})

		expect(onUpdateAttachments).toHaveBeenCalledOnce()
		expect(magicToast.success).toHaveBeenCalledWith(
			"topicFiles.contextMenu.createFolderSuccess",
		)
	})

	it("batchCopy collapses a fully selected folder into folder id only", () => {
		const selectedKeys = toggleAttachmentSelection(attachments[0], new Set())

		const { result } = renderHook(() =>
			useProjectDetailFilesController({
				projectId: "project-1",
				attachments,
				setIsSelectMode: vi.fn(),
			}),
		)

		act(() => {
			result.current.batchCopy(selectedKeys)
		})

		expect(result.current.copySelectorProps.visible).toBe(true)
		expect(result.current.pendingCopyFileIds).toEqual(["folder-1"])
	})

	it("batchMove collapses a fully selected folder into folder id only", () => {
		openBatchMoveByFileIds.mockClear()
		const selectedKeys = toggleAttachmentSelection(attachments[0], new Set())

		const { result } = renderHook(() =>
			useProjectDetailFilesController({
				projectId: "project-1",
				attachments,
				setIsSelectMode: vi.fn(),
			}),
		)

		act(() => {
			result.current.batchMove(selectedKeys)
		})

		expect(openBatchMoveByFileIds).toHaveBeenCalledWith(["folder-1"])
	})

	it("batchDelete collapses a fully selected folder into folder id only", async () => {
		openDeleteConfirm.mockClear()
		vi.mocked(magicToast.success).mockClear()
		vi.mocked(SuperMagicApi.deleteFiles).mockResolvedValue(null)
		const selectedKeys = toggleAttachmentSelection(attachments[0], new Set())
		const onUpdateAttachments = vi.fn()
		const setIsSelectMode = vi.fn()

		const { result } = renderHook(() =>
			useProjectDetailFilesController({
				projectId: "project-1",
				attachments,
				setIsSelectMode,
				onUpdateAttachments,
			}),
		)

		act(() => {
			result.current.batchDelete(selectedKeys)
		})

		expect(openDeleteConfirm).toHaveBeenCalledTimes(1)
		const confirmConfig = openDeleteConfirm.mock.calls[0]?.[0] as {
			onConfirm: () => Promise<void>
		}

		await act(async () => {
			await confirmConfig.onConfirm()
		})

		expect(SuperMagicApi.deleteFiles).toHaveBeenCalledWith({
			file_ids: ["folder-1"],
			project_id: "project-1",
		})
		expect(onUpdateAttachments).toHaveBeenCalledOnce()
		expect(magicToast.success).toHaveBeenCalledOnce()
		expect(setIsSelectMode).toHaveBeenCalledWith(false)
	})

	it("does not complete the delete flow when the API fails", async () => {
		openDeleteConfirm.mockClear()
		vi.mocked(magicToast.success).mockClear()
		vi.mocked(magicToast.error).mockClear()
		const deleteError = new Error("delete failed")
		vi.mocked(SuperMagicApi.deleteFiles).mockRejectedValue(deleteError)
		const selectedKeys = toggleAttachmentSelection(attachments[0], new Set())
		const onUpdateAttachments = vi.fn()
		const setIsSelectMode = vi.fn()

		const { result } = renderHook(() =>
			useProjectDetailFilesController({
				projectId: "project-1",
				attachments,
				setIsSelectMode,
				onUpdateAttachments,
			}),
		)

		act(() => {
			result.current.batchDelete(selectedKeys)
		})

		const confirmConfig = openDeleteConfirm.mock.calls[0]?.[0] as {
			onConfirm: () => Promise<void>
		}
		await act(async () => {
			await confirmConfig.onConfirm()
		})

		expect(onUpdateAttachments).not.toHaveBeenCalled()
		expect(magicToast.success).not.toHaveBeenCalled()
		expect(magicToast.error).toHaveBeenCalledOnce()
		expect(setIsSelectMode).not.toHaveBeenCalled()
	})
})
