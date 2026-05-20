import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ProjectShareFloatingActionBar } from "../components/ProjectShareFloatingActionBar"

describe("ProjectShareFloatingActionBar", () => {
	it("applies sticky layout and safe-area padding on the floating bar", () => {
		render(
			<ProjectShareFloatingActionBar testId="floating-bar">
				<button type="button">Submit</button>
			</ProjectShareFloatingActionBar>,
		)

		const bar = screen.getByTestId("floating-bar")
		expect(bar.className).toContain("sticky")
		expect(bar.className).toContain("bottom-0")
		expect(bar.className).toContain("safe-area-inset-bottom")
	})

	it("renders scroll spacer for dual-action variant", () => {
		render(
			<ProjectShareFloatingActionBar scrollSpacerVariant="dual" testId="dual-bar">
				<button type="button">A</button>
			</ProjectShareFloatingActionBar>,
		)

		expect(screen.getByTestId("dual-bar-scroll-spacer")).toBeInTheDocument()
	})
})
