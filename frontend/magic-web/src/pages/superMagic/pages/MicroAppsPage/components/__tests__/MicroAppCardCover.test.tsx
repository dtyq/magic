import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import MicroAppCardCover from "../MicroAppCardCover"

describe("MicroAppCardCover", () => {
	it.each([false, true])("renders the supplied cover in compact=%s", (compact) => {
		const { container } = render(
			<MicroAppCardCover id="app" coverUrl="/cover.png" compact={compact} />,
		)
		expect(container.querySelector("img")).toHaveAttribute("src", "/cover.png")
		expect(container.querySelector('[data-cover="image"]')).toBeInTheDocument()
	})

	it("falls back after an image error and accepts a replacement cover", () => {
		const { container, rerender, getByAltText } = render(
			<MicroAppCardCover id="app" coverUrl="/broken.png" />,
		)
		fireEvent.error(getByAltText(""))
		expect(container.querySelector("img")).not.toBeInTheDocument()
		expect(container.querySelector('[data-cover="placeholder"]')).toBeInTheDocument()
		rerender(<MicroAppCardCover id="app" coverUrl="/replacement.png" />)
		expect(container.querySelector("img")).toHaveAttribute("src", "/replacement.png")
	})

	it("does not request an image for apps without a cover", () => {
		const { container } = render(<MicroAppCardCover id="app" />)
		expect(container.querySelector("img")).not.toBeInTheDocument()
		expect(container.querySelector('[data-cover="placeholder"]')).toBeInTheDocument()
	})
})
