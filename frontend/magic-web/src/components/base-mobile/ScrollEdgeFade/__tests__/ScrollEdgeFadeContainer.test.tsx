import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ScrollEdgeFadeContainer } from "../ScrollEdgeFadeContainer"

describe("ScrollEdgeFadeContainer", () => {
	it("uses flex-col outer frame without overflow and in-flow inner scroll port with overflow-y-auto", () => {
		const { container } = render(
			<ScrollEdgeFadeContainer fadeColor="mobile-background" className="flex-1">
				<div data-testid="list-content">content</div>
			</ScrollEdgeFadeContainer>,
		)

		const outer = container.firstElementChild
		expect(outer).toBeTruthy()
		expect(outer?.className).toContain("relative")
		expect(outer?.className).toContain("flex")
		expect(outer?.className).toContain("flex-col")
		expect(outer?.className).not.toMatch(/overflow-y-auto/)

		const scrollPort = outer?.querySelector("[data-testid=list-content]")?.parentElement
		expect(scrollPort?.className).not.toContain("absolute")
		expect(scrollPort?.className).not.toContain("inset-0")
		expect(scrollPort?.className).toContain("flex-1")
		expect(scrollPort?.className).toContain("min-h-0")
		expect(scrollPort?.className).toContain("overflow-y-auto")

		const overlays = outer?.querySelectorAll("[aria-hidden=true]")
		expect(overlays?.length).toBe(2)
		for (const overlay of overlays ?? []) {
			expect(overlay.parentElement).toBe(outer)
			expect(overlay.parentElement).not.toBe(scrollPort)
			expect(overlay.className).toContain("z-10")
			expect(overlay.className).toContain("bg-gradient-to-")
		}

		expect(screen.getByTestId("list-content")).toBeInTheDocument()
	})
})
