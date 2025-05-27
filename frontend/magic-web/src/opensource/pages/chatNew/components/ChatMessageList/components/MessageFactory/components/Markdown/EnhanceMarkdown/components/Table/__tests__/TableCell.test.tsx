import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import TableCell from "../TableCell"

// Mock react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: vi.fn(() => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"markdownTable.clickToExpand": "Click to expand full content",
			}
			return translations[key] || key
		},
	})),
}))

// Mock antd-style
vi.mock("antd-style", () => ({
	createStyles: () => () => ({
		styles: {
			longText: "long-text-class",
		},
		cx: (...classes: any[]) => classes.filter(Boolean).join(" "),
	}),
}))

// Mock useTableI18n
vi.mock("../useTableI18n", () => ({
	useTableI18n: () => ({
		clickToExpand: "Click to expand full content",
	}),
}))

describe("TableCell", () => {
	it("should render normal table data cell", () => {
		render(<TableCell>Normal Text</TableCell>)
		const cell = screen.getByRole("cell")
		expect(cell).toBeDefined()
		expect(cell.textContent).toBe("Normal Text")
	})

	it("should render table header cell", () => {
		render(<TableCell isHeader>Table Header Text</TableCell>)
		const headerCell = screen.getByRole("columnheader")
		expect(headerCell).toBeDefined()
		expect(headerCell.textContent).toBe("Table Header Text")
	})

	it("should handle short text content correctly", () => {
		render(<TableCell>Short Text</TableCell>)
		const cell = screen.getByRole("cell")
		expect(cell.textContent).toBe("Short Text")
		// Short text should not have long text wrapper
		expect(cell.querySelector(".long-text-class")).toBeNull()
	})

	it("should add long text wrapper for extra long text", () => {
		const longText =
			"This is a very long text content, exceeding the threshold of 50 characters, should be wrapped in a long text component for processing, so that it can ensure more than 50 characters"
		render(<TableCell>{longText}</TableCell>)

		const longTextWrapper = screen.getByTitle("Click to expand full content")
		expect(longTextWrapper).toBeDefined()
		expect(longTextWrapper.textContent).toBe(longText)
	})

	it("should support click to expand functionality for long text", () => {
		const longText =
			"This is a very long text content, exceeding the threshold of 50 characters, should be wrapped in a long text component for processing, so that it can ensure more than 50 characters"
		render(<TableCell>{longText}</TableCell>)

		const longTextWrapper = screen.getByTitle("Click to expand full content")
		expect(longTextWrapper).toBeDefined()

		// Click to expand
		fireEvent.click(longTextWrapper)

		// After expansion, should not have title attribute
		expect(longTextWrapper.title).toBe("")
	})

	it("should automatically set text alignment based on content", () => {
		// Test left alignment (default)
		const { unmount: unmount1 } = render(<TableCell>普通文本</TableCell>)
		let cell = screen.getByRole("cell")
		expect(cell.style.textAlign).toBe("left")
		unmount1()

		// Test right alignment (numbers)
		const { unmount: unmount2 } = render(<TableCell>12345</TableCell>)
		cell = screen.getByRole("cell")
		expect(cell.style.textAlign).toBe("right")
		unmount2()

		// Test center alignment (special symbols)
		const { unmount: unmount3 } = render(<TableCell>→</TableCell>)
		cell = screen.getByRole("cell")
		expect(cell.style.textAlign).toBe("center")
		unmount3()
	})

	it("should handle array form child elements", () => {
		render(
			<TableCell>
				{[
					"Text 1",
					"This is a very long text content, exceeding the threshold of 50 characters, should be wrapped in a long text component for processing, so that it can ensure more than 50 characters",
				]}
			</TableCell>,
		)

		const cell = screen.getByRole("cell")
		expect(cell.textContent).toContain("Text 1")
		expect(cell.textContent).toContain("This is a very long text content")
	})

	it("should preserve whitespace and special character styles", () => {
		render(<TableCell>Text with space</TableCell>)
		const cell = screen.getByRole("cell")
		expect(cell.style.whiteSpace).toBe("pre-wrap")
	})

	it("should handle empty content correctly", () => {
		render(<TableCell>{""}</TableCell>)
		const cell = screen.getByRole("cell")
		expect(cell).toBeDefined()
		expect(cell.textContent).toBe("")
	})
})
