import type { ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MediaPreviewTrigger } from "../MediaPreviewTrigger"

vi.mock("../MediaPreview", () => ({
	MediaPreviewThumbnail: ({
		thumbnailUrl,
		fallback,
	}: {
		thumbnailUrl?: string | null
		fallback?: ReactNode
	}) => (
		<span data-testid="thumbnail" data-thumbnail-url={thumbnailUrl ?? ""}>
			{fallback}
		</span>
	),
}))

vi.mock("../MediaPreviewTooltip", () => ({
	MediaPreviewTooltip: ({
		children,
		onOpenChange,
	}: {
		children: ReactNode
		onOpenChange?: (open: boolean) => void
	}) => (
		<div data-testid="tooltip" onClick={() => onOpenChange?.(true)}>
			{children}
		</div>
	),
}))

const labels = {
	errorMessage: "Preview failed",
	audioLabels: { play: "Play", pause: "Pause", progress: "Progress" },
}

describe("MediaPreviewTrigger", () => {
	it("uses the source thumbnail and loads the preview on open", () => {
		const loadPreview = vi.fn(async () => undefined)
		render(
			<MediaPreviewTrigger
				fileName="cat.png"
				source={{
					mediaType: "image",
					thumbnailUrl: "blob:low",
					previewUrl: "https://cdn.test/cat.png",
					isLoading: false,
					hasError: false,
					loadPreview,
				}}
				fallback={<span data-testid="fallback">file</span>}
				renderTrigger={(thumbnail) => <span data-testid="trigger">{thumbnail}</span>}
				labels={labels}
			/>,
		)

		expect(screen.getByTestId("thumbnail")).toHaveAttribute("data-thumbnail-url", "blob:low")
		fireEvent.click(screen.getByTestId("tooltip"))
		expect(loadPreview).toHaveBeenCalledOnce()
	})

	it("shows a loading fallback when a media source has no thumbnail yet", () => {
		render(
			<MediaPreviewTrigger
				fileName="clip.mp4"
				source={{
					mediaType: "video",
					isLoading: true,
					hasError: false,
				}}
				fallback={<span data-testid="fallback">file</span>}
				renderTrigger={(thumbnail) => <span data-testid="trigger">{thumbnail}</span>}
				labels={labels}
			/>,
		)

		expect(screen.getByLabelText("Loading")).toBeInTheDocument()
		expect(screen.getByTestId("tooltip")).toBeInTheDocument()
	})

	it("does not create a tooltip for a non-media mention", () => {
		render(
			<MediaPreviewTrigger
				fileName="notes.txt"
				source={null}
				fallback={<span data-testid="fallback">file</span>}
				renderTrigger={(thumbnail) => <span data-testid="trigger">{thumbnail}</span>}
				labels={labels}
			/>,
		)

		expect(screen.getByTestId("fallback")).toBeInTheDocument()
		expect(screen.queryByTestId("tooltip")).not.toBeInTheDocument()
	})
})
