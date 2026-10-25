import { describe, expect, it, vi } from "vitest"
import { CanvasResourceScheduler } from "../scheduler/CanvasResourceScheduler"

interface Deferred<T> {
	promise: Promise<T>
	resolve: (value: T) => void
	reject: (error: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void
	let reject!: (error: unknown) => void
	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})
	return { promise, resolve, reject }
}

async function flushMicrotasks(): Promise<void> {
	await Promise.resolve()
	await Promise.resolve()
}

describe("CanvasResourceScheduler", () => {
	it("limits concurrent tasks by resource kind", async () => {
		const scheduler = new CanvasResourceScheduler()
		const started: number[] = []
		const deferreds = [
			createDeferred<number>(),
			createDeferred<number>(),
			createDeferred<number>(),
		]

		const promises = deferreds.map((deferred, index) =>
			scheduler.run(
				"video:preview",
				() => {
					started.push(index)
					return deferred.promise
				},
				{ source: "test", priority: "visible" },
			),
		)

		expect(started).toEqual([0, 1])
		expect(scheduler.getSnapshot()).toEqual(
			expect.objectContaining({
				activeTotal: 2,
				queuedTotal: 1,
			}),
		)

		deferreds[0].resolve(0)
		await promises[0]
		await flushMicrotasks()

		expect(started).toEqual([0, 1, 2])
		expect(scheduler.getSnapshot()).toEqual(
			expect.objectContaining({
				activeTotal: 2,
				queuedTotal: 0,
			}),
		)

		deferreds[1].resolve(1)
		deferreds[2].resolve(2)
		await expect(Promise.all(promises)).resolves.toEqual([0, 1, 2])
	})

	it("caps persistent low cache work independently from preview decoding", async () => {
		const scheduler = new CanvasResourceScheduler()
		const started: string[] = []
		const restoreA = createDeferred<string>()
		const restoreB = createDeferred<string>()
		const restoreC = createDeferred<string>()
		const writeA = createDeferred<string>()
		const writeB = createDeferred<string>()

		const promises = [
			scheduler.run(
				"image:persistent-low-restore",
				() => {
					started.push("restore-a")
					return restoreA.promise
				},
				{ source: "test", priority: "visible" },
			),
			scheduler.run(
				"image:persistent-low-restore",
				() => {
					started.push("restore-b")
					return restoreB.promise
				},
				{ source: "test", priority: "visible" },
			),
			scheduler.run(
				"image:persistent-low-restore",
				() => {
					started.push("restore-c")
					return restoreC.promise
				},
				{ source: "test", priority: "visible" },
			),
			scheduler.run(
				"image:persistent-low-write",
				() => {
					started.push("write-a")
					return writeA.promise
				},
				{ source: "test", priority: "background" },
			),
			scheduler.run(
				"image:persistent-low-write",
				() => {
					started.push("write-b")
					return writeB.promise
				},
				{ source: "test", priority: "background" },
			),
		]

		expect(started).toEqual(["restore-a", "restore-b", "write-a"])
		restoreA.resolve("restore-a")
		await promises[0]
		await flushMicrotasks()
		expect(started).toContain("restore-c")

		restoreB.resolve("restore-b")
		restoreC.resolve("restore-c")
		writeA.resolve("write-a")
		await promises[1]
		await promises[2]
		await promises[3]
		await flushMicrotasks()
		expect(started).toContain("write-b")
		writeB.resolve("write-b")
		await expect(Promise.all(promises)).resolves.toEqual([
			"restore-a",
			"restore-b",
			"restore-c",
			"write-a",
			"write-b",
		])
	})

	it("starts higher priority queued tasks first", async () => {
		const scheduler = new CanvasResourceScheduler()
		const started: string[] = []
		const activeA = createDeferred<string>()
		const activeB = createDeferred<string>()
		const queuedBackground = createDeferred<string>()
		const queuedCritical = createDeferred<string>()

		const promises = [
			scheduler.run(
				"video:preview",
				() => {
					started.push("active-a")
					return activeA.promise
				},
				{ source: "test", priority: "background" },
			),
			scheduler.run(
				"video:preview",
				() => {
					started.push("active-b")
					return activeB.promise
				},
				{ source: "test", priority: "background" },
			),
			scheduler.run(
				"video:preview",
				() => {
					started.push("queued-background")
					return queuedBackground.promise
				},
				{ source: "test", priority: "background" },
			),
			scheduler.run(
				"video:preview",
				() => {
					started.push("queued-critical")
					return queuedCritical.promise
				},
				{ source: "test", priority: "critical" },
			),
		]

		expect(started).toEqual(["active-a", "active-b"])

		activeA.resolve("active-a")
		await promises[0]
		await flushMicrotasks()

		expect(started).toEqual(["active-a", "active-b", "queued-critical"])

		queuedCritical.resolve("queued-critical")
		await promises[3]
		await flushMicrotasks()

		expect(started).toEqual(["active-a", "active-b", "queued-critical", "queued-background"])

		activeB.resolve("active-b")
		queuedBackground.resolve("queued-background")
		await expect(Promise.all(promises)).resolves.toEqual([
			"active-a",
			"active-b",
			"queued-background",
			"queued-critical",
		])
	})

	it("isolates viewport audio preloads from explicit playback acquires", async () => {
		const scheduler = new CanvasResourceScheduler()
		const preloadA = createDeferred<string>()
		const preloadB = createDeferred<string>()
		const preloadC = createDeferred<string>()
		const playback = createDeferred<string>()
		const started: string[] = []

		const promises = [
			scheduler.run(
				"audio:preload",
				() => {
					started.push("preload-a")
					return preloadA.promise
				},
				{ source: "test", priority: "visible" },
			),
			scheduler.run(
				"audio:preload",
				() => {
					started.push("preload-b")
					return preloadB.promise
				},
				{ source: "test", priority: "visible" },
			),
			scheduler.run(
				"audio:preload",
				() => {
					started.push("preload-c")
					return preloadC.promise
				},
				{ source: "test", priority: "visible" },
			),
			scheduler.run(
				"audio:playback-acquire",
				() => {
					started.push("playback")
					return playback.promise
				},
				{ source: "test", priority: "critical" },
			),
		]

		expect(started).toEqual(["preload-a", "preload-b", "playback"])
		expect(scheduler.getSnapshot().queuedByKind["audio:preload"]).toBe(1)

		preloadA.resolve("preload-a")
		await promises[0]
		await flushMicrotasks()
		expect(started).toContain("preload-c")

		preloadB.resolve("preload-b")
		preloadC.resolve("preload-c")
		playback.resolve("playback")
		await expect(Promise.all(promises)).resolves.toEqual([
			"preload-a",
			"preload-b",
			"preload-c",
			"playback",
		])
	})

	it("runs only one audio waveform decode at a time", async () => {
		const scheduler = new CanvasResourceScheduler()
		const first = createDeferred<string>()
		const second = createDeferred<string>()
		const started: string[] = []
		const promises = [
			scheduler.run(
				"audio:waveform-decode",
				() => {
					started.push("first")
					return first.promise
				},
				{ source: "test", priority: "visible" },
			),
			scheduler.run(
				"audio:waveform-decode",
				() => {
					started.push("second")
					return second.promise
				},
				{ source: "test", priority: "visible" },
			),
		]

		expect(started).toEqual(["first"])
		expect(scheduler.getSnapshot().queuedByKind["audio:waveform-decode"]).toBe(1)
		first.resolve("first")
		await promises[0]
		await flushMicrotasks()
		expect(started).toEqual(["first", "second"])
		second.resolve("second")
		await expect(Promise.all(promises)).resolves.toEqual(["first", "second"])
	})

	it("rejects queued tasks when destroyed", async () => {
		const scheduler = new CanvasResourceScheduler()
		const activeA = createDeferred<string>()
		const activeB = createDeferred<string>()
		const queued = createDeferred<string>()

		const activePromises = [
			scheduler.run("video:preview", () => activeA.promise, {
				source: "test",
				priority: "visible",
			}),
			scheduler.run("video:preview", () => activeB.promise, {
				source: "test",
				priority: "visible",
			}),
		]
		const queuedPromise = scheduler.run("video:preview", () => queued.promise, {
			source: "test",
			priority: "visible",
		})

		scheduler.destroy()

		await expect(queuedPromise).rejects.toThrow("CanvasResourceScheduler destroyed")
		expect(scheduler.getSnapshot()).toEqual(
			expect.objectContaining({
				destroyed: true,
				rejectedOnDestroyCount: 1,
			}),
		)

		activeA.resolve("active-a")
		activeB.resolve("active-b")
		await expect(Promise.all(activePromises)).resolves.toEqual(["active-a", "active-b"])
	})

	it("tracks completed and failed task counts", async () => {
		const scheduler = new CanvasResourceScheduler()

		await expect(
			scheduler.run("image:decode", async () => "ok", {
				source: "test",
				priority: "visible",
			}),
		).resolves.toBe("ok")
		await expect(
			scheduler.run(
				"image:decode",
				async () => {
					throw new Error("async failed")
				},
				{
					source: "test",
					priority: "visible",
				},
			),
		).rejects.toThrow("async failed")
		await expect(
			scheduler.run(
				"image:decode",
				() => {
					throw new Error("sync failed")
				},
				{
					source: "test",
					priority: "visible",
				},
			),
		).rejects.toThrow("sync failed")

		expect(scheduler.getSnapshot()).toEqual(
			expect.objectContaining({
				activeTotal: 0,
				startedCount: 3,
				completedCount: 1,
				failedCount: 2,
			}),
		)
	})

	it("removes an externally aborted queued task before it starts", async () => {
		const scheduler = new CanvasResourceScheduler()
		const activeA = createDeferred<string>()
		const activeB = createDeferred<string>()
		const controller = new AbortController()
		const queuedTask = vi.fn(async () => "queued")

		const activePromises = [
			scheduler.run("video:preview", () => activeA.promise, {
				source: "test",
				priority: "visible",
			}),
			scheduler.run("video:preview", () => activeB.promise, {
				source: "test",
				priority: "visible",
			}),
		]
		const queuedPromise = scheduler.run("video:preview", queuedTask, {
			source: "test",
			priority: "visible",
			signal: controller.signal,
		})

		controller.abort()

		await expect(queuedPromise).rejects.toMatchObject({ name: "AbortError" })
		expect(queuedTask).not.toHaveBeenCalled()
		expect(scheduler.getSnapshot()).toEqual(
			expect.objectContaining({ activeTotal: 2, queuedTotal: 0 }),
		)

		activeA.resolve("active-a")
		activeB.resolve("active-b")
		await expect(Promise.all(activePromises)).resolves.toEqual(["active-a", "active-b"])
	})

	it("forwards cancellation to an active task signal", async () => {
		const scheduler = new CanvasResourceScheduler()
		const controller = new AbortController()
		let taskSignal: AbortSignal | undefined

		const task = scheduler.run(
			"image:decode",
			(signal) => {
				taskSignal = signal
				return new Promise<string>((resolve) => {
					signal.addEventListener("abort", () => resolve("cancelled"), { once: true })
				})
			},
			{ source: "test", priority: "visible", signal: controller.signal },
		)

		expect(taskSignal?.aborted).toBe(false)
		controller.abort()
		await expect(task).resolves.toBe("cancelled")
		expect(taskSignal?.aborted).toBe(true)
	})
})
