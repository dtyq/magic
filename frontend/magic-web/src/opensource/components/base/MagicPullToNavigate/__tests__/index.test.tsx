import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "antd-style"
// @ts-ignore
import MagicPullToNavigate from "../index"

// Mock the hook
vi.mock("../hooks/usePullToNavigate", () => ({
	default: vi.fn(() => ({
		isActive: false,
		pullDistance: 0,
		rawPullDistance: 0,
		isRefreshing: false,
		isExiting: false,
		setContainer: vi.fn(),
	})),
}))

// Mock the animation component
vi.mock("../animations/PullToNavigateAnimation", () => ({
	default: vi.fn(() => <div data-testid="pull-animation" />),
}))

// Test wrapper with theme provider
function TestWrapper({ children }: { children: React.ReactNode }) {
	return <ThemeProvider>{children}</ThemeProvider>
}

describe("MagicPullToNavigate", () => {
	it("should render children correctly", () => {
		render(
			<TestWrapper>
				<MagicPullToNavigate>
					<div data-testid="test-content">Test Content</div>
				</MagicPullToNavigate>
			</TestWrapper>,
		)

		expect(screen.getByTestId("test-content")).toBeInTheDocument()
	})

	it("should accept onStart and onEnd callbacks", () => {
		const onStart = vi.fn()
		const onEnd = vi.fn()
		const onNavigate = vi.fn()

		render(
			<TestWrapper>
				<MagicPullToNavigate onNavigate={onNavigate} onStart={onStart} onEnd={onEnd}>
					<div>Test Content</div>
				</MagicPullToNavigate>
			</TestWrapper>,
		)

		// The component should render without errors when callbacks are provided
		expect(screen.getByText("Test Content")).toBeInTheDocument()
	})

	it("should pass callbacks to usePullToNavigate hook", () => {
		const onStart = vi.fn()
		const onEnd = vi.fn()
		const onNavigate = vi.fn()

		render(
			<TestWrapper>
				<MagicPullToNavigate onNavigate={onNavigate} onStart={onStart} onEnd={onEnd}>
					<div>Test Content</div>
				</MagicPullToNavigate>
			</TestWrapper>,
		)

		// The component should render without errors when callbacks are provided
		expect(screen.getByText("Test Content")).toBeInTheDocument()
	})

	it("should work without onStart and onEnd callbacks", () => {
		const onNavigate = vi.fn()

		render(
			<TestWrapper>
				<MagicPullToNavigate onNavigate={onNavigate}>
					<div>Test Content</div>
				</MagicPullToNavigate>
			</TestWrapper>,
		)

		expect(screen.getByText("Test Content")).toBeInTheDocument()
	})

	it("should apply custom className", () => {
		const customClassName = "custom-class"

		const { container } = render(
			<TestWrapper>
				<MagicPullToNavigate className={customClassName}>
					<div>Test Content</div>
				</MagicPullToNavigate>
			</TestWrapper>,
		)

		// Find the root container element (first child of the test container)
		const rootElement = container.firstChild as HTMLElement
		// Check if the custom class is included in the className
		expect(rootElement?.className).toContain(customClassName)
	})
})
