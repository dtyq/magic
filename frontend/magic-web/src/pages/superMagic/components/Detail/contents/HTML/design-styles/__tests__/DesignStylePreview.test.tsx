import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import DesignStylePreview from "../DesignStylePreview"
import { clearDesignStyleSourceCache } from "../useDesignStyleSource"
import { designStyleFixture } from "./fixtures"

const getSource = vi.hoisted(() => vi.fn())
const mobileViewport = vi.hoisted(() => ({ value: false }))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => mobileViewport.value,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		i18n: { language: "en_US", resolvedLanguage: "en_US" },
		t: (key: string, options?: { code?: string; count?: number }) => {
			if (options?.code) return `${key}:${options.code}`
			if (options?.count !== undefined) return `${key}:${options.count}`
			return key
		},
	}),
}))

vi.mock("@/apis", () => ({
	HtmlDesignStylesApi: { getSource: (...args: unknown[]) => getSource(...args) },
}))

vi.mock("@/utils/env", () => ({ isDev: false }))

vi.mock("../copyToClipboard", () => ({
	copyToClipboard: vi.fn(async () => true),
}))

vi.mock("../googleFontLoader", () => ({
	loadGoogleFonts: vi.fn(async () => undefined),
}))

describe("DesignStylePreview", () => {
	const renderPreview = (mode: "details" | "raw" = "details") =>
		render(<DesignStylePreview style={designStyleFixture} mode={mode} />)

	beforeEach(() => {
		getSource.mockReset()
		clearDesignStyleSourceCache()
		mobileViewport.value = false
	})

	it("shows the page preview above style details and keeps the source lazy", () => {
		renderPreview()

		expect(screen.getByTestId("design-style-page-canvas")).toBeInTheDocument()
		expect(screen.getByText("htmlEditor.designStyle.colorSystem")).toBeInTheDocument()
		expect(screen.queryByTestId("design-style-detail-header")).not.toBeInTheDocument()
		expect(
			screen
				.getByTestId("design-style-page-canvas")
				.compareDocumentPosition(screen.getByText("htmlEditor.designStyle.colorSystem")),
		).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
		expect(getSource).not.toHaveBeenCalled()
	})

	it("uses an explicit mobile layout rather than browser media queries", () => {
		renderPreview()

		fireEvent.click(
			screen.getByRole("tab", { name: "htmlEditor.designStyle.viewports.mobile" }),
		)

		expect(screen.getByTestId("design-style-scene-viewport")).toHaveAttribute(
			"data-viewport",
			"mobile",
		)
		expect(screen.getByTestId("design-style-scene-fixture-style")).toHaveAttribute(
			"data-viewport",
			"mobile",
		)
		expect(
			screen.queryByRole("navigation", {
				name: "htmlEditor.designStyle.scene.navigation",
			}),
		).not.toBeInTheDocument()
	})

	it("starts with the mobile scene layout in a narrow application viewport", () => {
		mobileViewport.value = true

		render(<DesignStylePreview style={designStyleFixture} mode="details" />)

		expect(screen.getByTestId("design-style-scene-viewport")).toHaveAttribute(
			"data-viewport",
			"mobile",
		)
		expect(screen.getByTestId("design-style-scene-fixture-style")).toHaveAttribute(
			"data-viewport",
			"mobile",
		)
	})

	it("groups visual specifications and component states in one section", () => {
		renderPreview()

		expect(screen.getByText("htmlEditor.designStyle.colorSystem")).toBeInTheDocument()
		expect(screen.getByTestId("design-style-component-states")).toBeInTheDocument()
	})

	it("keeps each section heading sticky within its own section", () => {
		renderPreview()

		expect(screen.getByTestId("design-style-preview")).toHaveClass("pt-4", "sm:pt-6")
		const headerTestIds = [
			"design-style-page-preview-header",
			"design-style-color-header",
			"design-style-typography-header",
			"design-style-spacing-header",
			"design-style-shape-header",
			"design-style-component-states-header",
		]
		headerTestIds.forEach((testId) => {
			expect(screen.getByTestId(testId)).toHaveClass("sticky", "top-0")
		})
		expect(screen.getByTestId("design-style-page-preview-header")).toContainElement(
			screen.getByRole("tablist", {
				name: "htmlEditor.designStyle.gallery.viewportLabel",
			}),
		)
	})

	it("loads the original specification only when requested", async () => {
		getSource.mockResolvedValue({
			style_code: designStyleFixture.code,
			content: "# Raw fixture",
			sha256: "abc",
		})
		renderPreview("raw")

		await waitFor(() =>
			expect(screen.getByTestId("design-style-raw-content")).toHaveTextContent(
				"# Raw fixture",
			),
		)
	})
})
