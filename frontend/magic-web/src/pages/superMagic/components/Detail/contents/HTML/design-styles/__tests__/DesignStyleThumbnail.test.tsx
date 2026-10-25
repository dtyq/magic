import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import DesignStyleThumbnail from "../DesignStyleThumbnail"
import { designStyleFixture } from "./fixtures"

describe("DesignStyleThumbnail", () => {
	it("uses the static landing document for the cover", () => {
		render(<DesignStyleThumbnail style={designStyleFixture} />)

		const frame = screen.getByTitle(`${designStyleFixture.title} preview`)
		expect(frame).toHaveAttribute("sandbox", "")
		expect(frame).toHaveAttribute(
			"src",
			`/html-design-style/previews/${encodeURIComponent(designStyleFixture.code)}.html`,
		)
	})
})
