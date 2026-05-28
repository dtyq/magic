import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { SharedProjectsView } from "../SharedProjectsView"

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()

	return {
		...actual,
		useTranslation: () => ({
			i18n: { language: "zh-CN" },
			t: (key: string, options?: { count?: number; keyword?: string }) => {
				if (key === "common.back") return "返回"
				if (key === "common.cancel") return "取消"
				if (key === "sharedProjects.title") return "共享工作区"
				if (key === "sharedProjects.filter.title") return "筛选"
				if (key === "sharedProjects.tabSharedWithMe") return "他人共享的"
				if (key === "sharedProjects.tabSharedByMe") return "我共享的"
				if (key === "sharedProjects.unknownTime") return "未知时间"
				if (key === "sharedProjects.unknownCreator") return "未知分享人"
				if (key === "sharedProjects.topicCount") {
					return `${options?.count ?? 0} 个话题`
				}
				if (key === "sharedProjects.sharedWith") {
					return `已共享给 ${options?.count ?? 0} 人`
				}
				if (key === "sharedProjects.searchPlaceholder") return "搜索"
				if (key === "sharedProjects.emptyTitle") return "暂无共享项目"
				if (key === "sharedProjects.emptySearchDescription") return "未找到结果"
				if (key === "sharedProjects.emptyDescriptionSharedWithMe") return "empty-with-me"
				if (key === "sharedProjects.emptyDescriptionSharedByMe") return "empty-by-me"
				if (key === "workspace.searchNoResults") {
					return `未找到 ${options?.keyword ?? ""}`.trim()
				}

				return key
			},
		}),
	}
})

vi.mock("antd-mobile", () => ({
	InfiniteScroll: () => <div data-testid="shared-projects-infinite-scroll" />,
}))

vi.mock("@/components/base-mobile/MagicPullToRefresh", () => ({
	default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/pages/superMagicMobile/components/MobileBottomSearchBar", () => ({
	default: ({ value, placeholder }: { value: string; placeholder: string }) => (
		<div data-testid="shared-projects-search-bar">
			<input value={value} placeholder={placeholder} readOnly />
		</div>
	),
}))

vi.mock("@/pages/superMagicMobile/components/icons/mobile-resource-type-icon", () => ({
	MobileResourceTypeIcon: () => <div data-testid="shared-project-icon" />,
}))

vi.mock("@/utils/string", () => ({
	formatRelativeTime: () => (value: string) => `formatted:${value}`,
}))

vi.mock("@/utils/avatar", () => ({
	getAvatarUrl: (value: string) => value,
}))

const defaultProps = {
	tab: "sharedWithMe" as const,
	projects: [],
	isLoading: false,
	isEmpty: false,
	isSearchEmpty: false,
	searchValue: "",
	debouncedSearchValue: "",
	canShowFilter: true,
	activeFilterCount: 0,
	hasMore: false,
	onBack: vi.fn(),
	onTabChange: vi.fn(),
	onOpenFilter: vi.fn(),
	onSearchChange: vi.fn(),
	onOpenProject: vi.fn(),
	onRefresh: vi.fn(() => Promise.resolve()),
	loadMore: vi.fn(() => Promise.resolve()),
}

describe("SharedProjectsView", () => {
	it("renders creator, topic count and time for shared-with-me rows", () => {
		render(
			<SharedProjectsView
				{...defaultProps}
				projects={[
					{
						id: "project-1",
						project_name: "Global Rebrand 2025",
						project_status: "finished",
						project_mode: "",
						workspace_id: "workspace-1",
						work_dir: "/tmp/project-1",
						workspace_name: "Workspace 1",
						current_topic_id: "topic-1",
						current_topic_status: "finished",
						created_at: "2026-05-27T09:00:00.000Z",
						updated_at: "2026-05-27T09:00:00.000Z",
						creator: {
							user_id: "user-1",
							avatar_url: "https://example.com/alice.png",
							nickname: "Alice Chen",
						},
						topic_count: 8,
						tag: "collaboration",
					},
				]}
			/>,
		)

		expect(screen.getByText("Global Rebrand 2025")).toBeInTheDocument()
		expect(screen.getByTestId("shared-projects-creator-avatar-project-1")).toHaveAttribute(
			"src",
			"https://example.com/alice.png",
		)
		expect(
			screen.getByText("Alice Chen · 8 个话题 · formatted:2026-05-27T09:00:00.000Z"),
		).toBeInTheDocument()
	})

	it("falls back to creator initial when shared-with-me rows have no avatar", () => {
		render(
			<SharedProjectsView
				{...defaultProps}
				projects={[
					{
						id: "project-3",
						project_name: "Data Privacy Audit",
						project_status: "finished",
						project_mode: "",
						workspace_id: "workspace-3",
						work_dir: "/tmp/project-3",
						workspace_name: "Workspace 3",
						current_topic_id: "topic-3",
						current_topic_status: "finished",
						created_at: "2026-05-27T10:00:00.000Z",
						updated_at: "2026-05-27T10:00:00.000Z",
						creator: { user_id: "user-2", avatar_url: "", nickname: "Bob Lee" },
						topic_count: 5,
						tag: "collaboration",
					},
				]}
			/>,
		)

		expect(screen.getByTestId("shared-projects-creator-fallback-project-3")).toHaveTextContent(
			"B",
		)
	})

	it("renders the generic list empty icon when there are no shared projects", () => {
		render(<SharedProjectsView {...defaultProps} isEmpty />)

		expect(
			screen.getByTestId("shared-projects-empty").querySelector(
				'[data-testid="mobile-list-empty-icon"]',
			),
		).not.toBeNull()
	})

	it("does not render the generic list empty icon for search-empty state", () => {
		render(
			<SharedProjectsView
				{...defaultProps}
				isSearchEmpty
				debouncedSearchValue="missing"
			/>,
		)

		expect(screen.queryByTestId("mobile-list-empty-icon")).toBeNull()
	})

	it("renders shared-member count, topic count and fallback time for shared-by-me rows", () => {
		render(
			<SharedProjectsView
				{...defaultProps}
				tab="sharedByMe"
				projects={[
					{
						id: "project-2",
						project_name: "Q2 Investor Deck",
						project_status: "finished",
						project_mode: "",
						workspace_id: "workspace-2",
						work_dir: "/tmp/project-2",
						workspace_name: "Workspace 2",
						current_topic_id: "topic-2",
						current_topic_status: "finished",
						created_at: "",
						updated_at: "",
						member_count: 3,
						topic_count: 12,
						tag: "collaboration",
					},
				]}
			/>,
		)

		expect(
			screen.getByText("已共享给 3 人 · 12 个话题 · 未知时间"),
		).toBeInTheDocument()
	})
})