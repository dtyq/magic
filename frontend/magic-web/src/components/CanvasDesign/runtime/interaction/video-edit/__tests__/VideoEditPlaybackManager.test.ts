import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { AudioPlaybackManager } from "../../../resources/audio/AudioPlaybackManager"
import { CanvasResourceScheduler } from "../../../resources/scheduler/CanvasResourceScheduler"
import { VideoEditPlaybackManager } from "../VideoEditPlaybackManager"

class FakeAudioElement extends EventTarget {
	preload = ""
	private source = ""
	get src(): string {
		return this.source
	}
	set src(value: string) {
		this.source = value
		this.currentTime = 0
		this.readyState = 0
	}
	duration = 60
	currentTime = 0
	paused = true
	ended = false
	readyState = 0
	error: MediaError | null = null
	load = vi.fn(() => {
		queueMicrotask(() => {
			this.readyState = HTMLMediaElement.HAVE_METADATA
			this.dispatchEvent(new Event("loadedmetadata"))
		})
	})
	play = vi.fn(async () => {
		this.paused = false
		this.dispatchEvent(new Event("play"))
	})
	pause = vi.fn(() => {
		this.paused = true
		this.dispatchEvent(new Event("pause"))
	})
	removeAttribute = vi.fn()
}

describe("VideoEditPlaybackManager", () => {
	it("uses an editor-owned session instead of the referenced audio element session", async () => {
		const toggle = vi.fn().mockResolvedValue(true)
		const subscribe = vi.fn(() => vi.fn())
		const prepare = vi.fn().mockResolvedValue(true)
		const seek = vi.fn()
		const release = vi.fn()
		const manager = new VideoEditPlaybackManager({
			canvas: {
				audioPlaybackManager: { toggle, subscribe, prepare, seek, release },
			} as never,
		})
		const source = { audioElementId: "audio-1", path: "audio.wav" }
		const handler = vi.fn()

		manager.bindAudio("editor-1", source)
		manager.subscribe("editor-1", handler)
		expect(await manager.toggle("editor-1", source)).toBe(true)
		await manager.prepare("editor-1", source, { source: "interaction" })
		manager.seek("editor-1", 0.5)

		expect(subscribe).toHaveBeenCalledWith("video-edit:audio:editor-1", handler)
		expect(toggle).toHaveBeenCalledWith("video-edit:audio:editor-1", "audio.wav")
		expect(prepare).toHaveBeenCalledWith("video-edit:audio:editor-1", "audio.wav", {
			source: "interaction",
		})
		expect(seek).toHaveBeenCalledWith("video-edit:audio:editor-1", 0.5)
		expect(toggle).not.toHaveBeenCalledWith("audio-1", "audio.wav")
	})

	it("releases only the prior editor session when its referenced audio changes", () => {
		const release = vi.fn()
		const manager = new VideoEditPlaybackManager({
			canvas: { audioPlaybackManager: { release } } as never,
		})

		manager.bindAudio("editor-1", { audioElementId: "audio-1", path: "one.wav" })
		manager.bindAudio("editor-1", { audioElementId: "audio-2", path: "two.wav" })

		expect(release).toHaveBeenCalledWith("video-edit:audio:editor-1")
		expect(release).not.toHaveBeenCalledWith("audio-1")
		expect(release).not.toHaveBeenCalledWith("audio-2")
	})

	it("keeps seek state isolated from the referenced AudioElement session", async () => {
		const audioElements: FakeAudioElement[] = []
		const originalCreateElement = document.createElement.bind(document)
		vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
			if (tagName.toLowerCase() !== "audio") return originalCreateElement(tagName)
			const audio = new FakeAudioElement()
			audioElements.push(audio)
			return audio as unknown as HTMLAudioElement
		}) as typeof document.createElement)
		const canvas = {
			audioResourceManager: {
				getResource: vi
					.fn()
					.mockResolvedValue({ ossSrc: "https://example.test/voice.mp3" }),
				getFailureReason: vi.fn().mockReturnValue(null),
				resolveVirtualPlaybackFallback: vi.fn().mockResolvedValue(null),
			},
			mediaPlaybackCoordinator: { preparePlayback: vi.fn() },
			mediaResourceOfflineCacheManager: { recordVirtualResourceLoadSuccess: vi.fn() },
			resourceScheduler: new CanvasResourceScheduler(),
			eventEmitter: { emit: vi.fn() },
			id: "canvas-1",
		} as unknown as Canvas
		const audioPlaybackManager = new AudioPlaybackManager({ canvas })
		;(canvas as { audioPlaybackManager: AudioPlaybackManager }).audioPlaybackManager =
			audioPlaybackManager
		const manager = new VideoEditPlaybackManager({ canvas })
		const source = { audioElementId: "audio-1", path: "./audios/voice.mp3" }

		await audioPlaybackManager.prepare("audio-1", source.path)
		await manager.prepare("editor-1", source)
		audioPlaybackManager.seek("audio-1", 0.25)
		manager.seek("editor-1", 0.75)

		expect(audioElements).toHaveLength(2)
		expect(audioPlaybackManager.getSnapshot("audio-1").currentTime).toBe(15)
		expect(audioPlaybackManager.getSnapshot("video-edit:audio:editor-1").currentTime).toBe(45)
	})
})
