import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { OptionItem } from "../../types"
import SlidesPresetGrid from "../SlidesPresetGrid"

describe("SlidesPresetGrid", () => {
	const mockTemplates: OptionItem[] = [
		{
			value: "academic-research",
			label: "Academic Research",
			thumbnail_url: "https://example.com/academic.png",
			preview_url: "https://example.com/academic-preview",
			preview_title: "Academic Preview",
		},
		{
			value: "tech-dark",
			label: "Tech Dark",
			thumbnail_url: "https://example.com/tech-dark.png",
			preview_url: "https://example.com/tech-dark-preview",
			preview_title: "Tech Dark Preview",
		},
	]

	it("renders slide preset cards", () => {
		render(<SlidesPresetGrid templates={mockTemplates} />)

		expect(screen.getByTestId("slides-preset-grid")).toBeInTheDocument()
		expect(screen.getByText("Academic Research")).toBeInTheDocument()
		expect(screen.getByText("Tech Dark")).toBeInTheDocument()
	})

	it("selects a template when card is clicked", () => {
		const handleTemplateClick = vi.fn()

		render(<SlidesPresetGrid templates={mockTemplates} onTemplateClick={handleTemplateClick} />)

		fireEvent.click(screen.getByText("Academic Research"))

		expect(handleTemplateClick).toHaveBeenCalledWith(mockTemplates[0])
	})

	it("opens preview without selecting the template", () => {
		const handleTemplateClick = vi.fn()

		render(<SlidesPresetGrid templates={mockTemplates} onTemplateClick={handleTemplateClick} />)

		const previewButtons = screen.getAllByTestId("slides-preset-card-preview-button")
		fireEvent.click(previewButtons[0])

		expect(handleTemplateClick).not.toHaveBeenCalled()
		expect(screen.getByTestId("slides-preset-preview-dialog-content")).toBeInTheDocument()
		expect(screen.getByTestId("slides-preset-preview-dialog-iframe")).toHaveAttribute(
			"src",
			"https://example.com/academic-preview",
		)
	})

	it("preloads preview iframe after hovering a card for one second", () => {
		vi.useFakeTimers()

		try {
			render(<SlidesPresetGrid templates={mockTemplates} />)

			fireEvent.mouseEnter(screen.getAllByTestId("slides-preset-card")[0])

			act(() => {
				vi.advanceTimersByTime(999)
			})

			expect(
				screen.queryByTestId("slides-preset-preview-preload-iframe"),
			).not.toBeInTheDocument()

			act(() => {
				vi.advanceTimersByTime(1)
			})

			expect(screen.getByTestId("slides-preset-preview-preload-iframe")).toHaveAttribute(
				"src",
				"https://example.com/academic-preview",
			)
		} finally {
			vi.useRealTimers()
		}
	})
})
