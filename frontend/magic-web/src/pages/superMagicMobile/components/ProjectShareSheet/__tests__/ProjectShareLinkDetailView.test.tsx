import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ShareMode, ShareType } from "@/pages/superMagic/components/Share/types"
import ProjectShareLinkDetailView from "../components/ProjectShareLinkDetailView"
import type { ProjectShareSheetController } from "../types"

vi.mock("@/pages/superMagic/components/ShareManagement/utils/shareTypeHelpers", async () => {
	const actual = await vi.importActual<
		typeof import("@/pages/superMagic/components/ShareManagement/utils/shareTypeHelpers")
	>("@/pages/superMagic/components/ShareManagement/utils/shareTypeHelpers")

	return {
		...actual,
		generateShareUrl: () => "https://example.com/share-1?password=abc123",
	}
})

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, values?: Record<string, unknown>) => {
			const labels: Record<string, string> = {
				"projectShare.copyLink": "复制链接",
				"projectShare.deleteLink": "删除链接",
				"projectShare.expiresPermanent": "永久有效",
				"projectShare.linkLabel": "链接",
				"projectShare.typePassword": "密码",
				"projectShare.typePasswordDescription": "需要密码访问的分享链接",
				"share.accessPassword": "访问密码",
				"share.copyPassword": "复制密码",
				"share.hidePassword": "隐藏密码",
				"share.showPassword": "显示密码",
			}
			if (key === "projectShare.fileCount" && typeof values?.count === "number") {
				return `${values.count} 个文件`
			}
			if (key === "projectShare.selectedFilesCount" && typeof values?.count === "number") {
				return `${values.count} 个文件`
			}
			return labels[key] || key
		},
	}),
}))

/**
 * 构造详情页所需的最小 controller，避免测试触达真实分享接口。
 */
function createController(
	overrides: Partial<ProjectShareSheetController> = {},
): ProjectShareSheetController {
	return {
		open: true,
		view: "linkDetail",
		viewStack: ["create"],
		mode: "project",
		shareMode: ShareMode.Project,
		projectName: "Demo Project",
		projectId: "project-1",
		formState: {
			shareName: "",
			shareType: ShareType.PasswordProtected,
			shareExpiry: null,
			password: "abc123",
			shareRange: "all",
			shareTargets: [],
			advancedSettings: {},
		},
		filteredShareItems: [],
		selectedShare: {
			resource_id: "share-1",
			title: "客户演示",
			project_id: "project-1",
			project_name: "Demo Project",
			share_type: ShareType.PasswordProtected,
			created_at: "2026-05-05T00:00:00.000Z",
			has_password: true,
			password: "abc123",
			extend: { file_count: 3 },
		},
		loading: false,
		saving: false,
		isCheckingShare: false,
		advancedOpen: false,
		defaultSelectedFileIds: ["file-1"],
		selectedFileItems: [],
		selectedFileHierarchy: [],
		selectedFileCount: 0,
		memberSelectorOpen: false,
		selectedMemberNodes: [],
		setShareName: vi.fn(),
		setShareType: vi.fn(),
		setShareExpiry: vi.fn(),
		setPassword: vi.fn(),
		resetPassword: vi.fn(),
		setShareRange: vi.fn(),
		setShareTargets: vi.fn(),
		setAdvancedSettings: vi.fn(),
		setAdvancedOpen: vi.fn(),
		openMemberSelector: vi.fn(),
		closeMemberSelector: vi.fn(),
		setSelectedMemberNodes: vi.fn(),
		confirmMemberSelector: vi.fn(),
		goToManage: vi.fn(),
		goToExpiry: vi.fn(),
		goToDeleteConfirm: vi.fn(),
		goToLinkDetail: vi.fn(),
		goBack: vi.fn(),
		close: vi.fn(),
		refreshShareList: vi.fn(),
		copySelectedShareUrl: vi.fn(),
		copySelectedSharePassword: vi.fn(),
		submitCreateShare: vi.fn(async () => undefined),
		openEditSelectedShare: vi.fn(),
		confirmCancelShare: vi.fn(async () => undefined),
		editResourceId: undefined,
		closeEditModal: vi.fn(),
		...overrides,
	}
}

describe("ProjectShareLinkDetailView", () => {
	it("展示原型结构的详情信息，并移除旧编辑按钮", () => {
		const controller = createController()

		render(<ProjectShareLinkDetailView controller={controller} />)

		expect(screen.getByTestId("project-share-sheet-detail-type-card")).toHaveTextContent(
			"需要密码访问的分享链接",
		)
		expect(screen.getByTestId("project-share-sheet-detail-link-card")).toHaveTextContent(
			"https://example.com/share-1?password=abc123",
		)
		expect(screen.getByTestId("project-share-sheet-copy-password-button")).toHaveTextContent(
			"复制密码",
		)
		expect(screen.queryByTestId("project-share-sheet-edit-button")).not.toBeInTheDocument()
		expect(screen.getByTestId("project-share-sheet-delete-button")).toHaveTextContent(
			"删除链接",
		)
	})

	it("点击详情页底部删除按钮进入删除确认视图", () => {
		const controller = createController()

		render(<ProjectShareLinkDetailView controller={controller} />)
		fireEvent.click(screen.getByTestId("project-share-sheet-delete-button"))

		expect(controller.goToDeleteConfirm).toHaveBeenCalled()
	})

	it("访问密码默认按原型展示为密文，并支持点击眼睛切换明文", () => {
		const controller = createController()

		render(<ProjectShareLinkDetailView controller={controller} />)

		expect(screen.getByTestId("project-share-sheet-password-value")).toHaveTextContent(
			"• • • • • •",
		)

		fireEvent.click(screen.getByTestId("project-share-sheet-password-visibility-button"))

		expect(screen.getByTestId("project-share-sheet-password-value")).toHaveTextContent("abc123")
	})

	it("文件模式详情页会展示固定文案的已选文件区块，并支持展开子文件夹", () => {
		render(
			<ProjectShareLinkDetailView
				controller={createController({
					mode: "file",
					shareMode: ShareMode.File,
					selectedFileCount: 3,
					selectedFileItems: [
						{ file_id: "folder-1", name: "测试画布", is_directory: true },
					],
					selectedFileHierarchy: [
						{
							id: "folder-1",
							name: "测试画布",
							isDirectory: true,
							children: [
								{
									id: "file-1",
									name: "需求文档.md",
									isDirectory: false,
									children: [],
								},
								{
									id: "folder-2",
									name: "素材",
									isDirectory: true,
									children: [
										{
											id: "file-2",
											name: "原型图.png",
											isDirectory: false,
											children: [],
										},
										{
											id: "file-3",
											name: "说明.txt",
											isDirectory: false,
											children: [],
										},
									],
								},
							],
						},
					],
				})}
			/>,
		)

		const trigger = screen.getByTestId("project-share-sheet-selected-files-trigger")
		expect(trigger).toHaveTextContent("projectShare.selectedFilesLabel")
		expect(trigger).toHaveTextContent("3")

		fireEvent.click(trigger)
		fireEvent.click(screen.getByTestId("project-share-sheet-selected-file-row-folder-1"))
		fireEvent.click(screen.getByTestId("project-share-sheet-selected-file-row-folder-2"))

		expect(screen.getByText("需求文档.md")).toBeInTheDocument()
		expect(screen.getByText("原型图.png")).toBeInTheDocument()
		expect(screen.getByText("说明.txt")).toBeInTheDocument()
	})
})
