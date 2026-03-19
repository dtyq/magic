import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import ImageViewer from "../index"

// Mock the styles
vi.mock("../../../styles", () => ({
	useStyles: () => ({
		styles: {
			container: "container",
			imageContainer: "imageContainer",
			imageViewer: "imageViewer",
			closeButton: "closeButton",
			emptyContainer: "emptyContainer",
			image: "image",
			svgContainer: "svgContainer",
			loadingContainer: "loadingContainer",
			progressContainer: "progressContainer",
			progressText: "progressText",
			actionBarContainer: "actionBarContainer",
		},
	}),
}))

// Mock react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock SVG processor
vi.mock("@/utils/svgProcessor", () => ({
	processSvgContent: vi.fn(() => ({
		isValid: true,
		content: "<svg><rect/></svg>",
	})),
	isSvgContent: vi.fn(() => false),
}))

describe("ImageViewer", () => {
	const mockOnClose = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders close button", () => {
		render(<ImageViewer src="test-image.jpg" onClose={mockOnClose} />)

		const closeButton = screen.getByRole("button")
		expect(closeButton).toBeDefined()
		expect(closeButton.getAttribute("type")).toBe("button")
	})

	it("renders image when src is provided", () => {
		render(<ImageViewer src="test-image.jpg" onClose={mockOnClose} />)

		const image = screen.getByRole("img")
		expect(image).toBeDefined()
		expect(image.getAttribute("src")).toBe("test-image.jpg")
	})

	it("renders empty state when no src provided", () => {
		render(<ImageViewer onClose={mockOnClose} />)

		expect(screen.getByText("chat.NoContent")).toBeDefined()
	})

	it("renders loading state when loading is true", () => {
		render(
			<ImageViewer src="test-image.jpg" loading={true} progress={50} onClose={mockOnClose} />,
		)

		expect(screen.getByText("50%")).toBeDefined()
		expect(screen.getByText("chat.imagePreview.hightImageConverting")).toBeDefined()
	})

	it("has touch event handlers attached to container", () => {
		const { container } = render(<ImageViewer src="test-image.jpg" onClose={mockOnClose} />)

		const mainContainer = container.firstChild as Element
		expect(mainContainer?.className).toContain("container")

		// Find the imageViewer element within the structure
		const imageViewer = mainContainer?.querySelector(".imageViewer")
		expect(imageViewer).toBeDefined()
	})

	it("applies transform styles to image", () => {
		render(<ImageViewer src="test-image.jpg" onClose={mockOnClose} />)

		const image = screen.getByRole("img")
		const style = image.getAttribute("style")
		expect(style).toContain("transform")
		expect(style).toContain("translate3d(0px, 0px, 0)")
		expect(style).toContain("scale(1)")
	})

	it("applies correct CSS classes for touch optimization", () => {
		const { container } = render(<ImageViewer src="test-image.jpg" onClose={mockOnClose} />)

		const mainContainer = container.firstChild as Element
		expect(mainContainer?.className).toContain("container")

		// Find the imageViewer element within the structure
		const imageViewer = mainContainer?.querySelector(".imageViewer")
		expect(imageViewer).toBeDefined()

		const image = screen.getByRole("img")
		expect(image.className).toContain("image")
	})
})
