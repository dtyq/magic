import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { OptionItem } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import type { SlidesTemplatePreviewFocus } from "../canvasInteraction"
import SlidesTemplateInlinePreview from "../SlidesTemplateInlinePreview"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		i18n: { language: "en_US" },
		t: (key: string) => key,
	}),
}))

const template: OptionItem = {
	value: "PPT-business",
	label: "Business",
	thumbnail_url: "https://example.com/business-cover.png",
	preview_image_urls: Array.from(
		{ length: 8 },
		(_, index) => `https://example.com/business-${index + 1}.png`,
	),
	colors: ["#315ECA", "#7AA7FF", "#182A5A"],
}

const focus: SlidesTemplatePreviewFocus = {
	anchorTileId: "business-cover",
	tile: {
		id: "business-cover",
		imageUrl: template.preview_image_urls?.[0],
		kind: "cover",
		template,
	},
}

function renderPreview({
	focus: previewFocus = focus,
	onClose = vi.fn(),
	onFindSimilarColors = vi.fn(),
	onTemplateSelect = vi.fn(),
}: {
	focus?: SlidesTemplatePreviewFocus
	onClose?: () => void
	onFindSimilarColors?: (template: OptionItem) => void
	onTemplateSelect?: (template: OptionItem) => void
} = {}) {
	const result = render(
		<SlidesTemplateInlinePreview
			focus={previewFocus}
			onClose={onClose}
			onFindSimilarColors={onFindSimilarColors}
			onTemplateSelect={onTemplateSelect}
			selectedTemplate={null}
		/>,
	)

	return {
		onClose,
		onFindSimilarColors,
		onTemplateSelect,
		...result,
	}
}

function mockRect(left: number, width: number) {
	return {
		bottom: 120,
		height: 90,
		left,
		right: left + width,
		top: 30,
		width,
		x: left,
		y: 30,
		toJSON: () => ({}),
	}
}

describe("SlidesTemplateInlinePreview", () => {
	it("shows usage to the right of the title", () => {
		const templateWithUsage = {
			...template,
			description: "Template description",
			usage_count: 3500,
		}

		renderPreview({
			focus: {
				...focus,
				tile: { ...focus.tile, template: templateWithUsage },
			},
		})

		const usage = screen.getByTestId("slides-template-inline-preview-usage-count")
		const title = screen.getByTestId("slides-template-inline-preview-title")
		const description = screen.getByTestId("slides-template-inline-preview-description")

		expect(usage).toHaveTextContent("3,500")
		expect(title.parentElement).toContainElement(usage)
		expect(title.compareDocumentPosition(usage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
		expect(usage.compareDocumentPosition(description)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
	})

	it("shows localized template tags below the title", () => {
		const taggedTemplate = {
			...template,
			tags: [
				{
					code: "featured",
					id: "featured",
					name_i18n: { en_US: "Featured", zh_CN: "精选" },
				},
				{
					code: "finance",
					id: "finance",
					name_i18n: { en_US: "Finance", zh_CN: "财务金融" },
				},
			],
		}

		renderPreview({
			focus: {
				...focus,
				tile: { ...focus.tile, template: taggedTemplate },
			},
		})

		const title = screen.getByTestId("slides-template-inline-preview-title")
		const tags = screen.getByTestId("slides-template-inline-preview-tags")
		const featuredTag = screen.getByTestId("slides-template-inline-preview-featured-tag")

		expect(featuredTag).toHaveTextContent("Featured")
		expect(tags).toHaveTextContent("Finance")
		expect(tags).not.toHaveTextContent("Featured")
		expect(title.parentElement).toContainElement(featuredTag)
		expect(title.compareDocumentPosition(tags) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
		expect(title).not.toHaveClass("flex-1")
		expect(title.nextElementSibling).toContainElement(featuredTag)
	})

	it("closes when clicking the empty preview background", () => {
		const { onClose } = renderPreview()

		fireEvent.click(screen.getByTestId("slides-template-inline-preview-showcase"))

		expect(onClose).toHaveBeenCalledTimes(1)
	})

	it("keeps the preview open when clicking the main preview or thumbnail rail", () => {
		const { onClose } = renderPreview()

		fireEvent.click(screen.getByTestId("slides-template-inline-preview-pages"))
		fireEvent.click(screen.getByTestId("slides-template-inline-preview-thumbnail-rail"))

		expect(onClose).not.toHaveBeenCalled()
	})

	it("closes after using the selected template", () => {
		const { onClose, onTemplateSelect } = renderPreview()

		fireEvent.click(screen.getByTestId("slides-template-inline-preview-use-button"))

		expect(onTemplateSelect).toHaveBeenCalledWith(template)
		expect(onClose).toHaveBeenCalledTimes(1)
	})

	it("shows the palette and opens similar-color results", () => {
		const { onClose, onFindSimilarColors } = renderPreview()

		expect(screen.getByTestId("slides-template-color-palette")).toBeInTheDocument()
		fireEvent.click(screen.getByTestId("slides-template-inline-preview-similar-colors"))

		expect(onFindSimilarColors).toHaveBeenCalledWith(template)
		expect(onClose).toHaveBeenCalledTimes(1)
	})

	it("shows a compact page number on each thumbnail", () => {
		renderPreview()

		expect(
			screen
				.getAllByTestId("slides-template-inline-preview-thumbnail-index")
				.map((pageIndex) => pageIndex.textContent),
		).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"])
	})

	it("keeps the focused page after normalizing preview image URLs", () => {
		renderPreview({
			focus: {
				...focus,
				tile: { ...focus.tile, imageUrl: template.preview_image_urls?.[2] },
			},
		})

		expect(screen.getByTestId("slides-template-inline-preview-page-index")).toHaveTextContent(
			"3 / 8",
		)
	})

	it("centers the active thumbnail after switching pages", () => {
		renderPreview()
		const thumbnailRail = screen.getByTestId("slides-template-inline-preview-thumbnail-rail")
		const scroller = thumbnailRail.firstElementChild as HTMLDivElement
		const secondThumbnail = screen.getAllByTestId("slides-template-inline-preview-thumbnail")[1]
		const secondThumbnailItem = secondThumbnail.parentElement as HTMLDivElement
		const scrollTo = vi.fn()

		Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 200 })
		Object.defineProperty(scroller, "scrollWidth", { configurable: true, value: 1000 })
		Object.defineProperty(scroller, "scrollLeft", {
			configurable: true,
			get: () => 20,
			set: vi.fn(),
		})
		scroller.scrollTo = scrollTo
		vi.spyOn(scroller, "getBoundingClientRect").mockReturnValue(mockRect(0, 200))
		vi.spyOn(secondThumbnailItem, "getBoundingClientRect").mockReturnValue(mockRect(300, 100))

		fireEvent.click(screen.getByTestId("slides-template-inline-preview-next-button"))

		expect(scrollTo).toHaveBeenCalledWith({
			behavior: "smooth",
			left: 270,
		})
	})

	it("shows thumbnail rail controls and scrolls in both directions", () => {
		renderPreview()
		const thumbnailRail = screen.getByTestId("slides-template-inline-preview-thumbnail-rail")
		const scroller = thumbnailRail.firstElementChild as HTMLDivElement
		const scrollTo = vi.fn()

		expect(thumbnailRail).toHaveStyle({ "--control-background": "transparent" })

		Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 200 })
		Object.defineProperty(scroller, "scrollWidth", { configurable: true, value: 1000 })
		Object.defineProperty(scroller, "scrollLeft", { configurable: true, value: 20 })
		scroller.scrollTo = scrollTo

		fireEvent.scroll(scroller)
		const nextButton = screen.getByTestId(
			"slides-template-inline-preview-thumbnail-next-button",
		)
		expect(nextButton.parentElement).not.toHaveClass("bg-gradient-to-l")
		fireEvent.click(
			screen.getByTestId("slides-template-inline-preview-thumbnail-previous-button"),
		)
		fireEvent.click(nextButton)

		expect(scrollTo).toHaveBeenNthCalledWith(1, {
			behavior: "smooth",
			left: -260,
		})
		expect(scrollTo).toHaveBeenNthCalledWith(2, {
			behavior: "smooth",
			left: 300,
		})
	})

	it("switches pages with keyboard arrows and wraps at the edges", () => {
		renderPreview()

		fireEvent.keyDown(document, { key: "ArrowLeft" })

		expect(screen.getByTestId("slides-template-inline-preview-page-index")).toHaveTextContent(
			"8 / 8",
		)

		fireEvent.keyDown(document, { key: "ArrowRight" })

		expect(screen.getByTestId("slides-template-inline-preview-page-index")).toHaveTextContent(
			"1 / 8",
		)
	})

	it("closes the preview with Escape", () => {
		const { onClose } = renderPreview()

		fireEvent.keyDown(document, { key: "Escape" })

		expect(onClose).toHaveBeenCalledTimes(1)
	})
})
