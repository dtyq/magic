import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import ProjectSider from "../index"

vi.mock("@/pages/superMagic/components/LazyGuideTour", () => ({
	GuideTourElementId: { ProjectFileSider: "tour-project-file-sider" },
}))

vi.mock("@/components/shadcn-ui/smooth-tabs", () => ({
	SmoothTabs: ({ tabs }: { tabs: Array<{ value: string }> }) => (
		<div data-testid="sider-tabs">{tabs.map((tab) => tab.value).join(",")}</div>
	),
}))

const trailingAction = <button data-testid="sider-trailing-action" type="button" />

describe("ProjectSider headerTrailingAction", () => {
	it("renders the action next to the tab bar when there are several tabs", () => {
		render(
			<ProjectSider
				items={[
					{ key: "files", title: "Files", content: <div>files</div> },
					{ key: "share", title: "Share", content: <div>share</div> },
				]}
				headerTrailingAction={trailingAction}
			/>,
		)

		expect(screen.getByTestId("sider-tabs")).toBeInTheDocument()
		expect(screen.getByTestId("sider-trailing-action")).toBeInTheDocument()
	})

	it("ignores the action when only one item is visible (no tab bar to attach to)", () => {
		render(
			<ProjectSider
				items={[{ key: "files", title: "Files", content: <div>files</div> }]}
				headerTrailingAction={trailingAction}
			/>,
		)

		expect(screen.queryByTestId("sider-tabs")).not.toBeInTheDocument()
		expect(screen.queryByTestId("sider-trailing-action")).not.toBeInTheDocument()
	})
})
