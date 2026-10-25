import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "../../../primitives/shadcn/tooltip"
import { CanvasDesignI18nProvider } from "../../../../app/providers/I18nProvider"
import { ElementTypeEnum, type ImageElement } from "../../../../runtime/document/types"
import LayerMediaPreview from "../LayerMediaPreview"

vi.mock("../useLayerMediaPreviewSource", () => ({
	useLayerMediaPreviewSource: () => ({
		mediaType: "image",
		path: "./images/layer.png",
		observeRef: vi.fn(),
		fallback: <span data-testid="layer-fallback">image</span>,
		source: {
			mediaType: "image",
			thumbnailUrl: "blob:layer-low",
			previewUrl: "https://cdn.test/layer.png",
			isLoading: false,
			hasError: false,
		},
	}),
}))

const imageElement = {
	id: "layer-image",
	type: ElementTypeEnum.Image,
} as ImageElement

function renderPreview(
	children: (thumbnail: ReactNode) => ReactNode,
	options?: { disabled?: boolean },
) {
	return render(
		<CanvasDesignI18nProvider>
			<TooltipProvider delayDuration={0}>
				<LayerMediaPreview
					element={imageElement}
					fileName="layer.png"
					disabled={options?.disabled}
				>
					{children}
				</LayerMediaPreview>
			</TooltipProvider>
		</CanvasDesignI18nProvider>,
	)
}

describe("LayerMediaPreview", () => {
	it("uses the complete layer body as the tooltip trigger and positions it on the right", async () => {
		const { container } = renderPreview((thumbnail) => (
			<div data-testid="layer-body">
				{thumbnail}
				<span>layer.png</span>
				<button type="button" data-testid="layer-action">
					Action
				</button>
			</div>
		))

		const trigger = container.querySelector<HTMLElement>("[data-media-preview-trigger]")
		expect(trigger).not.toBeNull()
		expect(trigger).toContainElement(screen.getByTestId("layer-body"))
		expect(trigger).toHaveAttribute("data-media-preview-trigger")
		expect(trigger).toContainElement(screen.getByTestId("layer-action"))

		fireEvent.pointerMove(trigger as HTMLElement)
		const tooltip = await waitFor(() => {
			const content = document.querySelector<HTMLElement>('[data-slot="tooltip-content"]')
			if (!content) throw new Error("Layer tooltip did not open")
			return content
		})
		// Radix may flip the requested right side when the jsdom viewport has no room.
		expect(["right", "left"]).toContain(tooltip.getAttribute("data-side"))
		expect(tooltip).toHaveTextContent("layer.png")
		expect(tooltip.querySelector('img[src="https://cdn.test/layer.png"]')).not.toBeNull()
	})

	it("keeps the media thumbnail while tooltip is disabled for renaming", async () => {
		const { container } = renderPreview(
			(thumbnail) => (
				<div data-testid="layer-body">
					{thumbnail}
					<input aria-label="Layer name" defaultValue="layer.png" />
				</div>
			),
			{ disabled: true },
		)

		expect(screen.getByTestId("layer-body")).toContainElement(
			container.querySelector('img[src="blob:layer-low"]'),
		)
		expect(container.querySelector("[data-media-preview-trigger]")).not.toBeInTheDocument()
		expect(document.querySelector('[data-slot="tooltip-content"]')).not.toBeInTheDocument()
	})
})
