import { render, screen } from "@testing-library/react"
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

describe("WorkspaceProjectListView", () => {
	it("uses a generic search placeholder in the mobile bottom search bar", () => {
		render(
			<WorkspaceProjectListView
				selectedWorkspace={null}
				projects={[]}
				isLoading={false}
				searchValue=""
				debouncedSearchValue=""
				setSearchValue={vi.fn()}
				projectTimeLabels={{}}
				isProjectEmpty={true}
				isSearchEmpty={false}
				hasMore={false}
				onBack={vi.fn()}
				onOpenMoreSheet={vi.fn()}
				onRefresh={vi.fn(async () => {})}
				onOpenCreateProjectSheet={vi.fn()}
				onOpenProject={vi.fn()}
				onMoreProject={vi.fn()}
				onPinProject={vi.fn()}
				onDeleteProject={vi.fn()}
				loadMore={vi.fn(async () => {})}
			/>,
		)

		expect(screen.getByPlaceholderText("搜索")).not.toBeNull()
		expect(screen.queryByPlaceholderText("搜索项目")).toBeNull()
	})
})