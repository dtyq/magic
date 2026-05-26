import type { ComponentProps } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { WorkspaceProjectListView } from "../WorkspaceProjectListView"

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()

	return {
		...actual,
		useTranslation: () => ({
			t: (key: string, options?: { keyword?: string }) => {
				if (key === "chatList.searchPlaceholder") return "搜索"
				if (key === "project.searchProject") return "搜索项目"
				if (key === "common.cancel") return "取消"
				if (key === "workspace.unnamedWorkspace") return "未命名工作区"
				if (key === "project.createProject") return "新建项目"
				if (key === "project.empty") return "暂无项目"
				if (key === "project.noProjects") return "暂无项目"
				if (key === "project.createNewProject") return "创建新项目"
				if (key === "project.searchNoResults") {
					return `未找到 ${options?.keyword || ""}`.trim()
				}

				return key
			},
		}),
	}
})

vi.mock("antd-mobile", () => ({
	InfiniteScroll: () => <div data-testid="infinite-scroll" />,
}))

vi.mock("@/components/base-mobile/MagicPullToRefresh", () => ({
	default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/pages/superMagicMobile/components/ProjectList", () => ({
	default: () => <div data-testid="workspace-project-list" />,
}))

function renderWorkspaceProjectListView(
	overrides: Partial<ComponentProps<typeof WorkspaceProjectListView>> = {},
) {
	const props: ComponentProps<typeof WorkspaceProjectListView> = {
		selectedWorkspace: null,
		projects: [],
		isLoading: false,
		searchValue: "",
		debouncedSearchValue: "",
		setSearchValue: vi.fn(),
		projectTimeLabels: {},
		isProjectEmpty: true,
		isSearchEmpty: false,
		hasMore: false,
		onBack: vi.fn(),
		onOpenMoreSheet: vi.fn(),
		onRefresh: vi.fn(async () => {}),
		onOpenCreateProjectSheet: vi.fn(),
		onOpenProject: vi.fn(),
		onMoreProject: vi.fn(),
		onPinProject: vi.fn(),
		onDeleteProject: vi.fn(),
		loadMore: vi.fn(async () => {}),
		...overrides,
	}

	return render(<WorkspaceProjectListView {...props} />)
}

describe("WorkspaceProjectListView", () => {
	it("uses a generic search placeholder in the mobile bottom search bar", () => {
		renderWorkspaceProjectListView()

		expect(screen.getByPlaceholderText("搜索")).not.toBeNull()
		expect(screen.queryByPlaceholderText("搜索项目")).toBeNull()
	})

	it("shows the clear button when the search input receives focus", () => {
		renderWorkspaceProjectListView()

		fireEvent.focus(screen.getByPlaceholderText("搜索"))

		expect(screen.getByTestId("workspace-project-page-search-clear")).not.toBeNull()
	})

	it("renders empty state with flex centering classes for vertical alignment", () => {
		renderWorkspaceProjectListView({ isProjectEmpty: true, isSearchEmpty: false })

		const emptyState = screen.getByTestId("workspace-project-page-empty")
		expect(emptyState.className).toContain("flex-1")
		expect(emptyState.className).toContain("justify-center")
		expect(emptyState.className).toContain("min-h-0")
	})

	it("renders search empty state with flex centering classes for vertical alignment", () => {
		renderWorkspaceProjectListView({
			isProjectEmpty: false,
			isSearchEmpty: true,
			debouncedSearchValue: "test",
		})

		const searchEmptyState = screen.getByTestId("workspace-project-page-search-empty")
		expect(searchEmptyState.className).toContain("flex-1")
		expect(searchEmptyState.className).toContain("justify-center")
		expect(searchEmptyState.className).toContain("min-h-0")
	})
})