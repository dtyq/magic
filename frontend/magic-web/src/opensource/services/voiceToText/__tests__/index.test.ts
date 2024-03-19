import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/opensource/components/business/VoiceInput/services/AudioProcessor", () => {
	class MockAudioProcessor {
		private callback: ((data: ArrayBuffer) => void) | null = null
		start = vi.fn(async () => {})
		stop = vi.fn(() => {})
		onData(cb: (data: ArrayBuffer) => void) {
			this.callback = cb
		}
		emit(data: ArrayBuffer) {
			if (this.callback) this.callback(data)
		}
	}
	let lastInstance: MockAudioProcessor | null = null
	const AudioProcessor = vi.fn().mockImplementation(() => {
		lastInstance = new MockAudioProcessor()
		return lastInstance
	})
	return { AudioProcessor, __AudioProcessor: { getLast: () => lastInstance } }
})

vi.mock("@/opensource/components/business/VoiceInput/services/VoiceClient", () => {
	type Listener = (...args: any[]) => void
	class MockVoiceClientImpl {
		public listeners = new Map<string, Listener[]>()
		constructor(
			public config: any,
			public refreshToken: () => Promise<any>,
		) {}
		connect = vi.fn(async () => {})
		disconnect = vi.fn(() => {})
		sendAudio = vi.fn((_: ArrayBuffer) => {})
		sendEndSignal = vi.fn(() => {})
		on(event: string, cb: Listener) {
			const list = this.listeners.get(event) || []
			list.push(cb)
			this.listeners.set(event, list)
		}
		emit(event: string, ...args: any[]) {
			const list = this.listeners.get(event) || []
			list.forEach((l) => l(...args))
		}
	}
	let lastInstance: MockVoiceClientImpl | null = null
	const VoiceClient = vi
		.fn()
		.mockImplementation((config: any, refreshToken: () => Promise<any>) => {
			lastInstance = new MockVoiceClientImpl(config, refreshToken)
			return lastInstance
		})
	return { VoiceClient, __VoiceClient: { getLast: () => lastInstance } }
})

vi.mock("@/apis", () => {
	return {
		ChatApi: {
			getVoiceInputToken: vi.fn(async (_?: any) => ({
				token: "mock-token",
				app_id: "app-1",
				user: { organization_code: "org-1" },
			})),
		},
	}
})

import { VoiceToTextService } from "@/opensource/services/voiceToText"
import * as AudioModule from "@/opensource/components/business/VoiceInput/services/AudioProcessor"
import * as VoiceModule from "@/opensource/components/business/VoiceInput/services/VoiceClient"
import { ChatApi } from "@/opensource/apis"

const getLastAudioProcessor = () => (AudioModule as any).__AudioProcessor.getLast()
const getLastVoiceClient = () => (VoiceModule as any).__VoiceClient.getLast()

function makeArrayBuffer(length: number) {
	const buf = new ArrayBuffer(length)
	return buf
}

describe("VoiceToTextService", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("initializes clients and fetches token", async () => {
		const onStatusChange = vi.fn()
		const service = new VoiceToTextService()
		await service.initialize({ onStatusChange })

		expect(ChatApi.getVoiceInputToken).toHaveBeenCalledTimes(1)
		const vc = getLastVoiceClient()
		expect(vc).toBeTruthy()
		expect(typeof vc?.connect).toBe("function")
	})

	it("starts recording, buffers when disconnected, then flushes on open", async () => {
		const onAudioChunk = vi.fn()
		const onResult = vi.fn()
		const onStatusChange = vi.fn()
		const service = new VoiceToTextService()
		await service.initialize({ onAudioChunk, onResult, onStatusChange })

		// Start while not connected
		await service.startRecording()
		expect(service.getStatus()).toBe("recording")

		const ap = getLastAudioProcessor()
		const vc = getLastVoiceClient()
		expect(ap).toBeTruthy()
		expect(vc).toBeTruthy()

		// Emit 3 chunks while disconnected
		ap!.emit(makeArrayBuffer(4))
		ap!.emit(makeArrayBuffer(8))
		ap!.emit(makeArrayBuffer(16))

		// sendAudio should not be called before open
		expect(vc!.sendAudio).not.toHaveBeenCalled()
		expect(onAudioChunk).toHaveBeenCalledTimes(3)

		// Connect opens, buffer should flush
		vc!.emit("open")
		expect(vc!.sendAudio).toHaveBeenCalledTimes(3)
	})

	it("increments chunkIndex and keeps stable recordingId in callbacks", async () => {
		const onAudioChunk = vi.fn()
		const onResult = vi.fn()
		const service = new VoiceToTextService()
		await service.initialize({ onAudioChunk, onResult })

		await service.startRecording()
		const ap = getLastAudioProcessor()
		const vc = getLastVoiceClient()

		vc!.emit("open")
		ap!.emit(makeArrayBuffer(2))
		ap!.emit(makeArrayBuffer(2))
		ap!.emit(makeArrayBuffer(2))

		const id = service.getCurrentRecordingId()
		expect(id).toBeTruthy()
		expect(onAudioChunk.mock.calls[0][0].recordingId).toBe(id)
		expect(onAudioChunk.mock.calls[1][0].chunkIndex).toBe(1)
		expect(onAudioChunk.mock.calls[2][0].chunkIndex).toBe(2)

		// simulate ASR result
		vc!.emit("result", { text: "hello" })
		expect(onResult).toHaveBeenCalledWith({ text: "hello", recordingId: id })
	})

	it("handles stopRecording and transitions to idle after processing", async () => {
		vi.useFakeTimers()
		const service = new VoiceToTextService()
		await service.initialize()

		await service.startRecording()
		const vc = getLastVoiceClient()
		vc!.emit("open")

		await service.stopRecording()
		expect(service.getStatus()).toBe("processing")

		// After 1s, goes idle and clears id
		vi.advanceTimersByTime(1000)
		expect(service.getStatus()).toBe("idle")
		expect(service.getCurrentRecordingId()).toBeNull()
		vi.useRealTimers()
	})

	it("handles VoiceClient error by resetting recording id and status", async () => {
		const onError = vi.fn()
		const service = new VoiceToTextService()
		await service.initialize({ onError })

		await service.startRecording()
		const vc = getLastVoiceClient()
		vc!.emit("error", "boom")

		expect(service.getStatus()).toBe("error")
		expect(service.getCurrentRecordingId()).toBeNull()
		expect(onError).toHaveBeenCalled()
	})

	it("updates status based on VoiceClient status events", async () => {
		const onStatusChange = vi.fn()
		const service = new VoiceToTextService()
		await service.initialize({ onStatusChange })
		const vc = getLastVoiceClient()

		vc!.emit("status", undefined, "connecting")
		expect(service.getStatus()).toBe("connecting")

		vc!.emit("status", undefined, "connected")
		expect(service.getStatus()).toBe("idle")

		vc!.emit("status", undefined, "error")
		expect(service.getStatus()).toBe("error")
	})

	it("disconnect resets state and stops audio", async () => {
		const service = new VoiceToTextService()
		await service.initialize()
		await service.startRecording()
		const vc = getLastVoiceClient()
		const ap = getLastAudioProcessor()
		vc!.emit("open")

		service.disconnect()
		expect(service.getIsConnected()).toBe(false)
		expect(service.getIsRecording()).toBe(false)
		expect(service.getStatus()).toBe("idle")
		expect(ap!.stop).toHaveBeenCalled()
		expect(vc!.disconnect).toHaveBeenCalled()
	})
})
