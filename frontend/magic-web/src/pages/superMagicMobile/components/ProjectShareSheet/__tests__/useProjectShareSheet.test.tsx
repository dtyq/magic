import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NodeType } from "@dtyq/user-selector"
import { ResourceType, ShareMode, ShareType } from "@/pages/superMagic/components/Share/types"
import { SharePermissionResourceProvider } from "@/pages/superMagic/components/Share/SharePermissionResourceContext"
import type {
	FileShareItem,
	ProjectShareItem,
} from "@/pages/superMagic/components/ShareManagement/types"
import { useProjectShareSheet } from "../hooks/useProjectShareSheet"

const mocks = vi.hoisted(() => ({
	refreshData: vi.fn(),
	cancelShare: vi.fn(),
	createOrUpdateShareResource: vi.fn(),
	getSnowflakeIds: vi.fn(),
	getShareInfoByCode: vi.fn(),
	getShareResourceMembers: vi.fn(),
	batchGetFileDetails: vi.fn(),
	writeText: vi.fn(),
	successToast: vi.fn(),
	errorToast: vi.fn(),
	warningToast: vi.fn(),
	canUseNativeShare: vi.fn(),
	shareToNativeTarget: vi.fn(),
	resolveShareDocumentDependencies: vi.fn(),
	track: vi.fn(),
	projectShareData: [] as ProjectShareItem[],
	fileShareData: [] as FileShareItem[],
	useShareDataCalls: [] as Array<{ resourceType: string; enabled?: boolean }>,
	functionPermissions: {} as Record<string, boolean>,
}))

vi.hoisted(() => {
	const storageMock = {
		getItem: () => null,
		setItem: vi.fn(),
		removeItem: vi.fn(),
		clear: vi.fn(),
		key: vi.fn(),
		length: 0,
	}

	Object.defineProperty(globalThis, "localStorage", {
		value: storageMock,
		configurable: true,
	})
	Object.defineProperty(globalThis, "sessionStorage", {
		value: storageMock,
		configurable: true,
	})
})

vi.mock("@/services/analytics", () => ({
	analyticsService: { report: mocks.track },
}))

vi.mock("@/apis", () => ({
	FUNCTION_PERMISSION_CODE: {
		MicroAppSharePassword: "micro_app.share_password",
		MicroAppSharePublic: "micro_app.share_public",
		MicroAppShareTeam: "micro_app.share_team",
		ProjectSharePassword: "project.share_password",
		ProjectSharePublic: "project.share_public",
		ProjectShareTeam: "project.share_team",
	},
	SuperMagicApi: {
		getSnowflakeIds: mocks.getSnowflakeIds,
		getShareInfoByCode: mocks.getShareInfoByCode,
		getShareResourceMembers: mocks.getShareResourceMembers,
		createOrUpdateShareResource: mocks.createOrUpdateShareResource,
		batchGetFileDetails: mocks.batchGetFileDetails,
	},
}))

vi.mock("@/hooks/useFunctionPermission", () => ({
	useFunctionPermissions: () => ({
		data: mocks.functionPermissions,
		error: undefined,
		isLoading: false,
		mutate: vi.fn(),
	}),
}))

vi.mock(
	"@/pages/superMagic/components/Share/FileShareModal/hooks/resolveShareDocumentDependencies",
	() => ({
		resolveShareDocumentDependencies: mocks.resolveShareDocumentDependencies,
	}),
)

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

vi.mock("@/pages/superMagic/components/Share/utils/nativeShare", () => ({
	canUseNativeShare: mocks.canUseNativeShare,
	shareToNativeTarget: mocks.shareToNativeTarget,
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
	useShareData: (params: { resourceType: string; enabled?: boolean }) => {
		mocks.useShareDataCalls.push(params)

		return {
			data: params.resourceType === "project" ? mocks.projectShareData : mocks.fileShareData,
			total:
				params.resourceType === "project"
					? mocks.projectShareData.length
					: mocks.fileShareData.length,
			loading: false,
			refreshData: mocks.refreshData,
			cancelShare: mocks.cancelShare,
			batchCancelShare: vi.fn(),
		}
	},
}))

vi.mock("react-i18next", () => ({
	initReactI18next: {
		type: "3rdParty",
		init: () => undefined,
	},
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
		mocks.useShareDataCalls = []
		mocks.functionPermissions = {
			"project.share_password": true,
			"project.share_public": true,
			"project.share_team": true,
		}
		mocks.getSnowflakeIds.mockResolvedValue({ ids: ["share-1"] })
		mocks.getShareInfoByCode.mockResolvedValue({})
		mocks.getShareResourceMembers.mockResolvedValue({ members: [] })
		mocks.createOrUpdateShareResource.mockResolvedValue({})
		mocks.batchGetFileDetails.mockResolvedValue({ files: [] })
		mocks.cancelShare.mockResolvedValue(undefined)
		mocks.canUseNativeShare.mockReturnValue(false)
		mocks.shareToNativeTarget.mockResolvedValue("shared")
		mocks.resolveShareDocumentDependencies.mockResolvedValue({
			dependencyFileIds: [],
			missingResourcePaths: [],
		})
	})

	it("Sheet 关闭或无 projectId 时不启用分享列表拉取", () => {
		renderHook(() =>
			useProjectShareSheet({
				open: false,
				projectId: "project-1",
				projectName: "Demo Project",
				attachments: [],
				mode: "project",
				onClose: vi.fn(),
			}),
		)

		expect(mocks.useShareDataCalls.every((call) => call.enabled === false)).toBe(true)
	})

	it("Sheet 打开且有 projectId 时启用分享列表拉取", () => {
		renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "project-1",
				projectName: "Demo Project",
				attachments: [],
				mode: "project",
				onClose: vi.fn(),
			}),
		)

		expect(mocks.useShareDataCalls.every((call) => call.enabled === true)).toBe(true)
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

	it("项目分享前两项被关闭时默认选中剩余的团队内分享", async () => {
		mocks.functionPermissions = {
			"project.share_password": false,
			"project.share_public": false,
			"project.share_team": true,
		}

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

		await waitFor(() => {
			expect(result.current.permittedShareTypes).toEqual([ShareType.Organization])
			expect(result.current.formState.shareType).toBe(ShareType.Organization)
			expect(result.current.isSelectedShareTypePermitted).toBe(true)
		})
	})

	it("单个文件分享同步应用项目分享方式权限", async () => {
		mocks.functionPermissions = {
			"project.share_password": false,
			"project.share_public": true,
			"project.share_team": false,
		}

		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "project-1",
				projectName: "Demo Project",
				attachments: [{ file_id: "file-1", file_name: "demo.md", is_directory: false }],
				defaultSelectedFileIds: ["file-1"],
				mode: "file",
				onClose: vi.fn(),
			}),
		)

		await waitFor(() => {
			expect(result.current.permittedShareTypes).toEqual([ShareType.Public])
			expect(result.current.formState.shareType).toBe(ShareType.Public)
			expect(result.current.isSelectedShareTypePermitted).toBe(true)
		})
	})

	it("微应用内文件分享使用微应用分享方式权限", async () => {
		mocks.functionPermissions = {
			"micro_app.share_password": false,
			"micro_app.share_public": false,
			"micro_app.share_team": true,
			"project.share_password": true,
			"project.share_public": false,
			"project.share_team": false,
		}

		const { result } = renderHook(
			() =>
				useProjectShareSheet({
					open: true,
					projectId: "project-1",
					projectName: "Demo Project",
					attachments: [{ file_id: "file-1", file_name: "demo.md", is_directory: false }],
					defaultSelectedFileIds: ["file-1"],
					mode: "file",
					onClose: vi.fn(),
				}),
			{
				wrapper: ({ children }) => (
					<SharePermissionResourceProvider value="microApp">
						{children}
					</SharePermissionResourceProvider>
				),
			},
		)

		await waitFor(() => {
			expect(result.current.permittedShareTypes).toEqual([ShareType.Organization])
			expect(result.current.formState.shareType).toBe(ShareType.Organization)
			expect(result.current.isSelectedShareTypePermitted).toBe(true)
		})
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

		await waitFor(() => {
			expect(result.current.selectedShareMessageText).toBeTruthy()
		})

		await act(async () => {
			await result.current.copySelectedShareUrl()
		})

		expect(mocks.writeText).toHaveBeenCalled()
		const copiedText = String(mocks.writeText.mock.calls[0]?.[0])
		expect(copiedText).not.toMatch(/^https?:\/\//)
		expect(copiedText.length).toBeGreaterThan(1)
	})

	it("单文件详情打开时预加载分享文案，点击复制时不再请求文件详情", async () => {
		mocks.fileShareData = [
			{
				resource_id: "fictional-share-1",
				title: "Fictional File Share",
				project_id: "fictional-project-1",
				project_name: "Fictional Project",
				workspace_id: "fictional-workspace-1",
				workspace_name: "Fictional Workspace",
				resource_type: ResourceType.FileCollection,
				share_type: ShareType.PasswordProtected,
				created_at: "2026-05-05",
				has_password: true,
				password: "FAKE12",
				share_project: false,
				file_ids: ["fictional-file-1"],
				extend: { file_count: 1 },
			},
		]
		mocks.batchGetFileDetails.mockResolvedValue({
			files: [{ display_config: { type: "slide" } }],
		})

		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "fictional-project-1",
				projectName: "Fictional Project",
				attachments: [],
				mode: "file",
				onClose: vi.fn(),
			}),
		)

		act(() => {
			result.current.goToLinkDetail("fictional-share-1")
		})

		await waitFor(() => {
			expect(mocks.batchGetFileDetails).toHaveBeenCalledTimes(1)
			expect(result.current.selectedShareMessageText).toBeTruthy()
		})

		await act(async () => {
			await result.current.copySelectedShareUrl()
		})

		expect(mocks.batchGetFileDetails).toHaveBeenCalledTimes(1)
		expect(mocks.writeText).toHaveBeenCalledWith(result.current.selectedShareMessageText)
	})

	it("快速切换分享记录时不会复制上一条记录的预加载文案", async () => {
		mocks.fileShareData = [
			{
				resource_id: "fictional-share-a",
				title: "Fictional Share A",
				project_id: "fictional-project-1",
				project_name: "Fictional Project",
				workspace_id: "fictional-workspace-1",
				workspace_name: "Fictional Workspace",
				resource_type: ResourceType.FileCollection,
				share_type: ShareType.PasswordProtected,
				created_at: "2026-05-05",
				has_password: true,
				password: "FAKEA1",
				share_project: false,
				file_ids: ["fictional-file-a"],
				extend: { file_count: 1 },
			},
			{
				resource_id: "fictional-share-b",
				title: "Fictional Share B",
				project_id: "fictional-project-1",
				project_name: "Fictional Project",
				workspace_id: "fictional-workspace-1",
				workspace_name: "Fictional Workspace",
				resource_type: ResourceType.FileCollection,
				share_type: ShareType.PasswordProtected,
				created_at: "2026-05-06",
				has_password: true,
				password: "FAKEB2",
				share_project: false,
				file_ids: ["fictional-file-b"],
				extend: { file_count: 1 },
			},
		]

		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "fictional-project-1",
				projectName: "Fictional Project",
				attachments: [],
				mode: "file",
				onClose: vi.fn(),
			}),
		)

		act(() => {
			result.current.goToLinkDetail("fictional-share-a")
		})

		await waitFor(() => {
			expect(result.current.selectedShareMessageText).toBeTruthy()
		})

		// Hold the second payload build open to verify the first share text cannot leak through.
		let resolveSecondFileDetails: (value: { files: [] }) => void = () => undefined
		mocks.batchGetFileDetails.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveSecondFileDetails = resolve
				}),
		)

		act(() => {
			result.current.goToLinkDetail("fictional-share-b")
		})

		expect(result.current.selectedShareMessageText).toBe("")
		await act(async () => {
			await result.current.copySelectedShareUrl()
		})
		expect(mocks.writeText).not.toHaveBeenCalled()

		await act(async () => {
			resolveSecondFileDetails({ files: [] })
		})
		await waitFor(() => {
			expect(result.current.selectedShareMessageText).toBeTruthy()
		})
	})

	it("详情页系统分享使用预先构建的分享文案", async () => {
		mocks.canUseNativeShare.mockReturnValue(true)
		mocks.fileShareData = [
			{
				resource_id: "fictional-native-share",
				title: "Fictional Native Share",
				project_id: "fictional-project-1",
				project_name: "Fictional Project",
				workspace_id: "",
				workspace_name: "",
				resource_type: ResourceType.FileCollection,
				share_type: ShareType.PasswordProtected,
				created_at: "2026-05-05",
				has_password: true,
				password: "FAKE12",
				share_project: false,
				file_ids: ["fictional-file-1"],
				extend: { file_count: 1 },
			},
		]

		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "fictional-project-1",
				projectName: "Fictional Project",
				attachments: [],
				mode: "file",
				onClose: vi.fn(),
			}),
		)

		act(() => {
			result.current.goToLinkDetail("fictional-native-share")
		})

		await waitFor(() => {
			expect(result.current.selectedShareMessageText).toBeTruthy()
		})

		await act(async () => {
			await result.current.shareSelectedShareToSystem()
		})

		expect(mocks.shareToNativeTarget).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "Fictional Native Share",
				text: result.current.selectedShareMessageText,
			}),
		)
		expect(mocks.errorToast).not.toHaveBeenCalled()
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
		expect(result.current.viewStack).toEqual([])
		expect(mocks.track).toHaveBeenCalledTimes(1)
		expect(mocks.track).toHaveBeenCalledWith("content_share_attempted", {
			resourceType: ResourceType.FileCollection,
			shareProject: true,
		})
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
		expect(mocks.createOrUpdateShareResource.mock.calls.at(-1)?.[0]).not.toHaveProperty(
			"password",
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
		expect(mocks.track).toHaveBeenCalledTimes(1)
		expect(mocks.track).toHaveBeenCalledWith("content_share_attempted", {
			resourceType: ResourceType.FileCollection,
			shareProject: false,
		})
	})

	it("文件模式未传默认打开文件时会从已选范围内自动计算并提交", async () => {
		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "fictional-project-1",
				projectName: "Fictional Project",
				attachments: [
					{
						file_id: "folder-1",
						name: "Fictional Folder",
						is_directory: true,
						children: [
							{
								file_id: "file-1",
								name: "index.html",
								file_name: "index.html",
								file_extension: "html",
								is_directory: false,
							},
							{
								file_id: "file-2",
								name: "fictional-note.txt",
								file_name: "fictional-note.txt",
								file_extension: "txt",
								is_directory: false,
							},
						],
					},
				],
				mode: "file",
				defaultSelectedFileIds: ["folder-1"],
				onClose: vi.fn(),
			}),
		)

		expect(result.current.defaultOpenFileId).toBe("file-1")
		expect(result.current.defaultOpenFileItem?.file_id).toBe("file-1")

		await act(async () => {
			await result.current.submitCreateShare()
		})

		expect(mocks.createOrUpdateShareResource).toHaveBeenCalledWith(
			expect.objectContaining({
				file_ids: ["folder-1"],
				default_open_file_id: "file-1",
			}),
		)
	})

	it("文件模式会保留已选文件夹子级中的外部默认打开文件", async () => {
		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "fictional-project-1",
				projectName: "Fictional Project",
				attachments: [
					{
						file_id: "folder-1",
						name: "Fictional Folder",
						is_directory: true,
						children: [
							{
								file_id: "file-1",
								name: "index.html",
								file_name: "index.html",
								file_extension: "html",
								is_directory: false,
							},
							{
								file_id: "file-2",
								name: "fictional-note.txt",
								file_name: "fictional-note.txt",
								file_extension: "txt",
								is_directory: false,
							},
						],
					},
				],
				mode: "file",
				defaultSelectedFileIds: ["folder-1"],
				defaultOpenFileId: "file-2",
				onClose: vi.fn(),
			}),
		)

		expect(result.current.defaultOpenFileId).toBe("file-2")
		expect(result.current.defaultOpenFileItem?.file_id).toBe("file-2")

		await act(async () => {
			await result.current.submitCreateShare()
		})

		expect(mocks.createOrUpdateShareResource).toHaveBeenCalledWith(
			expect.objectContaining({
				default_open_file_id: "file-2",
			}),
		)
	})

	it("文件模式外部默认打开文件为普通文件夹时会回退到文件夹内可打开文件", async () => {
		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "fictional-project-1",
				projectName: "Fictional Project",
				attachments: [
					{
						file_id: "folder-1",
						name: "Fictional Folder",
						is_directory: true,
						children: [
							{
								file_id: "file-1",
								name: "index.html",
								file_name: "index.html",
								file_extension: "html",
								is_directory: false,
							},
						],
					},
				],
				mode: "file",
				defaultSelectedFileIds: ["folder-1"],
				defaultOpenFileId: "folder-1",
				onClose: vi.fn(),
			}),
		)

		expect(result.current.defaultOpenFileId).toBe("file-1")
		expect(result.current.defaultOpenFileItem?.file_id).toBe("file-1")

		await act(async () => {
			await result.current.submitCreateShare()
		})

		expect(mocks.createOrUpdateShareResource).toHaveBeenCalledWith(
			expect.objectContaining({
				default_open_file_id: "file-1",
			}),
		)
	})

	it("项目模式会从项目附件中自动计算默认打开文件并提交", async () => {
		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "fictional-project-1",
				projectName: "Fictional Project",
				attachments: [
					{
						file_id: "folder-1",
						name: "Fictional Folder",
						is_directory: true,
						children: [
							{
								file_id: "file-1",
								name: "index.html",
								file_name: "index.html",
								file_extension: "html",
								is_directory: false,
							},
							{
								file_id: "file-2",
								name: "fictional-note.txt",
								file_name: "fictional-note.txt",
								file_extension: "txt",
								is_directory: false,
							},
						],
					},
				],
				mode: "project",
				onClose: vi.fn(),
			}),
		)

		expect(result.current.defaultOpenFileId).toBe("file-1")
		expect(result.current.defaultOpenFileItem?.file_id).toBe("file-1")
		expect(result.current.defaultOpenFileCandidates.map((item) => item.file_id)).toEqual([
			"file-1",
			"file-2",
		])

		await act(async () => {
			await result.current.submitCreateShare()
		})

		expect(mocks.createOrUpdateShareResource).toHaveBeenCalledWith(
			expect.objectContaining({
				share_project: true,
				default_open_file_id: "file-1",
			}),
		)
	})

	it("用户选择默认打开文件后会更新当前值并在提交时使用用户选择", async () => {
		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "fictional-project-1",
				projectName: "Fictional Project",
				attachments: [
					{
						file_id: "file-1",
						name: "index.html",
						file_name: "index.html",
						file_extension: "html",
						is_directory: false,
					},
					{
						file_id: "file-2",
						name: "fictional-note.txt",
						file_name: "fictional-note.txt",
						file_extension: "txt",
						is_directory: false,
					},
				],
				mode: "file",
				defaultSelectedFileIds: ["file-1", "file-2"],
				onClose: vi.fn(),
			}),
		)

		expect(result.current.defaultOpenFileId).toBe("file-1")

		act(() => {
			result.current.selectDefaultOpenFile("file-2")
		})

		expect(result.current.defaultOpenFileId).toBe("file-2")
		expect(result.current.defaultOpenFileItem?.file_id).toBe("file-2")
		expect(result.current.defaultOpenFilePickerOpen).toBe(false)

		await act(async () => {
			await result.current.submitCreateShare()
		})

		expect(mocks.createOrUpdateShareResource).toHaveBeenCalledWith(
			expect.objectContaining({
				file_ids: ["file-1", "file-2"],
				default_open_file_id: "file-2",
			}),
		)
	})

	it("录音分享场景创建分享时只会自动补齐 magic.project.js，音频仍保持默认勾选但不再强制注入", async () => {
		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "project-1",
				projectName: "Demo Project",
				attachments: [],
				mode: "file",
				projectMode: "audio",
				fileMap: {
					audio: { file_id: "file-audio", file_name: "session.wav" },
					transcript: { file_id: "file-transcript", file_name: "session-transcript.md" },
					magicProject: {
						file_id: "file-magic-project",
						file_name: "magic.project.js",
					},
					summaryFiles: [],
				},
				onClose: vi.fn(),
			}),
		)

		act(() => {
			result.current.setShareName("Recording Share")
			result.current.setSelectedFileIds(["file-transcript"])
		})

		await act(async () => {
			await result.current.submitCreateShare()
		})

		expect(mocks.createOrUpdateShareResource).toHaveBeenCalledWith(
			expect.objectContaining({
				share_project: false,
				project_id: "project-1",
				file_ids: ["file-transcript", "file-magic-project"],
			}),
		)
	})

	it("bundle 未就绪时仍允许提交当前选择并补齐必需文件", async () => {
		const dependencyAttachments = [
			{ file_id: "fake-transcript-id", file_name: "fake-transcript.md" },
		]
		const fileMap = {
			transcript: { file_id: "fake-transcript-id", file_name: "fake-transcript.md" },
			magicProject: {
				file_id: "fake-project-config-id",
				file_name: "magic.project.js",
			},
			summaryFiles: [],
		}
		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "fake-project-id",
				projectName: "Fake Recording",
				attachments: [],
				mode: "file",
				projectMode: "audio",
				dependencyAttachments,
				fileMap,
				defaultSelectedFileIds: ["fake-transcript-id"],
				onClose: vi.fn(),
			}),
		)

		act(() => {
			result.current.setSelectedFileIds(["fake-transcript-id"])
		})

		await act(async () => {
			await result.current.submitCreateShare()
		})

		expect(mocks.resolveShareDocumentDependencies).not.toHaveBeenCalled()
		expect(mocks.createOrUpdateShareResource).toHaveBeenCalledWith(
			expect.objectContaining({
				file_ids: ["fake-transcript-id", "fake-project-config-id"],
			}),
		)
	})

	it("bundle 就绪后会等待依赖分析并追加依赖文件", async () => {
		mocks.resolveShareDocumentDependencies.mockResolvedValue({
			dependencyFileIds: ["fake-image-id"],
			missingResourcePaths: [],
		})
		const dependencyAttachments = [
			{ file_id: "fake-transcript-id", file_name: "fake-transcript.md" },
			{ file_id: "fake-image-id", file_name: "fake-image.png" },
		]
		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "fake-project-id",
				projectName: "Fake Recording",
				attachments: [],
				mode: "file",
				projectMode: "audio",
				dependencyAttachments,
				dependencyBundleRootPath: "fake-recording-bundle",
				fileMap: {
					transcript: { file_id: "fake-transcript-id", file_name: "fake-transcript.md" },
					magicProject: {
						file_id: "fake-project-config-id",
						file_name: "magic.project.js",
					},
					summaryFiles: [],
				},
				defaultSelectedFileIds: ["fake-transcript-id"],
				onClose: vi.fn(),
			}),
		)

		act(() => {
			result.current.setSelectedFileIds(["fake-transcript-id"])
		})

		await waitFor(() => {
			expect(mocks.resolveShareDocumentDependencies).toHaveBeenCalledWith({
				selectedFileIds: ["fake-transcript-id"],
				attachments: dependencyAttachments,
				bundleRootPath: "fake-recording-bundle",
				requireBundleRootPath: true,
			})
		})

		await act(async () => {
			await result.current.submitCreateShare()
		})

		expect(mocks.createOrUpdateShareResource).toHaveBeenCalledWith(
			expect.objectContaining({
				file_ids: ["fake-transcript-id", "fake-image-id", "fake-project-config-id"],
			}),
		)
	})

	it("录音分享场景创建页默认使用录音分享文案，并在空名称提交时继续沿用该兜底", async () => {
		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "project-1",
				projectName: "季度复盘",
				attachments: [],
				mode: "file",
				projectMode: "audio",
				fileMap: {
					audio: { file_id: "file-audio", file_name: "meeting.wav" },
					transcript: { file_id: "file-transcript", file_name: "meeting-transcript.md" },
					magicProject: {
						file_id: "file-magic-project",
						file_name: "magic.project.js",
					},
					summaryFiles: [],
				},
				onClose: vi.fn(),
			}),
		)

		expect(result.current.formState.shareName).toBe("share.recordingShareName")

		act(() => {
			result.current.setShareName("")
		})

		await act(async () => {
			await result.current.submitCreateShare()
		})

		expect(mocks.createOrUpdateShareResource).toHaveBeenCalledWith(
			expect.objectContaining({
				resource_name: "share.recordingShareName",
			}),
		)
	})

	it("文件模式下查看整项目分享详情时，不使用当前勾选文件作为已选文件", async () => {
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
		await waitFor(() => {
			expect(result.current.selectedShareMessageText).toBeTruthy()
		})
	})

	it("打开组织分享详情时会请求成员列表并归一化节点 id", async () => {
		mocks.projectShareData = [
			{
				resource_id: "org-share-1",
				title: "组织分享",
				project_id: "project-1",
				project_name: "Demo Project",
				share_type: ShareType.Organization,
				created_at: "2026-05-05",
				has_password: false,
				extend: { file_count: 2 },
			},
		]
		mocks.getShareResourceMembers.mockResolvedValue({
			members: [
				{
					id: "legacy-user",
					user_id: "user-1",
					name: "User One",
					type: "User",
					dataType: NodeType.User,
					avatar_url: "https://static-legacy.dingtalk.com/avatar@100w_100h",
				},
				{
					id: "legacy-department",
					department_id: "department-1",
					name: "Design Team",
					type: "Department",
					dataType: NodeType.Department,
				},
			],
		})

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
			result.current.goToLinkDetail("org-share-1")
		})

		await waitFor(() => {
			expect(mocks.getShareResourceMembers).toHaveBeenCalledWith({
				resource_id: "org-share-1",
			})
		})

		await waitFor(() => {
			expect(result.current.detailMemberLoading).toBe(false)
			expect(result.current.detailMemberNodes).toEqual([
				expect.objectContaining({
					id: "user-1",
					name: "User One",
					avatar_url: "https://static-legacy.dingtalk.com/avatar",
				}),
				expect.objectContaining({
					id: "department-1",
					name: "Design Team",
				}),
			])
		})
	})

	it("打开组织全员分享详情时不会请求成员列表", async () => {
		mocks.projectShareData = [
			{
				resource_id: "org-share-all",
				title: "全员分享",
				project_id: "project-1",
				project_name: "Demo Project",
				share_type: ShareType.Organization,
				created_at: "2026-05-05",
				has_password: false,
				extend: { file_count: 2 },
				share_scope: { type: "all" },
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
			result.current.goToLinkDetail("org-share-all")
		})

		await waitFor(() => {
			expect(result.current.view).toBe("linkDetail")
		})

		expect(mocks.getShareResourceMembers).not.toHaveBeenCalled()
		expect(result.current.detailMemberNodes).toEqual([])
	})

	it("打开非组织分享详情时不会请求成员列表", async () => {
		mocks.projectShareData = [
			{
				resource_id: "password-share-1",
				title: "密码分享",
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
			result.current.goToLinkDetail("password-share-1")
		})

		await waitFor(() => {
			expect(result.current.view).toBe("linkDetail")
		})

		expect(mocks.getShareResourceMembers).not.toHaveBeenCalled()
		expect(result.current.detailMemberNodes).toEqual([])
	})

	it("编辑文件分享复用原资源并自动合并范围外的默认打开文件", async () => {
		mocks.fileShareData = [
			{
				resource_id: "fictional-file-share",
				title: "Fictional File Share",
				project_id: "fictional-project",
				project_name: "Fictional Project",
				workspace_id: "fictional-workspace",
				workspace_name: "Fictional Workspace",
				resource_type: ResourceType.FileCollection,
				share_type: ShareType.PasswordProtected,
				created_at: "2026-06-01",
				has_password: true,
				password: "FAKEPWD",
				share_project: false,
				file_ids: ["fictional-file-a"],
				extend: { file_count: 1 },
			},
		]
		mocks.getShareInfoByCode.mockResolvedValue({
			resource_name: "Fictional Edited Share",
			share_type: ShareType.PasswordProtected,
			password: "FAKEPWD2",
			file_ids: ["fictional-file-a"],
			default_open_file_id: "fictional-file-b",
			expire_days: 30,
			extra: { view_file_list: true },
		})

		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "fictional-project",
				projectName: "Fictional Project",
				mode: "file",
				attachments: [
					{ file_id: "fictional-file-a", name: "Fictional A", is_directory: false },
					{ file_id: "fictional-file-b", name: "Fictional B", is_directory: false },
				],
				onClose: vi.fn(),
			}),
		)

		act(() => result.current.goToLinkDetail("fictional-file-share"))
		await waitFor(() => expect(result.current.view).toBe("linkDetail"))

		act(() => result.current.openEditSelectedShare())
		await waitFor(() => {
			expect(result.current.view).toBe("edit")
			expect(result.current.editLoading).toBe(false)
		})

		expect(result.current.defaultOpenFileCandidates.map((item) => item.file_id)).toContain(
			"fictional-file-b",
		)
		await act(async () => result.current.submitCreateShare())

		expect(mocks.createOrUpdateShareResource).toHaveBeenLastCalledWith(
			expect.objectContaining({
				resource_id: "fictional-file-share",
				file_ids: ["fictional-file-a", "fictional-file-b"],
				default_open_file_id: "fictional-file-b",
				share_project: false,
			}),
		)
		expect(mocks.writeText).not.toHaveBeenCalled()
		expect(result.current.view).toBe("linkDetail")
		expect(mocks.track).not.toHaveBeenCalled()
	})

	it("进入移动端分享编辑时先清空上一条分享的选中文件", async () => {
		mocks.fileShareData = [
			{
				resource_id: "share-mobile-a",
				title: "Share A",
				project_id: "project-mobile",
				resource_type: ResourceType.FileCollection,
				share_type: ShareType.PasswordProtected,
				file_ids: ["file-mobile-a"],
			} as FileShareItem,
		]
		let resolveSettings!: (value: Record<string, unknown>) => void
		mocks.getShareInfoByCode.mockReturnValueOnce(
			new Promise((resolve) => {
				resolveSettings = resolve
			}),
		)

		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "project-mobile",
				projectName: "Mobile project",
				mode: "file",
				attachments: [{ file_id: "file-mobile-a", name: "File A", is_directory: false }],
				onClose: vi.fn(),
			}),
		)

		act(() => result.current.goToLinkDetail("share-mobile-a"))
		await waitFor(() => expect(result.current.view).toBe("linkDetail"))
		act(() => result.current.setSelectedFileIds(["file-mobile-a"]))

		act(() => result.current.openEditSelectedShare())
		expect(result.current.selectedFileIds).toEqual([])

		await act(async () => {
			resolveSettings({
				project_id: "project-mobile",
				resource_name: "Share A",
				share_type: ShareType.PasswordProtected,
				file_ids: ["file-mobile-a"],
				extra: {},
			})
		})
		await waitFor(() => expect(result.current.editLoading).toBe(false))
		expect(result.current.selectedFileIds).toEqual(["file-mobile-a"])
	})

	it("新建项目分享尝试时上报 content_share_attempted 且 shareProject 为 true", async () => {
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
		})

		await act(async () => {
			await result.current.submitCreateShare()
		})

		expect(mocks.track).toHaveBeenCalledTimes(1)
		expect(mocks.track).toHaveBeenCalledWith("content_share_attempted", {
			resourceType: ResourceType.FileCollection,
			shareProject: true,
		})
	})

	it("新建文件分享成功后上报 file", async () => {
		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "project-1",
				projectName: "Demo Project",
				attachments: [{ file_id: "file-1", name: "note.md", is_directory: false }],
				mode: "file",
				defaultSelectedFileIds: ["file-1"],
				onClose: vi.fn(),
			}),
		)

		act(() => {
			result.current.setShareName("File Share")
		})

		await act(async () => {
			await result.current.submitCreateShare()
		})

		expect(mocks.track).toHaveBeenCalledTimes(1)
		expect(mocks.track).toHaveBeenCalledWith("content_share_attempted", {
			resourceType: ResourceType.FileCollection,
			shareProject: false,
		})
	})

	it("编辑已有分享保存时不上报 content_share_attempted", async () => {
		mocks.fileShareData = [
			{
				resource_id: "existing-file-share",
				title: "Existing File Share",
				project_id: "project-1",
				project_name: "Demo Project",
				resource_type: ResourceType.FileCollection,
				share_type: ShareType.PasswordProtected,
				created_at: "2026-06-01",
				has_password: true,
				password: "abc123",
				share_project: false,
				file_ids: ["file-1"],
				extend: { file_count: 1 },
			},
		]
		mocks.getShareInfoByCode.mockResolvedValue({
			resource_name: "Existing File Share",
			share_type: ShareType.PasswordProtected,
			password: "abc123",
			file_ids: ["file-1"],
			extra: {},
		})

		const { result } = renderHook(() =>
			useProjectShareSheet({
				open: true,
				projectId: "project-1",
				projectName: "Demo Project",
				mode: "file",
				attachments: [{ file_id: "file-1", name: "note.md", is_directory: false }],
				onClose: vi.fn(),
			}),
		)

		act(() => result.current.goToLinkDetail("existing-file-share"))
		await waitFor(() => expect(result.current.view).toBe("linkDetail"))
		act(() => result.current.openEditSelectedShare())
		await waitFor(() => {
			expect(result.current.view).toBe("edit")
			expect(result.current.editLoading).toBe(false)
		})

		await act(async () => result.current.submitCreateShare())

		expect(mocks.createOrUpdateShareResource).toHaveBeenCalled()
		expect(mocks.track).not.toHaveBeenCalled()
	})

	it("新建分享失败时仍上报 content_share_attempted", async () => {
		mocks.createOrUpdateShareResource.mockRejectedValue(new Error("create failed"))

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
			result.current.setShareName("Broken Share")
		})

		await act(async () => {
			await result.current.submitCreateShare()
		})

		expect(mocks.errorToast).toHaveBeenCalled()
		expect(mocks.track).toHaveBeenCalledWith("content_share_attempted", {
			resourceType: ResourceType.FileCollection,
			shareProject: true,
		})
	})

	it("编辑指定成员后再确认选择器时仍按用户提交 target_type", async () => {
		mocks.projectShareData = [
			{
				resource_id: "org-share-edit",
				title: "组织分享",
				project_id: "project-1",
				project_name: "Demo Project",
				share_type: ShareType.Organization,
				created_at: "2026-05-05",
				has_password: false,
				extend: { file_count: 1 },
			},
		]
		mocks.getShareInfoByCode.mockResolvedValue({
			resource_name: "组织分享",
			share_type: ShareType.Organization,
			share_range: "designated",
			target_ids: [{ target_type: "User", target_id: "user-existing" }],
			file_ids: ["file-1"],
			extra: {},
		})
		mocks.getShareResourceMembers.mockResolvedValue({
			members: [
				{
					id: "member-row-1",
					user_id: "user-existing",
					name: "Existing Member",
					type: "User",
				},
			],
		})

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

		act(() => result.current.goToLinkDetail("org-share-edit"))
		await waitFor(() => expect(result.current.view).toBe("linkDetail"))

		act(() => result.current.openEditSelectedShare())
		await waitFor(() => {
			expect(result.current.view).toBe("edit")
			expect(result.current.editLoading).toBe(false)
			expect(result.current.selectedMemberNodes).toEqual([
				expect.objectContaining({
					id: "user-existing",
					dataType: NodeType.User,
				}),
			])
		})

		act(() => {
			result.current.confirmMemberSelector([
				{
					id: "user-existing",
					user_id: "user-existing",
					name: "Existing Member",
					type: "User",
				},
				{
					id: "user-added",
					name: "Added Member",
					dataType: NodeType.User,
				},
			] as never)
		})

		await act(async () => {
			await result.current.submitCreateShare()
		})

		expect(mocks.createOrUpdateShareResource).toHaveBeenLastCalledWith(
			expect.objectContaining({
				share_range: "designated",
				target_ids: [
					{ target_type: "User", target_id: "user-existing" },
					{ target_type: "User", target_id: "user-added" },
				],
			}),
		)
	})
})
