import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
	ProjectStatus,
	type ProjectListItem,
	TopicMode,
} from "@/pages/superMagic/pages/Workspace/types"
import ProjectItem from ".."

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/components/base-mobile/SwipeActionRow", () => ({
	SwipeActionRow: ({
		children,
		"data-testid": dataTestId,
	}: {
		children: React.ReactNode
		"data-testid"?: string
	}) => <div data-testid={dataTestId}>{children}</div>,
}))

/**
 * 为项目列表行补最小真实测试数据，确保 icon 判定基于真实项目字段。
 */
function createProject(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
	return {
		id: overrides.id ?? "project-1",
		project_status: overrides.project_status ?? ProjectStatus.WAITING,
		project_mode: overrides.project_mode ?? TopicMode.General,
		workspace_id: overrides.workspace_id ?? "workspace-1",
		work_dir: overrides.work_dir ?? "",
		workspace_name: overrides.workspace_name ?? "Workspace",
		project_name: overrides.project_name ?? "测试项目",
		current_topic_id: overrides.current_topic_id ?? "",
		current_topic_status: overrides.current_topic_status ?? "",
		created_at: overrides.created_at ?? "2026-05-10 10:00:00",
		updated_at: overrides.updated_at ?? "2026-05-10 10:00:00",
		tag: overrides.tag ?? "",
		...overrides,
	}
}

describe("ProjectList ProjectItem", () => {
	it("shows blue collaboration icon for owner collaboration project", () => {
		render(
			<ProjectItem
				project={createProject({
					id: "owner-collab",
					tag: "collaboration",
					user_role: "owner",
				})}
				onOpen={vi.fn()}
				updatedAtLabel="刚刚更新"
				isSwipeOpen={false}
				onSwipeOpen={vi.fn()}
				onSwipeClose={vi.fn()}
				onMore={vi.fn()}
				onPin={vi.fn()}
				onDelete={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("super-collaboration-project-tag")).toBeInTheDocument()
		expect(screen.queryByTestId("super-collaboration-shortcut-tag")).not.toBeInTheDocument()
	})

	it("shows gray shortcut icon for non-owner collaboration project", () => {
		render(
			<ProjectItem
				project={createProject({
					id: "joined-collab",
					tag: "collaboration",
					user_role: "manage",
				})}
				onOpen={vi.fn()}
				updatedAtLabel="刚刚更新"
				isSwipeOpen={false}
				onSwipeOpen={vi.fn()}
				onSwipeClose={vi.fn()}
				onMore={vi.fn()}
				onPin={vi.fn()}
				onDelete={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("super-collaboration-shortcut-tag")).toBeInTheDocument()
		expect(screen.queryByTestId("super-collaboration-project-tag")).not.toBeInTheDocument()
	})

	it("shows gray shortcut icon for bound workspace project", () => {
		render(
			<ProjectItem
				project={createProject({
					id: "bind-workspace",
					tag: "",
					is_bind_workspace: true,
					user_role: "editor",
				})}
				onOpen={vi.fn()}
				updatedAtLabel="刚刚更新"
				isSwipeOpen={false}
				onSwipeOpen={vi.fn()}
				onSwipeClose={vi.fn()}
				onMore={vi.fn()}
				onPin={vi.fn()}
				onDelete={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("super-collaboration-shortcut-tag")).toBeInTheDocument()
		expect(screen.queryByTestId("super-collaboration-project-tag")).not.toBeInTheDocument()
	})

	it("does not show collaboration icon for plain project", () => {
		render(
			<ProjectItem
				project={createProject({
					id: "plain-project",
					tag: "",
				})}
				onOpen={vi.fn()}
				updatedAtLabel="刚刚更新"
				isSwipeOpen={false}
				onSwipeOpen={vi.fn()}
				onSwipeClose={vi.fn()}
				onMore={vi.fn()}
				onPin={vi.fn()}
				onDelete={vi.fn()}
			/>,
		)

		expect(screen.queryByTestId("super-collaboration-shortcut-tag")).not.toBeInTheDocument()
		expect(screen.queryByTestId("super-collaboration-project-tag")).not.toBeInTheDocument()
	})

	it("renders collaboration and pinned icons after the project name", () => {
		render(
			<ProjectItem
				project={createProject({
					id: "pinned-owner-collab",
					tag: "collaboration",
					user_role: "owner",
					is_pinned: true,
				})}
				onOpen={vi.fn()}
				updatedAtLabel="刚刚更新"
				isSwipeOpen={false}
				onSwipeOpen={vi.fn()}
				onSwipeClose={vi.fn()}
				onMore={vi.fn()}
				onPin={vi.fn()}
				onDelete={vi.fn()}
			/>,
		)

		const row = screen.getByTestId("workspace-project-row-pinned-owner-collab")
		const titleText = within(row).getByText("测试项目")
		const collaborationTag = within(row).getByTestId("super-collaboration-project-tag")
		const titleRow = titleText.parentElement
		const pinnedSvg = titleRow?.querySelector("svg")

		expect(collaborationTag).toBeInTheDocument()
		expect(pinnedSvg).not.toBeNull()
		expect(titleText).toBeInTheDocument()
		expect(
			titleText.compareDocumentPosition(collaborationTag) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
	})
})
