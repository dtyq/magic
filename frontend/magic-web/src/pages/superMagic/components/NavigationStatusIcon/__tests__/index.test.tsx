import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ProjectStatus, WorkspaceStatus } from "@/pages/superMagic/pages/Workspace/types"
import NavigationStatusIcon from "../index"

vi.mock("@/pages/superMagic/components/MessageHeader/components/StatusIcon", () => ({
	default: () => <div data-testid="navigation-status-icon-running-dot" />,
}))

describe("NavigationStatusIcon", () => {
	it("renders running status icon for running workspace", () => {
		render(<NavigationStatusIcon itemType="workspace" status={WorkspaceStatus.RUNNING} />)

		expect(screen.getByTestId("navigation-status-icon-root")).toBeInTheDocument()
		expect(screen.getByTestId("navigation-status-icon-running")).toBeInTheDocument()
		expect(screen.getByTestId("navigation-status-icon-running-dot")).toBeInTheDocument()
		expect(screen.queryByTestId("navigation-status-icon-default")).not.toBeInTheDocument()
	})

	it("renders default workspace icon for waiting workspace", () => {
		render(<NavigationStatusIcon itemType="workspace" status={WorkspaceStatus.WAITING} />)

		expect(screen.getByTestId("navigation-status-icon-default")).toHaveAttribute(
			"data-icon-kind",
			"workspace",
		)
		expect(screen.queryByTestId("navigation-status-icon-running")).not.toBeInTheDocument()
	})

	it("renders default project icon for non-running project", () => {
		render(<NavigationStatusIcon itemType="project" status={ProjectStatus.WAITING} />)

		expect(screen.getByTestId("navigation-status-icon-default")).toHaveAttribute(
			"data-icon-kind",
			"project",
		)
		expect(screen.queryByTestId("navigation-status-icon-running")).not.toBeInTheDocument()
	})

	it("treats missing status as default icon", () => {
		render(<NavigationStatusIcon itemType="project" />)

		expect(screen.getByTestId("navigation-status-icon-default")).toBeInTheDocument()
		expect(screen.queryByTestId("navigation-status-icon-running")).not.toBeInTheDocument()
	})

	it("renders nothing when showDefaultIcon is false and status is not running", () => {
		const { container } = render(
			<NavigationStatusIcon
				itemType="project"
				status={ProjectStatus.WAITING}
				showDefaultIcon={false}
			/>,
		)

		expect(container.firstChild).toBeNull()
		expect(screen.queryByTestId("navigation-status-icon-root")).not.toBeInTheDocument()
	})

	it("still renders running icon when showDefaultIcon is false", () => {
		render(
			<NavigationStatusIcon
				itemType="project"
				status={ProjectStatus.RUNNING}
				showDefaultIcon={false}
			/>,
		)

		expect(screen.getByTestId("navigation-status-icon-running")).toBeInTheDocument()
		expect(screen.queryByTestId("navigation-status-icon-default")).not.toBeInTheDocument()
	})
})
