import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { HelpIllustration } from "../HelpIllustration"

vi.mock("react-i18next", async (importOriginal) => ({
	...(await importOriginal<typeof import("react-i18next")>()),
	useTranslation: () => ({ t: (key: string) => key }),
}))

const steps = ["a", "b", "c", "d", "e"].map((title) => ({ title, description: `${title} text` }))

describe("HelpIllustration flow", () => {
	it("draws a side arrow only between neighbours in the same row", () => {
		const { container } = render(<HelpIllustration title="Flow" steps={steps} variant="flow" />)
		const items = Array.from(container.querySelectorAll("li"))
		const rightArrows = items.map(
			(item) => item.querySelectorAll("svg.lucide-arrow-right").length,
		)
		// Three columns: cards 2, 3 and 5 follow a neighbour; card 4 starts the second row.
		expect(rightArrows).toEqual([0, 1, 1, 0, 1])
	})

	it("keeps a down arrow before every later card for the stacked layout", () => {
		const { container } = render(<HelpIllustration title="Flow" steps={steps} variant="flow" />)
		const downArrows = Array.from(container.querySelectorAll("li")).map(
			(item) => item.querySelectorAll("svg.lucide-arrow-down").length,
		)
		expect(downArrows).toEqual([0, 1, 1, 1, 1])
	})

	it("has no arrows in the tree and document variants", () => {
		for (const variant of ["tree", "document"] as const) {
			const { container, unmount } = render(
				<HelpIllustration title="Help" steps={steps} variant={variant} />,
			)
			expect(container.querySelectorAll("svg.lucide-arrow-right")).toHaveLength(0)
			unmount()
		}
	})
})
