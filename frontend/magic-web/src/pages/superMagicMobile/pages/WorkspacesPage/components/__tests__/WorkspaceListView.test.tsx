import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

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
				if (key === "workspace.searchNoResults") {
					return `未找到 ${options?.keyword || ""}`.trim()
				}
				if (key === "workspace.projectCount") return `${options?.count ?? 0} 个项目`

				return key
			},
		}),
	}
})

vi.mock("antd-mobile", () => ({
	InfiniteScroll: () => <div data-testid="infinite-scroll" />,
}))

vi.mock("@/components/base-mobile/SwipeActionRow", () => ({
	SwipeActionRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

describe("WorkspaceListView", () => {
	it("uses a generic search placeholder in the mobile bottom search bar", () => {
		render(
			<WorkspaceListView
				workspaces={[]}
				isLoading={false}
				searchValue=""
				debouncedSearchValue=""
				isWorkspaceEmpty={true}
				isSearchEmpty={false}
				hasMore={false}
				setSearchValue={vi.fn()}
				onSelectWorkspace={vi.fn()}
				onOpenCreateSheet={vi.fn()}
				onOpenSharedWorkspace={vi.fn()}
				onOpenSidebar={vi.fn()}
				onMoreWorkspace={vi.fn()}
				onDeleteWorkspace={vi.fn()}
				onRefresh={vi.fn(async () => {})}
				loadMore={vi.fn(async () => {})}
			/>,
		)

		expect(screen.getByPlaceholderText("搜索")).not.toBeNull()
		expect(screen.queryByPlaceholderText("搜索工作区")).toBeNull()
	})
})