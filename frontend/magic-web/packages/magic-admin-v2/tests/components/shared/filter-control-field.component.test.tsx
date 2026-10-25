import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { FilterControlField } from "../../../src/components/filter-control-field"

describe("filter control field", () => {
	it("renders an optional required marker next to the field label", () => {
		render(
			<FilterControlField label="交接原因" required>
				<textarea aria-label="交接原因输入框" />
			</FilterControlField>,
		)

		expect(screen.getByText("交接原因")).toBeInTheDocument()
		expect(screen.getByText("*")).toHaveClass("text-destructive")
	})
})
