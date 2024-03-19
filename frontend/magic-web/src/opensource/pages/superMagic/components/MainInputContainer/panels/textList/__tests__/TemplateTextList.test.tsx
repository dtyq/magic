import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import TemplateTextList from "../TemplateTextList"
import type { OptionItem } from "../../types"

describe("TemplateTextList", () => {
	const mockTemplates: OptionItem[] = [
		{
			value: "template-1",
			label: "Identify key positions and demands",
			description: "Analyze speaker positions",
		},
		{
			value: "template-2",
			label: "Extract core concepts from lecture",
			description: "Break down core concepts",
		},
		{
			value: "template-3",
			label: "Structure recording into report",
			description: "Create research report",
		},
	]

	it("renders all templates", () => {
		render(<TemplateTextList templates={mockTemplates} />)

		mockTemplates.forEach((template) => {
			expect(screen.getByText(template.label!)).toBeInTheDocument()
		})
	})

	it("calls onTemplateClick when template is clicked", () => {
		const handleClick = vi.fn()
		render(<TemplateTextList templates={mockTemplates} onTemplateClick={handleClick} />)

		const firstTemplate = screen.getByText(mockTemplates[0].label!)
		fireEvent.click(firstTemplate)

		expect(handleClick).toHaveBeenCalledWith(mockTemplates[0])
		expect(handleClick).toHaveBeenCalledTimes(1)
	})

	it("applies selected styles to selected template", () => {
		const selectedTemplate = mockTemplates[1]
		const { container } = render(
			<TemplateTextList templates={mockTemplates} selectedTemplate={selectedTemplate} />,
		)

		const buttons = container.querySelectorAll("button")
		const selectedButton = buttons[1]

		expect(selectedButton?.className).toContain("ring-2")
		expect(selectedButton?.className).toContain("ring-blue-600")
	})

	it("displays template description when name is not available", () => {
		const templatesWithoutNames: OptionItem[] = [
			{
				value: "template-1",
				description: "Template description only",
			},
		]

		render(<TemplateTextList templates={templatesWithoutNames} />)

		expect(screen.getByText("Template description only")).toBeInTheDocument()
	})

	it("renders empty list when no templates provided", () => {
		const { container } = render(<TemplateTextList templates={[]} />)

		const buttons = container.querySelectorAll("button")
		expect(buttons).toHaveLength(0)
	})

	it("handles multiple clicks correctly", () => {
		const handleClick = vi.fn()
		render(<TemplateTextList templates={mockTemplates} onTemplateClick={handleClick} />)

		const firstTemplate = screen.getByText(mockTemplates[0].label!)
		const secondTemplate = screen.getByText(mockTemplates[1].label!)

		fireEvent.click(firstTemplate)
		fireEvent.click(secondTemplate)
		fireEvent.click(firstTemplate)

		expect(handleClick).toHaveBeenCalledTimes(3)
		expect(handleClick).toHaveBeenNthCalledWith(1, mockTemplates[0])
		expect(handleClick).toHaveBeenNthCalledWith(2, mockTemplates[1])
		expect(handleClick).toHaveBeenNthCalledWith(3, mockTemplates[0])
	})

	it("renders button elements with correct type", () => {
		const { container } = render(<TemplateTextList templates={mockTemplates} />)

		const buttons = container.querySelectorAll("button")
		buttons.forEach((button) => {
			expect(button.getAttribute("type")).toBe("button")
		})
	})

	it("includes ArrowUpRight icon in each template item", () => {
		const { container } = render(<TemplateTextList templates={mockTemplates} />)

		const svgIcons = container.querySelectorAll("svg")
		expect(svgIcons.length).toBeGreaterThanOrEqual(mockTemplates.length)
	})
})
