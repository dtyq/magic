import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import SelectDirectoryModal from "./SelectDirectoryModal"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) => {
			if (key === "selectPathModal.rootDirectory") return "根目录"
			if (key === "selectPathModal.searchDirectory") return "搜索文件夹"
			if (key === "selectPathModal.myWorkspaces") return "我的工作区"
			if (key === "selectPathModal.chatCount")
				return `${String(options?.count || "0")} 个对话`
			if (key === "chat.unnamedChat") return "未命名对话"
			if (key === "common.confirm") return "确认"
			if (key === "common.cancel") return "取消"
			if (key === "mobile.shell.navChats") return "对话"
			if (key === "project.unnamedProject") return "未命名项目"
			if (key === "workspace.shareWorkspaceName") return "共享工作区"
			if (key === "workspace.projectCount") return `${String(options?.count || "0")} 个项目`
			if (key === "selectPathModal.searchEmptyDescription")
				return `暂无关于“${String(options?.keyword || "")}”的内容`
			return key
		},
	}),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => true,
}))

vi.mock("antd", () => ({
	Tooltip: ({ children }: { children: React.ReactNode }) => children,
	Dropdown: ({ children }: { children: React.ReactNode }) => children,
	Menu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/base/MagicSpin", () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => {
		if (!visible) return null

		return <div data-testid="mock-magic-popup">{children}</div>
	},
}))

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
}))

vi.mock("@/components/shadcn-ui/input", () => ({
	Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock("@/pages/superMagic/components/TopicFilesButton/components", () => ({
	InputWithError: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock("@/pages/superMagic/components/SelectPathModal/hooks/useCreateDirectory", () => ({
	useCreateDirectory: () => ({
		loading: false,
		createDirectoryShown: false,
		createDirectoryName: "",
		createDirectoryErrorMessage: "",
		showCreateDirectory: vi.fn(),
		cancelCreateDirectory: vi.fn(),
		onCreateDirectoryInputChange: vi.fn(),
		onCreateDirectoryInputFocus: vi.fn(),
		submitCreateDirectory: vi.fn(),
		onCreateDirectoryInputKeyDown: vi.fn(),
	}),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		info: vi.fn(),
	},
}))

vi.mock("@/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip", () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const {
	getWorkspaces,
	getCollaborationProjects,
	getChatWorkspace,
	getProjects,
	getProjectsWithCollaboration,
	getAttachmentsByProjectId,
} = vi.hoisted(() => ({
	getWorkspaces: vi.fn(),
	getCollaborationProjects: vi.fn(),
	getChatWorkspace: vi.fn(),
	getProjects: vi.fn(),
	getProjectsWithCollaboration: vi.fn(),
	getAttachmentsByProjectId: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getWorkspaces,
		getCollaborationProjects,
		getChatWorkspace,
		getProjects,
		getProjectsWithCollaboration,
		getAttachmentsByProjectId,
	},
}))

const attachments = [
	{
		file_id: "folder-a",
		name: "Folder A",
		is_directory: true,
		relative_file_path: "/Folder A",
		children: [
			{
				file_id: "folder-a-child",
				name: "Child Folder",
				is_directory: true,
				relative_file_path: "/Folder A/Child Folder",
				children: [
					{
						file_id: "folder-a-grandchild",
						name: "Grand Child Folder",
						is_directory: true,
						relative_file_path: "/Folder A/Child Folder/Grand Child Folder",
						children: [],
					},
				],
			},
		],
	},
	{
		file_id: "folder-b",
		name: "Folder B",
		is_directory: true,
		relative_file_path: "/Folder B",
		children: [],
	},
]

const targetAttachments = [
	{
		file_id: "folder-c",
		name: "Folder C",
		is_directory: true,
		relative_file_path: "/Folder C",
		children: [],
	},
]

describe("SelectDirectoryModal mobile", () => {
	const onClose = vi.fn()
	const onSubmit = vi.fn()

	beforeEach(() => {
		onClose.mockReset()
		onSubmit.mockReset()
		getWorkspaces.mockReset()
		getCollaborationProjects.mockReset()
		getChatWorkspace.mockReset()
		getProjects.mockReset()
		getProjectsWithCollaboration.mockReset()
		getAttachmentsByProjectId.mockReset()
		getWorkspaces.mockResolvedValue({
			list: [
				{
					id: "workspace-1",
					name: "Workspace One",
					project_count: 1,
					workspace_type: "default",
				},
				{
					id: "workspace-2",
					name: "Workspace Two",
					project_count: 1,
					workspace_type: "default",
				},
			],
		})
		getCollaborationProjects.mockResolvedValue({
			list: [
				{
					id: "project-shared",
					project_name: "Shared Project",
					workspace_id: "collaboration",
					user_role: "viewer",
				},
			],
			total: 1,
		})
		getChatWorkspace.mockResolvedValue({
			id: "chat-workspace",
			name: "Chat Workspace",
			project_count: 2,
			workspace_type: "chat",
		})
		getProjects.mockResolvedValue({
			list: [
				{
					id: "project-chat-2",
					project_name: "Chat Project Two",
					workspace_id: "chat-workspace",
					user_role: "owner",
				},
			],
		})
		getProjectsWithCollaboration.mockResolvedValue({
			list: [
				{
					id: "project-2",
					project_name: "Project Two",
					workspace_id: "workspace-2",
					user_role: "owner",
				},
			],
		})
		getAttachmentsByProjectId.mockResolvedValue({ tree: targetAttachments })
	})

	/**
	 * 统一渲染移动端目录选择器，确保每个交互测试都从同一份受控输入开始。
	 */
	function renderModal({
		disabledFolderIds = [],
		mobileCrossProjectConfig,
	}: {
		disabledFolderIds?: string[]
		mobileCrossProjectConfig?: React.ComponentProps<
			typeof SelectDirectoryModal
		>["mobileCrossProjectConfig"]
	} = {}) {
		return render(
			<SelectDirectoryModal
				visible
				projectId="project-1"
				title="移动文件"
				attachments={attachments}
				disabledFolderIds={disabledFolderIds}
				mobileCrossProjectConfig={mobileCrossProjectConfig}
				onClose={onClose}
				onSubmit={onSubmit}
			/>,
		)
	}

	it("allows selecting the root directory and confirming from the dedicated mobile sheet", () => {
		renderModal()

		expect(screen.getByTestId("select-directory-mobile-sheet-root")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("select-directory-mobile-root-select-button"))
		fireEvent.click(screen.getByTestId("select-directory-mobile-confirm-button"))

		expect(onSubmit).toHaveBeenCalledWith({ path: [] })
	})

	it("drills into child folders without keeping the root row in the nested list", () => {
		renderModal()

		fireEvent.click(screen.getByTestId("select-directory-mobile-folder-drill-folder-a"))

		expect(screen.getByText("Child Folder")).toBeInTheDocument()
		expect(
			screen.queryByTestId("select-directory-mobile-root-select-button"),
		).not.toBeInTheDocument()
		expect(screen.getByTestId("select-directory-mobile-confirm-button")).toBeDisabled()
	})

	it("supports horizontal breadcrumb scrolling and wider segment labels in the move sheet", () => {
		renderModal()

		fireEvent.click(screen.getByTestId("select-directory-mobile-folder-drill-folder-a"))
		fireEvent.click(screen.getByTestId("select-directory-mobile-folder-drill-folder-a-child"))

		expect(screen.getByTestId("select-directory-mobile-breadcrumb-scroll")).toHaveClass(
			"overflow-x-auto",
		)
		expect(screen.getByTestId("select-directory-mobile-breadcrumb-folder-a")).toHaveClass(
			"max-w-[168px]",
		)
		expect(screen.getByTestId("select-directory-mobile-breadcrumb-folder-a-child")).toHaveClass(
			"max-w-[168px]",
		)
	})

	it("supports selecting a folder from search results", () => {
		renderModal()

		fireEvent.change(screen.getByTestId("select-directory-mobile-search-input"), {
			target: { value: "Child" },
		})
		fireEvent.click(screen.getByTestId("select-directory-mobile-folder-select-folder-a-child"))
		fireEvent.click(screen.getByTestId("select-directory-mobile-confirm-button"))

		expect(onSubmit).toHaveBeenCalledWith({
			path: [attachments[0], attachments[0].children?.[0]],
		})
	})

	it("prevents selecting disabled folders from the mobile sheet", () => {
		renderModal({ disabledFolderIds: ["folder-b"] })

		fireEvent.click(screen.getByTestId("select-directory-mobile-folder-select-folder-b"))
		fireEvent.click(screen.getByTestId("select-directory-mobile-confirm-button"))

		expect(onSubmit).not.toHaveBeenCalled()
	})

	it("keeps a fixed sheet height and a dedicated bottom search layer", () => {
		renderModal()

		expect(screen.getByTestId("select-directory-mobile-sheet-root")).toHaveClass(
			"h-[calc(100dvh-var(--safe-area-inset-top,0px))]",
		)
		expect(screen.getByTestId("select-directory-mobile-scroll-area")).toHaveClass(
			"overflow-hidden",
		)
		expect(screen.getByTestId("select-directory-mobile-search-dock")).toHaveClass("shrink-0")
	})

	it("supports moving into another workspace project on mobile", async () => {
		renderModal({
			mobileCrossProjectConfig: {
				currentProject: {
					id: "project-1",
					project_name: "Project One",
					workspace_id: "workspace-1",
				},
				currentWorkspace: {
					id: "workspace-1",
					name: "Workspace One",
				},
				sourceAttachments: attachments,
			},
		})

		fireEvent.click(screen.getByTestId("select-directory-mobile-home-button"))

		await waitFor(() => {
			expect(
				screen.getByTestId("select-directory-mobile-workspace-collaboration"),
			).toBeInTheDocument()
			expect(
				screen.getByTestId("select-directory-mobile-workspace-__mobile-chats__"),
			).toBeInTheDocument()
			expect(
				screen.getByTestId("select-directory-mobile-workspace-workspace-2"),
			).toBeInTheDocument()
		})

		fireEvent.click(screen.getByTestId("select-directory-mobile-workspace-workspace-2"))

		await waitFor(() => {
			expect(
				screen.getByTestId("select-directory-mobile-project-project-2"),
			).toBeInTheDocument()
		})

		fireEvent.click(screen.getByTestId("select-directory-mobile-project-project-2"))

		await waitFor(() => {
			expect(
				screen.getByTestId("select-directory-mobile-folder-select-folder-c"),
			).toBeInTheDocument()
		})

		fireEvent.click(screen.getByTestId("select-directory-mobile-folder-select-folder-c"))
		fireEvent.click(screen.getByTestId("select-directory-mobile-confirm-button"))

		expect(onSubmit).toHaveBeenCalledWith({
			path: [targetAttachments[0]],
			targetProjectId: "project-2",
			targetAttachments,
			sourceAttachments: attachments,
		})
	})

	it("loads shared workspace projects with the 100-item API cap", async () => {
		renderModal({
			mobileCrossProjectConfig: {
				currentProject: {
					id: "project-1",
					project_name: "Project One",
					workspace_id: "workspace-1",
				},
				currentWorkspace: {
					id: "workspace-1",
					name: "Workspace One",
				},
				sourceAttachments: attachments,
			},
		})

		fireEvent.click(screen.getByTestId("select-directory-mobile-home-button"))

		await waitFor(() => {
			expect(
				screen.getByTestId("select-directory-mobile-workspace-collaboration"),
			).toBeInTheDocument()
		})

		fireEvent.click(screen.getByTestId("select-directory-mobile-workspace-collaboration"))

		await waitFor(() => {
			expect(getCollaborationProjects).toHaveBeenCalledWith({
				page: 1,
				page_size: 100,
			})
			expect(
				screen.getByTestId("select-directory-mobile-project-project-shared"),
			).toBeInTheDocument()
		})
	})

	it("allows chat projects to browse shared workspace and chats as move destinations", async () => {
		renderModal({
			mobileCrossProjectConfig: {
				currentProject: {
					id: "project-1",
					project_name: "Project One",
					workspace_id: "chat-workspace",
				},
				currentWorkspace: {
					id: "chat-workspace",
					name: "Chat Workspace",
				},
				sourceAttachments: attachments,
				isChatProject: true,
			},
		})

		fireEvent.click(screen.getByTestId("select-directory-mobile-home-button"))

		await waitFor(() => {
			expect(getWorkspaces).toHaveBeenCalled()
			expect(
				screen.getByTestId("select-directory-mobile-workspace-collaboration"),
			).toBeInTheDocument()
			expect(
				screen.getByTestId("select-directory-mobile-workspace-__mobile-chats__"),
			).toBeInTheDocument()
		})

		fireEvent.click(screen.getByTestId("select-directory-mobile-workspace-__mobile-chats__"))

		await waitFor(() => {
			expect(
				screen.getByTestId("select-directory-mobile-project-icon-project-chat-2"),
			).toBeInTheDocument()
			expect(
				screen.getByTestId("select-directory-mobile-project-project-chat-2"),
			).toBeInTheDocument()
			expect(
				screen.queryByTestId("select-directory-mobile-breadcrumb-project-project-1"),
			).not.toBeInTheDocument()
			expect(
				screen.queryByTestId("select-directory-mobile-breadcrumb-project-project-chat-2"),
			).not.toBeInTheDocument()
		})

		fireEvent.click(screen.getByTestId("select-directory-mobile-project-project-chat-2"))

		await waitFor(() => {
			expect(
				screen.getByTestId("select-directory-mobile-breadcrumb-project-project-chat-2"),
			).toBeInTheDocument()
		})
	})

	it("uses the fetched list length for shared and chats counts", async () => {
		getCollaborationProjects.mockResolvedValueOnce({
			list: [
				{
					id: "project-shared-1",
					project_name: "Shared Project One",
					workspace_id: "collaboration",
					user_role: "viewer",
				},
				{
					id: "project-shared-2",
					project_name: "Shared Project Two",
					workspace_id: "collaboration",
					user_role: "viewer",
				},
			],
			total: 0,
		})
		getChatWorkspace.mockResolvedValueOnce({
			id: "chat-workspace",
			name: "Chat Workspace",
			project_count: 0,
			workspace_type: "chat",
		})
		getProjects.mockResolvedValueOnce({
			list: [
				{
					id: "project-chat-1",
					project_name: "Chat Project One",
					workspace_id: "chat-workspace",
					user_role: "owner",
				},
			],
		})

		renderModal({
			mobileCrossProjectConfig: {
				currentProject: {
					id: "project-1",
					project_name: "Project One",
					workspace_id: "workspace-1",
				},
				currentWorkspace: {
					id: "workspace-1",
					name: "Workspace One",
				},
				sourceAttachments: attachments,
			},
		})

		fireEvent.click(screen.getByTestId("select-directory-mobile-home-button"))

		await waitFor(() => {
			expect(
				screen.getByTestId("select-directory-mobile-workspace-collaboration"),
			).toHaveTextContent("2 个项目")
			expect(
				screen.getByTestId("select-directory-mobile-workspace-__mobile-chats__"),
			).toHaveTextContent("1 个对话")
		})

		expect(getProjects).toHaveBeenCalledWith({
			workspace_id: "chat-workspace",
			page: 1,
			page_size: 100,
		})
	})

	it("shows fallback copy for unnamed chat projects in the list and breadcrumb", async () => {
		getProjects.mockResolvedValueOnce({
			list: [
				{
					id: "project-chat-empty",
					project_name: "   ",
					workspace_id: "chat-workspace",
					user_role: "owner",
				},
			],
		})

		renderModal({
			mobileCrossProjectConfig: {
				currentProject: {
					id: "project-1",
					project_name: "Project One",
					workspace_id: "workspace-1",
				},
				currentWorkspace: {
					id: "workspace-1",
					name: "Workspace One",
				},
				sourceAttachments: attachments,
			},
		})

		fireEvent.click(screen.getByTestId("select-directory-mobile-home-button"))

		await waitFor(() => {
			expect(
				screen.getByTestId("select-directory-mobile-workspace-__mobile-chats__"),
			).toHaveTextContent("对话")
		})

		fireEvent.click(screen.getByTestId("select-directory-mobile-workspace-__mobile-chats__"))

		await waitFor(() => {
			expect(
				screen.getByTestId("select-directory-mobile-project-project-chat-empty"),
			).toHaveTextContent("未命名对话")
		})

		fireEvent.click(screen.getByTestId("select-directory-mobile-project-project-chat-empty"))

		await waitFor(() => {
			expect(
				screen.getByTestId("select-directory-mobile-breadcrumb-project-project-chat-empty"),
			).toHaveTextContent("未命名对话")
		})
	})
})
