import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import MobileMenuItem from "../index"
import type { MentionItem } from "../../../types"
import { MentionItemType } from "../../../types"

// Mock the styles hook
vi.mock("../../../mobileStyles", () => ({
	useMobileStyles: () => ({
		styles: {
			menuItem: "mobile-menu-item",
			menuItemIcon: "mobile-menu-item-icon",
			menuItemContent: "mobile-menu-item-content",
			menuItemTitle: "mobile-menu-item-title",
			menuItemDescription: "mobile-menu-item-description",
			rightArrow: "mobile-right-arrow",
		},
		cx: (...classes: any[]) => classes.filter(Boolean).join(" "),
	}),
	getMobileItemIconStyle: vi.fn(() => "mobile-icon-style"),
}))

// Mock TSIcon component
vi.mock("@/components/base/TSIcon", () => ({
	default: ({ type, size }: { type: string; size: string }) => (
		<span data-testid="ts-icon" data-type={type} data-size={size}>
			{type === "ts-arrow-right" ? "➤" : "📄"}
		</span>
	),
}))

// Mock other components
vi.mock("@/components/base/MagicAvatar", () => ({
	default: ({ src, size }: { src: string; size: number }) => (
		<img data-testid="magic-avatar" src={src} width={size} height={size} alt="avatar" />
	),
}))

vi.mock("@/components/base/MagicFileIcon", () => ({
	default: ({ type, size }: { type: string; size: number }) => (
		<span data-testid="magic-file-icon" data-type={type} data-size={size}>
			📄
		</span>
	),
}))

vi.mock("../../icons/BotIcon", () => ({
	default: () => <span data-testid="bot-icon">🤖</span>,
}))

vi.mock("../../icons/PlugIcon", () => ({
	default: () => <span data-testid="plug-icon">🔌</span>,
}))

// Mock styles
vi.mock("../../../styles", () => ({
	getItemIconStyle: vi.fn(() => "pc-icon-style"),
}))

// Mock constants
vi.mock("../../../constants", () => ({
	ICON_MAPPINGS: {
		"file-folder": "ts-folder",
		"file-document": "ts-doc-file",
	},
}))

describe("MobileMenuItem", () => {
	const mockOnClick = vi.fn()

	const baseItem: MentionItem = {
		id: "1",
		type: MentionItemType.PROJECT_FILE,
		name: "Test Item",
		icon: "file-document",
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("rendering", () => {
		it("should render basic item correctly", () => {
			render(<MobileMenuItem item={baseItem} onClick={mockOnClick} />)

			expect(screen.getByRole("option")).toBeInTheDocument()
			expect(screen.getByText("Test Item")).toBeInTheDocument()
		})

		it("should render with description", () => {
			const itemWithDescription = {
				...baseItem,
				description: "Test description",
			}

			render(<MobileMenuItem item={itemWithDescription} onClick={mockOnClick} />)

			expect(screen.getByText("Test Item")).toBeInTheDocument()
			expect(screen.getByText("Test description")).toBeInTheDocument()
		})

		it("should apply selected state", () => {
			render(<MobileMenuItem item={baseItem} selected={true} onClick={mockOnClick} />)

			const option = screen.getByRole("option")
			expect(option).toHaveAttribute("aria-selected", "true")
			expect(option).toHaveAttribute("tabIndex", "0")
		})

		it("should apply unselected state", () => {
			render(<MobileMenuItem item={baseItem} selected={false} onClick={mockOnClick} />)

			const option = screen.getByRole("option")
			expect(option).toHaveAttribute("aria-selected", "false")
			expect(option).toHaveAttribute("tabIndex", "-1")
		})
	})

	describe("icon rendering", () => {
		it("should render agent icon with avatar", () => {
			const agentItem = {
				...baseItem,
				type: MentionItemType.AGENT,
				icon: "https://example.com/avatar.jpg",
			}

			render(<MobileMenuItem item={agentItem} onClick={mockOnClick} />)

			expect(screen.getByTestId("magic-avatar")).toBeInTheDocument()
		})

		it("should render agent icon with default bot icon", () => {
			const agentItem = {
				...baseItem,
				type: MentionItemType.AGENT,
				icon: null,
			}

			render(<MobileMenuItem item={agentItem} onClick={mockOnClick} />)

			expect(screen.getByTestId("bot-icon")).toBeInTheDocument()
		})

		it("should render MCP icon with avatar", () => {
			const mcpItem = {
				...baseItem,
				type: MentionItemType.MCP,
				icon: "https://example.com/mcp.jpg",
			}

			render(<MobileMenuItem item={mcpItem} onClick={mockOnClick} />)

			expect(screen.getByTestId("magic-avatar")).toBeInTheDocument()
		})

		it("should render MCP icon with default plug icon", () => {
			const mcpItem = {
				...baseItem,
				type: MentionItemType.MCP,
				icon: null,
			}

			render(<MobileMenuItem item={mcpItem} onClick={mockOnClick} />)

			expect(screen.getByTestId("plug-icon")).toBeInTheDocument()
		})

		it("should render project file icon", () => {
			const fileItem = {
				...baseItem,
				type: MentionItemType.PROJECT_FILE,
				icon: "ts",
			}

			render(<MobileMenuItem item={fileItem} onClick={mockOnClick} />)

			expect(screen.getByTestId("magic-file-icon")).toBeInTheDocument()
		})
	})

	describe("navigation indicators", () => {
		it("should render right arrow for items with children", () => {
			const itemWithChildren = {
				...baseItem,
				hasChildren: true,
			}

			render(<MobileMenuItem item={itemWithChildren} onClick={mockOnClick} />)

			expect(screen.getByText("➤")).toBeInTheDocument()
		})

		it("should not render right arrow for regular items", () => {
			render(<MobileMenuItem item={baseItem} onClick={mockOnClick} />)

			expect(screen.queryByText("➤")).not.toBeInTheDocument()
		})
	})

	describe("interactions", () => {
		it("should call onClick when clicked", () => {
			render(<MobileMenuItem item={baseItem} onClick={mockOnClick} />)

			const option = screen.getByRole("option")
			fireEvent.click(option)

			expect(mockOnClick).toHaveBeenCalledTimes(1)
		})

		it("should prevent event bubbling", () => {
			const mockParentClick = vi.fn()
			const MockParent = () => (
				<div onClick={mockParentClick}>
					<MobileMenuItem item={baseItem} onClick={mockOnClick} />
				</div>
			)

			render(<MockParent />)

			const option = screen.getByRole("option")
			fireEvent.click(option)

			expect(mockOnClick).toHaveBeenCalledTimes(1)
			expect(mockParentClick).not.toHaveBeenCalled()
		})
	})
})
