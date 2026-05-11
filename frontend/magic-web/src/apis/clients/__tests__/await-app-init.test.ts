import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	awaitAppInitForOutgoingRequest,
	awaitAppInitPromise,
	createWaitForAppInitRequestInterceptor,
} from "../await-app-init"
import { appStore } from "@/stores/app"

vi.mock("@/stores/app", () => ({
	appStore: {
		appInitPromise: null as Promise<unknown> | null,
	},
}))

describe("awaitAppInitPromise", () => {
	beforeEach(() => {
		appStore.appInitPromise = null
	})

	it("resolves when no init promise", async () => {
		await expect(awaitAppInitPromise()).resolves.toBeUndefined()
	})

	it("awaits existing promise", async () => {
		let resolveInit!: () => void
		appStore.appInitPromise = new Promise<void>((resolve) => {
			resolveInit = resolve
		})
		let settled = false
		const p = awaitAppInitPromise().then(() => {
			settled = true
		})
		expect(settled).toBe(false)
		resolveInit()
		await p
		expect(settled).toBe(true)
	})

	it("stops waiting after timeout when init promise hangs", async () => {
		vi.useFakeTimers()
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		appStore.appInitPromise = new Promise<void>(() => undefined)
		let settled = false
		const runAwaitAppInitPromise = awaitAppInitPromise as (timeoutMs?: number) => Promise<void>
		const pending = runAwaitAppInitPromise(1000).then(() => {
			settled = true
		})

		await vi.advanceTimersByTimeAsync(1000)
		await pending

		expect(settled).toBe(true)
		expect(warnSpy).toHaveBeenCalledTimes(1)
		warnSpy.mockRestore()
		vi.useRealTimers()
	})
})

describe("awaitAppInitForOutgoingRequest", () => {
	beforeEach(() => {
		appStore.appInitPromise = null
	})

	it("waits when outside bypass", async () => {
		let resolveInit!: () => void
		appStore.appInitPromise = new Promise<void>((resolve) => {
			resolveInit = resolve
		})
		let done = false
		const p = awaitAppInitForOutgoingRequest().then(() => {
			done = true
		})
		expect(done).toBe(false)
		resolveInit()
		await p
		expect(done).toBe(true)
	})

	it("stops waiting after timeout when init promise hangs", async () => {
		vi.useFakeTimers()
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		appStore.appInitPromise = new Promise<void>(() => undefined)
		let settled = false
		const runAwaitForRequest = awaitAppInitForOutgoingRequest as (
			timeoutMs?: number,
		) => Promise<void>
		const pending = runAwaitForRequest(1000).then(() => {
			settled = true
		})

		await vi.advanceTimersByTimeAsync(1000)
		await pending

		expect(settled).toBe(true)
		expect(warnSpy).toHaveBeenCalledTimes(1)
		warnSpy.mockRestore()
		vi.useRealTimers()
	})
})

describe("createWaitForAppInitRequestInterceptor", () => {
	beforeEach(() => {
		appStore.appInitPromise = null
	})

	it("skips wait when request sets skipAppInitWait", async () => {
		let resolveInit!: () => void
		appStore.appInitPromise = new Promise<void>((resolve) => {
			resolveInit = resolve
		})

		const interceptor = createWaitForAppInitRequestInterceptor()
		const requestConfig = {
			headers: new Headers(),
			skipAppInitWait: true,
		}

		await expect(interceptor(requestConfig)).resolves.toBe(requestConfig)

		resolveInit()
		await appStore.appInitPromise
	})

	it("can rewrite config after app init resolves", async () => {
		let resolveInit!: () => void
		appStore.appInitPromise = new Promise<void>((resolve) => {
			resolveInit = resolve
		})

		const interceptor = createWaitForAppInitRequestInterceptor(function rewriteBaseURL(config) {
			config.baseURL = "https://latest.teamshare.test"
			return config
		})
		const requestConfig = {
			headers: new Headers(),
			baseURL: "https://stale.teamshare.test",
		}

		const pendingConfig = interceptor(requestConfig)
		resolveInit()

		await expect(pendingConfig).resolves.toMatchObject({
			baseURL: "https://latest.teamshare.test",
		})
	})
})
