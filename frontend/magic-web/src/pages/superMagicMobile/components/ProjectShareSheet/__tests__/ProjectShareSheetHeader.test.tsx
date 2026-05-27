import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ShareMode, ShareType } from "@/pages/superMagic/components/Share/types"
import ProjectShareSheetHeader from "../components/ProjectShareSheetHeader"
import type { ProjectShareSheetController } from "../types"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, values?: Record<string, unknown>) => {
			if (key === "share.singleFileShareName") {
				return `文件分享_${values?.fileName}`
			}
			if (key === "share.multiFileShareName") {
				return `文件分享_${values?.mainFileName} 等 ${values?.count} 个文件`
			}

			const labels: Record<string, string> = {
				"projectShare.fileModeCreateTitle": "文件分享",
				"projectShare.createTitle": "项目分享",
				"projectShare.manageTitle": "分享管理",
				"projectShare.linkDetailTitle": "分享详情",
				"projectShare.expiryTitle": "有效期",
				"projectShare.deleteConfirmTitle": "删除分享",
				"share.untitled": "未命名",
				"common.close": "关闭",
				"common.back": "返回",
			}

			return labels[key] || key
		},
	}),
}))

/**
 * 只构造头部渲染所需的最小 controller，避免测试耦合到完整 Sheet 逻辑。
 */
function createController(
	overrides: Partial<ProjectShareSheetController> = {},
): ProjectShareSheetController {
	return {
		open: true,
		view: "linkDetail",
		viewStack: ["create"],
		mode: "file",
		shareMode: ShareMode.File,
		projectName: "测试项目",
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
			title: "文件分享_{{mainFileName}} 等 {{count}} 个文件",
			project_id: "project-1",
			project_name: "测试项目",
			workspace_id: "workspace-1",
			workspace_name: "测试空间",
			resource_type: 13,
			share_type: ShareType.PasswordProtected,
			resource_id: "share-1",
			has_password: true,
			password: "abc123",
			main_file_name: "测试画布",
			file_ids: ["folder-1"],
			extend: {
				file_count: 21,
			},
			created_at: "2026-05-06T00:00:00.000Z",
			share_project: false,
		},
		loading: false,
		saving: false,
		isCheckingShare: false,
		advancedOpen: false,
		defaultSelectedFileIds: ["folder-1"],
		selectedFileItems: [],
		selectedFileHierarchy: [
			{
				id: "folder-1",
				name: "测试画布",
				isDirectory: true,
				children: [],
			},
		],
		selectedFileCount: 21,
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

describe("ProjectShareSheetHeader", () => {
	it("文件分享详情标题遇到未替换模板时回退为真实文件名摘要", () => {
		render(<ProjectShareSheetHeader controller={createController()} projectName="测试项目" />)

		expect(screen.getByTestId("project-share-sheet-header")).toHaveTextContent(
			"文件分享_测试画布 等 21 个文件",
		)
		expect(screen.getByTestId("project-share-sheet-header")).not.toHaveTextContent(
			"{{mainFileName}}",
		)
	})
})
