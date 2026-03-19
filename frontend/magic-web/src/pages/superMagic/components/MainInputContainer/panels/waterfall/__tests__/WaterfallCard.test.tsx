import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import WaterfallCard from "../WaterfallCard"
import type { OptionItem } from "../../types"

describe("WaterfallCard", () => {
	const mockTemplate: OptionItem = {
		value: "1",
		label: "Test Template",
		thumbnail_url: "https://example.com/image.jpg",
	}

	it("renders template with image", () => {
		render(<WaterfallCard template={mockTemplate} />)

		const image = screen.getByAltText("Test Template")
		expect(image).toBeInTheDocument()
		expect(image).toHaveAttribute("src", mockTemplate.thumbnail_url)
	})

	it("renders loading state when no thumbnail", () => {
		const templateWithoutImage = { ...mockTemplate, thumbnail_url: undefined }
		render(<WaterfallCard template={templateWithoutImage} />)

		expect(screen.getByText("Loading Image...")).toBeInTheDocument()
	})

	it("shows selected state when isSelected is true", () => {
		const { container } = render(<WaterfallCard template={mockTemplate} isSelected />)

		const card = container.querySelector(".ring-2.ring-primary")
		expect(card).toBeInTheDocument()
	})

	it("calls onClick when card is clicked", () => {
		const onClick = vi.fn()

		render(<WaterfallCard template={mockTemplate} onClick={onClick} />)

		const card = screen.getByAltText("Test Template").closest("div")
		if (card) {
			fireEvent.click(card)
			expect(onClick).toHaveBeenCalledWith(mockTemplate)
		}
	})

	it("renders description and sub_text when provided", () => {
		const templateWithText = {
			...mockTemplate,
			description: "Test Description",
			sub_text: "Create Now",
		}

		render(<WaterfallCard template={templateWithText} />)

		expect(screen.getByText("Test Description")).toBeInTheDocument()
		expect(screen.getByText("Create Now")).toBeInTheDocument()
	})

	it("applies hover styles", () => {
		const { container } = render(<WaterfallCard template={mockTemplate} />)

		const card = container.firstChild
		expect(card).toHaveClass("hover:shadow-md")
	})

	it("renders with proper aspect ratio for images", () => {
		render(<WaterfallCard template={mockTemplate} />)

		const image = screen.getByAltText("Test Template")
		expect(image).toHaveStyle({ aspectRatio: "auto" })
	})
})
