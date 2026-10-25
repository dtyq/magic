import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import MagicModal from "@/components/base/MagicModal"
import { useRename } from "../useRename"
import type { AttachmentItem } from "../types"
import { detectCanvasProjectOperationRisk } from "../../utils/canvasProjectOperationRisk"
import {
	commitCanvasProjectPathRepair,
	planCanvasProjectsBeforeFileOperation,
	syncCanvasProjectNameAfterFileOperation,
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
		warning: vi.fn(),
	},
}))

vi.mock("@/components/base/MagicModal", () => ({
	default: {
		confirm: vi.fn(),
	},
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		renameFile: vi.fn(),
	},
}))

vi.mock("../../utils/canvasProjectOperationRisk", () => ({
	detectCanvasProjectOperationRisk: vi.fn(),
	getCanvasProjectOperationImpact: (risk: { riskTypes: string[] }) =>
		risk.riskTypes.includes("project-entry") ? "open-failure" : "content-loss",
}))

vi.mock(
	"@/pages/superMagic/components/Detail/contents/Design/utils/canvasProjectPathRepair",
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import("@/pages/superMagic/components/Detail/contents/Design/utils/canvasProjectPathRepair")
			>()
		return {
			...actual,
			planCanvasProjectsBeforeFileOperation: vi.fn(),
			commitCanvasProjectPathRepair: vi.fn(),
			syncCanvasProjectNameAfterFileOperation: vi.fn(),
			formatCanvasPathRepairFailures: vi.fn(() => "repair failed"),
		}
	},
)

const imagesDir: AttachmentItem = {
	file_id: "images-dir",
	file_name: "images",
	name: "images",
	is_directory: true,
	relative_file_path: "Canvas/images",
}

describe("useRename", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(detectCanvasProjectOperationRisk).mockResolvedValue({
			shouldWarn: true,
			riskTypes: ["canvas-resource"],
			affectedProjectNames: ["Canvas"],
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
		vi.mocked(syncCanvasProjectNameAfterFileOperation).mockResolvedValue({
			syncedFileIds: [],
			failures: [],
			hasFailures: false,
		})
	})

	it("画布风险确认弹窗打开期间重复提交只弹一次，取消后退出重命名态", async () => {
		let confirmConfig: Parameters<typeof MagicModal.confirm>[0] | undefined
		vi.mocked(MagicModal.confirm).mockImplementation((config) => {
			confirmConfig = config
			return undefined as never
		})

		const { result } = renderHook(() =>
			useRename({
				attachments: [imagesDir],
			}),
		)

		act(() => {
			result.current.handleStartRename(imagesDir)
			result.current.setRenameValue("media")
		})

		const firstConfirmPromise = result.current.handleRenameConfirm()

		await waitFor(() => {
			expect(MagicModal.confirm).toHaveBeenCalledTimes(1)
		})
		expect(MagicModal.confirm).toHaveBeenCalledWith(
			expect.objectContaining({
				content: "topicFiles.canvasOperationRisk.renameContentLossContent",
			}),
		)

		const blurConfirmPromise = result.current.handleRenameConfirm()

		await Promise.resolve()
		expect(MagicModal.confirm).toHaveBeenCalledTimes(1)

		await act(async () => {
			confirmConfig?.onCancel?.()
			await Promise.all([firstConfirmPromise, blurConfirmPromise])
		})

		expect(result.current.renamingItemId).toBeNull()
		expect(result.current.renameValue).toBe("")
		expect(SuperMagicApi.renameFile).not.toHaveBeenCalled()
	})

	it("目录重命名成功后才提交路径修复", async () => {
		vi.mocked(detectCanvasProjectOperationRisk).mockResolvedValue({
			shouldWarn: false,
			riskTypes: [],
			affectedProjectNames: [],
		})
		vi.mocked(SuperMagicApi.renameFile).mockResolvedValue({} as never)

		const { result } = renderHook(() => useRename({ attachments: [imagesDir] }))
		act(() => {
			result.current.handleStartRename(imagesDir)
			result.current.setRenameValue("media")
		})

		await act(async () => {
			await result.current.handleRenameConfirm()
		})

		expect(planCanvasProjectsBeforeFileOperation).toHaveBeenCalledTimes(1)
		expect(commitCanvasProjectPathRepair).toHaveBeenCalledTimes(1)
		expect(syncCanvasProjectNameAfterFileOperation).toHaveBeenCalledTimes(1)
		expect(SuperMagicApi.renameFile).toHaveBeenCalledTimes(1)
		expect(
			vi.mocked(planCanvasProjectsBeforeFileOperation).mock.invocationCallOrder[0],
		).toBeLessThan(vi.mocked(SuperMagicApi.renameFile).mock.invocationCallOrder[0])
		expect(vi.mocked(SuperMagicApi.renameFile).mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(commitCanvasProjectPathRepair).mock.invocationCallOrder[0],
		)
		expect(
			vi.mocked(commitCanvasProjectPathRepair).mock.invocationCallOrder[0],
		).toBeGreaterThan(vi.mocked(SuperMagicApi.renameFile).mock.invocationCallOrder[0])
		expect(
			vi.mocked(syncCanvasProjectNameAfterFileOperation).mock.invocationCallOrder[0],
		).toBeGreaterThan(vi.mocked(commitCanvasProjectPathRepair).mock.invocationCallOrder[0])
	})

	it("文件重命名不触发画布路径修复", async () => {
		vi.mocked(detectCanvasProjectOperationRisk).mockResolvedValue({
			shouldWarn: false,
			riskTypes: [],
			affectedProjectNames: [],
		})
		vi.mocked(SuperMagicApi.renameFile).mockResolvedValue({} as never)
		const file: AttachmentItem = {
			file_id: "file-1",
			file_name: "a.txt",
			relative_file_path: "Canvas/a.txt",
		}

		const { result } = renderHook(() => useRename({ attachments: [file] }))
		act(() => {
			result.current.handleStartRename(file)
			result.current.setRenameValue("b.txt")
		})
		await act(async () => {
			await result.current.handleRenameConfirm()
		})

		expect(planCanvasProjectsBeforeFileOperation).not.toHaveBeenCalled()
		expect(SuperMagicApi.renameFile).toHaveBeenCalledTimes(1)
		expect(syncCanvasProjectNameAfterFileOperation).not.toHaveBeenCalled()
	})

	it("路径修复失败时取消不会调用重命名接口", async () => {
		vi.mocked(detectCanvasProjectOperationRisk).mockResolvedValue({
			shouldWarn: false,
			riskTypes: [],
			affectedProjectNames: [],
		})
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
		const { result } = renderHook(() => useRename({ attachments: [imagesDir] }))
		act(() => {
			result.current.handleStartRename(imagesDir)
			result.current.setRenameValue("media")
		})

		const promise = result.current.handleRenameConfirm()
		await waitFor(() => expect(MagicModal.confirm).toHaveBeenCalledTimes(1))
		await act(async () => {
			confirmConfig?.onCancel?.()
			await promise
		})

		expect(SuperMagicApi.renameFile).not.toHaveBeenCalled()
		expect(commitCanvasProjectPathRepair).not.toHaveBeenCalled()
		expect(syncCanvasProjectNameAfterFileOperation).not.toHaveBeenCalled()
	})

	it("用户确认忽略路径读取失败后仍继续重命名", async () => {
		vi.mocked(detectCanvasProjectOperationRisk).mockResolvedValue({
			shouldWarn: false,
			riskTypes: [],
			affectedProjectNames: [],
		})
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
		vi.mocked(SuperMagicApi.renameFile).mockResolvedValue({} as never)
		vi.mocked(MagicModal.confirm).mockImplementation((config) => {
			config.onOk?.()
			return undefined as never
		})

		const { result } = renderHook(() => useRename({ attachments: [imagesDir] }))
		act(() => {
			result.current.handleStartRename(imagesDir)
			result.current.setRenameValue("media")
		})

		await act(async () => {
			await result.current.handleRenameConfirm()
		})

		expect(commitCanvasProjectPathRepair).toHaveBeenCalledTimes(1)
		expect(SuperMagicApi.renameFile).toHaveBeenCalledTimes(1)
	})

	it("重命名接口失败时不提前同步画布名称", async () => {
		vi.mocked(detectCanvasProjectOperationRisk).mockResolvedValue({
			shouldWarn: false,
			riskTypes: [],
			affectedProjectNames: [],
		})
		vi.mocked(SuperMagicApi.renameFile).mockRejectedValue(new Error("rename failed"))

		const { result } = renderHook(() => useRename({ attachments: [imagesDir] }))
		act(() => {
			result.current.handleStartRename(imagesDir)
			result.current.setRenameValue("media")
		})

		await act(async () => {
			await result.current.handleRenameConfirm()
		})

		expect(syncCanvasProjectNameAfterFileOperation).not.toHaveBeenCalled()
	})
})
