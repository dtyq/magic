import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import DesignStyleLandingPage, { resolveLayout, resolveScene } from "../DesignStyleLandingPage"
import type { DesignStyle } from "../catalog"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: "en_US", resolvedLanguage: "en_US" },
	}),
}))

vi.mock("../googleFontLoader", () => ({ loadGoogleFonts: vi.fn(async () => undefined) }))

const style: DesignStyle = {
	code: "landing-test",
	title: "Landing test",
	description: "A test style",
	category: "editorial",
	tags: ["test"],
	featured: false,
	preview: { layout: "editorial" },
	design: {
		colors: [
			{ name: "background", value: "#fff" },
			{ name: "primary", value: "#111" },
		],
		typography: [{ name: "body", fontFamily: "Inter", fontSize: "16px" }],
		spacing: [{ name: "sm", value: "8px" }],
		rounded: [{ name: "sm", value: "4px" }],
		components: ["hero", "button-primary"],
		sections: { Hero: "Lead with a clear message." },
	},
}

describe("DesignStyleLandingPage", () => {
	it("maps catalog families to a rich scene and renders DESIGN.md sections as text", () => {
		render(<DesignStyleLandingPage style={style} viewport="desktop" />)

		expect(resolveLayout(style)).toBe("magazine")
		expect(resolveScene(style)).toBe("landing")
		expect(screen.getByTestId("design-style-landing-page")).toHaveAttribute(
			"data-preview-layout",
			"editorial",
		)
		expect(screen.getByTestId("design-style-spec-rail")).toHaveTextContent("Hero")
		expect(screen.getByTestId("design-style-spec-rail")).toHaveTextContent("button-primary")
		expect(screen.getByRole("heading", { name: "Landing test" })).toBeInTheDocument()
		expect(screen.getByTestId("design-style-spec-rail")).toHaveTextContent("A test style")
	})

	it("does not render the specification rail in compact cover previews", () => {
		render(<DesignStyleLandingPage style={style} viewport="mobile" compact />)
		expect(screen.queryByTestId("design-style-spec-rail")).not.toBeInTheDocument()
	})
})
