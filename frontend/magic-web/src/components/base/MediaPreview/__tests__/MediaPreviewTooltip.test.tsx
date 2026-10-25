import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/shadcn-ui/tooltip"
import { MediaPreviewThumbnail, MediaPreviewTooltip } from "../index"

const mobileState = { isMobile: false }

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => mobileState.isMobile,
}))

function renderTooltip(ui: ReactNode) {
	return render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>)
}

describe("MediaPreviewTooltip", () => {
	beforeEach(() => {
		mobileState.isMobile = false
		vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined)
		vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue()
	})

	it("opens when hovering the complete trigger and renders an image preview", async () => {
		const { container } = renderTooltip(
			<MediaPreviewTooltip
				mediaType="image"
				fileName="cover.png"
				previewUrl="https://cdn.test/cover.png"
				errorMessage="Preview failed"
				audioLabels={{ play: "Play", pause: "Pause", progress: "Progress" }}
			>
				<span data-testid="mention-trigger">@cover.png</span>
			</MediaPreviewTooltip>,
		)

		fireEvent.pointerMove(
			container.querySelector("[data-media-preview-trigger]") as HTMLElement,
		)

		const tooltip = await waitFor(() => {
			const content = document.querySelector('[data-slot="tooltip-content"]')
			if (!content) throw new Error("Tooltip content did not open")
			return content
		})
		expect(tooltip).toHaveTextContent("cover.png")
		expect(tooltip.querySelector("button")).toBeNull()
		expect(tooltip).toHaveClass("z-tooltip")
		expect(tooltip.querySelector('img[src="https://cdn.test/cover.png"]')).not.toBeNull()
	})

	it("uses the image intrinsic ratio when preview size is not provided", async () => {
		const { container } = renderTooltip(
			<MediaPreviewTooltip
				mediaType="image"
				fileName="portrait.png"
				previewUrl="https://cdn.test/portrait.png"
				errorMessage="Preview failed"
				audioLabels={{ play: "Play", pause: "Pause", progress: "Progress" }}
			>
				<span>@portrait.png</span>
			</MediaPreviewTooltip>,
		)

		fireEvent.pointerMove(
			container.querySelector("[data-media-preview-trigger]") as HTMLElement,
		)

		const tooltip = await waitFor(() => {
			const content = document.querySelector('[data-slot="tooltip-content"]')
			if (!content) throw new Error("Tooltip content did not open")
			return content as HTMLElement
		})
		const image = tooltip.querySelector("img") as HTMLImageElement
		Object.defineProperty(image, "naturalWidth", { configurable: true, value: 120 })
		Object.defineProperty(image, "naturalHeight", { configurable: true, value: 240 })

		fireEvent.load(image)

		await waitFor(() => {
			expect(tooltip).toHaveStyle({ width: "120px", maxWidth: "250px" })
		})
		expect(image).toHaveStyle({ width: "120px", maxHeight: "240px" })
	})

	it("renders crop inside the shared media viewport", async () => {
		const { container } = renderTooltip(
			<MediaPreviewTooltip
				mediaType="image"
				fileName="cropped.png"
				previewUrl="https://cdn.test/cropped.png"
				sourceSize={{ width: 1000, height: 500 }}
				crop={{ x: 100, y: 50, width: 400, height: 300 }}
				errorMessage="Preview failed"
				audioLabels={{ play: "Play", pause: "Pause", progress: "Progress" }}
			>
				<span>@cropped.png</span>
			</MediaPreviewTooltip>,
		)

		fireEvent.pointerMove(
			container.querySelector("[data-media-preview-trigger]") as HTMLElement,
		)

		const tooltip = await waitFor(() => {
			const content = document.querySelector('[data-slot="tooltip-content"]')
			if (!content) throw new Error("Tooltip content did not open")
			return content
		})
		const viewport = tooltip.querySelector(
			"[data-media-preview-content] .relative.overflow-hidden",
		) as HTMLElement
		expect(viewport).toHaveStyle({ width: "250px", height: "188px" })
		expect(viewport.querySelector("img")).toHaveStyle({
			width: "625px",
		})
	})

	it("keeps the thumbnail on mobile without opening a tooltip", () => {
		mobileState.isMobile = true
		renderTooltip(
			<MediaPreviewTooltip
				mediaType="image"
				fileName="cover.png"
				previewUrl="https://cdn.test/cover.png"
				errorMessage="Preview failed"
				audioLabels={{ play: "Play", pause: "Pause", progress: "Progress" }}
			>
				<span data-testid="mention-trigger">@cover.png</span>
			</MediaPreviewTooltip>,
		)

		const trigger = screen.getByTestId("mention-trigger")
		fireEvent.mouseMove(trigger)
		expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
	})

	it("stops tooltip content interactions from bubbling to its parent", async () => {
		const parentClick = vi.fn()
		const parentMouseDown = vi.fn()
		const parentPointerDown = vi.fn()
		const parentDoubleClick = vi.fn()
		const { container } = renderTooltip(
			<div
				onClick={parentClick}
				onMouseDown={parentMouseDown}
				onPointerDown={parentPointerDown}
				onDoubleClick={parentDoubleClick}
			>
				<MediaPreviewTooltip
					mediaType="image"
					fileName="cover.png"
					previewUrl="https://cdn.test/cover.png"
					errorMessage="Preview failed"
					audioLabels={{ play: "Play", pause: "Pause", progress: "Progress" }}
				>
					<span>@cover.png</span>
				</MediaPreviewTooltip>
			</div>,
		)

		fireEvent.pointerMove(
			container.querySelector("[data-media-preview-trigger]") as HTMLElement,
		)
		const tooltip = await waitFor(() => {
			const content = document.querySelector('[data-slot="tooltip-content"]')
			if (!content) throw new Error("Tooltip content did not open")
			return content
		})
		const mediaContent = tooltip.querySelector("[data-media-preview-content]")
		if (!mediaContent) throw new Error("Media content did not render")
		fireEvent.pointerDown(mediaContent)
		fireEvent.mouseDown(mediaContent)
		fireEvent.click(mediaContent)
		fireEvent.doubleClick(mediaContent)

		expect(parentPointerDown).not.toHaveBeenCalled()
		expect(parentMouseDown).not.toHaveBeenCalled()
		expect(parentClick).not.toHaveBeenCalled()
		expect(parentDoubleClick).not.toHaveBeenCalled()
	})

	it("suppresses a trigger double click that follows a portal content interaction", async () => {
		const triggerDoubleClick = vi.fn()
		const { container } = renderTooltip(
			<MediaPreviewTooltip
				mediaType="image"
				fileName="layer.png"
				previewUrl="https://cdn.test/layer.png"
				errorMessage="Preview failed"
				audioLabels={{ play: "Play", pause: "Pause", progress: "Progress" }}
			>
				<span onDoubleClick={triggerDoubleClick}>layer.png</span>
			</MediaPreviewTooltip>,
		)

		const trigger = container.querySelector("[data-media-preview-trigger]") as HTMLElement
		fireEvent.pointerMove(trigger)
		const tooltip = await waitFor(() => {
			const content = document.querySelector('[data-slot="tooltip-content"]')
			if (!content) throw new Error("Tooltip content did not open")
			return content
		})

		fireEvent.pointerDown(tooltip)
		fireEvent.doubleClick(trigger)

		expect(triggerDoubleClick).not.toHaveBeenCalled()
	})

	it("does not open when pointer movement starts in an excluded trigger control", async () => {
		const { container } = renderTooltip(
			<MediaPreviewTooltip
				mediaType="image"
				fileName="cover.png"
				previewUrl="https://cdn.test/cover.png"
				errorMessage="Preview failed"
				audioLabels={{ play: "Play", pause: "Pause", progress: "Progress" }}
			>
				<div>
					<span data-testid="layer-body">cover.png</span>
					<button type="button" data-media-preview-ignore-hover>
						Action
					</button>
				</div>
			</MediaPreviewTooltip>,
		)

		const trigger = container.querySelector("[data-media-preview-trigger]") as HTMLElement
		const action = trigger.querySelector("button")
		if (!action) throw new Error("Action control did not render")
		fireEvent.pointerMove(action, { pointerType: "mouse" })
		await new Promise((resolve) => setTimeout(resolve, 10))
		expect(document.querySelector('[data-slot="tooltip-content"]')).not.toBeInTheDocument()
	})

	it("autoplays a muted looping video and resets it when closed", async () => {
		const { container } = renderTooltip(
			<MediaPreviewTooltip
				mediaType="video"
				fileName="clip.mp4"
				previewUrl="https://cdn.test/clip.mp4"
				errorMessage="Preview failed"
				audioLabels={{ play: "Play", pause: "Pause", progress: "Progress" }}
				enableTouchTrigger
			>
				<span>@clip.mp4</span>
			</MediaPreviewTooltip>,
		)

		fireEvent.pointerMove(
			container.querySelector("[data-media-preview-trigger]") as HTMLElement,
		)
		const tooltip = await waitFor(() => {
			const content = document.querySelector('[data-slot="tooltip-content"]')
			if (!content) throw new Error("Tooltip content did not open")
			return content
		})
		const video = tooltip.querySelector("video") as HTMLVideoElement
		expect(video.muted).toBe(true)
		expect(video.loop).toBe(true)
		expect(video.autoplay).toBe(true)
		fireEvent.canPlay(video)
		await waitFor(() => expect(video.autoplay).toBe(true))

		fireEvent.pointerDown(document.body)
		expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
		expect(video.currentTime).toBe(0)
	})

	it("renders the shared audio player and resets it when closed", async () => {
		const { container } = renderTooltip(
			<MediaPreviewTooltip
				mediaType="audio"
				fileName="voice.mp3"
				audioUrl="https://cdn.test/voice.mp3"
				errorMessage="Preview failed"
				audioLabels={{ play: "Play", pause: "Pause", progress: "Progress" }}
				enableTouchTrigger
			>
				<span>@voice.mp3</span>
			</MediaPreviewTooltip>,
		)

		fireEvent.pointerMove(
			container.querySelector("[data-media-preview-trigger]") as HTMLElement,
		)
		const tooltip = await waitFor(() => {
			const content = document.querySelector('[data-slot="tooltip-content"]')
			if (!content) throw new Error("Tooltip content did not open")
			return content
		})
		const audio = tooltip.querySelector("audio") as HTMLAudioElement
		const playButton = tooltip.querySelector('button[aria-label="Play"]') as HTMLButtonElement
		expect(playButton.querySelector('svg[fill="currentColor"]')).not.toBeNull()
		fireEvent.canPlay(audio)
		await waitFor(() => expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled())
		fireEvent.click(playButton)
		await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled())
		const pauseButton = await waitFor(() => {
			const button = tooltip.querySelector('button[aria-label="Pause"]')
			if (!button) throw new Error("Pause button did not render")
			return button
		})
		expect(pauseButton.querySelector('svg[fill="currentColor"]')).not.toBeNull()
		fireEvent.click(pauseButton)
		expect(tooltip.querySelector('button[aria-label="Play"]')).not.toBeNull()
		const progress = tooltip.querySelector('input[aria-label="Progress"]') as HTMLInputElement
		expect(progress).toHaveClass("rounded-full")
		expect(progress).toHaveClass("[&::-webkit-slider-runnable-track]:h-0.5")
		expect(progress).toHaveClass("[&::-webkit-slider-thumb]:size-3")
		expect(progress.parentElement?.firstElementChild).toHaveClass("h-1.5")
		Object.defineProperty(audio, "duration", { configurable: true, value: 100 })
		fireEvent.loadedMetadata(audio)
		await waitFor(() => expect(progress).toHaveAttribute("max", "100"))
		let seekTime = 0
		Object.defineProperty(audio, "currentTime", {
			configurable: true,
			get: () => seekTime,
			set: (value: number) => {
				seekTime = value
			},
		})
		vi.spyOn(progress, "getBoundingClientRect").mockReturnValue({
			bottom: 0,
			height: 12,
			left: 10,
			right: 210,
			top: 0,
			width: 200,
			x: 10,
			y: 0,
			toJSON: () => undefined,
		})
		const dispatchPointerEvent = (type: string, clientX: number) => {
			const event = new Event(type, { bubbles: true })
			Object.defineProperties(event, {
				clientX: { value: clientX },
				pointerId: { value: 1 },
			})
			fireEvent(progress, event)
		}
		dispatchPointerEvent("pointerdown", 60)
		expect(seekTime).toBe(25)
		dispatchPointerEvent("pointermove", 160)
		expect(seekTime).toBe(75)
		dispatchPointerEvent("pointerup", 160)
		expect(Number((progress as HTMLInputElement).value)).toBe(75)
		Object.defineProperty(audio, "currentTime", {
			configurable: true,
			writable: true,
			value: 12,
		})
		fireEvent.pointerDown(document.body)
		expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
		expect(audio.currentTime).toBe(0)
	})

	it("shows a loading icon while starting audio playback", async () => {
		let resolvePlay: (() => void) | undefined
		const pendingPlay = new Promise<void>((resolve) => {
			resolvePlay = resolve
		})
		vi.mocked(HTMLMediaElement.prototype.play).mockReturnValue(pendingPlay)

		const { container } = renderTooltip(
			<MediaPreviewTooltip
				mediaType="audio"
				fileName="voice.mp3"
				audioUrl="https://cdn.test/voice.mp3"
				errorMessage="Preview failed"
				audioLabels={{
					play: "Play",
					pause: "Pause",
					loading: "Loading",
					progress: "Progress",
				}}
				enableTouchTrigger
			>
				<span>@voice.mp3</span>
			</MediaPreviewTooltip>,
		)

		fireEvent.pointerMove(
			container.querySelector("[data-media-preview-trigger]") as HTMLElement,
		)
		const tooltip = await waitFor(() => {
			const content = document.querySelector('[data-slot="tooltip-content"]')
			if (!content) throw new Error("Tooltip content did not open")
			return content
		})
		const playButton = tooltip.querySelector('button[aria-label="Play"]') as HTMLButtonElement
		fireEvent.click(playButton)

		expect(tooltip.querySelector('button[aria-label="Loading"]')).not.toBeNull()
		expect(tooltip.querySelector("button svg.animate-spin")).not.toBeNull()

		resolvePlay?.()
		await waitFor(() => {
			expect(tooltip.querySelector('button[aria-label="Pause"]')).not.toBeNull()
		})
	})

	it("keeps the audio loading viewport height equal to the ready content height", async () => {
		const props = {
			mediaType: "audio" as const,
			fileName: "voice.mp3",
			audioUrl: "https://cdn.test/voice.mp3",
			errorMessage: "Preview failed",
			audioLabels: { play: "Play", pause: "Pause", progress: "Progress" },
			enableTouchTrigger: true,
		}
		const { container, rerender } = renderTooltip(
			<MediaPreviewTooltip {...props} isLoading>
				<span>@voice.mp3</span>
			</MediaPreviewTooltip>,
		)

		fireEvent.pointerMove(
			container.querySelector("[data-media-preview-trigger]") as HTMLElement,
		)
		const tooltip = await waitFor(() => {
			const content = document.querySelector('[data-slot="tooltip-content"]')
			if (!content) throw new Error("Tooltip content did not open")
			return content
		})
		const getViewportHeight = () =>
			(
				tooltip.querySelector(
					"[data-media-preview-content] > div:nth-child(2)",
				) as HTMLElement
			)?.style.height
		const loadingHeight = getViewportHeight()
		// Audio loading keeps the original natural player layout instead of using
		// the generic 120px media viewport.
		expect(loadingHeight).toBe("")

		rerender(
			<MediaPreviewTooltip {...props} isLoading={false}>
				<span>@voice.mp3</span>
			</MediaPreviewTooltip>,
		)
		await waitFor(() => expect(getViewportHeight()).toBe(loadingHeight))
	})

	it("falls back when a thumbnail URL is missing or fails to load", () => {
		render(
			<MediaPreviewThumbnail
				mediaType="image"
				thumbnailUrl="https://cdn.test/missing.png"
				fallback={<span data-testid="fallback">file</span>}
			/>,
		)
		fireEvent.error(screen.getByRole("img"))
		expect(screen.getByTestId("fallback")).toBeInTheDocument()
	})
})
