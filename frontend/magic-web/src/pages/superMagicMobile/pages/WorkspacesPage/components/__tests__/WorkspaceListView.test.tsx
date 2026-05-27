import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { WorkspaceStatus } from "@/pages/superMagic/pages/Workspace/types"
import { WorkspaceListView } from "../WorkspaceListView"

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()

	return {
		...actual,
		useTranslation: () => ({
			t: (key: string, options?: { keyword?: string; count?: number }) => {
				if (key === "chatList.searchPlaceholder") return "搜索"
				if (key === "workspace.searchWorkspace") return "搜索工作区"
				if (key === "common.cancel") return "取消"
				if (key === "workspace.workspace") return "工作空间"
				if (key === "workspace.addWorkspace") return "添加工作区"
				if (key === "mobile.shell.menuAria") return "菜单"
				if (key === "workspace.sharedWorkspace") return "共享工作区"
				if (key === "workspace.collaborationProjectsDescV2") return "他人共享的项目"
				if (key === "workspace.noWorkspaces") return "暂无工作区"
				if (key === "workspace.pinWorkspaceSuccess") return "工作区已置顶"
				if (key === "workspace.unpinWorkspaceSuccess") return "工作区已取消置顶"
				if (key === "workspace.searchNoResults") {
					return `未找到 ${options?.keyword || ""}`.trim()
				}
				if (key === "workspace.projectCount") return `${options?.count ?? 0} 个项目`
				if (key === "workspaceList.swipeMore") return "更多"
				if (key === "workspaceList.swipeDelete") return "删除"
				if (key === "workspaceList.swipePin") return "置顶"
				if (key === "workspaceList.swipeUnpin") return "取消置顶"

				return key
			},
		}),
	}
})

vi.mock("antd-mobile", () => ({
	InfiniteScroll: () => <div data-testid="infinite-scroll" />,
}))

vi.mock("@/components/base-mobile/SwipeActionRow", () => ({
	SwipeActionRow: ({
		children,
		actions = [],
	}: {
		children: React.ReactNode
		actions?: Array<{ id: string; label: string; [key: string]: unknown }>
	}) => (
		<div>
			<div>{children}</div>
			<div>
				{actions.map((action) => (
					<button
						key={action.id}
						type="button"
						data-testid={String(action["data-testid"] ?? action.id)}
					>
						{action.label}
					</button>
				))}
			</div>
		</div>
	),
}))

vi.mock("@/components/base-mobile/MagicPullToRefresh", () => ({
	default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/pages/superMagicMobile/components/MobileShell", () => ({
	MobileShellIconButton: ({ children, label }: { children: React.ReactNode; label: string }) => (
		<button type="button" aria-label={label}>
			{children}
		</button>
	),
}))

vi.mock("@/pages/superMagicMobile/components/icons/MobilePinBadge", () => ({
	MobilePinBadge: ({ "data-testid": dataTestId }: { "data-testid"?: string }) => (
		<div data-testid={dataTestId ?? "mobile-pin-badge"}>pin badge</div>
	),
}))

const defaultProps = {
	workspaces: [],
	isLoading: false,
	searchValue: "",
	debouncedSearchValue: "",
	isWorkspaceEmpty: true,
	isSearchEmpty: false,
	hasMore: false,
	setSearchValue: vi.fn(),
	onSelectWorkspace: vi.fn(),
	onOpenCreateSheet: vi.fn(),
	onOpenSharedWorkspace: vi.fn(),
	onOpenSidebar: vi.fn(),
	onMoreWorkspace: vi.fn(),
	onPinWorkspace: vi.fn(),
	onDeleteWorkspace: vi.fn(),
	onRefresh: vi.fn(() => Promise.resolve()),
	loadMore: vi.fn(() => Promise.resolve()),
}

describe("WorkspaceListView", () => {
	it("uses a generic search placeholder in the mobile bottom search bar", () => {
		render(<WorkspaceListView {...defaultProps} />)

		expect(screen.getByPlaceholderText("搜索")).not.toBeNull()
		expect(screen.queryByPlaceholderText("搜索工作区")).toBeNull()
	})

	it("renders pin swipe action and pinned badge for pinned workspaces", () => {
		render(
			<WorkspaceListView
				{...defaultProps}
				workspaces={[
					{
						id: "ws-pinned",
						name: "Pinned Workspace",
						is_archived: 0,
						is_pinned: true,
						current_topic_id: "topic-1",
						current_project_id: null,
						workspace_status: WorkspaceStatus.FINISHED,
						cooperate_project_count: 2,
						project_count: 2,
						workspace_type: "default",
					},
				]}
				isWorkspaceEmpty={false}
			/>,
		)

		expect(screen.getByTestId("workspace-item-ws-pinned-pin-button")).toHaveTextContent(
			"取消置顶",
		)
		expect(screen.getByTestId("workspace-item-ws-pinned-pin-badge")).not.toBeNull()
	})

	it("renders pin swipe action for unpinned workspaces", () => {
		render(
			<WorkspaceListView
				{...defaultProps}
				workspaces={[
					{
						id: "ws-normal",
						name: "Normal Workspace",
						is_archived: 0,
						is_pinned: false,
						current_topic_id: "topic-2",
						current_project_id: null,
						workspace_status: WorkspaceStatus.FINISHED,
						cooperate_project_count: 0,
						project_count: 0,
						workspace_type: "default",
					},
				]}
				isWorkspaceEmpty={false}
			/>,
		)

		expect(screen.getByTestId("workspace-item-ws-normal-pin-button")).toHaveTextContent("置顶")
		expect(screen.queryByTestId("workspace-item-ws-normal-pin-badge")).toBeNull()
	})
})
