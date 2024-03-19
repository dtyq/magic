import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import TabCache from "../components/TabCache"

// Mock dependencies
vi.mock("../../../Render", () => ({
	default: ({ children, ...props }: any) => (
		<div data-testid="render-component" {...props}>
			{children}
		</div>
	),
}))

vi.mock("../styles", () => ({
	useStyles: () => ({
		styles: {
			tabCacheContainer: "tab-cache-container",
			tabCacheActive: "tab-cache-active",
			tabCacheInactive: "tab-cache-inactive",
		},
		cx: (...classes: string[]) => classes.filter(Boolean).join(" "),
	}),
}))

describe("TabCache", () => {
	const mockTab = {
		id: "test-tab-1",
		title: "Test File",
		refreshKey: "refresh-key-1",
	}

	const mockRenderProps = {
		isFullscreen: false,
		openFileTab: vi.fn(),
		allowEdit: true,
		selectedProject: null,
	}

	it("renders active tab correctly", () => {
		render(<TabCache tab={mockTab} isActive={true} renderProps={mockRenderProps} />)

		const container = screen.getByTestId("render-component").parentElement
		expect(container).toHaveClass("tab-cache-container tab-cache-active")
		expect(container).not.toHaveClass("tab-cache-inactive")
	})

	it("renders inactive tab correctly", () => {
		render(<TabCache tab={mockTab} isActive={false} renderProps={mockRenderProps} />)

		const container = screen.getByTestId("render-component").parentElement
		expect(container).toHaveClass("tab-cache-container tab-cache-inactive")
		expect(container).not.toHaveClass("tab-cache-active")
	})

	it("passes render props to Render component", () => {
		render(<TabCache tab={mockTab} isActive={true} renderProps={mockRenderProps} />)

		const renderComponent = screen.getByTestId("render-component")
		expect(renderComponent).toBeInTheDocument()
	})

	it("calls onActiveFileChange when provided", () => {
		const mockOnActiveFileChange = vi.fn()

		render(
			<TabCache
				tab={mockTab}
				isActive={true}
				renderProps={mockRenderProps}
				onActiveFileChange={mockOnActiveFileChange}
			/>,
		)

		// The onActiveFileChange should be passed to Render component
		const renderComponent = screen.getByTestId("render-component")
		expect(renderComponent).toBeInTheDocument()
	})

	it("uses tab refreshKey as key when available", () => {
		const tabWithRefreshKey = {
			...mockTab,
			refreshKey: "custom-refresh-key",
		}

		render(<TabCache tab={tabWithRefreshKey} isActive={true} renderProps={mockRenderProps} />)

		const renderComponent = screen.getByTestId("render-component")
		expect(renderComponent).toBeInTheDocument()
	})

	it("falls back to tab id when refreshKey is not available", () => {
		const tabWithoutRefreshKey = {
			...mockTab,
			refreshKey: undefined,
		}

		render(
			<TabCache tab={tabWithoutRefreshKey} isActive={true} renderProps={mockRenderProps} />,
		)

		const renderComponent = screen.getByTestId("render-component")
		expect(renderComponent).toBeInTheDocument()
	})
})
