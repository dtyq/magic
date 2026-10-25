import { afterEach, describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { CanvasResourceScheduler } from "../../scheduler/CanvasResourceScheduler"
import { AudioWaveformManager, buildAudioWaveformPeaks } from "../AudioWaveformManager"

function createAudioBuffer(channels: number[][]): AudioBuffer {
	return {
		length: channels[0]?.length ?? 0,
		numberOfChannels: channels.length,
		getChannelData: (channelIndex: number) => Float32Array.from(channels[channelIndex] ?? []),
	} as unknown as AudioBuffer
}

function createHarness(options?: {
	decodeAudioData?: (arrayBuffer: ArrayBuffer) => Promise<AudioBuffer>
	fetchImpl?: typeof fetch
}) {
	const scheduler = new CanvasResourceScheduler()
	const resource = {
		path: "./audios/a.mp3",
		ossSrc: "https://example.test/a.mp3",
		expiresAt: null,
		resourceIdentity: "workspace:/audios/a.mp3",
		resourceVersion: "v1",
		sourceUpdatedAt: null,
	}
	const getResource = vi.fn(async () => resource)
	const invalidateAudioLoadRequest = vi.fn()
	const decodeAudioData = vi.fn(
		options?.decodeAudioData ??
			(async () => createAudioBuffer([[0, 0.25, -0.5, 1, -0.75, 0.5, 0.25, 0]])),
	)
	const close = vi.fn(async () => undefined)
	class MockAudioContext {
		state: AudioContextState = "running"
		decodeAudioData = decodeAudioData
		close = close
	}
	vi.stubGlobal("AudioContext", MockAudioContext)
	vi.stubGlobal(
		"fetch",
		options?.fetchImpl ??
			(vi.fn(async () => ({
				ok: true,
				status: 200,
				arrayBuffer: async () => new ArrayBuffer(8),
			})) as unknown as typeof fetch),
	)
	const canvas = {
		resourceScheduler: scheduler,
		audioResourceManager: {
			getResourceIdentity: vi.fn(() => resource.resourceIdentity),
			getResource,
			getFailureReason: vi.fn(() => null),
		},
		visibilityManager: { invalidateAudioLoadRequest },
	} as unknown as Canvas
	const manager = new AudioWaveformManager({ canvas })
	return {
		close,
		decodeAudioData,
		getResource,
		invalidateAudioLoadRequest,
		manager,
		resource,
		scheduler,
	}
}

describe("buildAudioWaveformPeaks", () => {
	it("mixes channels into normalized RMS energy buckets", () => {
		const peaks = buildAudioWaveformPeaks(
			createAudioBuffer([
				[0, 0.25, 0.5, 1],
				[0, -0.5, -0.25, -0.75],
			]),
			4,
		)

		expect(peaks[0]).toBe(0)
		expect(peaks[1]).toBeCloseTo(0.4472, 4)
		expect(peaks[2]).toBeCloseTo(0.4472, 4)
		expect(peaks[3]).toBe(1)
	})
})

describe("AudioWaveformManager", () => {
	afterEach(() => {
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})

	it("decodes a visible resource and reuses cached peaks", async () => {
		const { decodeAudioData, manager } = createHarness()
		const snapshots: string[] = []
		manager.subscribe("./audios/a.mp3", (snapshot) => snapshots.push(snapshot.status))

		await expect(manager.prepare("./audios/a.mp3")).resolves.toBe(true)
		await expect(manager.prepare("./audios/a.mp3")).resolves.toBe(true)

		expect(decodeAudioData).toHaveBeenCalledTimes(1)
		expect(manager.getSnapshot("./audios/a.mp3")).toMatchObject({ status: "ready" })
		expect(manager.getSnapshot("./audios/a.mp3").peaks).toHaveLength(512)
		expect(snapshots).toContain("loading")
		expect(snapshots.at(-1)).toBe("ready")
	})

	it("deduplicates concurrent requests for the same resource", async () => {
		let resolveFetch!: (value: Response) => void
		const fetchImpl = vi.fn(
			() =>
				new Promise<Response>((resolve) => {
					resolveFetch = resolve
				}),
		)
		const { decodeAudioData, manager } = createHarness({ fetchImpl: fetchImpl as typeof fetch })

		const first = manager.prepare("./audios/a.mp3")
		const second = manager.prepare("./audios/a.mp3")
		await Promise.resolve()
		await Promise.resolve()
		resolveFetch({
			ok: true,
			status: 200,
			arrayBuffer: async () => new ArrayBuffer(8),
		} as Response)

		await expect(Promise.all([first, second])).resolves.toEqual([true, true])
		expect(fetchImpl).toHaveBeenCalledTimes(1)
		expect(decodeAudioData).toHaveBeenCalledTimes(1)
	})

	it("cancels the shared fetch when its last viewport consumer aborts", async () => {
		const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
			return new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener(
					"abort",
					() => {
						const error = new Error("Aborted")
						error.name = "AbortError"
						reject(error)
					},
					{ once: true },
				)
			})
		})
		const { manager } = createHarness({ fetchImpl: fetchImpl as typeof fetch })
		const controller = new AbortController()
		const pending = manager.prepare("./audios/a.mp3", { signal: controller.signal })

		controller.abort()

		await expect(pending).resolves.toBe(false)
		await Promise.resolve()
		expect(manager.getSnapshot("./audios/a.mp3").status).toBe("idle")
	})

	it("keeps waveform failures separate from playback state", async () => {
		const { invalidateAudioLoadRequest, manager } = createHarness({
			decodeAudioData: async () => {
				throw new Error("decode failed")
			},
		})

		await expect(manager.prepare("./audios/a.mp3")).resolves.toBe(false)

		expect(manager.getSnapshot("./audios/a.mp3")).toEqual({
			status: "error",
			peaks: null,
		})
		expect(invalidateAudioLoadRequest).toHaveBeenCalledWith(
			"./audios/a.mp3",
			"waveform-decode-failed",
			{ scheduleRefresh: false },
		)
	})

	it("invalidates cached peaks and closes its AudioContext on destroy", async () => {
		const { close, decodeAudioData, manager } = createHarness()
		await manager.prepare("./audios/a.mp3")

		manager.invalidatePath("./audios/a.mp3")
		await manager.prepare("./audios/a.mp3")
		expect(decodeAudioData).toHaveBeenCalledTimes(2)

		manager.destroy()
		expect(close).toHaveBeenCalledTimes(1)
	})
})
