import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ResourceType, ShareMode, ShareType } from "@/pages/superMagic/components/Share/types"
import type {
	FileShareItem,
	ProjectShareItem,
} from "@/pages/superMagic/components/ShareManagement/types"
import { useProjectShareSheet } from "../hooks/useProjectShareSheet"
import { NodeType } from "@dtyq/user-selector"

const mocks = vi.hoisted(() => ({
	refreshData: vi.fn(),
	cancelShare: vi.fn(),
	createOrUpdateShareResource: vi.fn(),
	getSnowflakeIds: vi.fn(),
	writeText: vi.fn(),
	successToast: vi.fn(),
	errorToast: vi.fn(),
	warningToast: vi.fn(),
	projectShareData: [] as ProjectShareItem[],
	fileShareData: [] as FileShareItem[],
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getSnowflakeIds: mocks.getSnowflakeIds,
		createOrUpdateShareResource: mocks.createOrUpdateShareResource,
		batchGetFileDetails: vi.fn().mockResolvedValue({ files: [] }),
	},
}))

vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			userInfo: {
				nickname: "Tester",
				real_name: "Tester",
			},
		},
	},
}))

vi.mock("@/utils/clipboard-helpers", () => ({
	clipboard: {
		writeText: mocks.writeText,
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: mocks.successToast,
		error: mocks.errorToast,
		warning: mocks.warningToast,
	},
}))

vi.mock("@/pages/superMagic/layouts/MainLayout/hooks/useShareProject", () => ({
	useShareProject: () => ({
		shareModalOpen: false,
		defaultSelectedFileIds: ["file-1"],
		editingResourceId: undefined,
		similarSharesInfo: null,
		shareSuccessInfo: null,
		isCheckingShare: false,
		openShareModal: vi.fn(),
		closeShareModal: vi.fn(),
		closeSimilarSharesDialog: vi.fn(),
		closeSuccessModal: vi.fn(),
		handleSelectSimilarShare: vi.fn(),
		handleCreateNewShare: vi.fn(),
		handleCancelShare: vi.fn(),
		handleEditShare: vi.fn(),
	}),
}))

vi.mock("@/pages/superMagic/components/ShareManagement/hooks/useShareData", () => ({
	useShareData: (params: { resourceType: string }) => ({
		data: params.resourceType === "project" ? mocks.projectShareData : mocks.fileShareData,
		total:
			params.resourceType === "project"
				? mocks.projectShareData.length
				: mocks.fileShareData.length,
		loading: false,
		refreshData: mocks.refreshData,
		cancelShare: mocks.cancelShare,
		batchCancelShare: vi.fn(),
	}),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, values?: Record<string, unknown>) =>
			values?.days ? `${key}:${values.days}` : key,
	}),
}))

describe("useProjectShareSheet", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.projectShareData = []
		mocks.fileShareData = []
		mocks.getSnowflakeIds.mockResolvedValue({ ids: ["share-1"] })
		mocks.createOrUpdateShareResource.mockResolvedValue({})
		mocks.cancelShare.mockResolvedValue(undefined)
	})

	it("默认进入 create 视图，并支持切换到 manage 后回退", () => {
		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "project-1",
				projectName: "Demo Project",
				attachments: [],
				mode: "project",
				onClose: vi.fn(),
			}),
		)

		expect(result.current.view).toBe("create")

		act(() => {
			result.current.goToManage()
		})

		expect(result.current.view).toBe("manage")

		act(() => {
			result.current.goBack()
		})

		expect(result.current.view).toBe("create")
	})

	it("项目模式打开创建页时预填默认链接名称", () => {
		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "project-1",
				projectName: "Demo Project",
				attachments: [],
				mode: "project",
				onClose: vi.fn(),
			}),
		)

		expect(result.current.formState.shareName).toBe("share.projectShareName")
	})

	it("文件模式打开创建页时预填默认链接名称", () => {
		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "project-1",
				projectName: "Demo Project",
				attachments: [
					{
						file_id: "file-1",
						name: "深圳今日天气",
						is_directory: false,
					},
				],
				mode: "file",
				defaultSelectedFileIds: ["file-1"],
				defaultOpenFileId: "file-1",
				onClose: vi.fn(),
			}),
		)

		expect(result.current.formState.shareName).toBe("share.singleFileShareName")
	})

	it("详情页复制链接时写入多行分享文案而非裸 URL", async () => {
		mocks.fileShareData = [
			{
				resource_id: "share-multi",
				title: "文件分享_测试特殊文件",
				project_id: "project-1",
				project_name: "Demo Project",
				workspace_id: "",
				workspace_name: "",
				resource_type: ResourceType.FileCollection,
				share_type: ShareType.PasswordProtected,
				created_at: "2026-05-05",
				has_password: true,
				password: "1VP1RX",
				share_project: false,
				file_ids: Array.from({ length: 8 }, (_, index) => `file-${index + 1}`),
				extend: { file_count: 8 },
			},
		]

		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "project-1",
				projectName: "Demo Project",
				attachments: [],
				mode: "file",
				onClose: vi.fn(),
			}),
		)

		act(() => {
			result.current.goToLinkDetail("share-multi")
		})

		await act(async () => {
			await result.current.copySelectedShareUrl()
		})

		expect(mocks.writeText).toHaveBeenCalled()
		const copiedText = String(mocks.writeText.mock.calls[0]?.[0])
		expect(copiedText).not.toMatch(/^https?:\/\//)
		expect(copiedText.length).toBeGreaterThan(1)
	})

	it("创建分享时复用现有分享资源保存契约", async () => {
		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "project-1",
				projectName: "Demo Project",
				attachments: [],
				mode: "project",
				onClose: vi.fn(),
			}),
		)

		act(() => {
			result.current.setShareName("Demo Share")
			result.current.setShareType(ShareType.PasswordProtected)
		})

		await act(async () => {
			await result.current.submitCreateShare()
		})

		expect(mocks.createOrUpdateShareResource).toHaveBeenCalledWith(
			expect.objectContaining({
				resource_id: "share-1",
				resource_name: "Demo Share",
				share_project: true,
				project_id: "project-1",
				file_ids: ["file-1"],
			}),
		)
		expect(mocks.refreshData).toHaveBeenCalled()
		expect(mocks.writeText).toHaveBeenCalled()
		expect(String(mocks.writeText.mock.calls[0]?.[0])).not.toMatch(/^https?:\/\//)
		expect(result.current.view).toBe("linkDetail")
	})

	it("指定组织成员后创建分享时提交 designated 范围和目标成员", async () => {
		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "project-1",
				projectName: "Demo Project",
				attachments: [],
				mode: "project",
				onClose: vi.fn(),
			}),
		)

		act(() => {
			result.current.setShareType(ShareType.Organization)
			result.current.confirmMemberSelector([
				{
					id: "user-1",
					name: "User One",
					dataType: NodeType.User,
				},
			])
		})

		await act(async () => {
			await result.current.submitCreateShare()
		})

		expect(mocks.createOrUpdateShareResource).toHaveBeenCalledWith(
			expect.objectContaining({
				share_type: ShareType.Organization,
				share_range: "designated",
				target_ids: [
					{
						target_type: "User",
						target_id: "user-1",
					},
				],
			}),
		)
	})

	it("取消分享后刷新列表并回到 manage", async () => {
		mocks.projectShareData = [
			{
				resource_id: "share-1",
				title: "Demo Share",
				project_id: "project-1",
				project_name: "Demo Project",
				share_type: ShareType.PasswordProtected,
				created_at: "2026-05-05",
				has_password: true,
				password: "abc123",
				extend: { file_count: 2 },
			},
		]

		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "project-1",
				projectName: "Demo Project",
				attachments: [],
				mode: "project",
				onClose: vi.fn(),
			}),
		)

		act(() => {
			result.current.goToLinkDetail("share-1")
		})

		await act(async () => {
			await result.current.confirmCancelShare()
		})

		expect(mocks.cancelShare).toHaveBeenCalledWith("share-1")
		expect(mocks.refreshData).toHaveBeenCalled()
		expect(result.current.view).toBe("manage")
	})

	it("文件模式创建分享时提交指定 file_ids 且不是项目分享", async () => {
		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "project-1",
				projectName: "Demo Project",
				attachments: [
					{
						file_id: "folder-1",
						name: "测试画布",
						is_directory: true,
						children: [
							{
								file_id: "file-1",
								name: "需求文档.md",
								is_directory: false,
							},
							{
								file_id: "folder-2",
								name: "素材",
								is_directory: true,
								children: [
									{
										file_id: "file-2",
										name: "原型图.png",
										is_directory: false,
									},
								],
							},
						],
					},
				],
				mode: "file",
				defaultSelectedFileIds: ["folder-1"],
				defaultOpenFileId: "file-1",
				onClose: vi.fn(),
			}),
		)

		act(() => {
			result.current.setShareName("Selected Files Share")
			result.current.setShareType(ShareType.PasswordProtected)
		})

		await act(async () => {
			await result.current.submitCreateShare()
		})

		expect(mocks.createOrUpdateShareResource).toHaveBeenCalledWith(
			expect.objectContaining({
				resource_name: "Selected Files Share",
				share_project: false,
				project_id: "project-1",
				file_ids: ["folder-1"],
				default_open_file_id: "file-1",
			}),
		)
		expect(result.current.mode).toBe("file")
		expect(result.current.shareMode).toBe(ShareMode.File)
		expect(result.current.selectedFileCount).toBe(2)
		expect(result.current.selectedFileHierarchy).toEqual([
			expect.objectContaining({
				id: "folder-1",
				name: "测试画布",
				isDirectory: true,
			}),
		])
		expect(result.current.view).toBe("linkDetail")
	})

	it("文件模式下查看整项目分享详情时，不使用当前勾选文件作为已选文件", () => {
		mocks.fileShareData = [
			{
				resource_id: "project-share-1",
				title: "项目分享_Demo",
				project_id: "project-1",
				project_name: "Demo Project",
				workspace_id: "",
				workspace_name: "",
				resource_type: ResourceType.FileCollection,
				share_type: ShareType.PasswordProtected,
				created_at: "2026-05-05",
				has_password: true,
				share_project: true,
				file_ids: ["file-a", "file-b"],
				extend: { file_count: 259 },
			},
		]

		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "project-1",
				projectName: "Demo Project",
				attachments: [
					{
						file_id: "file-selected",
						name: "index.html",
						is_directory: false,
					},
				],
				mode: "file",
				defaultSelectedFileIds: ["file-selected"],
				onClose: vi.fn(),
			}),
		)

		act(() => {
			result.current.goToLinkDetail("project-share-1")
		})

		expect(result.current.selectedFileCount).toBe(0)
		expect(result.current.selectedFileHierarchy).toEqual([])
	})
})
