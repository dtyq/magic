import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { VoiceToTextService } from ".."

const mocks = vi.hoisted(() => ({
	startAudio: vi.fn(),
	stopAudio: vi.fn(),
	disposeAudio: vi.fn(),
	connect: vi.fn(),
	disconnect: vi.fn(),
	startSending: vi.fn(),
}))

vi.mock("@/components/business/VoiceInput/services/AudioProcessor", () => ({
	AudioProcessor: class {
		isRecording = false
		start = mocks.startAudio
		stop = mocks.stopAudio
		dispose = mocks.disposeAudio
		on = () => vi.fn()
	},
}))

vi.mock("@/components/business/VoiceInput/services/VoiceClient/VoiceClientProxy", () => ({
	VoiceClientProxy: class {
		workerReady = true
		private idleTimer?: ReturnType<typeof setTimeout>
		private listeners = new Map<string, Array<(...args: unknown[]) => void>>()
		on(event: string, callback: (...args: unknown[]) => void) {
			this.listeners.set(event, [...(this.listeners.get(event) ?? []), callback])
		}
		private emit(event: string, ...args: unknown[]) {
			this.listeners.get(event)?.forEach((callback) => callback(...args))
		}
		async connect() {
			mocks.connect()
			this.emit("open")
			this.emit("status", undefined, "connected")
			// A connected ASR session with no microphone data eventually times out.
			this.idleTimer = setTimeout(() => this.emit("error", "No audio received"), 5000)
		}
		disconnect() {
			mocks.disconnect()
			clearTimeout(this.idleTimer)
			this.emit("close")
			this.emit("status", undefined, "stop")
		}
		startSending = mocks.startSending
	},
}))

vi.mock("@/models/user", () => ({ userStore: { user: { userInfo: {} } } }))
vi.mock("@/utils/env", () => ({ env: () => "test" }))
vi.mock("@/apis", () => ({ ChatApi: {} }))
vi.mock("../PersistenceManager", () => ({ createPersistenceStorage: vi.fn() }))
vi.mock("@/infrastructure/logger", () => ({
	logger: {
		createLogger: () => ({ log: vi.fn(), warn: vi.fn(), error: vi.fn(), report: vi.fn() }),
	},
}))

describe("VoiceToTextService microphone startup", () => {
	let service: VoiceToTextService
	let onStatusChange: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		vi.useFakeTimers()
		vi.clearAllMocks()
		mocks.startAudio.mockReset().mockResolvedValue(undefined)
		mocks.startSending.mockResolvedValue(undefined)
		onStatusChange = vi.fn()
		service = new VoiceToTextService({ persistence: { enabled: false }, onStatusChange })
		await service.initialize({ persistence: { enabled: false }, onStatusChange })
	})

	afterEach(() => {
		service.disconnect()
		vi.useRealTimers()
	})

	it.each(["NotAllowedError", "NotFoundError"])(
		"stays idle without reconnection after %s",
		async (name) => {
			const error = new DOMException("Microphone unavailable", name)
			mocks.startAudio.mockRejectedValueOnce(error)

			await expect(service.startRecording()).rejects.toBe(error)
			expect(service.getStatus()).toBe("idle")
			expect(service.getIsConnected()).toBe(false)
			expect(service.getIsRecording()).toBe(false)
			expect(service.getCurrentRecordingId()).toBeNull()
			expect(service.getPageLifecycleInfo().shouldResumeAfterWake).toBe(false)
			expect(mocks.disposeAudio).toHaveBeenCalled()
			expect(mocks.startSending).not.toHaveBeenCalled()

			onStatusChange.mockClear()
			const connectionCount = mocks.connect.mock.calls.length
			await vi.advanceTimersByTimeAsync(30000)
			expect(mocks.connect).toHaveBeenCalledTimes(connectionCount)
			expect(onStatusChange).not.toHaveBeenCalled()
			expect(service.getRetryInfo().isRetrying).toBe(false)
		},
	)

	it("reports recording only after the microphone has started", async () => {
		let allowMicrophone!: () => void
		mocks.startAudio.mockImplementationOnce(
			() => new Promise<void>((resolve) => (allowMicrophone = resolve)),
		)
		const startup = service.startRecording()
		await vi.waitFor(() => expect(mocks.startAudio).toHaveBeenCalled())
		expect(onStatusChange).not.toHaveBeenCalledWith("recording")
		expect(service.getIsRecording()).toBe(false)

		allowMicrophone()
		await startup
		expect(service.getStatus()).toBe("recording")
		expect(service.getIsRecording()).toBe(true)
		expect(mocks.startSending).toHaveBeenCalledOnce()
	})

	it("can record after the user grants permission and tries again", async () => {
		mocks.startAudio.mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"))
		await expect(service.startRecording()).rejects.toThrow("Denied")
		await service.startRecording()

		expect(mocks.connect).toHaveBeenCalledTimes(2)
		expect(service.getStatus()).toBe("recording")
		expect(service.getIsRecording()).toBe(true)
		expect(mocks.startSending).toHaveBeenCalledOnce()
	})

	it("cancels an already scheduled connection retry when permission is denied", async () => {
		mocks.connect.mockImplementationOnce(() => {
			throw new Error("Connection failed")
		})
		mocks.startAudio.mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"))
		await expect(service.startRecording()).rejects.toThrow("Denied")

		onStatusChange.mockClear()
		await vi.advanceTimersByTimeAsync(30000)
		expect(mocks.connect).toHaveBeenCalledOnce()
		expect(onStatusChange).not.toHaveBeenCalled()
		expect(service.getStatus()).toBe("idle")
		expect(service.getRetryInfo().isRetrying).toBe(false)
	})
})
