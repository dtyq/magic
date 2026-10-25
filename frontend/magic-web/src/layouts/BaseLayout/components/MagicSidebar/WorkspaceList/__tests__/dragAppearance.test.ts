import { describe, expect, it } from "vitest"
import { clearSidebarDragAppearance, setSidebarDragAppearance } from "../dragAppearance"
import { createSidebarDragImage, createSidebarDropIndicator } from "../dndUtils"

describe("sidebar drag appearance lifecycle", () => {
	it("cleans up temporary appearance without removing component classes or measured geometry", () => {
		const target = document.createElement("div")
		target.className = "workspace !bg-[#eef3fd]"
		target.style.transform = "translateY(216px)"
		target.style.height = "36px"
		setSidebarDragAppearance(target, "workspace")
		setSidebarDragAppearance(target, "disabled")
		expect(target).not.toHaveClass("!rounded-xl")
		expect(target).toHaveClass("!opacity-[0.45]")
		clearSidebarDragAppearance(target)
		clearSidebarDragAppearance(target)
		expect(target.className).toBe("workspace !bg-[#eef3fd]")
		expect(target.style.transform).toBe("translateY(216px)")
		expect(target.style.height).toBe("36px")
	})

	it("creates and removes native preview and insertion nodes without inline appearance", () => {
		const image = createSidebarDragImage("Project", "project")!
		const indicator = createSidebarDropIndicator()
		expect(image.textContent).toBe("Project")
		expect(image.querySelector("svg")).toBeInTheDocument()
		expect(image).not.toHaveAttribute("style")
		expect(indicator).not.toHaveAttribute("style")
		expect(indicator).toHaveClass("hidden", "fixed")
		image.remove()
		indicator.remove()
		expect(image.isConnected).toBe(false)
		expect(indicator.isConnected).toBe(false)
	})
})
