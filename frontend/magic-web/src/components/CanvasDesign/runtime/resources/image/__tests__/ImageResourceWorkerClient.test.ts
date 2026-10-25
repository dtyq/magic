import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ImageResourceWorkerClient } from "../ImageResourceWorkerClient"

class FakeWorker {
	public onmessage: ((event: MessageEvent) => void) | null = null
	public onerror: ((event: ErrorEvent) => void) | null = null
	public readonly messages: Array<{ requestId: string }> = []
	public failRequestId: string | null = null

	public postMessage(message: { requestId: string }): void {
		if (message.requestId === this.failRequestId) {
			throw new Error(`Failed to post ${message.requestId}`)
		}
		this.messages.push(message)
	}

	public terminate(): void {
		this.onmessage = null
		this.onerror = null
	}

	public respond(requestId: string): void {
		this.onmessage?.(
			new MessageEvent("message", {
				data: { requestId, imageInfo: { naturalWidth: 1, naturalHeight: 1 } },
			}),
		)
	}
}

// The test injects its own worker factory; this only prevents the Vite worker asset import from
// being evaluated by Vitest.
vi.mock("../imageResource.worker?worker", () => ({ default: class {} }))

const OWNER = {
	ownerId: "owner",
	canvasId: "canvas",
	managerInstanceId: 1,
}

function createRequest(requestId: string) {
	return { type: "decode" as const, requestId }
}

function deferredRequest(
	lease: ReturnType<ImageResourceWorkerClient["acquire"]>,
	requestId: string,
	options?: Parameters<typeof lease.send>[1],
) {
	return lease.send(createRequest(requestId), options)
}

describe("ImageResourceWorkerClient", () => {
	let client: ImageResourceWorkerClient
	let worker!: FakeWorker

	beforeEach(() => {
		client = new ImageResourceWorkerClient(() => {
			worker = new FakeWorker()
			return worker as unknown as Worker
		})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("runs visible work before queued background work", async () => {
		const lease = client.acquire(OWNER)
		const requests = ["visible-1", "visible-2", "visible-3", "visible-4"].map((requestId) =>
			deferredRequest(lease, requestId, { priority: "visible", pixelCost: 1 }),
		)
		const background = deferredRequest(lease, "background", {
			priority: "background",
			pixelCost: 1,
		})
		const critical = deferredRequest(lease, "critical", {
			priority: "critical",
			pixelCost: 1,
		})

		expect(worker.messages.map((message) => message.requestId)).toEqual([
			"visible-1",
			"visible-2",
			"visible-3",
			"visible-4",
		])

		worker.respond("visible-1")
		expect(worker.messages.at(-1)?.requestId).toBe("critical")

		worker.respond("critical")
		expect(worker.messages.at(-1)?.requestId).toBe("background")
		worker.respond("background")
		for (const requestId of ["visible-2", "visible-3", "visible-4"]) worker.respond(requestId)

		await Promise.all([...requests, background, critical])
		lease.release()
	})

	it("keeps decode pixel cost under the page-level budget", async () => {
		const lease = client.acquire(OWNER)
		const first = deferredRequest(lease, "large-1", {
			priority: "visible",
			pixelCost: 12 * 1024 * 1024,
		})
		const second = deferredRequest(lease, "large-2", {
			priority: "visible",
			pixelCost: 8 * 1024 * 1024,
		})

		expect(worker.messages.map((message) => message.requestId)).toEqual(["large-1"])
		expect(lease.getSnapshot()).toMatchObject({ queuedRequestCount: 1 })

		worker.respond("large-1")
		expect(worker.messages.map((message) => message.requestId)).toEqual(["large-1", "large-2"])
		worker.respond("large-2")

		await Promise.all([first, second])
		lease.release()
	})

	it("does not let background work bypass a blocked visible request", async () => {
		const lease = client.acquire(OWNER)
		const active = deferredRequest(lease, "active", {
			priority: "visible",
			pixelCost: 12 * 1024 * 1024,
		})
		const visible = deferredRequest(lease, "visible", {
			priority: "visible",
			pixelCost: 8 * 1024 * 1024,
		})
		const background = deferredRequest(lease, "background", {
			priority: "background",
			pixelCost: 1,
		})

		expect(worker.messages.map((message) => message.requestId)).toEqual(["active"])
		expect(lease.getSnapshot()).toMatchObject({ queuedRequestCount: 2 })
		worker.respond("active")
		expect(worker.messages.map((message) => message.requestId).slice(0, 2)).toEqual([
			"active",
			"visible",
		])
		worker.respond("visible")
		worker.respond("background")
		await Promise.all([active, visible, background])
		lease.release()
	})

	it("runs a smaller request in the same priority band when the head does not fit", async () => {
		const lease = client.acquire(OWNER)
		const active = deferredRequest(lease, "active-1", {
			priority: "visible",
			pixelCost: 8 * 1024 * 1024,
		})
		const active2 = deferredRequest(lease, "active-2", {
			priority: "visible",
			pixelCost: 8 * 1024 * 1024,
		})
		const large = deferredRequest(lease, "large", {
			priority: "visible",
			pixelCost: 10 * 1024 * 1024,
		})
		const small = deferredRequest(lease, "small", {
			priority: "visible",
			pixelCost: 4 * 1024 * 1024,
		})

		worker.respond("active-1")
		expect(worker.messages.at(-1)?.requestId).toBe("small")
		worker.respond("small")
		worker.respond("active-2")
		expect(worker.messages.at(-1)?.requestId).toBe("large")
		worker.respond("large")

		await Promise.all([active, active2, large, small])
		lease.release()
	})

	it("continues pumping queued work after postMessage fails", async () => {
		const lease = client.acquire(OWNER)
		const active = ["active-1", "active-2", "active-3", "active-4"].map((requestId) =>
			deferredRequest(lease, requestId, { priority: "visible", pixelCost: 1 }),
		)
		worker.failRequestId = "failed"
		const failed = deferredRequest(lease, "failed", { priority: "visible", pixelCost: 1 })
		const queued = deferredRequest(lease, "queued", { priority: "visible", pixelCost: 1 })

		worker.respond("active-1")
		await expect(failed).rejects.toThrow("Failed to post failed")
		expect(worker.messages.at(-1)?.requestId).toBe("queued")
		worker.respond("queued")
		for (const requestId of ["active-2", "active-3", "active-4"]) worker.respond(requestId)

		await Promise.all([...active, queued])
		lease.release()
	})

	it("cancels a queued request without touching active work", async () => {
		const lease = client.acquire(OWNER)
		const active = ["active-1", "active-2", "active-3", "active-4"].map((requestId) =>
			deferredRequest(lease, requestId, { priority: "visible", pixelCost: 1 }),
		)
		const controller = new AbortController()
		const queued = deferredRequest(lease, "queued", {
			priority: "background",
			pixelCost: 1,
			signal: controller.signal,
		})

		expect(lease.getSnapshot()).toMatchObject({ queuedRequestCount: 1 })
		controller.abort()
		await expect(queued).rejects.toMatchObject({ name: "AbortError" })
		expect(lease.getSnapshot()).toMatchObject({ activeRequestCount: 4, queuedRequestCount: 0 })

		for (const requestId of ["active-1", "active-2", "active-3", "active-4"])
			worker.respond(requestId)
		await Promise.all(active)
		lease.release()
	})
})
