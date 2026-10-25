import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip"
import { OverlayZIndexProvider } from "@/utils/overlayZIndex"

describe("TooltipContent z-index", () => {
	it("uses default z-tooltip class without inline z-index when outside overlay provider", () => {
		render(
			<Tooltip open>
				<TooltipTrigger>Hover me</TooltipTrigger>
				<TooltipContent data-testid="tooltip">Tooltip text</TooltipContent>
			</Tooltip>,
		)

		const content = screen.getByTestId("tooltip")
		expect(content.className).toContain("z-tooltip")
		expect(content.style.zIndex).toBe("")
	})

	it("applies dynamic zIndex when rendered inside OverlayZIndexProvider", () => {
		render(
			<OverlayZIndexProvider value={1020}>
				<Tooltip open>
					<TooltipTrigger>Hover me</TooltipTrigger>
					<TooltipContent data-testid="tooltip">Tooltip text</TooltipContent>
				</Tooltip>
			</OverlayZIndexProvider>,
		)

		const content = screen.getByTestId("tooltip")
		expect(content.style.zIndex).toBe("1026")
	})

	it("elevates explicit zIndex above parent overlay when inside OverlayZIndexProvider", () => {
		render(
			<OverlayZIndexProvider value={1020}>
				<Tooltip open>
					<TooltipTrigger>Hover me</TooltipTrigger>
					<TooltipContent zIndex={960} data-testid="tooltip">
						Tooltip text
					</TooltipContent>
				</Tooltip>
			</OverlayZIndexProvider>,
		)

		const content = screen.getByTestId("tooltip")
		// 1020 + 6 = 1026, which is > 960
		expect(content.style.zIndex).toBe("1026")
	})

	it("respects explicit zIndex when outside OverlayZIndexProvider", () => {
		render(
			<Tooltip open>
				<TooltipTrigger>Hover me</TooltipTrigger>
				<TooltipContent zIndex={960} data-testid="tooltip">
					Tooltip text
				</TooltipContent>
			</Tooltip>,
		)

		const content = screen.getByTestId("tooltip")
		expect(content.style.zIndex).toBe("960")
	})

	it("strips important editor z-index classes inside OverlayZIndexProvider", () => {
		render(
			<OverlayZIndexProvider value={1020}>
				<Tooltip open>
					<TooltipTrigger>Hover me</TooltipTrigger>
					<TooltipContent className="!z-[960] max-w-48" data-testid="tooltip">
						Tooltip text
					</TooltipContent>
				</Tooltip>
			</OverlayZIndexProvider>,
		)

		const content = screen.getByTestId("tooltip")
		expect(content.style.zIndex).toBe("1026")
		expect(content.className).not.toContain("!z-[960]")
		expect(content.className).toContain("max-w-48")
	})
})
