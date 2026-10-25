import { createEvent, fireEvent, render, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "../../../primitives/shadcn/tooltip"
import { ReferenceAudioPreview } from "../ReferenceAudioPreview"
import { ReferenceImageLowPreview } from "../ReferenceImageLowPreview"
import { ReferenceVideoPosterPreview } from "../ReferenceVideoPosterPreview"
import { CanvasDesignI18nProvider } from "../../../../app/providers/I18nProvider"

const mocks = vi.hoisted(() => ({
	loadAudio: vi.fn(),
	posterClone: null as HTMLCanvasElement | null,
}))

vi.mock("../useReferenceAudioSrc", () => ({
	useReferenceAudioSrc: () => ({
		src: "https://cdn.test/audio.mp3",
		isLoading: false,
		hasError: false,
		load: mocks.loadAudio,
	}),
}))

vi.mock("../useReferenceVideoPoster", () => ({
	useReferenceVideoPoster: () => ({
		loadState: "ready",
		posterClone: mocks.posterClone,
		ossSrc: "https://cdn.test/video.mp4",
	}),
}))

vi.mock("../../../../app/hooks/resources/useReferenceImageUrls", async () => {
	const { useState } = await import("react")
	return {
		useReferenceImageUrls: () => {
			const [open, setOpen] = useState(false)
			return {
				lowUrl: "https://cdn.test/image-low.png",
				fullUrl: "https://cdn.test/image-full.png",
				isLoading: false,
				hasError: false,
				imageInfo: { naturalWidth: 640, naturalHeight: 360 },
				isFullUrlLoading: false,
				open,
				setOpen,
				handleOpenChange: setOpen,
			}
		},
	}
})

vi.mock("../useObserveBoxSize", () => ({
	useObserveBoxSize: () => ({ ref: vi.fn(), w: 48, h: 56 }),
}))

function renderWithTooltipProvider(ui: ReactNode) {
	return render(
		<CanvasDesignI18nProvider>
			<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>
		</CanvasDesignI18nProvider>,
	)
}

function getTooltipTrigger(container: HTMLElement): HTMLElement {
	const trigger = container.querySelector<HTMLElement>("[data-state]")
	if (!trigger) throw new Error("Tooltip trigger not found")
	return trigger
}

async function getTooltipContent(): Promise<HTMLElement> {
	return waitFor(() => {
		const content = document.querySelector<HTMLElement>('[data-slot="tooltip-content"]')
		if (!content) throw new Error("Tooltip content did not open")
		return content
	})
}

function fireTouchPointerDown(target: Element) {
	const event = createEvent.pointerDown(target)
	Object.defineProperty(event, "pointerType", { value: "touch" })
	fireEvent(target, event)
}

function expectTooltipHeaderBefore(tooltip: HTMLElement, selector: string) {
	const header = tooltip.querySelector<HTMLElement>("[data-reference-media-tooltip-header]")
	const media = tooltip.querySelector(selector)

	expect(header).not.toBeNull()
	expect(media).not.toBeNull()
	if (!header || !media) return
	expect(header.compareDocumentPosition(media) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
}

describe("Reference media SourceList tooltip", () => {
	beforeEach(() => {
		mocks.loadAudio.mockClear()
		const poster = document.createElement("canvas")
		poster.width = 640
		poster.height = 360
		mocks.posterClone = poster
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			drawImage: vi.fn(),
			clearRect: vi.fn(),
		} as unknown as CanvasRenderingContext2D)
		vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined)
		vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue()
	})

	it("opens an image preview from a touch press and keeps the file name", async () => {
		const { container } = renderWithTooltipProvider(
			<ReferenceImageLowPreview
				fileName="image.png"
				path="./images/image.png"
				fillParent
				inlineOriginal
				enableTooltip
			/>,
		)

		fireTouchPointerDown(getTooltipTrigger(container))

		const tooltip = await getTooltipContent()
		expect(tooltip).not.toHaveAttribute("data-reference-media-tooltip-fullscreen")
		expect(tooltip).toHaveStyle({ width: "250px", maxWidth: "250px" })
		expect(tooltip).toHaveTextContent("image.png")
		expectTooltipHeaderBefore(tooltip, 'img[src="https://cdn.test/image-full.png"]')
		const image = tooltip.querySelector<HTMLImageElement>(
			'img[src="https://cdn.test/image-full.png"]',
		)
		expect(image).not.toBeNull()
		expect(image).toHaveStyle({ width: "250px", height: "141px" })
		const closeButton = tooltip.querySelector<HTMLButtonElement>(
			'button[aria-label="关闭预览"]',
		)
		expect(closeButton).not.toBeNull()

		if (!closeButton) throw new Error("Close button not found")
		fireEvent.click(closeButton)
		expect(document.querySelector('[data-slot="tooltip-content"]')).not.toBeInTheDocument()
	})

	afterEach(() => {
		vi.restoreAllMocks()
		vi.stubGlobal(
			"ResizeObserver",
			vi.fn().mockImplementation(() => ({
				observe: vi.fn(),
				unobserve: vi.fn(),
				disconnect: vi.fn(),
			})),
		)
	})

	it("opens the custom audio player without autoplay and closes outside", async () => {
		const { container } = renderWithTooltipProvider(
			<ReferenceAudioPreview fileName="audio.mp3" path="./audios/audio.mp3" enableTooltip />,
		)

		fireTouchPointerDown(getTooltipTrigger(container))

		expect(mocks.loadAudio).toHaveBeenCalledOnce()
		const tooltip = await getTooltipContent()
		expect(tooltip).toHaveTextContent("audio.mp3")
		expectTooltipHeaderBefore(tooltip, "audio")
		const audio = tooltip.querySelector<HTMLAudioElement>("audio")
		expect(audio).not.toHaveAttribute("controls")
		const playButton = tooltip.querySelector<HTMLButtonElement>('button[aria-label="播放"]')
		const progress = tooltip.querySelector<HTMLInputElement>('input[aria-label="播放进度"]')
		expect(playButton).not.toBeNull()
		expect(progress).not.toBeNull()
		if (!playButton || !progress) throw new Error("Audio controls not found")
		expect(progress).toHaveValue("0")
		expect(tooltip).toHaveTextContent("0:00 / 0:00")

		if (!audio) throw new Error("Audio element not found")
		fireEvent.canPlay(audio)
		expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
		Object.defineProperty(audio, "duration", { configurable: true, value: 120 })
		fireEvent.durationChange(audio)
		expect(progress).toHaveAttribute("max", "120")
		expect(tooltip).toHaveTextContent("0:00 / 2:00")

		fireEvent.click(playButton)
		expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce()
		fireEvent.play(audio)
		await waitFor(() =>
			expect(tooltip.querySelector('button[aria-label="暂停"]')).not.toBeNull(),
		)

		fireEvent.click(tooltip.querySelector('button[aria-label="暂停"]') as HTMLButtonElement)
		expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
		fireEvent.pause(audio)

		expect(tooltip.querySelector('button[aria-label="播放"]')).not.toBeNull()

		fireEvent.change(progress, { target: { value: "30" } })
		expect(audio.currentTime).toBe(30)
		expect(tooltip).toHaveTextContent("0:30 / 2:00")

		fireEvent.pointerDown(document.body)
		expect(document.querySelector('[data-slot="tooltip-content"]')).not.toBeInTheDocument()
	})

	it("opens a muted looping video preview and pauses it when closed", async () => {
		const pause = vi.mocked(HTMLMediaElement.prototype.pause)
		const { container } = renderWithTooltipProvider(
			<ReferenceVideoPosterPreview
				fileName="video.mp4"
				path="./videos/video.mp4"
				enableTooltip
			/>,
		)

		fireTouchPointerDown(getTooltipTrigger(container))

		const tooltip = await getTooltipContent()
		const video = tooltip.querySelector("video")
		expectTooltipHeaderBefore(tooltip, "video")
		expect(video).not.toBeNull()
		if (!video) throw new Error("Video preview not found")
		expect(video.muted).toBe(true)
		expect(video.loop).toBe(true)
		expect(video.autoplay).toBe(true)

		fireEvent.pointerDown(document.body)
		expect(pause).toHaveBeenCalled()
		expect(document.querySelector('[data-slot="tooltip-content"]')).not.toBeInTheDocument()
	})

	it("keeps rendering while the video poster dimensions are not ready", () => {
		mocks.posterClone = null

		expect(() =>
			renderWithTooltipProvider(
				<ReferenceVideoPosterPreview
					fileName="video.mp4"
					path="./videos/video.mp4"
					enableTooltip
				/>,
			),
		).not.toThrow()
	})
})
