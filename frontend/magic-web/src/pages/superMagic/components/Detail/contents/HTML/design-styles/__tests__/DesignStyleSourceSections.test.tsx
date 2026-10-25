import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { splitDesignStyleSections } from "../DesignStyleSourceSections"
import DesignStyleGuidelines from "../DesignStyleGuidelines"
import { clearDesignStyleSourceCache } from "../useDesignStyleSource"
import { designStyleFixture } from "./fixtures"

const getSource = vi.hoisted(() => vi.fn())
vi.mock("@/apis", () => ({
	HtmlDesignStylesApi: { getSource: (...args: unknown[]) => getSource(...args) },
}))
vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}))

describe("complete design guidelines", () => {
	beforeEach(() => {
		getSource.mockReset()
		clearDesignStyleSourceCache()
	})
	it("preserves complete bodies and fenced code headings without frontmatter", () => {
		const sections = splitDesignStyleSections(
			"---\nname: example\n---\n# Layout\nFull layout text.\n```md\n# not a section\n```\n## Motion\nReduce movement.",
		)
		expect(sections.map((section) => section.title)).toEqual(["Layout", "Motion"])
		expect(sections[0].content).toContain("# not a section")
		expect(sections[1].content).toContain("Reduce movement.")
	})
	it("loads full text only on expansion and renders source markup as inert text", async () => {
		getSource.mockResolvedValue({
			style_code: designStyleFixture.code,
			content:
				"# Layout\nFull text beyond the catalog excerpt.\n<script>window.bad = true</script>",
			sha256: "fixture",
		})
		render(<DesignStyleGuidelines style={designStyleFixture} />)
		expect(getSource).not.toHaveBeenCalled()
		const disclosure = screen
			.getByText("htmlEditor.designStyle.fullGuidelines")
			.closest("details")
		if (!disclosure) throw new Error("Missing guidelines disclosure")
		disclosure.open = true
		fireEvent(disclosure, new Event("toggle"))
		await waitFor(() =>
			expect(screen.getByTestId("design-style-source-sections")).toBeInTheDocument(),
		)
		expect(screen.getByTestId("design-style-source-sections")).toHaveTextContent(
			"Full text beyond the catalog excerpt.",
		)
		expect(
			screen.getByTestId("design-style-source-sections").querySelector("script"),
		).toBeNull()
		expect(getSource).toHaveBeenCalledTimes(1)
	})
})
