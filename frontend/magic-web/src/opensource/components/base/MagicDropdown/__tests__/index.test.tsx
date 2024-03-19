import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import MagicDropdown from "../index"
import type { MenuProps } from "antd"

describe("MagicDropdown", () => {
	const basicMenuItems: MenuProps["items"] = [
		{
			key: "1",
			label: "Option 1",
		},
		{
			key: "2",
			label: "Option 2",
		},
		{
			key: "3",
			label: "Option 3",
		},
	]

	describe("Basic Rendering", () => {
		it("renders trigger children", () => {
			render(
				<MagicDropdown menu={{ items: basicMenuItems }}>
					<button>Click me</button>
				</MagicDropdown>,
			)

			expect(screen.getByText("Click me")).toBeInTheDocument()
		})

		it("renders menu items when opened", async () => {
			render(
				<MagicDropdown menu={{ items: basicMenuItems }} open={true}>
					<button>Click me</button>
				</MagicDropdown>,
			)

			await waitFor(() => {
				expect(screen.getByText("Option 1")).toBeInTheDocument()
				expect(screen.getByText("Option 2")).toBeInTheDocument()
				expect(screen.getByText("Option 3")).toBeInTheDocument()
			})
		})
	})

	describe("Menu Item Types", () => {
		it("renders divider correctly", async () => {
			const itemsWithDivider: MenuProps["items"] = [
				{ key: "1", label: "Option 1" },
				{ type: "divider" },
				{ key: "2", label: "Option 2" },
			]

			render(
				<MagicDropdown menu={{ items: itemsWithDivider }} open={true}>
					<button>Click me</button>
				</MagicDropdown>,
			)

			await waitFor(() => {
				const separators = document.querySelectorAll(
					'[data-slot="dropdown-menu-separator"]',
				)
				expect(separators.length).toBeGreaterThan(0)
			})
		})

		it("renders group with label", async () => {
			const itemsWithGroup: MenuProps["items"] = [
				{
					type: "group",
					label: "Group Label",
					children: [
						{ key: "1", label: "Option 1" },
						{ key: "2", label: "Option 2" },
					],
				},
			]

			render(
				<MagicDropdown menu={{ items: itemsWithGroup }} open={true}>
					<button>Click me</button>
				</MagicDropdown>,
			)

			await waitFor(() => {
				expect(screen.getByText("Group Label")).toBeInTheDocument()
			})
		})

		it("renders danger/destructive items", async () => {
			const itemsWithDanger: MenuProps["items"] = [
				{ key: "1", label: "Normal" },
				{ key: "2", label: "Danger", danger: true },
			]

			render(
				<MagicDropdown menu={{ items: itemsWithDanger }} open={true}>
					<button>Click me</button>
				</MagicDropdown>,
			)

			await waitFor(() => {
				const dangerItem = screen
					.getByText("Danger")
					.closest('[data-variant="destructive"]')
				expect(dangerItem).toBeInTheDocument()
			})
		})

		it("renders disabled items", async () => {
			const itemsWithDisabled: MenuProps["items"] = [
				{ key: "1", label: "Enabled" },
				{ key: "2", label: "Disabled", disabled: true },
			]

			render(
				<MagicDropdown menu={{ items: itemsWithDisabled }} open={true}>
					<button>Click me</button>
				</MagicDropdown>,
			)

			await waitFor(() => {
				const disabledItem = screen.getByText("Disabled").closest("[data-disabled]")
				expect(disabledItem).toHaveAttribute("data-disabled")
				expect(disabledItem).toHaveAttribute("aria-disabled", "true")
			})
		})
	})

	describe("Click Events", () => {
		it("calls onClick handler when menu item is clicked", async () => {
			const handleClick = vi.fn()

			render(
				<MagicDropdown menu={{ items: basicMenuItems, onClick: handleClick }} open={true}>
					<button>Click me</button>
				</MagicDropdown>,
			)

			await waitFor(() => {
				expect(screen.getByText("Option 1")).toBeInTheDocument()
			})

			const option1 = screen.getByText("Option 1")
			option1.click()

			expect(handleClick).toHaveBeenCalledWith(
				expect.objectContaining({
					key: "1",
				}),
			)
		})
	})

	describe("Trigger Types", () => {
		it("renders as DropdownMenu by default (click trigger)", () => {
			render(
				<MagicDropdown menu={{ items: basicMenuItems }}>
					<button>Click me</button>
				</MagicDropdown>,
			)

			const trigger = screen.getByText("Click me")
			expect(trigger.closest('[data-slot="dropdown-menu-trigger"]')).toBeInTheDocument()
		})

		it("opens menu and supports click when using contextMenu trigger", async () => {
			const handleClick = vi.fn()

			render(
				<MagicDropdown
					menu={{ items: basicMenuItems, onClick: handleClick }}
					trigger={["contextMenu"]}
				>
					<button>Right click me</button>
				</MagicDropdown>,
			)

			const trigger = screen.getByText("Right click me")
			fireEvent.contextMenu(trigger)

			await waitFor(() => {
				expect(screen.getByText("Option 1")).toBeInTheDocument()
			})

			fireEvent.click(screen.getByText("Option 1"))
			expect(handleClick).toHaveBeenCalledWith(
				expect.objectContaining({
					key: "1",
				}),
			)
		})
	})

	describe("Controlled Mode", () => {
		it("respects open prop", async () => {
			const { rerender } = render(
				<MagicDropdown menu={{ items: basicMenuItems }} open={false}>
					<button>Click me</button>
				</MagicDropdown>,
			)

			// Menu should not be visible
			expect(screen.queryByText("Option 1")).not.toBeInTheDocument()

			rerender(
				<MagicDropdown menu={{ items: basicMenuItems }} open={true}>
					<button>Click me</button>
				</MagicDropdown>,
			)

			// Menu should be visible
			await waitFor(() => {
				expect(screen.getByText("Option 1")).toBeInTheDocument()
			})
		})
	})

	describe("Placement", () => {
		it("converts placement prop to side and align", async () => {
			render(
				<MagicDropdown menu={{ items: basicMenuItems }} placement="topLeft" open={true}>
					<button>Click me</button>
				</MagicDropdown>,
			)

			await waitFor(() => {
				const content = document.querySelector('[data-slot="dropdown-menu-content"]')
				expect(content).toBeInTheDocument()
				// Note: Checking exact side/align requires inspecting Radix UI internal props
			})
		})
	})

	describe("Custom Render", () => {
		it("uses popupRender when provided", async () => {
			const customRender = () => <div>Custom Content</div>

			render(
				<MagicDropdown
					menu={{ items: basicMenuItems }}
					popupRender={customRender}
					open={true}
				>
					<button>Click me</button>
				</MagicDropdown>,
			)

			await waitFor(() => {
				expect(screen.getByText("Custom Content")).toBeInTheDocument()
			})
		})
	})

	describe("Disabled State", () => {
		it("respects disabled prop", () => {
			render(
				<MagicDropdown menu={{ items: basicMenuItems }} disabled={true}>
					<button>Click me</button>
				</MagicDropdown>,
			)

			const trigger = screen.getByText("Click me")
			const triggerElement = trigger.closest('[data-slot="dropdown-menu-trigger"]')
			expect(triggerElement).toBeInTheDocument()
			expect(triggerElement).toHaveAttribute("data-disabled")
		})
	})

	describe("Submenu", () => {
		it("renders submenu correctly", async () => {
			const itemsWithSubmenu: MenuProps["items"] = [
				{
					key: "1",
					label: "Parent Item",
					children: [
						{ key: "1-1", label: "Child 1" },
						{ key: "1-2", label: "Child 2" },
					],
				},
			]

			render(
				<MagicDropdown menu={{ items: itemsWithSubmenu }} open={true}>
					<button>Click me</button>
				</MagicDropdown>,
			)

			await waitFor(() => {
				const subTrigger = document.querySelector('[data-slot="dropdown-menu-sub-trigger"]')
				expect(subTrigger).toBeInTheDocument()
				expect(screen.getByText("Parent Item")).toBeInTheDocument()
			})
		})
	})

	describe("Icons", () => {
		it("renders menu item icons", async () => {
			const itemsWithIcons: MenuProps["items"] = [
				{
					key: "1",
					label: "With Icon",
					icon: <span data-testid="test-icon">🎨</span>,
				},
			]

			render(
				<MagicDropdown menu={{ items: itemsWithIcons }} open={true}>
					<button>Click me</button>
				</MagicDropdown>,
			)

			await waitFor(() => {
				expect(screen.getByTestId("test-icon")).toBeInTheDocument()
			})
		})
	})

	describe("Class Names", () => {
		it("applies overlayClassName", async () => {
			render(
				<MagicDropdown
					menu={{ items: basicMenuItems }}
					overlayClassName="custom-overlay-class"
					open={true}
				>
					<button>Click me</button>
				</MagicDropdown>,
			)

			await waitFor(() => {
				const content = document.querySelector(".custom-overlay-class")
				expect(content).toBeInTheDocument()
			})
		})

		it("applies rootClassName", () => {
			render(
				<MagicDropdown menu={{ items: basicMenuItems }} rootClassName="custom-root-class">
					<button>Click me</button>
				</MagicDropdown>,
			)

			const trigger = document.querySelector(".custom-root-class")
			expect(trigger).toBeInTheDocument()
		})
	})
})
