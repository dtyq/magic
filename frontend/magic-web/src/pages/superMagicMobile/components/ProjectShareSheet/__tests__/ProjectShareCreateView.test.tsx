import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ShareMode, ShareType } from "@/pages/superMagic/components/Share/types"
import ProjectShareCreateView from "../components/ProjectShareCreateView"
import type { ProjectShareSheetController } from "../types"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) => {
			if (key === "projectShare.expiryDays" && typeof options?.days === "number") {
				return `${options.days} days`
			}
			if (key === "projectShare.selectedMembersCount" && typeof options?.count === "number") {
				return `${options.count} selected`
			}
			if (key === "projectShare.selectedFilesCount" && typeof options?.count === "number") {
				return `${options.count} files`
			}
			return key
		},
	}),
}))

vi.mock("@/components/business/MemberDepartmentSelector", () => ({
	default: () => null,
}))

/**
 * 构造最小 controller 数据，专门覆盖创建分享页的交互结构测试。
 */
function createController(
	overrides: Partial<ProjectShareSheetController> = {},
): ProjectShareSheetController {
	return {
		open: true,
		view: "create",
		viewStack: [],
		mode: "project",
		shareMode: ShareMode.Project,
		projectName: "Demo Project",
		projectId: "project-1",
		formState: {
			shareName: "Demo Project",
			shareType: ShareType.Public,
			shareExpiry: null,
			password: "abc123",
			shareRange: "all",
			shareTargets: [],
			advancedSettings: {},
		},
		filteredShareItems: [],
		selectedShare: null,
		loading: false,
		saving: false,
		isCheckingShare: false,
		advancedOpen: true,
		defaultSelectedFileIds: [],
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

describe("ProjectShareCreateView", () => {
	it("高级设置行不会产生 button 嵌套告警", () => {
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)

		render(<ProjectShareCreateView controller={createController()} />)

		const nestingWarnings = consoleErrorSpy.mock.calls
			.flat()
			.filter(
				(value) =>
					typeof value === "string" &&
					value.includes("<button> cannot appear as a descendant of <button>"),
			)

		expect(nestingWarnings).toHaveLength(0)

		consoleErrorSpy.mockRestore()
	})

	it("文件模式会展示固定文案的已选文件区块，并支持展开文件夹层级", () => {
		render(
			<ProjectShareCreateView
				controller={createController({
					mode: "file",
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
