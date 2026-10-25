import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { NodeType } from "@dtyq/user-selector"
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
	default: ({
		open,
		selectedValues,
		onSelectChange,
		onCancel,
		onOk,
	}: {
		open?: boolean
		selectedValues?: Array<{ id: string; name?: string; dataType?: number }>
		onSelectChange?: (values: Array<{ id: string; name?: string; dataType?: number }>) => void
		onCancel?: () => void
		onOk?: (values: Array<{ id: string; name?: string; dataType?: number }>) => void
	}) => {
		if (!open) return null
		return (
			<div data-testid="mock-member-department-selector">
				<span data-testid="mock-member-selector-count">{selectedValues?.length ?? 0}</span>
				<button
					type="button"
					data-testid="mock-member-selector-select"
					onClick={() =>
						onSelectChange?.([
							...(selectedValues || []),
							{ id: "user-mock-added", name: "Added Mock User", dataType: 1 },
						])
					}
				>
					Select
				</button>
				<button
					type="button"
					data-testid="mock-member-selector-cancel"
					onClick={() => {
						// MobileUserSelector resets selection to empty on cancel
						onSelectChange?.([])
						onCancel?.()
					}}
				>
					Cancel
				</button>
				<button
					type="button"
					data-testid="mock-member-selector-ok"
					onClick={() => onOk?.(selectedValues || [])}
				>
					OK
				</button>
			</div>
		)
	},
}))

vi.mock(
	"@/pages/superMagic/pages/AudioRecordings/components/recording-share/RecordingShareContentPicker",
	() => ({
		RecordingShareContentPicker: () => (
			<div data-testid="mock-recording-share-content-picker" />
		),
	}),
)

vi.mock(
	"@/pages/superMagic/components/TopicFilesButton/components/MobileAttachmentRowIcon",
	() => ({
		MobileAttachmentRowIcon: ({
			item,
			attachments,
			dataTestId,
		}: {
			item: { file_id?: string; name?: string; file_name?: string }
			attachments: Array<{ file_id?: string }>
			dataTestId?: string
		}) => (
			<span
				data-testid={dataTestId || "mock-mobile-attachment-row-icon"}
				data-item-id={item.file_id}
				data-item-name={item.name || item.file_name}
				data-attachment-count={attachments.length}
			/>
		),
	}),
)

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
		projectMode: "",
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
		selectedFileIds: [],
		groupedShareItems: [],
		enableInlineFileSelection: false,
		selectedFileItems: [],
		selectedFileHierarchy: [],
		selectedFileCount: 0,
		defaultOpenFileId: undefined,
		defaultOpenFileItem: undefined,
		defaultOpenFileCandidates: [],
		defaultOpenFileCandidateTree: [],
		defaultOpenFilePickerOpen: false,
		memberSelectorOpen: false,
		selectedMemberNodes: [],
		detailMemberNodes: [],
		detailMemberLoading: false,
		selectedShareMessageText: "",
		canNativeShare: false,
		shareSelectedShareToSystem: vi.fn(),
		setShareName: vi.fn(),
		setShareType: vi.fn(),
		setShareExpiry: vi.fn(),
		setPassword: vi.fn(),
		resetPassword: vi.fn(),
		setShareRange: vi.fn(),
		setShareTargets: vi.fn(),
		setAdvancedSettings: vi.fn(),
		setAdvancedOpen: vi.fn(),
		setSelectedFileIds: vi.fn(),
		toggleShareFileId: vi.fn(),
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
		openDefaultOpenFilePicker: vi.fn(),
		closeDefaultOpenFilePicker: vi.fn(),
		selectDefaultOpenFile: vi.fn(),
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

	it("reserves scroll space for the fixed sheet footer", () => {
		render(<ProjectShareCreateView controller={createController()} />)

		expect(
			screen.getByTestId("project-share-sheet-create-floating-bar-scroll-spacer"),
		).toBeInTheDocument()
	})

	it("高级设置展示纯净模式，默认关闭，点击后保留其它设置并开启", () => {
		const controller = createController({
			formState: {
				...createController().formState,
				advancedSettings: { allowCopy: false, hideCreatorInfo: true },
			},
		})

		render(<ProjectShareCreateView controller={controller} />)

		const row = screen.getByTestId("project-share-sheet-pure-mode-row")
		expect(row).toHaveTextContent("share.pureMode")
		expect(row).toHaveTextContent("share.pureModeDescription")
		expect(row.querySelector("[role='switch']")).toHaveAttribute("aria-checked", "false")

		fireEvent.click(row)

		expect(controller.setAdvancedSettings).toHaveBeenCalledWith({
			allowCopy: false,
			hideCreatorInfo: true,
			pureMode: true,
		})
	})

	it("纯净模式已开启时展示开启状态，点击后关闭", () => {
		const controller = createController({
			formState: {
				...createController().formState,
				advancedSettings: { pureMode: true },
			},
		})

		render(<ProjectShareCreateView controller={controller} />)

		const row = screen.getByTestId("project-share-sheet-pure-mode-row")
		expect(row.querySelector("[role='switch']")).toHaveAttribute("aria-checked", "true")

		fireEvent.click(row)

		expect(controller.setAdvancedSettings).toHaveBeenCalledWith({ pureMode: false })
	})

	it("录音分享的内联文件选择模式同样展示纯净模式，与 Web 保持一致", () => {
		render(
			<ProjectShareCreateView
				controller={createController({ enableInlineFileSelection: true })}
			/>,
		)

		expect(screen.getByTestId("project-share-sheet-pure-mode-row")).toBeInTheDocument()
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

	it("文件模式展示默认打开文件并支持点击打开选择器", () => {
		const openDefaultOpenFilePicker = vi.fn()

		render(
			<ProjectShareCreateView
				controller={createController({
					mode: "file",
					defaultOpenFileId: "file-1",
					defaultOpenFileItem: {
						file_id: "file-1",
						name: "fictional-photo.jpg",
						file_name: "fictional-photo.jpg",
						file_extension: "jpg",
						is_directory: false,
					},
					defaultOpenFileCandidates: [
						{
							file_id: "file-1",
							name: "fictional-photo.jpg",
							file_extension: "jpg",
							is_directory: false,
						},
					],
					openDefaultOpenFilePicker,
				})}
			/>,
		)

		const trigger = screen.getByTestId("project-share-sheet-default-open-file-trigger")
		expect(trigger).toHaveTextContent("projectShare.defaultOpenFileLabel")
		expect(trigger).toHaveTextContent("fictional-photo.jpg")

		fireEvent.click(trigger)

		expect(openDefaultOpenFilePicker).toHaveBeenCalledTimes(1)
	})

	it("编辑文件分享时在已选文件行提供编辑图标", () => {
		const openFileSelector = vi.fn()

		render(
			<ProjectShareCreateView
				controller={createController({
					mode: "file",
					isEditing: true,
					openFileSelector,
					selectedFileCount: 1,
					selectedFileHierarchy: [
						{
							id: "fictional-selected-file",
							name: "fictional-selected.html",
							isDirectory: false,
							children: [],
						},
					],
				})}
			/>,
		)

		fireEvent.click(
			screen.getByTestId("project-share-sheet-selected-files-trigger-edit-button"),
		)

		expect(openFileSelector).toHaveBeenCalledTimes(1)
	})

	it("项目模式也展示默认打开文件并支持点击打开选择器", () => {
		const openDefaultOpenFilePicker = vi.fn()

		render(
			<ProjectShareCreateView
				controller={createController({
					mode: "project",
					defaultOpenFileId: "file-1",
					defaultOpenFileItem: {
						file_id: "file-1",
						name: "fictional-dashboard.html",
						file_name: "fictional-dashboard.html",
						file_extension: "html",
						is_directory: false,
					},
					defaultOpenFileCandidates: [
						{
							file_id: "file-1",
							name: "fictional-dashboard.html",
							file_extension: "html",
							is_directory: false,
						},
					],
					openDefaultOpenFilePicker,
				})}
			/>,
		)

		const trigger = screen.getByTestId("project-share-sheet-default-open-file-trigger")
		expect(trigger).toHaveTextContent("projectShare.defaultOpenFileLabel")
		expect(trigger).toHaveTextContent("fictional-dashboard.html")

		fireEvent.click(trigger)

		expect(openDefaultOpenFilePicker).toHaveBeenCalledTimes(1)
	})

	it("项目模式默认打开特殊文件夹摘要行复用移动端文件图标规则", () => {
		const openDefaultOpenFilePicker = vi.fn()

		render(
			<ProjectShareCreateView
				controller={createController({
					mode: "project",
					defaultOpenFileId: "file-special-folder",
					defaultOpenFileItem: {
						file_id: "file-special-folder",
						name: "fictional-special-folder",
						is_directory: true,
						display_config: { type: "slide" },
						children: [
							{
								file_id: "file-child",
								name: "fictional-child.html",
								file_extension: "html",
								is_directory: false,
							},
						],
					},
					defaultOpenFileCandidates: [
						{
							file_id: "file-special-folder",
							name: "fictional-special-folder",
							is_directory: true,
							display_config: { type: "slide" },
						},
					],
					defaultOpenFileCandidateTree: [
						{
							file_id: "file-special-folder",
							name: "fictional-special-folder",
							is_directory: true,
							display_config: { type: "slide" },
						},
					],
					openDefaultOpenFilePicker,
				})}
			/>,
		)

		const trigger = screen.getByTestId("project-share-sheet-default-open-file-trigger")
		const icon = screen.getByTestId("project-share-sheet-default-open-file-icon")

		expect(trigger).toHaveTextContent("fictional-special-folder")
		expect(icon).toHaveAttribute("data-item-id", "file-special-folder")
		expect(icon).toHaveAttribute("data-item-name", "fictional-special-folder")
		expect(icon).toHaveAttribute("data-attachment-count", "1")

		fireEvent.click(trigger)

		expect(openDefaultOpenFilePicker).toHaveBeenCalledTimes(1)
	})

	it("项目分享只展示管理员允许的分享方式", () => {
		render(
			<ProjectShareCreateView
				controller={createController({
					permittedShareTypes: [ShareType.Public],
					isSelectedShareTypePermitted: true,
				})}
			/>,
		)

		expect(
			screen.getByTestId(`project-share-sheet-type-${ShareType.Public}`),
		).toBeInTheDocument()
		expect(
			screen.queryByTestId(`project-share-sheet-type-${ShareType.PasswordProtected}`),
		).not.toBeInTheDocument()
		expect(
			screen.queryByTestId(`project-share-sheet-type-${ShareType.Organization}`),
		).not.toBeInTheDocument()
	})

	it("编辑时保留但禁用已经失权的当前分享方式", () => {
		render(
			<ProjectShareCreateView
				controller={createController({
					view: "edit",
					isEditing: true,
					formState: {
						...createController().formState,
						shareType: ShareType.PasswordProtected,
					},
					permittedShareTypes: [ShareType.Public],
					isSelectedShareTypePermitted: false,
				})}
			/>,
		)

		expect(
			screen.getByTestId(`project-share-sheet-type-${ShareType.PasswordProtected}`),
		).toBeDisabled()
		expect(screen.getByText("share.currentShareMethodUnavailable")).toBeInTheDocument()
	})

	it("管理员未开放任何项目分享方式时显示提示并收起其余表单项", () => {
		render(
			<ProjectShareCreateView
				controller={createController({
					mode: "file",
					advancedOpen: true,
					selectedFileCount: 2,
					selectedFileItems: [
						{ file_id: "file-1", name: "fictional-a.md", is_directory: false },
					],
					selectedFileHierarchy: [
						{
							id: "file-1",
							name: "fictional-a.md",
							isDirectory: false,
							children: [],
						},
					],
					defaultOpenFileId: "file-1",
					defaultOpenFileItem: {
						file_id: "file-1",
						name: "fictional-a.md",
						file_name: "fictional-a.md",
						file_extension: "md",
						is_directory: false,
					},
					defaultOpenFileCandidates: [
						{
							file_id: "file-1",
							name: "fictional-a.md",
							file_extension: "md",
							is_directory: false,
						},
					],
					permittedShareTypes: [],
					isSelectedShareTypePermitted: false,
				})}
			/>,
		)

		expect(screen.getByText("share.noAvailableShareMethods")).toBeInTheDocument()
		// 全部分享方式被管控后，除「分享方式 + 红字提示」外的附属内容对用户没有意义，不再渲染。
		expect(screen.getByTestId("project-share-sheet-type-grid")).toBeInTheDocument()
		expect(screen.queryByTestId("project-share-sheet-name-input")).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("project-share-sheet-default-open-file-trigger"),
		).not.toBeInTheDocument()
		expect(screen.queryByTestId("project-share-sheet-expiry-trigger")).not.toBeInTheDocument()
		expect(screen.queryByTestId("project-share-sheet-password-input")).not.toBeInTheDocument()
		expect(screen.queryByTestId("project-share-sheet-advanced-trigger")).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("project-share-sheet-selected-files-trigger"),
		).not.toBeInTheDocument()
		expect(screen.queryByText("projectShare.typePublic")).not.toBeInTheDocument()
		// 底部占位仍保留，避免固定底栏盖住内容。
		expect(
			screen.getByTestId("project-share-sheet-create-floating-bar-scroll-spacer"),
		).toBeInTheDocument()
	})

	it("内联文件选择模式下管理员未开放分享方式时同样收起内容选择器", () => {
		const { unmount } = render(
			<ProjectShareCreateView
				controller={createController({
					mode: "file",
					enableInlineFileSelection: true,
					permittedShareTypes: [ShareType.Public],
					isSelectedShareTypePermitted: true,
				})}
			/>,
		)

		// 对照组：有可用分享方式时内容选择器正常展示，确保下面的隐藏断言不是假绿。
		expect(screen.getByTestId("mock-recording-share-content-picker")).toBeInTheDocument()

		unmount()

		render(
			<ProjectShareCreateView
				controller={createController({
					mode: "file",
					enableInlineFileSelection: true,
					permittedShareTypes: [],
					isSelectedShareTypePermitted: false,
				})}
			/>,
		)

		expect(screen.queryByTestId("mock-recording-share-content-picker")).not.toBeInTheDocument()
		expect(screen.getByText("share.noAvailableShareMethods")).toBeInTheDocument()
	})

	it("preserves confirmed members when cancelling the member selector modal", () => {
		// Mock callbacks to verify whether cancel triggers commit or close actions
		const closeMemberSelector = vi.fn()
		const confirmMemberSelector = vi.fn()
		const initialMembers = [
			{
				id: "user-mock-1",
				name: "Mock Member One",
				dataType: NodeType.User,
			},
			{
				id: "user-mock-2",
				name: "Mock Member Two",
				dataType: NodeType.User,
			},
		]

		render(
			<ProjectShareCreateView
				controller={createController({
					memberSelectorOpen: true,
					selectedMemberNodes: initialMembers,
					closeMemberSelector,
					confirmMemberSelector,
					formState: {
						...createController().formState,
						shareType: ShareType.Organization,
					},
				})}
			/>,
		)

		// Verify the staged selector is opened with the current confirmed members
		expect(screen.getByTestId("mock-member-selector-count")).toHaveTextContent("2")

		// Simulate adding a user inside the picker modal
		fireEvent.click(screen.getByTestId("mock-member-selector-select"))
		expect(screen.getByTestId("mock-member-selector-count")).toHaveTextContent("3")

		// Click cancel (simulating MobileUserSelector clearing selection on cancel and closing)
		fireEvent.click(screen.getByTestId("mock-member-selector-cancel"))

		// Selector closes without committing unconfirmed staged selection
		expect(closeMemberSelector).toHaveBeenCalledTimes(1)
		expect(confirmMemberSelector).not.toHaveBeenCalled()
	})

	it("commits all staged members when clicking confirm in member selector", () => {
		// Verify that confirming the picker commits both initial and newly selected members
		const confirmMemberSelector = vi.fn()
		const initialMembers = [
			{
				id: "user-mock-1",
				name: "Mock Member One",
				dataType: NodeType.User,
			},
		]

		render(
			<ProjectShareCreateView
				controller={createController({
					memberSelectorOpen: true,
					selectedMemberNodes: initialMembers,
					confirmMemberSelector,
					formState: {
						...createController().formState,
						shareType: ShareType.Organization,
					},
				})}
			/>,
		)

		expect(screen.getByTestId("mock-member-selector-count")).toHaveTextContent("1")

		// Select an additional member and confirm
		fireEvent.click(screen.getByTestId("mock-member-selector-select"))
		fireEvent.click(screen.getByTestId("mock-member-selector-ok"))

		expect(confirmMemberSelector).toHaveBeenCalledWith([
			{
				id: "user-mock-1",
				name: "Mock Member One",
				dataType: NodeType.User,
			},
			{
				id: "user-mock-added",
				name: "Added Mock User",
				dataType: 1,
			},
		])
	})

	it("directly removes a member from confirmed list when clicking remove icon on card", () => {
		// Verify clicking the remove button on member card calls confirmMemberSelector with remaining members
		const confirmMemberSelector = vi.fn()
		const initialMembers = [
			{
				id: "user-mock-1",
				name: "Mock Member One",
				dataType: NodeType.User,
			},
			{
				id: "user-mock-2",
				name: "Mock Member Two",
				dataType: NodeType.User,
			},
		]

		render(
			<ProjectShareCreateView
				controller={createController({
					selectedMemberNodes: initialMembers,
					confirmMemberSelector,
					formState: {
						...createController().formState,
						shareType: ShareType.Organization,
					},
				})}
			/>,
		)

		const removeButtons = screen.getAllByTestId("project-share-sheet-member-remove-button")
		expect(removeButtons).toHaveLength(2)

		fireEvent.click(removeButtons[0])

		expect(confirmMemberSelector).toHaveBeenCalledWith([
			{
				id: "user-mock-2",
				name: "Mock Member Two",
				dataType: NodeType.User,
			},
		])
	})
})
