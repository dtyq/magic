import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import DesignStyleHtmlPreview, { getDesignStylePreviewUrl } from "../DesignStyleHtmlPreview"
import { designStyleFixture } from "./fixtures"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("DesignStyleHtmlPreview", () => {
	it("loads the style-specific static page in a scriptless sandbox", () => {
		render(<DesignStyleHtmlPreview style={designStyleFixture} viewport="mobile" />)

		const iframe = screen.getByTestId("design-style-scene-fixture-style")
		expect(iframe.tagName).toBe("IFRAME")
		expect(iframe).toHaveAttribute("sandbox", "")
		expect(iframe.getAttribute("sandbox")).not.toContain("allow-scripts")
		expect(iframe.getAttribute("sandbox")).not.toContain("allow-same-origin")
		expect(iframe).not.toHaveAttribute("allow")
		expect(iframe).toHaveAttribute("src", getDesignStylePreviewUrl(designStyleFixture.code))
		expect(iframe).toHaveAttribute(
			"data-preview-url",
			getDesignStylePreviewUrl(designStyleFixture.code),
		)
		expect(iframe).not.toHaveAttribute("srcdoc")
		expect(iframe).toHaveAttribute("data-viewport", "mobile")
		expect(iframe).toHaveAttribute("data-scene", "landing")
		expect(screen.getByTestId("design-style-html-loading")).toBeInTheDocument()
	})

	it("removes loading feedback after the isolated document loads", () => {
		render(<DesignStyleHtmlPreview style={designStyleFixture} viewport="desktop" />)
		const iframe = screen.getByTestId("design-style-scene-fixture-style")

		fireEvent.load(iframe)

		expect(screen.getByTestId("design-style-html-preview")).toHaveAttribute(
			"data-status",
			"loaded",
		)
		expect(screen.queryByTestId("design-style-html-loading")).not.toBeInTheDocument()
	})

	it("remounts and resets the loading state when selecting another style", () => {
		const { rerender } = render(
			<DesignStyleHtmlPreview style={designStyleFixture} viewport="desktop" />,
		)
		const firstIframe = screen.getByTestId("design-style-scene-fixture-style")
		fireEvent.load(firstIframe)

		const nextStyle = { ...designStyleFixture, code: "next-style", title: "Next Style" }
		rerender(<DesignStyleHtmlPreview style={nextStyle} viewport="desktop" />)

		expect(screen.getByTestId("design-style-html-loading")).toBeInTheDocument()
		expect(screen.getByTestId("design-style-scene-next-style")).not.toBe(firstIframe)
		expect(screen.getByTestId("design-style-scene-next-style")).toHaveAttribute(
			"src",
			getDesignStylePreviewUrl("next-style"),
		)
	})
})
