import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ShareType } from "@/pages/superMagic/components/Share/types"
import ProjectShareDeleteConfirmView from "../components/ProjectShareDeleteConfirmView"
import type { ProjectShareSheetController } from "../types"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, values?: Record<string, unknown>) => {
			if (key === "projectShare.deleteConfirmMessage") {
				return `确定取消「${values?.name}」吗？取消后，已获得链接的人将无法继续访问该分享。`
			}
			return key
		},
	}),
}))

/**
 * 删除确认页只依赖 selectedShare 名称和 controller 结构，测试避免触达真实取消接口。
 */
function createController(
	overrides: Partial<ProjectShareSheetController> = {},
): ProjectShareSheetController {
	return {
		open: true,
		view: "deleteConfirm",
		viewStack: ["linkDetail"],
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
			extend: { file_count: 2 },
		},
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

describe("ProjectShareDeleteConfirmView", () => {
	it("展示包含分享名的原型确认文案，且不在内容区重复放确认按钮", () => {
		render(<ProjectShareDeleteConfirmView controller={createController()} />)

		expect(screen.getByTestId("project-share-sheet-delete-confirm-view")).toHaveTextContent(
			"客户演示",
		)
		expect(
			screen.queryByTestId("project-share-sheet-delete-submit-button"),
		).not.toBeInTheDocument()
	})
})
