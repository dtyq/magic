import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ShareType } from "@/pages/superMagic/components/Share/types"
import ProjectShareManageView from "../components/ProjectShareManageView"
import type { ProjectShareSheetController } from "../types"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, values?: Record<string, unknown>) => {
			const labels: Record<string, string> = {
				"projectShare.empty": "暂无分享链接",
				"projectShare.managePasswordSummary": "需要密码访问",
				"projectShare.managePermanent": "永久有效",
				"share.untitled": "未命名分享",
			}
			if (key === "projectShare.fileCount" && typeof values?.count === "number") {
				return `${values.count} 个文件`
			}
			return labels[key] || key
		},
	}),
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
		expect(screen.getByTestId("project-share-sheet-manage-row")).toHaveTextContent("2 个文件")
		expect(screen.queryByText("取消分享")).not.toBeInTheDocument()

		fireEvent.click(screen.getByTestId("project-share-sheet-manage-row"))

		expect(controller.goToLinkDetail).toHaveBeenCalledWith("share-1")
	})
})
