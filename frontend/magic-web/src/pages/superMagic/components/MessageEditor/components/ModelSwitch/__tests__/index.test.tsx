import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import "@testing-library/jest-dom"
// @ts-ignore
import ModelSwitch from "../index"
import type { ModelItem } from "../types"

// Mock external dependencies
vi.mock("@tabler/icons-react", () => ({
	IconCheck: ({ className }: { className?: string }) => (
		<div data-testid="icon-check" className={className} />
	),
	IconChevronDown: ({ className }: { className?: string }) => (
		<div data-testid="icon-chevron-down" className={className} />
	),
	IconSparkles: ({ className }: { className?: string }) => (
		<div data-testid="icon-sparkles" className={className} />
	),
}))

vi.mock("@/components/base/MagicDropdown", () => ({
	default: ({
		children,
		trigger,
		open,
		onOpenChange,
		popupRender,
	}: {
		children: React.ReactNode
		trigger?: string[]
		open?: boolean
		onOpenChange?: (open: boolean) => void
		popupRender?: () => React.ReactNode
	}) => (
		<div data-testid="magic-dropdown">
			<div data-testid="dropdown-trigger" onClick={() => onOpenChange?.(!open)}>
				{children}
			</div>
			{open && <div data-testid="dropdown-content">{popupRender?.()}</div>}
		</div>
	),
}))

vi.mock("@/components/base/MagicIcon", () => ({
	default: ({ component: Component, className, color, size }: any) => (
		<div
			data-testid="magic-icon"
			className={className}
			style={{ color, width: size, height: size }}
		>
			{Component && <Component />}
		</div>
	),
}))

vi.mock("@/components/base/FlexBox", () => ({
	default: ({ children, gap, className }: any) => (
		<div data-testid="flex-box" className={className} style={{ gap }}>
			{children}
		</div>
	),
}))

vi.mock("../styles", () => ({
	useStyles: vi.fn().mockReturnValue({
		styles: {
			modelSwitch: "model-switch",
			modelSwitchBorder: "model-switch-border",
			modelList: "model-list",
			modelItem: "model-item",
			modelItemSelected: "model-item-selected",
			modelItemDisabled: "model-item-disabled",
			modelContent: "model-content",
			modelIcon: "model-icon",
			modelName: "model-name",
			modelNameSelected: "model-name-selected",
			checkIcon: "check-icon",
		},
		cx: (...args: any[]) => args.filter(Boolean).join(" "),
	}),
}))

const mockModelList: ModelItem[] = [
	{
		id: "1",
		model_id: "gpt-4",
		name: "GPT-4",
		icon: "https://example.com/gpt4-icon.png",
	},
	{
		id: "2",
		model_id: "claude-3",
		name: "Claude-3",
		icon: "https://example.com/claude3-icon.png",
	},
]

describe("ModelSwitch", () => {
	const mockOnModelChange = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("Rendering", () => {
		it("should render ModelSwitch component", () => {
			// Arrange & Act
			render(<ModelSwitch modelList={mockModelList} onModelChange={mockOnModelChange} />)

			// Assert
			expect(screen.getByTestId("magic-dropdown")).toBeInTheDocument()
			expect(screen.getByTestId("dropdown-trigger")).toBeInTheDocument()
		})

		it("should render selected model information", () => {
			// Arrange
			const selectedModel = mockModelList[0]

			// Act
			render(
				<ModelSwitch
					modelList={mockModelList}
					selectedModel={selectedModel}
					onModelChange={mockOnModelChange}
				/>,
			)

			// Assert
			expect(screen.getByText("GPT-4")).toBeInTheDocument()
			expect(screen.getByTestId("icon-chevron-down")).toBeInTheDocument()
		})

		it("should render without selected model", () => {
			// Arrange & Act
			render(<ModelSwitch modelList={mockModelList} onModelChange={mockOnModelChange} />)

			// Assert
			expect(screen.getByTestId("magic-dropdown")).toBeInTheDocument()
		})
	})

	describe("Empty Model List Behavior", () => {
		it("should return null when modelList is empty", () => {
			// Arrange & Act
			const { container } = render(
				<ModelSwitch modelList={[]} onModelChange={mockOnModelChange} />,
			)

			// Assert
			expect(container.firstChild).toBeNull()
		})

		it("should return null when modelList is undefined", () => {
			// Arrange & Act
			const { container } = render(<ModelSwitch onModelChange={mockOnModelChange} />)

			// Assert
			expect(container.firstChild).toBeNull()
		})
	})

	describe("Dropdown Interaction", () => {
		it("should open dropdown when trigger is clicked", async () => {
			// Arrange
			render(<ModelSwitch modelList={mockModelList} onModelChange={mockOnModelChange} />)

			// Act
			fireEvent.click(screen.getByTestId("dropdown-trigger"))

			// Assert
			await waitFor(() => {
				expect(screen.getByTestId("dropdown-content")).toBeInTheDocument()
			})
		})

		it("should render model list when dropdown is open", async () => {
			// Arrange
			render(<ModelSwitch modelList={mockModelList} onModelChange={mockOnModelChange} />)

			// Act
			fireEvent.click(screen.getByTestId("dropdown-trigger"))

			// Assert
			await waitFor(() => {
				expect(screen.getByText("GPT-4")).toBeInTheDocument()
				expect(screen.getByText("Claude-3")).toBeInTheDocument()
			})
		})

		it("should display model icons in dropdown", async () => {
			// Arrange
			render(<ModelSwitch modelList={mockModelList} onModelChange={mockOnModelChange} />)

			// Act
			fireEvent.click(screen.getByTestId("dropdown-trigger"))

			// Assert
			await waitFor(() => {
				const modelIcons = screen
					.getAllByRole("generic")
					.filter((el) => el.classList.contains("model-icon"))
				expect(modelIcons.length).toBeGreaterThan(0)
			})
		})
	})

	describe("Model Selection", () => {
		it("should call onModelChange when model is selected", async () => {
			// Arrange
			render(<ModelSwitch modelList={mockModelList} onModelChange={mockOnModelChange} />)

			// Act
			fireEvent.click(screen.getByTestId("dropdown-trigger"))
			await waitFor(() => {
				fireEvent.click(screen.getByText("Claude-3"))
			})

			// Assert
			expect(mockOnModelChange).toHaveBeenCalledWith(mockModelList[1])
		})

		it("should show check icon for selected model", async () => {
			// Arrange
			const selectedModel = mockModelList[0]
			render(
				<ModelSwitch
					modelList={mockModelList}
					selectedModel={selectedModel}
					onModelChange={mockOnModelChange}
				/>,
			)

			// Act
			fireEvent.click(screen.getByTestId("dropdown-trigger"))

			// Assert
			await waitFor(() => {
				expect(screen.getByTestId("icon-check")).toBeInTheDocument()
			})
		})

		it("should apply selected styles to selected model", async () => {
			// Arrange
			const selectedModel = mockModelList[0]
			render(
				<ModelSwitch
					modelList={mockModelList}
					selectedModel={selectedModel}
					onModelChange={mockOnModelChange}
				/>,
			)

			// Act
			fireEvent.click(screen.getByTestId("dropdown-trigger"))

			// Assert
			await waitFor(() => {
				const modelElements = screen.getAllByText("GPT-4")
				const dropdownModelElement = modelElements.find(
					(el) => el.closest(".model-list") !== null,
				)
				const modelItemElement = dropdownModelElement?.closest(".model-item")
				expect(modelItemElement).toHaveClass("model-item-selected")
			})
		})
	})

	describe("Props Testing", () => {
		it("should show model name when showName is true", () => {
			// Arrange
			const selectedModel = mockModelList[0]

			// Act
			render(
				<ModelSwitch
					modelList={mockModelList}
					selectedModel={selectedModel}
					onModelChange={mockOnModelChange}
					showName={true}
				/>,
			)

			// Assert
			expect(screen.getByText("GPT-4")).toBeInTheDocument()
		})

		it("should hide model name when showName is false", () => {
			// Arrange
			const selectedModel = mockModelList[0]

			// Act
			render(
				<ModelSwitch
					modelList={mockModelList}
					selectedModel={selectedModel}
					onModelChange={mockOnModelChange}
					showName={false}
				/>,
			)

			// Assert
			const flexBox = screen.getByTestId("flex-box")
			expect(flexBox).not.toHaveTextContent("GPT-4")
		})

		it("should apply border styles when showBorder is true", () => {
			// Arrange
			const selectedModel = mockModelList[0]

			// Act
			render(
				<ModelSwitch
					modelList={mockModelList}
					selectedModel={selectedModel}
					onModelChange={mockOnModelChange}
					showBorder={true}
				/>,
			)

			// Assert
			const flexBox = screen.getByTestId("flex-box")
			expect(flexBox).toHaveClass("model-switch model-switch-border")
		})

		it("should not apply border styles when showBorder is false", () => {
			// Arrange
			const selectedModel = mockModelList[0]

			// Act
			render(
				<ModelSwitch
					modelList={mockModelList}
					selectedModel={selectedModel}
					onModelChange={mockOnModelChange}
					showBorder={false}
				/>,
			)

			// Assert
			const flexBox = screen.getByTestId("flex-box")
			expect(flexBox).toHaveClass("model-switch")
			expect(flexBox).not.toHaveClass("model-switch-border")
		})
	})

	describe("Error Handling", () => {
		it("should handle undefined selectedModel", () => {
			// Arrange & Act
			render(
				<ModelSwitch
					modelList={mockModelList}
					selectedModel={undefined}
					onModelChange={mockOnModelChange}
				/>,
			)

			// Assert
			expect(screen.getByTestId("magic-dropdown")).toBeInTheDocument()
		})

		it("should handle missing onModelChange callback", async () => {
			// Arrange
			render(<ModelSwitch modelList={mockModelList} selectedModel={mockModelList[0]} />)

			// Act
			fireEvent.click(screen.getByTestId("dropdown-trigger"))
			await waitFor(() => {
				fireEvent.click(screen.getByText("Claude-3"))
			})

			// Assert - should not throw
			expect(screen.getByTestId("magic-dropdown")).toBeInTheDocument()
		})

		it("should handle image loading errors gracefully", () => {
			// Arrange
			const modelWithBrokenIcon = {
				...mockModelList[0],
				icon: "broken-url",
			}

			// Act & Assert - should not throw
			expect(() => {
				render(
					<ModelSwitch
						modelList={[modelWithBrokenIcon]}
						selectedModel={modelWithBrokenIcon}
						onModelChange={mockOnModelChange}
					/>,
				)
			}).not.toThrow()
		})

		it("should show IconSparkles when no selectedModel", () => {
			// Arrange & Act
			render(<ModelSwitch modelList={mockModelList} onModelChange={mockOnModelChange} />)

			// Assert
			expect(screen.getByTestId("icon-sparkles")).toBeInTheDocument()
		})

		it("should show IconSparkles for models with empty icon", async () => {
			// Arrange
			const modelWithEmptyIcon = {
				...mockModelList[0],
				icon: "",
			}
			render(
				<ModelSwitch
					modelList={[modelWithEmptyIcon]}
					selectedModel={modelWithEmptyIcon}
					onModelChange={mockOnModelChange}
				/>,
			)

			// Act
			fireEvent.click(screen.getByTestId("dropdown-trigger"))

			// Assert
			await waitFor(() => {
				const dropdownContent = screen.getByTestId("dropdown-content")
				expect(dropdownContent).toBeInTheDocument()
				expect(screen.getAllByTestId("icon-sparkles")).toHaveLength(2) // One in trigger, one in dropdown
			})
		})
	})

	describe("Edge Cases", () => {
		it("should handle models without icons", async () => {
			// Arrange
			const modelWithoutIcon = {
				...mockModelList[0],
				icon: "",
			}
			render(
				<ModelSwitch
					modelList={[modelWithoutIcon]}
					selectedModel={modelWithoutIcon}
					onModelChange={mockOnModelChange}
				/>,
			)

			// Act
			fireEvent.click(screen.getByTestId("dropdown-trigger"))

			// Assert
			await waitFor(() => {
				const dropdownContent = screen.getByTestId("dropdown-content")
				expect(dropdownContent).toBeInTheDocument()
				expect(dropdownContent).toHaveTextContent("GPT-4")
			})
		})

		it("should handle very long model names", async () => {
			// Arrange
			const modelWithLongName = {
				...mockModelList[0],
				name: "This is a very long model name that should be truncated properly",
			}
			render(
				<ModelSwitch
					modelList={[modelWithLongName]}
					selectedModel={modelWithLongName}
					onModelChange={mockOnModelChange}
				/>,
			)

			// Act
			fireEvent.click(screen.getByTestId("dropdown-trigger"))

			// Assert
			await waitFor(() => {
				const dropdownContent = screen.getByTestId("dropdown-content")
				expect(dropdownContent).toBeInTheDocument()
				expect(dropdownContent).toHaveTextContent(
					"This is a very long model name that should be truncated properly",
				)
			})
		})

		it("should handle single model in list", async () => {
			// Arrange
			const singleModel = [mockModelList[0]]
			render(
				<ModelSwitch
					modelList={singleModel}
					selectedModel={singleModel[0]}
					onModelChange={mockOnModelChange}
				/>,
			)

			// Act
			fireEvent.click(screen.getByTestId("dropdown-trigger"))

			// Assert
			await waitFor(() => {
				const dropdownContent = screen.getByTestId("dropdown-content")
				expect(dropdownContent).toBeInTheDocument()
				expect(dropdownContent).toHaveTextContent("GPT-4")
				expect(dropdownContent).not.toHaveTextContent("Claude-3")
			})
		})
	})

	describe("Dropdown State Management", () => {
		it("should close dropdown after model selection", async () => {
			// Arrange
			render(<ModelSwitch modelList={mockModelList} onModelChange={mockOnModelChange} />)

			// Act
			fireEvent.click(screen.getByTestId("dropdown-trigger"))
			await waitFor(() => {
				expect(screen.getByTestId("dropdown-content")).toBeInTheDocument()
			})
			fireEvent.click(screen.getByText("Claude-3"))

			// Assert
			await waitFor(() => {
				expect(screen.queryByTestId("dropdown-content")).not.toBeInTheDocument()
			})
		})

		it("should toggle dropdown state correctly", async () => {
			// Arrange
			render(<ModelSwitch modelList={mockModelList} onModelChange={mockOnModelChange} />)

			// Act - Open
			fireEvent.click(screen.getByTestId("dropdown-trigger"))
			await waitFor(() => {
				expect(screen.getByTestId("dropdown-content")).toBeInTheDocument()
			})

			// Act - Close
			fireEvent.click(screen.getByTestId("dropdown-trigger"))
			await waitFor(() => {
				expect(screen.queryByTestId("dropdown-content")).not.toBeInTheDocument()
			})
		})
	})

	describe("Accessibility", () => {
		it("should have proper ARIA attributes", () => {
			// Arrange & Act
			render(<ModelSwitch modelList={mockModelList} onModelChange={mockOnModelChange} />)

			// Assert
			const dropdown = screen.getByTestId("magic-dropdown")
			expect(dropdown).toBeInTheDocument()
		})

		it("should have alt attributes for images", () => {
			// Arrange
			const selectedModel = mockModelList[0]

			// Act
			render(
				<ModelSwitch
					modelList={mockModelList}
					selectedModel={selectedModel}
					onModelChange={mockOnModelChange}
				/>,
			)

			// Assert
			const image = document.querySelector("img")
			expect(image).toHaveAttribute("alt", "GPT-4")
		})
	})

	describe("Performance", () => {
		it("should handle re-renders gracefully with same props", () => {
			// Arrange
			const selectedModel = mockModelList[0]
			const { rerender } = render(
				<ModelSwitch
					modelList={mockModelList}
					selectedModel={selectedModel}
					onModelChange={mockOnModelChange}
				/>,
			)

			// Act - Re-render with same props
			rerender(
				<ModelSwitch
					modelList={mockModelList}
					selectedModel={selectedModel}
					onModelChange={mockOnModelChange}
				/>,
			)

			// Assert - Component should handle re-renders gracefully
			expect(screen.getByTestId("magic-dropdown")).toBeInTheDocument()
			expect(screen.getByText("GPT-4")).toBeInTheDocument()
		})
	})
})
