// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { AppLoggerService } from "../loggerService"
import { createLogger, logger } from "@/infrastructure/logger"
import { configureLogger, getLoggerStats, shutdown } from "@/infrastructure/logger/runtime"
import * as records from "@/infrastructure/logger/record"

const stores = vi.hoisted(() => ({
	userStore: {
		user: {
			userInfo: { magic_id: "user-a" },
			teamshareOrganizationCode: "team-a",
			organizationCode: "org-a",
		},
	},
	configStore: { cluster: { clusterCode: "cluster-a", cluster: { services: {} } } },
}))
vi.mock("@/models/user", () => ({ userStore: stores.userStore }))
vi.mock("@/models/config", () => ({ configStore: stores.configStore }))
const { setupPlugin } = vi.hoisted(() => ({ setupPlugin: vi.fn() }))
vi.mock("@/infrastructure/logger/plugins", () => ({
	createGlobalErrorPlugin: () => ({
		name: "globalError",
		setup: (context: { onDispose: (fn: () => void) => void }) => {
			context.onDispose(setupPlugin())
		},
	}),
	createFetchPlugin: () => ({ name: "fetch", setup: () => undefined }),
	createResourcePlugin: () => ({ name: "resource", setup: () => undefined }),
	createPageDwellPlugin: () => ({ name: "pageDwell", setup: () => undefined }),
	createDevicePlugin: () => ({ name: "device", setup: () => undefined }),
}))
vi.mock("../storage/storageQuota", () => ({
	createStorageQuotaPlugin: () => ({ name: "storageQuota", setup: () => undefined }),
}))

let service: AppLoggerService
let disposePlugin: ReturnType<typeof vi.fn>

beforeEach(() => {
	service = new AppLoggerService()
	disposePlugin = vi.fn()
	vi.mocked(setupPlugin).mockReset().mockReturnValue(disposePlugin)
	vi.stubEnv("DEV", false)
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response('{"code":1000,"accepted":1}')),
	)
	vi.spyOn(console, "warn").mockImplementation(() => undefined)
	vi.stubGlobal("CONFIG", {
		MAGIC_APP_VERSION: "test-release",
	})
	sessionStorage.clear()
	stores.userStore.user.userInfo.magic_id = "user-a"
	stores.userStore.user.organizationCode = "org-a"
	stores.configStore.cluster.clusterCode = "cluster-a"
})

afterEach(async () => {
	await service.shutdown({ timeoutMs: 0 })
	await shutdown({ timeoutMs: 0 })
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
	vi.unstubAllEnvs()
})

it.each([true, false])("reports by default without Node configuration (DEV=%s)", async (dev) => {
	vi.stubEnv("DEV", dev)
	vi.stubGlobal("CONFIG", undefined)
	vi.spyOn(console, "info").mockImplementation(() => undefined)
	expect(service.start()).toBe(true)
	logger.report({ namespace: "test", data: "without Node configuration" })
	await service.shutdown({ timeoutMs: 1000 })
	expect(fetch).toHaveBeenCalledWith("/log-report", expect.objectContaining({ method: "POST" }))
	expect(getLoggerStats().accepted).toBe(1)
})

it("constructs without starting and installs only once, including storage side effects", async () => {
	const storage = vi.spyOn(Storage.prototype, "setItem")
	expect(setupPlugin).not.toHaveBeenCalled()
	expect(storage).not.toHaveBeenCalled()
	expect(service.start()).toBe(true)
	expect(service.start()).toBe(true)
	expect(storage).toHaveBeenCalledTimes(1)
	expect(setupPlugin).toHaveBeenCalledTimes(1)
	const firstShutdown = service.shutdown({ timeoutMs: 0 })
	expect(service.shutdown()).toBe(firstShutdown)
	await firstShutdown
	expect(disposePlugin).toHaveBeenCalledTimes(1)
	expect(service.start()).toBe(false)
})

it("reads current identity for new records without changing old snapshots", () => {
	const create = vi.spyOn(records, "createRecord")
	service.start()
	logger.report({ namespace: "test", data: "before" })
	const before = create.mock.results.at(-1)?.value
	stores.userStore.user.userInfo.magic_id = "user-b"
	stores.userStore.user.organizationCode = "org-b"
	stores.configStore.cluster.clusterCode = "cluster-b"
	logger.report({ namespace: "test", data: "after" })
	const after = create.mock.results.at(-1)?.value
	expect(before.info).toMatchObject({ uId: "user-a", mOrgCode: "org-a", cluster: "cluster-a" })
	expect(after.info).toMatchObject({ uId: "user-b", mOrgCode: "org-b", cluster: "cluster-b" })
	expect(after.traceId).toBe(before.traceId)
	expect(after.release).toBe("test-release")
})

it("keeps an in-memory session when storage is unavailable", () => {
	vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
		throw new Error("storage denied")
	})
	const create = vi.spyOn(records, "createRecord")
	expect(service.start()).toBe(true)
	logger.report({ namespace: "test", data: 1 })
	const first = create.mock.results.at(-1)?.value
	logger.report({ namespace: "test", data: 2 })
	const second = create.mock.results.at(-1)?.value
	expect(first.traceId).toBeTruthy()
	expect(first.traceId).toBe(second.traceId)
})

it("keeps business logging available when identity access fails", () => {
	service.start()
	vi.spyOn(stores.userStore, "user", "get").mockImplementation(() => {
		throw new Error("identity unavailable")
	})
	const create = vi.spyOn(records, "createRecord")
	expect(() => logger.report({ namespace: "test", data: "safe" })).not.toThrow()
	const snapshot = create.mock.results.at(-1)?.value
	expect(snapshot.release).toBe("test-release")
	expect(snapshot.info).toBeUndefined()
})

it("isolates a failed plugin without disabling business logging", async () => {
	vi.mocked(setupPlugin).mockImplementationOnce(() => {
		throw new Error("collector unavailable")
	})
	expect(service.start()).toBe(true)
	expect(getLoggerStats()).toMatchObject({ state: "running", plugin_setup_failed: 1 })
	logger.report({ data: "still available" })
	expect(getLoggerStats().admitted).toBe(1)
})

it("continues cleanup when a collector disposer fails", async () => {
	disposePlugin.mockImplementation(() => {
		throw new Error("cleanup failure")
	})
	service.start()
	await expect(service.shutdown({ timeoutMs: 0 })).resolves.toBeUndefined()
	expect(getLoggerStats().state).toBe("closed")
})

it("does not let an unstarted service shut down the active service", async () => {
	service.start()
	const other = new AppLoggerService()
	expect(other.start()).toBe(false)
	await other.shutdown()
	expect(getLoggerStats().state).toBe("running")
	expect(disposePlugin).not.toHaveBeenCalled()
})

it("reassembles a closed runtime while preserving existing business logger references", async () => {
	const namespace = createLogger("retained")
	service.start()
	await service.shutdown({ timeoutMs: 0 })
	namespace.report("ignored while closed")
	expect(getLoggerStats()).toHaveProperty("after_shutdown", 1)
	service = new AppLoggerService()
	expect(service.start()).toBe(true)
	const create = vi.spyOn(records, "createRecord")
	namespace.report("new runtime")
	expect(create).toHaveBeenCalled()
	expect(getLoggerStats().state).toBe("running")
	expect(getLoggerStats()).not.toHaveProperty("after_shutdown")
	configureLogger({ enabled: false })
	create.mockClear()
	namespace.report("disabled on new runtime")
	expect(create).not.toHaveBeenCalled()
})

it("keeps a replacement runtime alive when the previous service releases its own handle", async () => {
	service.start()
	const previous = service
	await shutdown({ timeoutMs: 0 })
	service = new AppLoggerService()
	expect(service.start()).toBe(true)
	const create = vi.spyOn(records, "createRecord")
	logger.report({ namespace: "test", data: "before" })
	const currentSnapshot = create.mock.results.at(-1)?.value
	await previous.shutdown({ timeoutMs: 0 })
	expect(getLoggerStats().state).toBe("running")
	logger.report({ namespace: "test", data: "after" })
	const snapshot = create.mock.results.at(-1)?.value
	expect(snapshot.release).toBe("test-release")
	expect(snapshot.info).toEqual(currentSnapshot.info)
})
