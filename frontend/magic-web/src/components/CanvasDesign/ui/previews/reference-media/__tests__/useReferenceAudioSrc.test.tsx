import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useReferenceAudioSrc } from "../useReferenceAudioSrc"

const mocks = vi.hoisted(() => {
	let deferred = false
	let remoteLoadReleasedHandler: ((event: { data: { key: string } }) => void) | null = null
	const getResource = vi.fn(async () =>
		deferred
			? null
			: {
					ossSrc: "https://cdn.test/audio.mp3",
				},
	)
	const shouldDeferRemoteResourceLoad = vi.fn(() => deferred)
	const getRemoteResourceLoadDeferralKey = vi.fn(() => "audio-key")

	return {
		getResource,
		shouldDeferRemoteResourceLoad,
		getRemoteResourceLoadDeferralKey,
		setDeferred(value: boolean) {
			deferred = value
		},
		setRemoteLoadReleasedHandler(handler: ((event: { data: { key: string } }) => void) | null) {
			remoteLoadReleasedHandler = handler
		},
		getRemoteLoadReleasedHandler() {
			return remoteLoadReleasedHandler
		},
		canvas: {
			audioResourceManager: {
				getResource,
			},
			canvasFileUploadManager: {
				shouldDeferRemoteResourceLoad,
				getRemoteResourceLoadDeferralKey,
			},
		},
	}
})

vi.mock("../../../../app/providers/CanvasProvider", () => ({
	useCanvas: () => ({ canvas: mocks.canvas }),
	useOptionalCanvas: () => mocks.canvas,
}))

vi.mock("../../../../app/hooks/canvas", () => ({
	useCanvasEvent: (_event: string, handler: (event: { data: { key: string } }) => void) =>
		mocks.setRemoteLoadReleasedHandler(handler),
	useCanvasEventWithInstance: (
		_canvas: unknown,
		_event: string,
		handler: (event: { data: { key: string } }) => void,
	) => mocks.setRemoteLoadReleasedHandler(handler),
}))

describe("useReferenceAudioSrc", () => {
	beforeEach(() => {
		mocks.setDeferred(false)
		mocks.setRemoteLoadReleasedHandler(null)
		mocks.getResource.mockClear()
		mocks.shouldDeferRemoteResourceLoad.mockClear()
		mocks.getRemoteResourceLoadDeferralKey.mockClear()
	})

	it("loads the audio source only after the tooltip requests it", async () => {
		const { result } = renderHook(() => useReferenceAudioSrc("./audios/audio.mp3"))

		expect(mocks.getResource).not.toHaveBeenCalled()

		await act(async () => {
			await result.current.load()
		})

		expect(result.current.src).toBe("https://cdn.test/audio.mp3")
		expect(result.current.isLoading).toBe(false)
		expect(result.current.hasError).toBe(false)
	})

	it("keeps loading while remote access is deferred and retries after release", async () => {
		mocks.setDeferred(true)
		const { result } = renderHook(() => useReferenceAudioSrc("./audios/audio.mp3"))

		await act(async () => {
			await result.current.load()
		})

		expect(result.current.src).toBeUndefined()
		expect(result.current.isLoading).toBe(true)
		expect(result.current.hasError).toBe(false)

		mocks.setDeferred(false)
		act(() => {
			mocks.getRemoteLoadReleasedHandler()?.({ data: { key: "audio-key" } })
		})

		await waitFor(() => {
			expect(result.current.src).toBe("https://cdn.test/audio.mp3")
			expect(result.current.isLoading).toBe(false)
		})
	})
})
