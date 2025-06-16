import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import Blockquote from "../index"

describe("Blockquote", () => {
	it("should render blockquote with children", () => {
		render(
			<Blockquote>
				<p>This is a blockquote content</p>
			</Blockquote>,
		)

		const blockquote = screen.getByText("This is a blockquote content").closest("blockquote")
		expect(blockquote).toBeInTheDocument()
		expect(blockquote).toHaveTextContent("This is a blockquote content")
	})

	it("should pass through all props to blockquote element", () => {
		const testId = "test-blockquote"
		render(
			<Blockquote data-testid={testId} className="custom-class">
				<p>Content</p>
			</Blockquote>,
		)

		const blockquote = screen.getByTestId(testId)
		expect(blockquote).toBeInTheDocument()
		expect(blockquote?.className).toContain("custom-class")
	})

	it("should render nested elements correctly", () => {
		render(
			<Blockquote>
				<h3>Title in blockquote</h3>
				<p>Paragraph in blockquote</p>
				<code>Code in blockquote</code>
			</Blockquote>,
		)

		const blockquote = screen.getByText("Title in blockquote").closest("blockquote")
		expect(blockquote).toBeInTheDocument()

		// Check nested elements
		expect(screen.getByText("Title in blockquote")).toBeInTheDocument()
		expect(screen.getByText("Paragraph in blockquote")).toBeInTheDocument()
		expect(screen.getByText("Code in blockquote")).toBeInTheDocument()
	})
})
