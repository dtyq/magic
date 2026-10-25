import Konva from "konva"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import type { LoadedVideoMetadata } from "../../../resources/video/VideoResourceManager"
import { VideoRenderer } from "../VideoRenderer"

function createCanvasMock(): Canvas {
	return {
		permissionManager: {
			canShowTransientElementAffordance: vi.fn(() => true),
			canUseSelectionToolAffordance: vi.fn(() => true),
		},
		cursorManager: {
			setTemporary: vi.fn(),
			restoreToolCursor: vi.fn(),
		},
	} as unknown as Canvas
}

function createFakeVideo(options: { paused: boolean; ended?: boolean; duration?: number }) {
	const video = document.createElement("video")

	Object.defineProperties(video, {
		paused: { configurable: true, value: options.paused },
		ended: { configurable: true, value: options.ended ?? false },
		duration: { configurable: true, value: options.duration ?? 65 },
		currentTime: { configurable: true, value: 0 },
		videoWidth: { configurable: true, value: 640 },
		videoHeight: { configurable: true, value: 360 },
		readyState: { configurable: true, value: HTMLMediaElement.HAVE_CURRENT_DATA },
		playbackRate: { configurable: true, value: 1 },
		buffered: {
			configurable: true,
			value: {
				length: 0,
				start: () => 0,
				end: () => 0,
			},
		},
	})

	vi.spyOn(video, "play").mockResolvedValue(undefined)
	vi.spyOn(video, "pause").mockImplementation(() => undefined)

	return video
}

function getPlayerNodes(group: Konva.Group) {
	const controlsGroup = group.findOne<Konva.Group>(".video-player-controls")
	const progressGroup = group.findOne<Konva.Group>(".video-player-progress")
	const draftTagGroup = group.findOne<Konva.Group>(".video-player-draft-tag")
	const playButtonGroup = group.findOne<Konva.Group>(".video-player-play-button")
	const progressText = progressGroup?.getChildren()[1] as Konva.Text | undefined

	return { controlsGroup, draftTagGroup, playButtonGroup, progressGroup, progressText }
}

const POSTER_METADATA: LoadedVideoMetadata = {
	duration: 65,
	videoWidth: 640,
	videoHeight: 360,
}

describe("VideoRenderer player controls", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			clearRect: vi.fn(),
			fillRect: vi.fn(),
			getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) })),
			measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
			scale: vi.fn(),
		} as unknown as CanvasRenderingContext2D)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("keeps the play button and duration visible after a paused video loses hover", () => {
		const renderer = new VideoRenderer()
		const canvas = createCanvasMock()
		renderer.loadPoster(document.createElement("canvas"), POSTER_METADATA)

		const group = renderer.createPlayerNode(640, 360, canvas)
		expect(group).not.toBeNull()

		const nodes = getPlayerNodes(group as Konva.Group)
		expect(nodes.playButtonGroup?.visible()).toBe(true)
		expect(nodes.controlsGroup?.visible()).toBe(true)
		expect(nodes.progressText?.text()).toBe("00:00 / 01:05")

		group?.fire("mouseleave")

		expect(nodes.playButtonGroup?.visible()).toBe(true)
		expect(nodes.controlsGroup?.visible()).toBe(true)

		renderer.destroy()
	})

	it("renders the sample tag beside the duration tag", () => {
		const renderer = new VideoRenderer()
		const canvas = createCanvasMock()
		renderer.loadPoster(document.createElement("canvas"), POSTER_METADATA)

		const group = renderer.createPlayerNode(640, 360, canvas, { showDraftTag: true })
		const nodes = getPlayerNodes(group as Konva.Group)
		const progressBackground = nodes.progressGroup?.getChildren()[0] as Konva.Rect | undefined

		expect(nodes.draftTagGroup).toBeDefined()
		expect(nodes.draftTagGroup?.getChildren()[1]).toBeDefined()
		expect((nodes.draftTagGroup?.getChildren()[1] as Konva.Text).text()).toBe("样片")
		expect(nodes.draftTagGroup?.x()).toBeGreaterThan(
			(nodes.progressGroup?.x() ?? 0) + (progressBackground?.width() ?? 0),
		)

		renderer.destroy()
	})

	it("keeps the ended-state controls visible", () => {
		const renderer = new VideoRenderer()
		const canvas = createCanvasMock()
		const video = createFakeVideo({ paused: true, ended: true })
		renderer.attachPlayback(video)

		const group = renderer.createPlayerNode(640, 360, canvas)
		const nodes = getPlayerNodes(group as Konva.Group)

		expect(nodes.playButtonGroup?.visible()).toBe(true)
		expect(nodes.controlsGroup?.visible()).toBe(true)

		group?.fire("mouseleave")

		expect(nodes.playButtonGroup?.visible()).toBe(true)
		expect(nodes.controlsGroup?.visible()).toBe(true)

		renderer.destroy()
	})

	it("keeps playing-state controls hover-driven", () => {
		const renderer = new VideoRenderer()
		const canvas = createCanvasMock()
		const video = createFakeVideo({ paused: false })
		renderer.attachPlayback(video)

		const group = renderer.createPlayerNode(640, 360, canvas)
		const nodes = getPlayerNodes(group as Konva.Group)

		expect(nodes.playButtonGroup?.visible()).toBe(false)
		expect(nodes.controlsGroup?.visible()).toBe(false)

		group?.fire("mouseenter")

		expect(nodes.playButtonGroup?.visible()).toBe(true)
		expect(nodes.controlsGroup?.visible()).toBe(true)

		group?.fire("mouseleave")

		expect(nodes.controlsGroup?.visible()).toBe(false)

		renderer.destroy()
	})

	it("hides the play button behind the loading overlay", () => {
		const renderer = new VideoRenderer()
		const canvas = createCanvasMock()
		renderer.loadPoster(document.createElement("canvas"), POSTER_METADATA)

		const group = renderer.createPlayerNode(640, 360, canvas, { showLoadingOverlay: true })
		const nodes = getPlayerNodes(group as Konva.Group)
		const bufferingOverlay = group?.findOne<Konva.Group>(".video-player-buffer-overlay")

		expect(bufferingOverlay?.visible()).toBe(true)
		expect(nodes.playButtonGroup?.visible()).toBe(false)
		expect(nodes.controlsGroup?.visible()).toBe(true)

		renderer.destroy()
	})

	it("rejects a zero-sized poster instead of creating a Konva image", () => {
		const renderer = new VideoRenderer()
		const canvas = createCanvasMock()
		const poster = document.createElement("canvas")
		poster.width = 0
		poster.height = 0

		renderer.loadPoster(poster, POSTER_METADATA)

		expect(renderer.hasPreview()).toBe(false)
		expect(renderer.createPlayerNode(640, 360, canvas)).toBeNull()
		renderer.destroy()
	})

	it("stops and resumes the playback render loop with render visibility", () => {
		let nextRafId = 1
		const requestAnimationFrameSpy = vi
			.spyOn(globalThis, "requestAnimationFrame")
			.mockImplementation(() => nextRafId++)
		const cancelAnimationFrameSpy = vi
			.spyOn(globalThis, "cancelAnimationFrame")
			.mockImplementation(() => undefined)
		const renderer = new VideoRenderer()
		const canvas = createCanvasMock()
		const video = createFakeVideo({ paused: false })
		renderer.attachPlayback(video)
		renderer.createPlayerNode(640, 360, canvas)

		expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1)
		renderer.setRenderVisibility(false)
		expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(1)

		renderer.setRenderVisibility(true)
		expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(2)

		renderer.destroy()
		requestAnimationFrameSpy.mockRestore()
		cancelAnimationFrameSpy.mockRestore()
	})
})
