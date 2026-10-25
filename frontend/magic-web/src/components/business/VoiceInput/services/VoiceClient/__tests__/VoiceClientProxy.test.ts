import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const workers = vi.hoisted(() => [] as Array<{ postMessage: ReturnType<typeof vi.fn> }>)

vi.mock("../voice-client.worker?worker", () => ({
	default: class {
		onmessage: ((event: MessageEvent) => void) | null = null
		onerror: ((event: ErrorEvent) => void) | null = null
		onmessageerror: ((event: MessageEvent) => void) | null = null
		postMessage = vi.fn()
		terminate = vi.fn()
		private listeners: Array<(event: MessageEvent) => void> = []

		constructor() {
			workers.push(this)
		}

		addEventListener(_type: string, listener: (event: MessageEvent) => void) {
			this.listeners.push(listener)
		}

		removeEventListener(_type: string, listener: (event: MessageEvent) => void) {
			this.listeners = this.listeners.filter((item) => item !== listener)
		}
	},
}))

vi.mock("@/infrastructure/logger", () => ({
	logger: {
		createLogger: () => ({
			log: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		}),
	},
}))

import { VoiceClientProxy } from "../VoiceClientProxy"

describe("VoiceClientProxy", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		workers.length = 0
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	// Fake timers keep the constructor's 5s readiness timeout from firing, so the
	// worker stays in the "created but not ready" state for the whole test.
	function createProxy() {
		return new VoiceClientProxy(async () => ({}) as never)
	}

	it("treats disconnect before the worker is ready as a no-op", async () => {
		const proxy = createProxy()

		await expect(proxy.disconnect()).resolves.toBeUndefined()
		expect(workers[0].postMessage).not.toHaveBeenCalled()

		proxy.dispose()
	})

	it("treats disconnect after dispose as a no-op", async () => {
		const proxy = createProxy()
		proxy.dispose()

		await expect(proxy.disconnect()).resolves.toBeUndefined()
	})

	it("still rejects requests that need a ready worker", async () => {
		const proxy = createProxy()

		await expect(proxy.startSending()).rejects.toThrow("Worker not ready")

		proxy.dispose()
	})
})
