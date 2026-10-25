import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Common } from "@/types/common"

const mocks = vi.hoisted(() => ({
	config: {
		getThemeConfig: vi.fn(),
		getFontScaleConfig: vi.fn(),
		getLocaleConfig: vi.fn(),
		getClusterConfig: vi.fn(),
		getClusterCacheConfig: vi.fn(),
		setThemeConfig: vi.fn(),
		setFontScaleConfig: vi.fn(),
		setLocaleConfig: vi.fn(),
		setClusterConfig: vi.fn(),
		setClusterCacheConfig: vi.fn(),
	},
	cluster: { setClusterConfig: vi.fn(), setClustersConfig: vi.fn(), getClustersConfig: vi.fn() },
	store: {
		theme: { theme: "light", setTheme: vi.fn() },
		font: { fontScale: 1, setFontScale: vi.fn() },
		i18n: { language: "en_US", waitForI18nCoreReady: vi.fn(), syncLanguage: vi.fn() },
		cluster: {
			clusterCodeCache: "",
			clusterConfig: {},
			setClusterCode: vi.fn(),
			setClusterCodeCache: vi.fn(),
			setClusterConfig: vi.fn(),
			setClustersConfig: vi.fn(),
		},
	},
}))

vi.mock("@/models/config/repositories/ConfigRepository", () => ({
	ConfigRepository: class {
		constructor() {
			return mocks.config
		}
	},
}))
vi.mock("@/models/config/repositories/ClusterRepository", () => ({
	ClusterRepository: class {
		constructor() {
			return mocks.cluster
		}
	},
}))
vi.mock("@/models/config/stores", () => ({ configStore: mocks.store }))
vi.mock("@/broadcastChannel", () => ({ BroadcastChannelSender: {} }))
vi.mock("@/utils/env", () => ({ env: () => "https://example.com" }))

import { ConfigService } from "../ConfigService"

function deferred() {
	let resolve!: () => void
	let reject!: (reason: unknown) => void
	const promise = new Promise<void>((done, fail) => {
		resolve = done
		reject = fail
	})
	return { promise, resolve, reject }
}

function createService() {
	return new ConfigService({} as ConstructorParameters<typeof ConfigService>[0])
}

const definition = { services: {} } as Common.PrivateConfig

beforeEach(() => {
	vi.resetAllMocks()
	for (const save of [
		mocks.config.setThemeConfig,
		mocks.config.setFontScaleConfig,
		mocks.config.setLocaleConfig,
		mocks.config.setClusterConfig,
		mocks.config.setClusterCacheConfig,
		mocks.cluster.setClusterConfig,
		mocks.cluster.setClustersConfig,
	])
		save.mockResolvedValue(undefined)
	mocks.config.getClusterConfig.mockResolvedValue("")
	mocks.config.getClusterCacheConfig.mockResolvedValue("")
	mocks.cluster.getClustersConfig.mockResolvedValue([])
})

afterEach(() => vi.restoreAllMocks())

describe("configuration persistence boundaries", () => {
	it("starts independent cluster writes together but waits for both by default", async () => {
		const write = deferred()
		mocks.cluster.setClusterConfig.mockReturnValue(write.promise)
		let finished = false
		const saving = createService()
			.setClusterConfig("private", definition)
			.then(() => {
				finished = true
			})
		expect(mocks.store.cluster.setClusterConfig).toHaveBeenCalledWith("private", definition)
		expect(mocks.config.setClusterCacheConfig).toHaveBeenCalledWith("private")
		await Promise.resolve()
		expect(finished).toBe(false)
		write.resolve()
		await saving
	})

	it("lets an explicit background probe continue while saving remains pending", async () => {
		const write = deferred()
		mocks.cluster.setClusterConfig.mockReturnValue(write.promise)
		await createService().setClusterConfig("private", definition, { waitForPersistence: false })
		expect(mocks.store.cluster.setClusterConfig).toHaveBeenCalledWith("private", definition)
		write.resolve()
	})

	it("handles a background persistence failure after the caller has continued", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
		const write = deferred()
		mocks.cluster.setClusterConfig.mockReturnValue(write.promise)
		await createService().setClusterConfig("private", definition, { waitForPersistence: false })
		const error = new Error("storage unavailable")
		write.reject(error)
		await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(error))
	})

	it("applies default theme and language before saving finishes, but keeps init pending", async () => {
		const write = deferred()
		mocks.config.setThemeConfig.mockReturnValue(write.promise)
		let finished = false
		const initialization = createService()
			.init({})
			.then(() => {
				finished = true
			})
		await vi.waitFor(() => expect(mocks.store.i18n.syncLanguage).toHaveBeenCalled())
		expect(mocks.store.theme.setTheme).toHaveBeenCalled()
		expect(mocks.config.setLocaleConfig).toHaveBeenCalled()
		expect(finished).toBe(false)
		write.resolve()
		await initialization
	})

	it("still waits for the default cluster write before reading the cluster list", async () => {
		const write = deferred()
		mocks.cluster.setClusterConfig.mockReturnValue(write.promise)
		const initialization = createService().initialCluster()
		await vi.waitFor(() => expect(mocks.cluster.setClusterConfig).toHaveBeenCalled())
		expect(mocks.cluster.getClustersConfig).not.toHaveBeenCalled()
		write.resolve()
		await initialization
		expect(mocks.cluster.getClustersConfig).toHaveBeenCalledOnce()
	})

	it("keeps active-cluster persistence awaited for reload boundaries", async () => {
		const write = deferred()
		mocks.config.setClusterConfig.mockReturnValue(write.promise)
		let finished = false
		const saving = createService()
			.setClusterCode("private")
			.then(() => {
				finished = true
			})
		expect(mocks.store.cluster.setClusterCode).toHaveBeenCalledWith("private")
		await Promise.resolve()
		expect(finished).toBe(false)
		write.resolve()
		await saving
	})

	it("waits for the remaining write even when another independent write fails", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {})
		const write = deferred()
		mocks.cluster.setClusterConfig.mockReturnValue(write.promise)
		mocks.config.setClusterCacheConfig.mockRejectedValue(new Error("cache write failed"))
		let finished = false
		const saving = createService()
			.setClusterConfig("private", definition)
			.then(() => {
				finished = true
			})
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(finished).toBe(false)
		write.resolve()
		await saving
	})
})
