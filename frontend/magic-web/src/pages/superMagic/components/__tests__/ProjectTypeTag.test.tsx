import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import ProjectTypeTag from "../ProjectTypeTag"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/components/base/MagicTooltip", () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe("ProjectTypeTag", () => {
	it("marks AI canvas projects like the other special project modes", () => {
		render(<ProjectTypeTag projectMode="ai-canvas" />)
		expect(screen.getByTestId("project-type-tag")).toHaveAttribute(
			"aria-label",
			"projectTypeTag.aiCanvas",
		)
	})

	it("renders at the requested size (14px in recent lists)", () => {
		render(<ProjectTypeTag projectMode="ai-canvas" size={14} />)
		const tag = screen.getByTestId("project-type-tag")
		expect(tag.style.width).toBe("14px")
		expect(tag.querySelector("svg")).toHaveAttribute("width", "14")
	})

	it("leaves line weight to the global lucide stroke and MagiClaw's own default", () => {
		render(<ProjectTypeTag projectMode="magiclaw" size={14} uniformStroke />)
		// No strokeWidth is passed (see src/styles/lucide.css): MagiClaw keeps its default 1 on
		// its 16-unit grid, which renders like lucide's global 1.5 on 24 units.
		expect(screen.getByTestId("project-type-tag").querySelector("path")).toHaveAttribute(
			"stroke-width",
			"1",
		)
	})

	it("shows nothing for ordinary projects", () => {
		const { container } = render(<ProjectTypeTag projectMode="general" />)
		expect(container).toBeEmptyDOMElement()
	})
})
