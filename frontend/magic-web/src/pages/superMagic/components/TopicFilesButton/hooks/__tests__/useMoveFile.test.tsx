import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useMoveFile } from "../useMoveFile"
import type { AttachmentItem } from "../types"
import { SuperMagicApi } from "@/apis"
import MagicModal from "@/components/base/MagicModal"
import { resolveSingleDocumentStaticDependencies } from "@/pages/superMagic/utils/staticDependencies"
import {
	commitCanvasProjectPathRepair,
	planCanvasProjectsBeforeFileOperation,
} from "@/pages/superMagic/components/Detail/contents/Design/utils/canvasProjectPathRepair"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: vi.fn(),
		error: vi.fn(),
		loading: vi.fn(),
		destroy: vi.fn(),
	},
}))

vi.mock("@/components/base/MagicModal", () => ({
	default: {
		confirm: vi.fn(),
	},
}))

vi.mock("@tabler/icons-react", () => ({
	IconAlertTriangleFilled: () => null,
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		moveFile: vi.fn(),
		moveFiles: vi.fn(),
		checkBatchOperationStatus: vi.fn(),
	},
}))

vi.mock("../../utils/checkDuplicateFileName", () => ({
	checkDuplicateFileName: vi.fn(() => false),
}))

vi.mock("@/pages/superMagic/utils/staticDependencies", () => ({
	resolveSingleDocumentStaticDependencies: vi.fn(),
	mergeStaticDependencyFileIds: (
		fileIds: string[],
		dependencyFileIds: string[],
		includeDependencies: boolean,
	) =>
		includeDependencies
			? [...new Set([...fileIds, ...dependencyFileIds])]
			: [...new Set(fileIds)],
}))

vi.mock(
	"@/pages/superMagic/components/Detail/contents/Design/utils/canvasProjectPathRepair",
	() => ({
		planCanvasProjectsBeforeFileOperation: vi.fn(),
		commitCanvasProjectPathRepair: vi.fn(),
	}),
)

describe("useMoveFile", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(resolveSingleDocumentStaticDependencies).mockResolvedValue({
			fileType: null,
			dependencyFileIds: [],
			dependencyTransferFileIds: [],
			missingResourcePaths: [],
		})
		vi.mocked(planCanvasProjectsBeforeFileOperation).mockResolvedValue({
			affectedProjects: [],
			repairedFileIds: [],
			repairedFiles: [],
			failures: [],
			saveFailures: [],
			hasFailures: false,
			hasSaveFailures: false,
			requiresConfirmation: false,
		})
		vi.mocked(commitCanvasProjectPathRepair).mockResolvedValue({
			affectedProjects: [],
			repairedFileIds: [],
			repairedFiles: [],
			failures: [],
			saveFailures: [],
			hasFailures: false,
			hasSaveFailures: false,
			requiresConfirmation: false,
		})
	})

	it("单个移动时默认从当前项目根目录打开", () => {
		const attachments: AttachmentItem[] = [
			{
				file_id: "folder-1",
				name: "Folder 1",
				is_directory: true,
				relative_file_path: "/Folder 1",
				children: [
					{
						file_id: "child-file-1",
						name: "Child File",
						is_directory: false,
						relative_file_path: "/Folder 1/Child File",
					},
				],
			},
		]

		const { result } = renderHook(() =>
			useMoveFile({
				attachments,
			}),
		)

		act(() => {
			result.current.showMoveSelector(attachments[0].children?.[0] as AttachmentItem)
		})

		expect(result.current.selectorConfig.visible).toBe(true)
		expect(result.current.selectorConfig.defaultPath).toEqual([])
	})

	it("批量移动选中文件夹时只保留文件夹自身 ID，不递归展开子文件", () => {
		const attachments: AttachmentItem[] = [
			{
				file_id: "folder-1",
				name: "Folder 1",
				is_directory: true,
				relative_file_path: "/Folder 1",
				children: [
					{
						file_id: "child-file-1",
						name: "Child File",
						is_directory: false,
						relative_file_path: "/Folder 1/Child File",
					},
				],
			},
		]

		const { result } = renderHook(() =>
			useMoveFile({
				attachments,
				allFiles: attachments,
				selectedItems: new Set(["folder-1"]),
				getItemId: (item) => item.file_id || "",
			}),
		)

		act(() => {
			result.current.openBatchMove()
		})

		expect(result.current.selectorConfig.visible).toBe(true)
		expect(result.current.selectorConfig.defaultPath).toEqual([])
		expect(result.current.selectorConfig.pendingMoveFileIds).toEqual(["folder-1"])
	})

	it("移动文件夹到同级目录时默认保留两者并跳过冲突弹窗", async () => {
		vi.mocked(SuperMagicApi.moveFile).mockResolvedValue({
			status: "success",
		})

		const attachments: AttachmentItem[] = [
			{
				file_id: "folder-1",
				name: "Folder 1",
				is_directory: true,
				relative_file_path: "/Folder 1",
				children: [],
			},
		]

		const { result } = renderHook(() =>
			useMoveFile({
				projectId: "project-1",
				attachments,
			}),
		)

		await act(async () => {
			await result.current.batchMoveFilesWithDuplicateCheck({
				fileIds: ["folder-1"],
				projectId: "project-1",
				targetParentId: "",
				targetPath: [],
				sourceAttachments: attachments,
				targetAttachments: attachments,
			})
		})

		expect(result.current.folderConflictModalVisible).toBe(false)
		expect(SuperMagicApi.moveFile).toHaveBeenCalledWith(
			expect.objectContaining({
				file_id: "folder-1",
				target_parent_id: "",
				keep_both_file_ids: ["folder-1"],
			}),
		)
		expect(
			vi.mocked(planCanvasProjectsBeforeFileOperation).mock.invocationCallOrder[0],
		).toBeLessThan(vi.mocked(SuperMagicApi.moveFile).mock.invocationCallOrder[0])
	})

	it("跨项目移动不触发画布路径修复", async () => {
		vi.mocked(SuperMagicApi.moveFile).mockResolvedValue({ status: "success" })
		const { result } = renderHook(() => useMoveFile({ projectId: "project-1" }))

		await act(async () => {
			await result.current.batchMoveFiles({
				fileIds: ["folder-1"],
				projectId: "project-1",
				targetProjectId: "project-2",
				targetParentId: "target",
			})
		})

		expect(planCanvasProjectsBeforeFileOperation).not.toHaveBeenCalled()
		expect(SuperMagicApi.moveFile).toHaveBeenCalledWith(
			expect.objectContaining({ target_project_id: "project-2" }),
		)
	})

	it("单个画布资源移动仍提示风险但不触发路径修复", async () => {
		vi.mocked(SuperMagicApi.moveFile).mockResolvedValue({ status: "success" })
		vi.mocked(MagicModal.confirm).mockImplementation((config) => {
			config.onOk?.()
			return undefined as never
		})
		const canvasRoot: AttachmentItem = {
			file_id: "canvas",
			file_name: "Canvas",
			is_directory: true,
			relative_file_path: "Canvas",
		}
		const resourceDir: AttachmentItem = {
			file_id: "images",
			file_name: "images",
			parent_id: "canvas",
			is_directory: true,
			relative_file_path: "Canvas/images",
		}
		const resource: AttachmentItem = {
			file_id: "image",
			file_name: "a.png",
			parent_id: "images",
			relative_file_path: "Canvas/images/a.png",
		}
		const target: AttachmentItem = {
			file_id: "target",
			file_name: "Other",
			is_directory: true,
			relative_file_path: "Other",
		}
		const attachments: AttachmentItem[] = [
			canvasRoot,
			{
				file_id: "main",
				file_name: "magic.project.js",
				parent_id: "canvas",
				relative_file_path: "Canvas/magic.project.js",
			},
			resourceDir,
			resource,
			target,
		]
		const { result } = renderHook(() => useMoveFile({ projectId: "project-1", attachments }))

		act(() => result.current.showMoveSelector(resource))
		await act(async () => {
			await result.current.confirmMove({ path: [target] })
		})

		expect(MagicModal.confirm).toHaveBeenCalledTimes(1)
		expect(planCanvasProjectsBeforeFileOperation).not.toHaveBeenCalled()
		expect(SuperMagicApi.moveFile).toHaveBeenCalledWith(
			expect.objectContaining({ file_id: "image", target_parent_id: "target" }),
		)
	})

	it("路径修复失败时继续仍会调用移动接口", async () => {
		vi.mocked(SuperMagicApi.moveFile).mockResolvedValue({ status: "success" })
		vi.mocked(planCanvasProjectsBeforeFileOperation).mockResolvedValue({
			affectedProjects: [],
			repairedFileIds: [],
			repairedFiles: [],
			failures: [
				{ projectName: "Canvas", fileName: "magic.project.js", message: "read failed" },
			],
			saveFailures: [],
			hasFailures: true,
			hasSaveFailures: false,
			requiresConfirmation: true,
		})
		vi.mocked(commitCanvasProjectPathRepair).mockResolvedValue({
			affectedProjects: [],
			repairedFileIds: [],
			repairedFiles: [],
			failures: [
				{ projectName: "Canvas", fileName: "magic.project.js", message: "read failed" },
			],
			saveFailures: [],
			hasFailures: true,
			hasSaveFailures: false,
			requiresConfirmation: true,
		})
		let confirmConfig: Parameters<typeof MagicModal.confirm>[0] | undefined
		vi.mocked(MagicModal.confirm).mockImplementation((config) => {
			confirmConfig = config
			return undefined as never
		})
		const { result } = renderHook(() => useMoveFile({ projectId: "project-1" }))

		const promise = result.current.batchMoveFiles({
			fileIds: ["folder-1"],
			projectId: "project-1",
			targetParentId: "target",
		})
		await waitFor(() => expect(MagicModal.confirm).toHaveBeenCalledTimes(1))
		await act(async () => {
			confirmConfig?.onOk?.()
			await promise
		})

		expect(SuperMagicApi.moveFile).toHaveBeenCalledTimes(1)
		expect(vi.mocked(SuperMagicApi.moveFile).mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(commitCanvasProjectPathRepair).mock.invocationCallOrder[0],
		)
	})

	it("路径修复失败时取消不会调用移动接口", async () => {
		vi.mocked(planCanvasProjectsBeforeFileOperation).mockResolvedValue({
			affectedProjects: [],
			repairedFileIds: [],
			repairedFiles: [],
			failures: [
				{ projectName: "Canvas", fileName: "magic.project.js", message: "read failed" },
			],
			saveFailures: [],
			hasFailures: true,
			hasSaveFailures: false,
			requiresConfirmation: true,
		})
		let confirmConfig: Parameters<typeof MagicModal.confirm>[0] | undefined
		vi.mocked(MagicModal.confirm).mockImplementation((config) => {
			confirmConfig = config
			return undefined as never
		})
		const { result } = renderHook(() => useMoveFile({ projectId: "project-1" }))

		const promise = result.current.batchMoveFiles({
			fileIds: ["folder-1"],
			projectId: "project-1",
			targetParentId: "target",
		})
		await waitFor(() => expect(MagicModal.confirm).toHaveBeenCalledTimes(1))
		await act(async () => {
			confirmConfig?.onCancel?.()
			await promise
		})

		expect(SuperMagicApi.moveFile).not.toHaveBeenCalled()
		expect(commitCanvasProjectPathRepair).not.toHaveBeenCalled()
	})
})
