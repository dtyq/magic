import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { OverlayZIndexProvider } from "@/utils/overlayZIndex"
import { TAILWIND_Z_INDEX_CLASSES } from "../../../constants/z-index"
import {
	EditorSelectContent,
	EditorPopoverContent,
	EditorDropdownMenuContent,
} from "../EditorFloating"
import { Select, SelectTrigger } from "@/components/shadcn-ui/select"
import { Popover, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { DropdownMenu, DropdownMenuTrigger } from "@/components/shadcn-ui/dropdown-menu"

describe("EditorFloating", () => {
	describe("when outside of OverlayZIndexProvider (default workspace)", () => {
		it("applies default tailwind z-index classes without custom inline zIndex", () => {
			render(
				<>
					<Select open>
						<SelectTrigger>Trigger</SelectTrigger>
						<EditorSelectContent data-testid="select-content">
							<div>Item</div>
						</EditorSelectContent>
					</Select>

					<Popover open>
						<PopoverTrigger>Trigger</PopoverTrigger>
						<EditorPopoverContent data-testid="popover-content">
							<div>Content</div>
						</EditorPopoverContent>
					</Popover>

					<DropdownMenu open>
						<DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
						<EditorDropdownMenuContent data-testid="dropdown-content">
							<div>Item</div>
						</EditorDropdownMenuContent>
					</DropdownMenu>
				</>,
			)

			const select = screen.getByTestId("select-content")
			expect(select.className).toContain(TAILWIND_Z_INDEX_CLASSES.EDITOR_FLOATING.SELECT)
			expect(select.style.zIndex).toBe("")

			const popover = screen.getByTestId("popover-content")
			expect(popover.className).toContain(TAILWIND_Z_INDEX_CLASSES.EDITOR_FLOATING.POPOVER)
			expect(popover.style.zIndex).toBe("")

			const dropdown = screen.getByTestId("dropdown-content")
			expect(dropdown.className).toContain(TAILWIND_Z_INDEX_CLASSES.EDITOR_FLOATING.DROPDOWN)
			expect(dropdown.style.zIndex).toBe("")
		})
	})

	describe("when inside of OverlayZIndexProvider (modal / preview / context panel)", () => {
		it("omits hardcoded classes so overlay primitives can elevate", () => {
			const parentZIndex = 1020

			render(
				<OverlayZIndexProvider value={parentZIndex}>
					<Select open>
						<SelectTrigger>Trigger</SelectTrigger>
						<EditorSelectContent data-testid="dynamic-select-content">
							<div>Item</div>
						</EditorSelectContent>
					</Select>

					<Popover open>
						<PopoverTrigger>Trigger</PopoverTrigger>
						<EditorPopoverContent data-testid="dynamic-popover-content">
							<div>Content</div>
						</EditorPopoverContent>
					</Popover>

					<DropdownMenu open>
						<DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
						<EditorDropdownMenuContent data-testid="dynamic-dropdown-content">
							<div>Item</div>
						</EditorDropdownMenuContent>
					</DropdownMenu>
				</OverlayZIndexProvider>,
			)

			const select = screen.getByTestId("dynamic-select-content")
			expect(select.style.zIndex).toBe(String(parentZIndex + 10))
			expect(select.className).not.toContain(TAILWIND_Z_INDEX_CLASSES.EDITOR_FLOATING.SELECT)

			const popover = screen.getByTestId("dynamic-popover-content")
			expect(popover.style.zIndex).toBe(String(parentZIndex + 10))
			expect(popover.className).not.toContain(
				TAILWIND_Z_INDEX_CLASSES.EDITOR_FLOATING.POPOVER,
			)

			const dropdown = screen.getByTestId("dynamic-dropdown-content")
			expect(dropdown.style.zIndex).toBe(String(parentZIndex + 10))
			expect(dropdown.className).not.toContain(
				TAILWIND_Z_INDEX_CLASSES.EDITOR_FLOATING.DROPDOWN,
			)
		})
	})
})
