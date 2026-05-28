import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { MobileListEmptyIcon } from "../mobile-list-empty-icon"

describe("MobileListEmptyIcon", () => {
	it("renders the generic list empty illustration with a stable test id", () => {
		render(<MobileListEmptyIcon />)

		expect(screen.getByTestId("mobile-list-empty-icon")).toBeInTheDocument()
	})

	it("merges optional className overrides", () => {
		render(<MobileListEmptyIcon className="custom-empty-icon" />)

		expect(screen.getByTestId("mobile-list-empty-icon")).toHaveClass("custom-empty-icon")
	})
})
