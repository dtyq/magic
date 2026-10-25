import { act, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import SlidesTemplatePreviewStage from "../SlidesTemplatePreviewStage"

const pages = [
	"https://example.com/page-1.png",
	"https://example.com/page-2.png",
	"https://example.com/page-3.png",
]

function renderStage(activeIndex: number) {
	return render(
		<SlidesTemplatePreviewStage activeIndex={activeIndex} pages={pages} title="Business" />,
	)
}

describe("SlidesTemplatePreviewStage", () => {
	it("uses the full available stage size for the preview frame", () => {
		renderStage(0)

		expect(screen.getByTestId("slides-template-inline-preview-stage")).toHaveClass("size-full")
	})

	it("reuses the active page URL for the ambient background", () => {
		const page =
			"https://assets.example.test/templates/slide-008.png?x-tos-process=image%2Fresize%2Cw_1920%2Fformat%2Cwebp"
		render(<SlidesTemplatePreviewStage activeIndex={0} pages={[page]} title="Business" />)

		expect(screen.getByTestId("slides-template-inline-preview-active-image")).toHaveAttribute(
			"src",
			page,
		)
		expect(screen.getByTestId("slides-template-inline-preview-ambient-image")).toHaveAttribute(
			"src",
			page,
		)
	})

	it("renders the page number outside the preview frame", () => {
		renderStage(0)

		const previewFrame = screen.getByTestId("slides-template-inline-preview-pages")
		const pageIndex = screen.getByTestId("slides-template-inline-preview-page-index")

		expect(pageIndex.parentElement).toBe(previewFrame.parentElement)
		expect(pageIndex.parentElement).not.toBe(previewFrame)
	})

	it("keeps the current preview image visible until the next image finishes loading", () => {
		const OriginalImage = window.Image
		const createdImages: Array<{
			complete: boolean
			crossOrigin: string
			decoding: ImageDecoding
			onerror: (() => void) | null
			onload: (() => void) | null
			src: string
		}> = []

		class MockImage {
			complete = false
			crossOrigin = ""
			decoding: ImageDecoding = "auto"
			onerror: (() => void) | null = null
			onload: (() => void) | null = null
			private imageSrc = ""

			get src() {
				return this.imageSrc
			}

			set src(value: string) {
				this.imageSrc = value
				createdImages.push(this)
			}
		}

		vi.stubGlobal("Image", MockImage)
		Object.defineProperty(window, "Image", {
			configurable: true,
			value: MockImage,
			writable: true,
		})

		try {
			const { rerender } = renderStage(0)
			const initialImage = screen.getByTestId("slides-template-inline-preview-active-image")

			expect(initialImage).toHaveAttribute("src", pages[0])
			expect(initialImage).toHaveAttribute("crossorigin", "anonymous")

			rerender(<SlidesTemplatePreviewStage activeIndex={1} pages={pages} title="Business" />)

			expect(
				screen.getByTestId("slides-template-inline-preview-page-index"),
			).toHaveTextContent("2 / 3")
			expect(screen.getByTestId("slides-template-inline-preview-pages")).toHaveAttribute(
				"data-loading",
				"true",
			)
			expect(
				screen.getByTestId("slides-template-inline-preview-active-image"),
			).toHaveAttribute("src", pages[0])
			expect(
				screen.getByTestId("slides-template-inline-preview-ambient-image"),
			).toHaveAttribute("src", pages[0])

			const pendingImage = [...createdImages]
				.reverse()
				.find((image) => image.src === pages[1] && image.onload)

			expect(pendingImage).toBeDefined()
			expect(createdImages.every((image) => image.crossOrigin === "anonymous")).toBe(true)

			act(() => {
				pendingImage?.onload?.()
			})

			expect(screen.getByTestId("slides-template-inline-preview-pages")).toHaveAttribute(
				"data-loading",
				"false",
			)
			expect(
				screen.getByTestId("slides-template-inline-preview-active-image"),
			).toHaveAttribute("src", pages[1])
			expect(screen.getByTestId("slides-template-inline-preview-active-image")).toBe(
				initialImage,
			)
		} finally {
			vi.stubGlobal("Image", OriginalImage)
			Object.defineProperty(window, "Image", {
				configurable: true,
				value: OriginalImage,
				writable: true,
			})
		}
	})
})
