import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ShareType } from "@/pages/superMagic/components/Share/types"
import ProjectShareManageView from "../components/ProjectShareManageView"
import type { ProjectShareSheetController } from "../types"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		i18n: { language: "zh_CN" },
		t: (key: string, values?: Record<string, unknown>) => {
			const labels: Record<string, string> = {
				"projectShare.empty": "暂无分享链接",
				"projectShare.defaultNameOrganization": "组织分享",
				"projectShare.defaultNamePassword": "密码链接",
				"projectShare.defaultNamePublic": "公开链接",
				"projectShare.manageOrganizationDepartmentsOnly": "{{departmentCount}} 个部门",
				"projectShare.manageOrganizationMembersAndDepartments": "{{userCount}} 个成员，{{departmentCount}} 个部门",
				"projectShare.manageOrganizationMembersOnly": "{{userCount}} 个成员",
				"projectShare.manageOrganizationSummary": "组织成员可访问",
				"projectShare.managePasswordSummary": "需要密码访问",
				"projectShare.managePublicSummary": "获得链接的人可访问",
				"projectShare.shareScopeAllMembers": "所有成员",
			}
			if (key === "projectShare.manageOrganizationMembersAndDepartments") {
				return `${values?.userCount} 个成员，${values?.departmentCount} 个部门`
			}
			if (key === "projectShare.manageOrganizationMembersOnly") {
				return `${values?.userCount} 个成员`
			}
			if (key === "projectShare.manageOrganizationDepartmentsOnly") {
				return `${values?.departmentCount} 个部门`
			}
			return labels[key] || key
		},
	}),
}))

vi.mock("@/utils/string", () => ({
	formatRelativeTime: () => (value: string) => `formatted:${value}`,
}))

/**
 * 构造管理页最小 controller，只验证列表展示和点击行为。
 */
function createController(
	overrides: Partial<ProjectShareSheetController> = {},
): ProjectShareSheetController {
	return {
		open: true,
		view: "manage",
		viewStack: ["create"],
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
		filteredShareItems: [
			{
				resource_id: "share-1",
				title: "客户演示",
				project_id: "project-1",
				project_name: "Demo Project",
				share_type: ShareType.PasswordProtected,
				created_at: "2026-05-05T00:00:00.000Z",
				has_password: true,
				password: "abc123",
				extend: { file_count: 2 },
			},
		],
		selectedShare: null,
		loading: false,
		saving: false,
		isCheckingShare: false,
		advancedOpen: false,
		defaultSelectedFileIds: [],
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

describe("ProjectShareManageView", () => {
	it("以原型卡片列表展示分享项，点击整行进入详情", () => {
		const controller = createController()

		render(<ProjectShareManageView controller={controller} />)

		expect(screen.getByTestId("project-share-sheet-manage-list")).toBeInTheDocument()
		expect(screen.getByTestId("project-share-sheet-manage-row")).toHaveTextContent("客户演示")
		expect(screen.getByTestId("project-share-sheet-manage-row")).toHaveTextContent(
			"需要密码访问",
		)
		expect(screen.getByTestId("project-share-sheet-manage-row")).toHaveTextContent(
			"formatted:2026-05-05T00:00:00.000Z",
		)
		expect(screen.getByTestId("project-share-sheet-manage-row")).not.toHaveTextContent(
			"2 个文件",
		)
		expect(screen.queryByText("取消分享")).not.toBeInTheDocument()

		fireEvent.click(screen.getByTestId("project-share-sheet-manage-row"))

		expect(controller.goToLinkDetail).toHaveBeenCalledWith("share-1")
	})

	it("组织分享优先展示 share_scope 的成员与部门数量", () => {
		const controller = createController({
			filteredShareItems: [
				{
					resource_id: "share-org-1",
					title: "组织链接",
					project_id: "project-1",
					project_name: "Demo Project",
					share_type: ShareType.Organization,
					created_at: "2026-05-05T00:00:00.000Z",
					has_password: false,
					share_scope: { type: "designated", user_count: 3, department_count: 2 },
				},
			],
		})

		render(<ProjectShareManageView controller={controller} />)

		expect(screen.getByTestId("project-share-sheet-manage-row")).toHaveTextContent(
			"3 个成员，2 个部门",
		)
	})

	it("组织分享范围为全部时展示「所有成员」", () => {
		const controller = createController({
			filteredShareItems: [
				{
					resource_id: "share-org-all",
					title: "全员链接",
					project_id: "project-1",
					project_name: "Demo Project",
					share_type: ShareType.Organization,
					created_at: "2026-05-05T00:00:00.000Z",
					has_password: false,
					share_scope: { type: "all" },
				},
			],
		})

		render(<ProjectShareManageView controller={controller} />)

		expect(screen.getByTestId("project-share-sheet-manage-row")).toHaveTextContent("所有成员")
	})

	it("未命名分享按分享类型回退默认标题", () => {
		const controller = createController({
			filteredShareItems: [
				{
					resource_id: "share-public-1",
					title: "",
					project_id: "project-1",
					project_name: "Demo Project",
					share_type: ShareType.Public,
					created_at: "2026-05-05T00:00:00.000Z",
					has_password: false,
				},
			],
		})

		render(<ProjectShareManageView controller={controller} />)

		expect(screen.getByTestId("project-share-sheet-manage-row")).toHaveTextContent("公开链接")
	})
})
