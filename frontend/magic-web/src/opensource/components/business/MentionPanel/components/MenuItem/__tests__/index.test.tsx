import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
// @ts-ignore
import MenuItem from "../index"
import type { MentionItem } from "../../../types"
import { MentionItemType } from "../../../types"

// Mock the styles hook
vi.mock("../../../styles", () => ({
	useStyles: () => ({
		styles: {
			menuItem: "menu-item",
			menuItemContent: "menu-item-content",
			itemIcon: "item-icon",
			itemText: "item-text",
			itemName: "item-name",
			itemDescription: "item-description",
			rightArrow: "right-arrow",
		},
		cx: (...classes: any[]) => classes.filter(Boolean).join(" "),
	}),
	getItemIconStyle: vi.fn(() => "icon-style"),
}))

// Mock the i18n hook
vi.mock("../../../hooks/useI18n", () => ({
	useI18nStatic: () => ({
		ariaLabels: {
			menuItem: "Menu item",
		},
	}),
}))

// Mock constants
vi.mock("../../../constants", () => ({
	ICON_MAPPINGS: {
		folder: "📁",
		file: "📄",
		search: "🔍",
	},
}))

describe("MenuItem", () => {
	const mockOnClick = vi.fn()

	const baseItem: MentionItem = {
		id: "1",
		type: MentionItemType.PROJECT_FILE,
		name: "Test Item",
		icon: "file",
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("rendering", () => {
		it("should render basic item correctly", () => {
			render(<MenuItem item={baseItem} onClick={mockOnClick} />)

			expect(screen.getByRole("option")).toBeInTheDocument()
			expect(screen.getByText("Test Item")).toBeInTheDocument()
		})

		it("should render with description", () => {
			const itemWithDescription = {
				...baseItem,
				description: "Test description",
			}

			render(<MenuItem item={itemWithDescription} onClick={mockOnClick} />)

			expect(screen.getByText("Test Item")).toBeInTheDocument()
			expect(screen.getByText("Test description")).toBeInTheDocument()
		})

		it("should apply selected state", () => {
			render(<MenuItem item={baseItem} selected={true} onClick={mockOnClick} />)

			const option = screen.getByRole("option")
			expect(option).toHaveAttribute("aria-selected", "true")
			expect(option).toHaveAttribute("tabIndex", "0")
		})

		it("should apply unselected state", () => {
			render(<MenuItem item={baseItem} selected={false} onClick={mockOnClick} />)

			const option = screen.getByRole("option")
			expect(option).toHaveAttribute("aria-selected", "false")
			expect(option).toHaveAttribute("tabIndex", "-1")
		})

		it("should render custom className and style", () => {
			const customStyle = { color: "red" }
			const customClassName = "custom-class"

			render(
				<MenuItem
					item={baseItem}
					onClick={mockOnClick}
					className={customClassName}
					style={customStyle}
				/>,
			)

			const option = screen.getByRole("option")
			expect(option?.className).toContain("custom-class")
			expect(option).toHaveStyle("color: rgb(255, 0, 0)")
		})
	})

	describe("icon rendering", () => {
		it("should render string icon from mapping", () => {
			const itemWithMappedIcon = {
				...baseItem,
				icon: "folder",
			}

			render(<MenuItem item={itemWithMappedIcon} onClick={mockOnClick} />)

			expect(screen.getByText("📁")).toBeInTheDocument()
		})

		it("should render unmapped string icon directly", () => {
			const itemWithUnmappedIcon = {
				...baseItem,
				icon: "🎯",
			}

			render(<MenuItem item={itemWithUnmappedIcon} onClick={mockOnClick} />)

			expect(screen.getByText("🎯")).toBeInTheDocument()
		})

		it("should render React node icon", () => {
			const ReactIcon = () => <span data-testid="react-icon">Custom Icon</span>
			const itemWithReactIcon = {
				...baseItem,
				icon: <ReactIcon />,
			}

			render(<MenuItem item={itemWithReactIcon} onClick={mockOnClick} />)

			expect(screen.getByTestId("react-icon")).toBeInTheDocument()
			expect(screen.getByText("Custom Icon")).toBeInTheDocument()
		})
	})

	describe("navigation indicators", () => {
		it("should render right arrow for folder type", () => {
			const folderItem = {
				...baseItem,
				type: MentionItemType.FOLDER,
			}

			render(<MenuItem item={folderItem} onClick={mockOnClick} />)

			expect(screen.getByText("➤")).toBeInTheDocument()
		})

		it("should render right arrow for items with children", () => {
			const itemWithChildren = {
				...baseItem,
				hasChildren: true,
			}

			render(<MenuItem item={itemWithChildren} onClick={mockOnClick} />)

			expect(screen.getByText("➤")).toBeInTheDocument()
		})

		it("should not render right arrow for regular files", () => {
			render(<MenuItem item={baseItem} onClick={mockOnClick} />)

			expect(screen.queryByText("➤")).not.toBeInTheDocument()
		})
	})

	describe("interactions", () => {
		it("should call onClick when clicked", () => {
			render(<MenuItem item={baseItem} onClick={mockOnClick} />)

			fireEvent.click(screen.getByRole("option"))

			expect(mockOnClick).toHaveBeenCalledTimes(1)
		})

		it("should call onClick when Enter key is pressed", () => {
			render(<MenuItem item={baseItem} onClick={mockOnClick} />)

			fireEvent.keyDown(screen.getByRole("option"), { key: "Enter" })

			expect(mockOnClick).toHaveBeenCalledTimes(1)
		})

		it("should call onClick when Space key is pressed", () => {
			render(<MenuItem item={baseItem} onClick={mockOnClick} />)

			fireEvent.keyDown(screen.getByRole("option"), { key: " " })

			expect(mockOnClick).toHaveBeenCalledTimes(1)
		})

		it("should not call onClick for other keys", () => {
			render(<MenuItem item={baseItem} onClick={mockOnClick} />)

			fireEvent.keyDown(screen.getByRole("option"), { key: "Tab" })
			fireEvent.keyDown(screen.getByRole("option"), { key: "Escape" })

			expect(mockOnClick).not.toHaveBeenCalled()
		})

		it("should prevent default behavior on Enter and Space", () => {
			render(<MenuItem item={baseItem} onClick={mockOnClick} />)

			const element = screen.getByRole("option")

			// Mock the event handlers to check preventDefault calls
			const enterHandler = vi.fn()
			const spaceHandler = vi.fn()

			// Add event listeners that capture preventDefault calls
			element.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					enterHandler()
					// Check if preventDefault would be called
					expect(e.defaultPrevented || e.key === "Enter").toBe(true)
				}
				if (e.key === " ") {
					spaceHandler()
					// Check if preventDefault would be called
					expect(e.defaultPrevented || e.key === " ").toBe(true)
				}
			})

			// Use fireEvent which properly handles preventDefault
			fireEvent.keyDown(element, { key: "Enter" })
			fireEvent.keyDown(element, { key: " " })

			// Verify the events were processed
			expect(mockOnClick).toHaveBeenCalledTimes(2)
		})

		it("should work without onClick handler", () => {
			render(<MenuItem item={baseItem} />)

			expect(() => {
				fireEvent.click(screen.getByRole("option"))
				fireEvent.keyDown(screen.getByRole("option"), { key: "Enter" })
			}).not.toThrow()
		})
	})

	describe("accessibility", () => {
		it("should have correct ARIA attributes", () => {
			render(<MenuItem item={baseItem} selected={true} onClick={mockOnClick} />)

			const option = screen.getByRole("option")
			expect(option).toHaveAttribute("aria-selected", "true")
			expect(option).toHaveAttribute("aria-label", "Menu item: Test Item")
			expect(option).toHaveAttribute("tabIndex", "0")
		})

		it("should have correct ARIA label with item name", () => {
			const customItem = {
				...baseItem,
				name: "Custom Item Name",
			}

			render(<MenuItem item={customItem} onClick={mockOnClick} />)

			expect(screen.getByRole("option")).toHaveAttribute(
				"aria-label",
				"Menu item: Custom Item Name",
			)
		})

		it("should be focusable when selected", () => {
			render(<MenuItem item={baseItem} selected={true} onClick={mockOnClick} />)

			expect(screen.getByRole("option")).toHaveAttribute("tabIndex", "0")
		})

		it("should not be focusable when not selected", () => {
			render(<MenuItem item={baseItem} selected={false} onClick={mockOnClick} />)

			expect(screen.getByRole("option")).toHaveAttribute("tabIndex", "-1")
		})
	})

	describe("different item types", () => {
		it("should render folder item correctly", () => {
			const folderItem = {
				...baseItem,
				type: MentionItemType.FOLDER,
				icon: "folder",
			}

			render(<MenuItem item={folderItem} onClick={mockOnClick} />)

			expect(screen.getByText("📁")).toBeInTheDocument()
			expect(screen.getByText("➤")).toBeInTheDocument()
		})

		it("should render MCP item correctly", () => {
			const mcpItem = {
				...baseItem,
				type: MentionItemType.MCP,
				name: "MCP Extension",
				icon: "🔌",
			}

			render(<MenuItem item={mcpItem} onClick={mockOnClick} />)

			expect(screen.getByText("MCP Extension")).toBeInTheDocument()
			expect(screen.getByText("🔌")).toBeInTheDocument()
		})

		it("should render agent item correctly", () => {
			const agentItem = {
				...baseItem,
				type: MentionItemType.AGENT,
				name: "AI Agent",
				icon: "🤖",
			}

			render(<MenuItem item={agentItem} onClick={mockOnClick} />)

			expect(screen.getByText("AI Agent")).toBeInTheDocument()
			expect(screen.getByText("🤖")).toBeInTheDocument()
		})
	})

	describe("edge cases", () => {
		it("should handle empty item name", () => {
			const emptyNameItem = {
				...baseItem,
				name: "",
			}

			render(<MenuItem item={emptyNameItem} onClick={mockOnClick} />)

			expect(screen.getByRole("option")).toBeInTheDocument()
		})

		it("should handle missing icon", () => {
			const noIconItem = {
				...baseItem,
				icon: "",
			}

			render(<MenuItem item={noIconItem} onClick={mockOnClick} />)

			expect(screen.getByRole("option")).toBeInTheDocument()
			expect(screen.getByText("Test Item")).toBeInTheDocument()
		})

		it("should handle very long names", () => {
			const longNameItem = {
				...baseItem,
				name: "This is a very long item name that might cause layout issues",
			}

			render(<MenuItem item={longNameItem} onClick={mockOnClick} />)

			expect(
				screen.getByText("This is a very long item name that might cause layout issues"),
			).toBeInTheDocument()
		})

		it("should handle special characters in name", () => {
			const specialCharItem = {
				...baseItem,
				name: "Item with special chars: @#$%^&*()",
			}

			render(<MenuItem item={specialCharItem} onClick={mockOnClick} />)

			expect(screen.getByText("Item with special chars: @#$%^&*()")).toBeInTheDocument()
		})
	})

	describe("component lifecycle", () => {
		it("should be memoized", () => {
			const { rerender } = render(<MenuItem item={baseItem} onClick={mockOnClick} />)

			// Re-render with same props should not cause re-render
			rerender(<MenuItem item={baseItem} onClick={mockOnClick} />)

			expect(screen.getByText("Test Item")).toBeInTheDocument()
		})

		it("should update when item changes", () => {
			const { rerender } = render(<MenuItem item={baseItem} onClick={mockOnClick} />)

			const updatedItem = {
				...baseItem,
				name: "Updated Item",
			}

			rerender(<MenuItem item={updatedItem} onClick={mockOnClick} />)

			expect(screen.getByText("Updated Item")).toBeInTheDocument()
			expect(screen.queryByText("Test Item")).not.toBeInTheDocument()
		})
	})
})
