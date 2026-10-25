// @vitest-environment node
import { gunzipSync } from "node:zlib"
import { afterEach, expect, it, vi } from "vitest"
import {
	createLoggerRuntime,
	startLoggerRuntime,
	shutdown,
	type LoggerPlugin,
	type LoggerPluginContext,
	type ManagedLoggerRuntime,
} from "../runtime"
import { createLogger, logger } from "../index"
import { createFetchPlugin } from "../plugins"
import { DeliveryQueue } from "../delivery/queue"
import { FetchTransport } from "../delivery/transport"
import type { NamespaceLogger } from "../types"

const instances: ManagedLoggerRuntime[] = []
function create(plugins: LoggerPlugin[] = [], user = "user") {
	const runtime = createLoggerRuntime({
		fetcher: vi.fn(),
		getContext: () => ({ info: { uId: user } }),
		plugins,
	})
	instances.push(runtime)
	return runtime
}
afterEach(async () => {
	await Promise.all(instances.splice(0).map((runtime) => runtime.shutdown({ timeoutMs: 0 })))
	await shutdown({ timeoutMs: 0 })
	vi.restoreAllMocks()
	vi.useRealTimers()
})

it("imports plugin factories and constructs instances without browser access or installation", () => {
	const timers = vi.spyOn(globalThis, "setInterval")
	const setup = vi.fn()
	const runtime = create([{ name: "metric", setup }])
	expect(setup).not.toHaveBeenCalled()
	expect(timers).not.toHaveBeenCalled()
	expect(runtime.getStats().state).toBe("idle")
	expect(runtime.logger.report({ data: "before" })).toBeUndefined()
	expect(runtime.start()).toBe(true)
	expect(runtime.start()).toBe(true)
	expect(setup).toHaveBeenCalledTimes(1)
})

it("routes plugin and namespace records to their own queues, contexts and dedup windows", async () => {
	const sent: string[][] = []
	vi.spyOn(FetchTransport.prototype, "send").mockImplementation(async (batch) => {
		const body = batch.encoding === "gzip" ? gunzipSync(batch.body) : batch.body
		const records = JSON.parse(new TextDecoder().decode(body))
		sent.push(records.map((record: { info: { uId: string } }) => record.info.uId))
		return { ok: true }
	})
	const plugin = (label: string): LoggerPlugin => ({
		name: "metric",
		setup({ createLogger }) {
			createLogger(label).report("initial")
		},
	})
	const a = create([plugin("a")], "a")
	const b = create([plugin("b")], "b")
	a.start()
	b.start()
	const error = { eventKey: "upload_failed", errorKind: "network", error: "bad" }
	a.logger.createLogger("same").error(error)
	a.logger.createLogger("same").error(error)
	b.logger.createLogger("same").error(error)
	expect(a.getStats().suppressed).toBe(1)
	expect(b.getStats()).not.toHaveProperty("suppressed")
	await Promise.all([a.flush(), b.flush()])
	expect(sent).toEqual(
		expect.arrayContaining([
			["a", "a"],
			["b", "b"],
		]),
	)
	await a.shutdown({ timeoutMs: 0 })
	expect(b.getStats().state).toBe("running")
	b.logger.report({ data: "continues" })
	expect(b.getStats().admitted).toBe(3)
})

it("never replaces the default facade when an isolated runtime starts or closes", async () => {
	const add = vi.spyOn(DeliveryQueue.prototype, "add").mockImplementation(() => undefined)
	startLoggerRuntime({ fetcher: vi.fn(), sessionId: "default" })
	const old = createLogger("existing")
	const isolated = create()
	isolated.start()
	isolated.logger.report({ data: "isolated" })
	await isolated.shutdown({ timeoutMs: 0 })
	old.report("default")
	logger.report({ data: "default root" })
	expect(add.mock.calls.slice(-2).map(([record]) => record.traceId)).toEqual([
		"default",
		"default",
	])
})

it("inherits child namespace context and honors explicit false without bypassing sanitization", () => {
	const add = vi.spyOn(DeliveryQueue.prototype, "add").mockImplementation(() => undefined)
	const runtime = create()
	runtime.start()
	const parent = runtime.logger.createLogger("upload", {
		context: { operation: "upload", token: "secret" },
		enableConfig: { remote: false },
	})
	parent.createLogger("hidden").report("ignored")
	expect(add).not.toHaveBeenCalled()
	const child = parent.createLogger("task", {
		context: { taskId: "task" },
		enableConfig: { remote: true },
	})
	child.error({
		eventKey: "upload_failed",
		errorKind: "network",
		context: { eventId: "forged", password: "pw" },
	})
	const record = add.mock.calls[0][0]
	expect(record.namespace).toBe("upload.task")
	expect(record.context).toMatchObject({ operation: "upload", taskId: "task" })
	expect(record.eventId).not.toBe("forged")
	expect(JSON.stringify(record)).not.toContain("secret")
	expect(JSON.stringify(record)).not.toContain('"pw"')
})

it("rolls back partial setup, blocks retained loggers and keeps independent plugins alive", () => {
	const dispose = vi.fn()
	let retained!: NamespaceLogger
	let signal!: AbortSignal
	const runtime = create([
		{
			name: "broken",
			setup(context) {
				signal = context.signal
				retained = context.createLogger("broken")
				context.onDispose(dispose)
				throw new Error("setup failure")
			},
		},
		{
			name: "healthy",
			setup({ createLogger }) {
				createLogger("healthy").report("works")
			},
		},
	])
	runtime.start()
	expect(signal.aborted).toBe(true)
	expect(dispose).toHaveBeenCalledTimes(1)
	expect(runtime.getStats()).toMatchObject({
		state: "running",
		plugin_setup_failed: 1,
		admitted: 1,
	})
	retained.report("must be ignored")
	expect(runtime.getStats().admitted).toBe(1)
})

it("aborts plugins, disposes in reverse order, accepts final summaries and ignores late work", async () => {
	const add = vi.spyOn(DeliveryQueue.prototype, "add").mockImplementation(() => undefined)
	const disposed: string[] = []
	let context!: LoggerPluginContext
	const runtime = create([
		{
			name: "metric",
			setup(ctx) {
				context = ctx
				ctx.onDispose(() => {
					disposed.push("first")
				})
				ctx.onDispose(() => {
					disposed.push("last")
					ctx.createLogger("metric").report("final")
					throw Error("cleanup")
				})
			},
		},
	])
	runtime.start()
	const closing = runtime.shutdown()
	expect(runtime.shutdown()).toBe(closing)
	await closing
	expect(disposed).toEqual(["last", "first"])
	expect(context.signal.aborted).toBe(true)
	expect(add).toHaveBeenCalledTimes(1)
	context.createLogger("metric").report("late")
	expect(add).toHaveBeenCalledTimes(1)
	const late = vi.fn()
	context.onDispose(late)
	expect(late).toHaveBeenCalledOnce()
	expect(runtime.getStats()).toMatchObject({ state: "closed", plugin_cleanup_failed: 1 })
	expect(runtime.start()).toBe(false)
})

it("rejects duplicate names and page-wide plugins before acquiring any resources", () => {
	const setup = vi.fn()
	expect(() =>
		create([
			{ name: "same", setup },
			{ name: "same", setup },
		]),
	).toThrow(/Duplicate/)
	expect(() =>
		create([
			createFetchPlugin({ shouldReadResponse: () => false, isBusinessError: () => false }),
		]),
	).toThrow(/default application/)
	expect(setup).not.toHaveBeenCalled()
})

it("shares the page keepalive budget across transports and releases it after cancellation", async () => {
	const pending = vi.fn(
		(_input: RequestInfo | URL, init?: RequestInit) =>
			new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () => reject(Error("aborted")))
			}),
	)
	const a = new FetchTransport(pending)
	const b = new FetchTransport(pending)
	const first = a.send({ body: new Uint8Array(32 * 1024) }, 1, { keepalive: true })
	expect(await b.send({ body: new Uint8Array(32 * 1024) }, 1, { keepalive: true })).toMatchObject(
		{ reason: "keepalive_budget" },
	)
	a.destroy()
	await first
	const next = b.send({ body: new Uint8Array(32 * 1024) }, 1, { keepalive: true })
	expect(pending).toHaveBeenCalledTimes(2)
	b.destroy()
	await next
})

it("rejects asynchronous setup, cancels its work and disposes resources registered late", async () => {
	const early = vi.fn()
	const late = vi.fn()
	let signal!: AbortSignal
	const runtime = create([
		{
			name: "async",
			async setup(context) {
				signal = context.signal
				context.onDispose(early)
				await Promise.resolve()
				context.onDispose(late)
				throw Error("late setup failure")
			},
		},
	])
	runtime.start()
	await Promise.resolve()
	await Promise.resolve()
	expect(signal.aborted).toBe(true)
	expect(early).toHaveBeenCalledTimes(1)
	expect(late).toHaveBeenCalledTimes(1)
	expect(runtime.getStats().plugin_setup_failed).toBe(1)
})

it("closes synchronously while reentrant cleanup shares the same shutdown promise", async () => {
	let nested: Promise<void> | undefined
	const runtime = create([
		{
			name: "reentrant",
			setup({ onDispose }) {
				onDispose(() => {
					nested = runtime.shutdown()
				})
			},
		},
	])
	runtime.start()
	const closing = runtime.shutdown({ timeoutMs: 0 })
	expect(nested).toBe(closing)
	expect(runtime.getStats().state).toBe("closed")
	runtime.logger.report({ data: "after close started" })
	expect(runtime.getStats().after_shutdown).toBe(1)
	await closing
})

it("honors namespace overrides after updating runtime defaults and isolates total disable", () => {
	const runtime = create()
	runtime.start()
	const local = runtime.logger.createLogger("explicit", { enableConfig: { remote: true } })
	runtime.configure({ remote: false })
	runtime.logger.report({ data: "disabled default" })
	expect(runtime.getStats()).not.toHaveProperty("admitted")
	local.report("explicit override")
	expect(runtime.getStats().admitted).toBe(1)
	runtime.configure({ enabled: false })
	local.report("disabled entirely")
	expect(runtime.getStats().admitted).toBe(1)
})

it("applies configuration before start and preserves mutable legacy namespace enableConfig", () => {
	const runtime = create()
	runtime.configure({ remote: false })
	runtime.start()
	runtime.logger.report({ data: "disabled default" })
	expect(runtime.getStats()).not.toHaveProperty("admitted")
	const options = { enableConfig: { remote: true } }
	const local = runtime.logger.createLogger("legacy", options)
	local.report("enabled")
	options.enableConfig = { remote: false }
	local.report("disabled")
	expect(runtime.getStats().admitted).toBe(1)
})

it("contains accidental async disposer rejection without waiting for plugin work", async () => {
	const runtime = create([
		{
			name: "asyncCleanup",
			setup({ onDispose }) {
				onDispose(async () => {
					throw Error("invalid async disposer")
				})
			},
		},
	])
	runtime.start()
	await runtime.shutdown()
	expect(runtime.getStats()).toMatchObject({ state: "closed", plugin_cleanup_failed: 1 })
})
