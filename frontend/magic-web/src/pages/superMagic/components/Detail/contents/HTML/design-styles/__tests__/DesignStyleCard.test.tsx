import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import DesignStyleCard from "../DesignStyleCard"
import { designStyleFixture } from "./fixtures"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ i18n: { language: "zh_CN" }, t: (key: string) => key }),
}))

vi.mock("../DesignStyleThumbnail", () => ({
	default: ({ style }: { style: { code: string } }) => (
		<div data-testid={`design-style-thumbnail-${style.code}`} aria-hidden="true" />
	),
}))

describe("DesignStyleCard", () => {
	it("renders a gallery card with its scene thumbnail and accessible title", () => {
		render(<DesignStyleCard style={designStyleFixture} onSelect={vi.fn()} />)

		expect(
			screen.getByTestId(`design-style-thumbnail-${designStyleFixture.code}`),
		).toBeInTheDocument()
		expect(screen.getByTestId(`design-style-card-${designStyleFixture.code}`)).toHaveAttribute(
			"aria-label",
			designStyleFixture.title,
		)
		expect(screen.queryByRole("img")).not.toBeInTheDocument()
	})

	it("reports selection on click", () => {
		const onSelect = vi.fn()
		render(<DesignStyleCard style={designStyleFixture} onSelect={onSelect} />)

		fireEvent.click(screen.getByTestId(`design-style-card-${designStyleFixture.code}`))

		expect(onSelect).toHaveBeenCalledTimes(1)
	})
})
