import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import TemplateWaterfall from "../TemplateWaterfall"
import type { OptionItem } from "../../types"

describe("TemplateWaterfall", () => {
	const mockTemplates: OptionItem[] = [
		{
			value: "1",
			label: "Template 1",
			thumbnail_url: "https://example.com/image1.jpg",
		},
		{
			value: "2",
			label: "Template 2",
			thumbnail_url: "https://example.com/image2.jpg",
		},
		{
			value: "3",
			label: "Template 3",
			thumbnail_url: "https://example.com/image3.jpg",
		},
		{
			value: "4",
			label: "Template 4",
			thumbnail_url: "https://example.com/image4.jpg",
		},
		{
			value: "5",
			label: "Template 5",
			thumbnail_url: "https://example.com/image5.jpg",
		},
		{
			value: "6",
			label: "Template 6",
			thumbnail_url: "https://example.com/image6.jpg",
		},
	]

	it("renders templates in columns", () => {
		render(<TemplateWaterfall templates={mockTemplates} />)

		// Check that all templates are rendered
		mockTemplates.forEach((template) => {
			expect(screen.getByAltText(template.label)).toBeInTheDocument()
		})
	})

	it("distributes templates across 3 columns by default", () => {
		const { container } = render(<TemplateWaterfall templates={mockTemplates} />)

		// Should have 3 columns (flex-1 columns inside the container)
		const columns = container.querySelectorAll(".flex.flex-1.flex-col")
		expect(columns).toHaveLength(3)
	})

	it("calls onTemplateClick when a template is clicked", () => {
		const onTemplateClick = vi.fn()

		render(<TemplateWaterfall templates={mockTemplates} onTemplateClick={onTemplateClick} />)

		const firstTemplate = screen.getByAltText("Template 1")
		const card = firstTemplate.closest("div")
		if (card) {
			fireEvent.click(card)
			expect(onTemplateClick).toHaveBeenCalledWith(mockTemplates[0])
		}
	})

	it("shows selected state for selected template", () => {
		const selectedTemplate = mockTemplates[0]

		const { container } = render(
			<TemplateWaterfall templates={mockTemplates} selectedTemplate={selectedTemplate} />,
		)

		// Check for ring-2 ring-primary class on selected card
		const selectedCard = container.querySelector(".ring-2.ring-primary")
		expect(selectedCard).toBeInTheDocument()
	})

	it("renders with custom max column count", () => {
		const { container } = render(<TemplateWaterfall templates={mockTemplates} maxColumns={2} />)

		// maxColumns=2 → at most 2 flex-1 column divs
		const columns = container.querySelectorAll(".flex.flex-1.flex-col")
		expect(columns.length).toBeLessThanOrEqual(2)
	})

	it("handles empty templates array", () => {
		const { container } = render(<TemplateWaterfall templates={[]} />)

		// Columns are still rendered (empty), count depends on container width
		const columns = container.querySelectorAll(".flex.flex-1.flex-col")
		expect(columns.length).toBeGreaterThanOrEqual(1)
	})
})
