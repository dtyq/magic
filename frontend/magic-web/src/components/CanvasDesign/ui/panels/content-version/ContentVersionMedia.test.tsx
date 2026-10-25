import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AudioElement, ImageElement, VideoElement } from "../../../runtime/document/types"
import ContentVersionMedia, { ContentVersionAudioControl } from "./ContentVersionMedia"

const mocks = vi.hoisted(() => ({
	image: {
		lowUrl: undefined as string | undefined,
		isLoading: false,
	},
	video: {
		posterClone: null as HTMLCanvasElement | null,
		loadState: "loading" as "loading" | "ready" | "error",
		ossSrc: null as string | null,
	},
	audio: {
		src: undefined as string | undefined,
		isLoading: false,
		hasError: false,
		load: vi.fn(async () => undefined),
	},
	submissionRuntime: null as { phase: string } | null,
	replacement: null as {
		contentId: string
		source: string
		phase: string
	} | null,
	compositionActive: false,
}))

vi.mock("../../../app/providers/I18nProvider", () => ({
	useCanvasDesignI18n: () => ({
		t: (key: string, fallback?: string | { defaultValue?: string; name?: string }) => {
			if (typeof fallback === "string") return fallback
			return (fallback?.defaultValue ?? key).replace("{{name}}", fallback?.name ?? "")
		},
	}),
}))

vi.mock("../../../app/hooks/resources/useReferenceImageUrls", () => ({
	useReferenceImageUrls: () => mocks.image,
}))

vi.mock("../../../app/providers/CanvasProvider", () => ({
	useCanvas: () => ({
		canvas: {
			getEffectiveContentId: () => "v1",
			mediaReplaceController: { getReplacementState: () => mocks.replacement },
			videoCompositionManager: { isComposingResult: () => mocks.compositionActive },
		},
	}),
}))

vi.mock("../../../app/hooks/canvas", () => ({
	useCanvasEvent: vi.fn(),
	useGenerationSubmissionState: () => mocks.submissionRuntime,
}))

vi.mock("../../previews/reference-media/useReferenceVideoPoster", () => ({
	useReferenceVideoPoster: () => mocks.video,
}))

vi.mock("../../previews/reference-media/useReferenceAudioSrc", () => ({
	useReferenceAudioSrc: () => mocks.audio,
}))

vi.mock("../../../runtime/shared/path/canvasResourcePath", () => ({
	getCanvasResourceFileName: (path: string) => path.split("/").pop(),
}))

function imageElement(): ImageElement {
	return {
		id: "image-1",
		type: "image",
		activeContentId: "v1",
		mainContentId: "v1",
		contents: [{ contentId: "v1", src: "./images/a.png" }],
	}
}

function videoElement(): VideoElement {
	return {
		id: "video-1",
		type: "video",
		activeContentId: "v1",
		mainContentId: "v1",
		contents: [{ contentId: "v1", src: "./videos/a.mp4", status: "completed" }],
	}
}

function audioElement(): AudioElement {
	return {
		id: "audio-1",
		type: "audio",
		activeContentId: "v1",
		mainContentId: "v1",
		contents: [{ contentId: "v1", src: "./audios/a.mp3" }],
	}
}

describe("ContentVersionMedia", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.image = { lowUrl: undefined, isLoading: false }
		mocks.video = { posterClone: null, loadState: "loading", ossSrc: null }
		mocks.audio = {
			src: undefined,
			isLoading: false,
			hasError: false,
			load: vi.fn(async () => undefined),
		}
		mocks.submissionRuntime = null
		mocks.replacement = null
		mocks.compositionActive = false
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			clearRect: vi.fn(),
			drawImage: vi.fn(),
		} as unknown as CanvasRenderingContext2D)
	})

	afterEach(() => {
		cleanup()
		vi.restoreAllMocks()
	})

	it("uses the shared placeholder for Content generation states", () => {
		const element = imageElement()
		element.contents[0].status = "processing"

		render(
			<ContentVersionMedia
				element={element}
				content={element.contents[0]}
				contentState="processing"
				playing={false}
			/>,
		)

		expect(screen.getByRole("status")).toHaveTextContent("生成中")
	})

	it("aligns video pending and processing labels with the video element", () => {
		const element = videoElement()
		element.contents[0].status = "pending"
		const view = render(
			<ContentVersionMedia
				element={element}
				content={element.contents[0]}
				contentState="pending"
				playing={false}
			/>,
		)
		expect(screen.getByRole("status")).toHaveTextContent("上传中")

		element.contents[0].status = "processing"
		view.rerender(
			<ContentVersionMedia
				element={element}
				content={element.contents[0]}
				contentState="processing"
				playing={false}
			/>,
		)
		expect(screen.getByRole("status")).toHaveTextContent("生成中")
	})

	it("shows runtime upload and compliance phases with the shared placeholder", () => {
		const element = imageElement()
		mocks.replacement = { contentId: "v1", source: "local-upload", phase: "uploading" }
		const view = render(
			<ContentVersionMedia
				element={element}
				content={element.contents[0]}
				contentState="completed"
				playing={false}
			/>,
		)
		expect(screen.getByRole("status")).toHaveTextContent("上传中")

		mocks.replacement = null
		mocks.submissionRuntime = { phase: "validating" }
		const video = videoElement()
		view.rerender(
			<ContentVersionMedia
				element={video}
				content={video.contents[0]}
				contentState="completed"
				playing={false}
			/>,
		)
		expect(screen.getByRole("status")).toHaveTextContent("正在校验")
	})

	it("uses the shared placeholder for media resource failures", () => {
		render(
			<ContentVersionMedia
				element={imageElement()}
				content={imageElement().contents[0]}
				contentState="completed"
				playing={false}
			/>,
		)

		expect(screen.getByRole("alert")).toHaveTextContent("图片加载失败")
	})

	it("shows a video poster and plays muted looped video only while hovered", () => {
		const poster = document.createElement("canvas")
		poster.width = 320
		poster.height = 180
		mocks.video = { posterClone: poster, loadState: "ready", ossSrc: "blob:video" }
		const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined)
		const pause = vi
			.spyOn(HTMLMediaElement.prototype, "pause")
			.mockImplementation(() => undefined)
		const element = videoElement()
		const view = render(
			<ContentVersionMedia
				element={element}
				content={element.contents[0]}
				contentState="completed"
				playing
			/>,
		)

		const video = view.container.querySelector("video")
		expect((video as HTMLVideoElement).muted).toBe(true)
		expect((video as HTMLVideoElement).loop).toBe(true)
		expect(play).toHaveBeenCalled()

		view.rerender(
			<ContentVersionMedia
				element={element}
				content={element.contents[0]}
				contentState="completed"
				playing={false}
			/>,
		)
		expect(pause).toHaveBeenCalled()
	})

	it("shows an audio file name and toggles playback", async () => {
		mocks.audio.src = "blob:audio"
		const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined)
		const pause = vi
			.spyOn(HTMLMediaElement.prototype, "pause")
			.mockImplementation(() => undefined)
		const element = audioElement()

		const view = render(
			<>
				<ContentVersionMedia
					element={element}
					content={element.contents[0]}
					contentState="completed"
					playing={false}
				/>
				<ContentVersionAudioControl
					contentId="v1"
					path="./audios/a.mp3"
					onPlaybackChange={vi.fn()}
				/>
			</>,
		)

		expect(screen.getByText("a.mp3")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "播放" }))
		expect(play).toHaveBeenCalled()

		const audio = view.container.querySelector("audio")
		if (!audio) throw new Error("audio not found")
		fireEvent.play(audio)
		fireEvent.click(screen.getByRole("button", { name: "暂停" }))
		expect(pause).toHaveBeenCalled()
	})

	it("pauses audio when another version takes playback ownership", async () => {
		mocks.audio.src = "blob:audio"
		vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined)
		const pause = vi
			.spyOn(HTMLMediaElement.prototype, "pause")
			.mockImplementation(() => undefined)
		const view = render(
			<ContentVersionAudioControl
				contentId="v1"
				path="./audios/a.mp3"
				activeAudioContentId="v2"
				onPlaybackChange={vi.fn()}
			/>,
		)
		const audio = view.container.querySelector("audio")
		if (!audio) throw new Error("audio not found")

		fireEvent.play(audio)
		await waitFor(() => expect(pause).toHaveBeenCalled())
	})
})
