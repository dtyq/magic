import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { StepLoadingSkeleton } from "../StepLoadingSkeleton"

describe("StepLoadingSkeleton", () => {
	it("should render loading skeleton", () => {
		const { container } = render(<StepLoadingSkeleton />)
		const wrapper = container.firstChild as HTMLElement
		expect(wrapper).toBeInTheDocument()
	})

	it("should have correct layout classes", () => {
		const { container } = render(<StepLoadingSkeleton />)
		const wrapper = container.firstChild as HTMLElement
		expect(wrapper.className).toContain("flex")
		expect(wrapper.className).toContain("items-center")
		expect(wrapper.className).toContain("justify-center")
	})

	it("should render spinner with animate-spin class", () => {
		const { container } = render(<StepLoadingSkeleton />)
		const spinner = container.querySelector(".animate-spin")
		expect(spinner).toBeInTheDocument()
	})
})
