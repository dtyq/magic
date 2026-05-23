import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
	ProjectShareActionFooter,
	ProjectShareScrollSpacer,
} from "../components/ProjectShareFloatingActionBar"

describe("ProjectShareScrollSpacer", () => {
	it("renders scroll spacer for dual-action variant", () => {
		render(<ProjectShareScrollSpacer variant="dual" testId="dual-bar" />)

		expect(screen.getByTestId("dual-bar-scroll-spacer")).toBeInTheDocument()
	})
})

describe("ProjectShareActionFooter", () => {
	it("applies fixed footer layout and safe-area padding", () => {
		render(
			<ProjectShareActionFooter testId="floating-bar">
				<button type="button">Submit</button>
			</ProjectShareActionFooter>,
		)

		const bar = screen.getByTestId("floating-bar")
		expect(bar.className).toContain("shrink-0")
		expect(bar.className).not.toContain("sticky")
		expect(bar.className).toContain("safe-area-inset-bottom")
	})
})
