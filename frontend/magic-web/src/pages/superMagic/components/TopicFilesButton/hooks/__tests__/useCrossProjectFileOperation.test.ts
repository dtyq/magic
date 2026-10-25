import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import MagicModal from "@/components/base/MagicModal"
import magicToast from "@/components/base/MagicToaster/utils"
import { useCrossProjectFileOperation } from "../useCrossProjectFileOperation"
import type { AttachmentItem } from "../types"
import { detectCanvasProjectOperationRisk } from "../../utils/canvasProjectOperationRisk"
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
		warning: vi.fn(),
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
		copyFiles: vi.fn(),
		checkBatchOperationStatus: vi.fn(),
	},
}))

vi.mock("../../utils/canvasProjectOperationRisk", () => ({
	detectCanvasProjectOperationRisk: vi.fn(),
	getCanvasProjectOperationImpact: (risk: { riskTypes: string[] }) =>
		risk.riskTypes.includes("project-entry") ? "open-failure" : "content-loss",
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
		formatCanvasPathRepairFailures: vi.fn(),
	}),
)

const sourceAttachments: AttachmentItem[] = [
	{
		file_id: "file-1",
		file_name: "magic.project.js",
		is_directory: false,
		relative_file_path: "Design/magic.project.js",
	},
]

describe("useCrossProjectFileOperation", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(detectCanvasProjectOperationRisk).mockResolvedValue({
			shouldWarn: false,
			riskTypes: [],
			affectedProjectNames: [],
		})
		vi.mocked(SuperMagicApi.moveFile).mockResolvedValue({ status: "success" })
		vi.mocked(SuperMagicApi.moveFiles).mockResolvedValue({ status: "success" })
		vi.mocked(SuperMagicApi.copyFiles).mockResolvedValue({ status: "success" })
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

	it("跨项目移动命中画布风险且用户取消时不执行移动", async () => {
		vi.mocked(detectCanvasProjectOperationRisk).mockResolvedValue({
			shouldWarn: true,
			riskTypes: ["project-entry"],
			affectedProjectNames: ["Design"],
		})
		vi.mocked(MagicModal.confirm).mockImplementation((config) => {
			config.onCancel?.()
			return undefined as never
		})

		const { result } = renderHook(() =>
			useCrossProjectFileOperation({
				projectId: "project-1",
				selectedWorkspace: null,
				selectedProject: null,
				projects: [],
			}),
		)

		await act(async () => {
			await result.current.executeMoveOperation({
				fileIds: ["file-1"],
				targetProjectId: "project-2",
				targetPath: [],
				targetAttachments: [],
				sourceAttachments,
			})
		})

		expect(detectCanvasProjectOperationRisk).toHaveBeenCalledWith({
			attachments: sourceAttachments,
			fileIds: ["file-1"],
			operation: "move",
		})
		expect(MagicModal.confirm).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "topicFiles.canvasOperationRisk.title",
				content: "topicFiles.canvasOperationRisk.moveOpenFailureContent",
			}),
		)
		expect(SuperMagicApi.moveFile).not.toHaveBeenCalled()
	})

	it("跨项目移动画布根目录时先计划，移动成功后提交路径修复", async () => {
		vi.mocked(planCanvasProjectsBeforeFileOperation).mockResolvedValue({
			affectedProjects: [],
			repairedFileIds: [],
			repairedFiles: [],
			failures: [
				{ projectName: "Design", fileName: "magic.project.js", message: "read failed" },
			],
			saveFailures: [],
			hasFailures: true,
			hasSaveFailures: false,
			requiresConfirmation: true,
		})
		vi.mocked(MagicModal.confirm).mockImplementation((config) => {
			config.onOk?.()
			return undefined as never
		})

		const { result } = renderHook(() =>
			useCrossProjectFileOperation({
				projectId: "project-1",
				selectedWorkspace: null,
				selectedProject: null,
				projects: [],
			}),
		)

		await act(async () => {
			await result.current.executeMoveOperation({
				fileIds: ["folder-1"],
				targetProjectId: "project-2",
				targetPath: [],
				targetAttachments: [],
				sourceAttachments: [
					{
						file_id: "folder-1",
						file_name: "Design",
						is_directory: true,
						relative_file_path: "Design",
					},
				],
			})
		})

		expect(planCanvasProjectsBeforeFileOperation).toHaveBeenCalledWith(
			expect.objectContaining({
				fileIds: ["folder-1"],
				operation: "move",
				projectId: "project-1",
			}),
		)
		expect(commitCanvasProjectPathRepair).toHaveBeenCalledTimes(1)
		expect(SuperMagicApi.moveFile).toHaveBeenCalledTimes(1)
		expect(vi.mocked(SuperMagicApi.moveFile).mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(commitCanvasProjectPathRepair).mock.invocationCallOrder[0],
		)
	})

	it("跨项目移动路径修复保存失败时不阻断已成功的移动", async () => {
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
			failures: [
				{ projectName: "Design", fileName: "magic.project.js", message: "save failed" },
			],
			hasFailures: true,
			hasSaveFailures: true,
			saveFailures: [
				{ projectName: "Design", fileName: "magic.project.js", message: "save failed" },
			],
			requiresConfirmation: true,
		})

		const { result } = renderHook(() =>
			useCrossProjectFileOperation({
				projectId: "project-1",
				selectedWorkspace: null,
				selectedProject: null,
				projects: [],
			}),
		)

		await act(async () => {
			await result.current.executeMoveOperation({
				fileIds: ["folder-1"],
				targetProjectId: "project-2",
				targetPath: [],
				targetAttachments: [],
				sourceAttachments: [],
			})
		})

		expect(magicToast.error).toHaveBeenCalledWith(
			"topicFiles.canvasOperationRisk.pathRepairSaveFailed",
		)
		expect(SuperMagicApi.moveFile).toHaveBeenCalledTimes(1)
		expect(vi.mocked(SuperMagicApi.moveFile).mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(commitCanvasProjectPathRepair).mock.invocationCallOrder[0],
		)
	})

	it("copies the confirmed single-HTML static dependencies with the HTML file", async () => {
		const { result } = renderHook(() =>
			useCrossProjectFileOperation({
				projectId: "project-1",
				selectedWorkspace: null,
				selectedProject: null,
				projects: [],
			}),
		)

		await act(async () => {
			await result.current.executeCopyOperation({
				fileIds: ["file-1"],
				targetProjectId: "project-2",
				targetPath: [],
				targetAttachments: [],
				sourceAttachments,
				includeDocumentDependencies: true,
				documentDependencyFileIds: ["image-1"],
			})
		})

		expect(SuperMagicApi.copyFiles).toHaveBeenCalledWith(
			expect.objectContaining({
				file_ids: ["file-1", "image-1"],
				project_id: "project-1",
				target_project_id: "project-2",
			}),
		)
	})

	it("reports the target project after a successful copy", async () => {
		vi.useFakeTimers()
		const onSuccess = vi.fn()
		const { result } = renderHook(() =>
			useCrossProjectFileOperation({
				projectId: "project-1",
				selectedWorkspace: null,
				selectedProject: null,
				projects: [],
				onSuccess,
			}),
		)

		await act(async () => {
			await result.current.executeCopyOperation({
				fileIds: ["file-1"],
				targetProjectId: "project-2",
				targetWorkspaceId: "workspace-2",
				targetPath: [],
				targetAttachments: [],
				sourceAttachments,
			})
		})

		act(() => {
			vi.advanceTimersByTime(500)
		})

		expect(onSuccess).toHaveBeenCalledWith({
			operationType: "copy",
			fileIds: ["file-1"],
			targetProjectId: "project-2",
			targetWorkspaceId: "workspace-2",
			targetProjectName: undefined,
		})
		vi.useRealTimers()
	})

	it("preserves parent paths for a cross-project batch move when requested", async () => {
		const { result } = renderHook(() =>
			useCrossProjectFileOperation({
				projectId: "project-1",
				selectedWorkspace: null,
				selectedProject: null,
				projects: [],
			}),
		)

		await act(async () => {
			await result.current.executeMoveOperation({
				fileIds: ["file-1", "file-2"],
				targetProjectId: "project-2",
				targetPath: [],
				targetAttachments: [],
				sourceAttachments: [
					...sourceAttachments,
					{
						file_id: "file-2",
						file_name: "notes.md",
						is_directory: false,
						relative_file_path: "Docs/notes.md",
					},
				],
				includeDocumentDependencies: false,
				preserveParentPath: true,
			})
		})

		expect(SuperMagicApi.moveFiles).toHaveBeenCalledWith(
			expect.objectContaining({
				file_ids: ["file-1", "file-2"],
				preserve_parent_path: true,
			}),
		)
	})

	it("preserves parent paths for a cross-project batch copy when requested", async () => {
		const { result } = renderHook(() =>
			useCrossProjectFileOperation({
				projectId: "project-1",
				selectedWorkspace: null,
				selectedProject: null,
				projects: [],
			}),
		)

		await act(async () => {
			await result.current.executeCopyOperation({
				fileIds: ["file-1", "file-2"],
				targetProjectId: "project-2",
				targetPath: [],
				targetAttachments: [],
				sourceAttachments: [
					...sourceAttachments,
					{
						file_id: "file-2",
						file_name: "notes.md",
						is_directory: false,
						relative_file_path: "Docs/notes.md",
					},
				],
				includeDocumentDependencies: false,
				preserveParentPath: true,
			})
		})

		expect(SuperMagicApi.copyFiles).toHaveBeenCalledWith(
			expect.objectContaining({
				file_ids: ["file-1", "file-2"],
				preserve_parent_path: true,
			}),
		)
	})

	it("copies dependency folders when a nested HTML resource needs its directory structure", async () => {
		vi.mocked(resolveSingleDocumentStaticDependencies).mockResolvedValue({
			fileType: "html",
			dependencyFileIds: ["image-1"],
			dependencyTransferFileIds: ["assets-folder"],
			missingResourcePaths: [],
		})

		const { result } = renderHook(() =>
			useCrossProjectFileOperation({
				projectId: "project-1",
				selectedWorkspace: null,
				selectedProject: null,
				projects: [],
			}),
		)

		await act(async () => {
			await result.current.executeCopyOperation({
				fileIds: ["file-1"],
				targetProjectId: "project-2",
				targetPath: [],
				targetAttachments: [],
				sourceAttachments,
			})
		})

		expect(SuperMagicApi.copyFiles).toHaveBeenCalledWith(
			expect.objectContaining({
				file_ids: ["file-1", "assets-folder"],
			}),
		)
	})

	it("warns when dependency analysis falls back to the selected HTML file", async () => {
		vi.mocked(resolveSingleDocumentStaticDependencies).mockRejectedValue(
			new Error("dependency analysis failed"),
		)

		const { result } = renderHook(() =>
			useCrossProjectFileOperation({
				projectId: "project-1",
				selectedWorkspace: null,
				selectedProject: null,
				projects: [],
			}),
		)

		await act(async () => {
			await result.current.executeCopyOperation({
				fileIds: ["file-1"],
				targetProjectId: "project-2",
				targetPath: [],
				targetAttachments: [],
				sourceAttachments,
			})
		})

		expect(magicToast.warning).toHaveBeenCalledWith("share.documentDependenciesAnalysisFailed")
		expect(SuperMagicApi.copyFiles).toHaveBeenCalledWith(
			expect.objectContaining({ file_ids: ["file-1"] }),
		)
	})
})
