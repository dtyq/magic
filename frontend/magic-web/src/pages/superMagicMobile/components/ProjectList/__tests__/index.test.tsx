import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import ProjectList from "../index"

describe("ProjectList", () => {
	it("renders shared list row skeleton only on first-screen loading", () => {
		render(
			<ProjectList
				projects={[]}
				isLoading
				onOpen={vi.fn()}
				onMore={vi.fn()}
				onPin={vi.fn()}
				onDelete={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("workspace-project-list-loading")).toBeInTheDocument()
		expect(screen.getAllByTestId("mobile-resource-list-row-skeleton")).toHaveLength(5)
	})

	it("does not render skeleton when loading with existing projects", () => {
		render(
			<ProjectList
				projects={[
					{
						id: "p1",
						project_name: "Demo",
						workspace_id: "w1",
					} as never,
				]}
				isLoading
				onOpen={vi.fn()}
				onMore={vi.fn()}
				onPin={vi.fn()}
				onDelete={vi.fn()}
			/>,
		)

		expect(screen.queryByTestId("workspace-project-list-loading")).not.toBeInTheDocument()
	})
})
