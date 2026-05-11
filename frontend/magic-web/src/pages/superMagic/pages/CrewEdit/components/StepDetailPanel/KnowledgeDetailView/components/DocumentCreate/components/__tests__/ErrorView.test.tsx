import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { ErrorView } from "../ErrorView"

describe("ErrorView", () => {
	it("should render error message", () => {
		render(<ErrorView message="Test Error" />)
		expect(screen.getByText("Test Error")).toBeInTheDocument()
	})

	it("should render error description when provided", () => {
		render(<ErrorView message="Test Error" description="Test Description" />)
		expect(screen.getByText("Test Error")).toBeInTheDocument()
		expect(screen.getByText("Test Description")).toBeInTheDocument()
	})

	it("should not render description when not provided", () => {
		const { container } = render(<ErrorView message="Test Error" />)
		const description = container.querySelector("p")
		expect(description).toBeNull()
	})

	it("should have correct styling classes", () => {
		const { container } = render(<ErrorView message="Test Error" />)
		const wrapper = container.firstChild as HTMLElement
		expect(wrapper.className).toContain("flex")
		expect(wrapper.className).toContain("items-center")
		expect(wrapper.className).toContain("justify-center")
	})
})
