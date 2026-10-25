import { describe, expect, it, vi } from "vitest"
import { createInspectorCaptureStore } from "../inspectorCaptureStore"
import type { CurrentTabCaptureSession } from "../screenshot"

function createSession(
	overrides: Partial<CurrentTabCaptureSession> = {},
): CurrentTabCaptureSession & {
	acquire: ReturnType<typeof vi.fn>
	release: ReturnType<typeof vi.fn>
} {
	const acquire = vi.fn().mockResolvedValue({})
	const release = vi.fn()
	return {
		acquire,
		release,
		hasLiveStream: () => false,
		...overrides,
	}
}

function createCrossOriginIframe() {
	const iframe = document.createElement("iframe")
	Object.defineProperty(iframe, "contentDocument", {
		configurable: true,
		get() {
			throw new DOMException("Blocked a frame", "SecurityError")
		},
	})
	return iframe
}

describe("createInspectorCaptureStore", () => {
	it("does not force tab capture when preparing a cross-origin iframe", async () => {
		const session = createSession()
		const store = createInspectorCaptureStore(session)

		await expect(store.prepare(createCrossOriginIframe())).resolves.toBe(true)
		expect(store.getSnapshot().authorization).toBeNull()
		expect(store.getSnapshot().isBusy).toBe(false)
		expect(session.acquire).not.toHaveBeenCalled()
	})

	it("reuses an in-flight prepare instead of starting another", async () => {
		const session = createSession()
		const store = createInspectorCaptureStore(session)
		const iframe = createCrossOriginIframe()

		const first = store.prepare(iframe)
		const second = store.prepare(iframe)
		await expect(Promise.all([first, second])).resolves.toEqual([true, true])
		expect(session.acquire).not.toHaveBeenCalled()
	})

	it("does not idle-release while authorization is open", async () => {
		const session = createSession()
		const store = createInspectorCaptureStore(session)
		const authorized = store.requestAuthorization(
			{
				reason: "iframe-runtime-unavailable",
				selection: { left: 0, top: 0, width: 1, height: 1 },
				outputSize: { width: 1, height: 1 },
			},
			async () => "captured",
		)

		store.releaseIfIdle(false)
		expect(session.release).not.toHaveBeenCalled()
		expect(store.getSnapshot().isBusy).toBe(true)

		store.resolveAuthorization(false)
		await expect(authorized).resolves.toBeNull()
		store.releaseIfIdle(false)
		expect(session.release).toHaveBeenCalledOnce()
	})

	it("returns null when the user cancels authorization", async () => {
		const session = createSession()
		const store = createInspectorCaptureStore(session)
		const authorized = store.requestAuthorization(
			{
				reason: "iframe-runtime-unavailable",
				selection: { left: 0, top: 0, width: 1, height: 1 },
				outputSize: { width: 1, height: 1 },
			},
			async () => {
				await session.acquire()
				return "captured"
			},
		)

		store.resolveAuthorization(false)
		await expect(authorized).resolves.toBeNull()
		expect(session.acquire).not.toHaveBeenCalled()
	})

	it("skips work when a live stream already exists", async () => {
		const session = createSession({ hasLiveStream: () => true })
		const store = createInspectorCaptureStore(session)

		await expect(store.prepare(createCrossOriginIframe())).resolves.toBe(true)
		expect(store.getSnapshot().isBusy).toBe(false)
		expect(session.acquire).not.toHaveBeenCalled()
	})
})
