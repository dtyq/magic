import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { loggerError } = vi.hoisted(() => ({ loggerError: vi.fn() }))

vi.mock("@/models/repository/logger", () => ({
	logger: { error: loggerError, warn: vi.fn(), log: vi.fn(), info: vi.fn() },
}))

vi.mock("@/models/repository/Cache", () => ({
	Storage: { get: vi.fn(() => ({})), set: vi.fn(), getAll: vi.fn(() => []) },
}))

import { Storage } from "@/models/repository/Cache"
import { ConfigRepository } from "../ConfigRepository"
import { ClusterRepository } from "../ClusterRepository"

/** Collect rejections that escape every handler while a test runs. */
function trackUnhandledRejections() {
	const reasons: unknown[] = []
	const onRejection = (reason: unknown) => reasons.push(reason)
	process.on("unhandledRejection", onRejection)
	return {
		reasons,
		dispose: () => process.off("unhandledRejection", onRejection),
	}
}

/** Let pending microtasks and the unhandled-rejection check run. */
const flushRejections = () => new Promise((resolve) => setTimeout(resolve, 0))

const putError = () => new Error("Repository operation 'put' failed: Transaction aborted")

describe("immediate configuration caches", () => {
	it.each([
		["theme", (repo: ConfigRepository) => repo.setThemeConfig("dark"), "dark"],
		["i18n", (repo: ConfigRepository) => repo.setLocaleConfig("en_US"), "en_US"],
		["cluster", (repo: ConfigRepository) => repo.setClusterConfig("private"), "private"],
		[
			"clusterCodeCache",
			(repo: ConfigRepository) => repo.setClusterCacheConfig("private"),
			"private",
		],
		["fontScale", (repo: ConfigRepository) => repo.setFontScaleConfig(1.2), "1.2"],
	] as const)("updates %s before a slow database read", (key, save, value) => {
		vi.clearAllMocks()
		const repo = new ConfigRepository()
		vi.spyOn(repo, "get").mockImplementation(() => new Promise(() => {}))
		void save(repo)
		expect(Storage.set).toHaveBeenCalledWith(`config:${key}`, { key, value })
	})

	it("caches a cluster definition before its database write finishes", async () => {
		vi.clearAllMocks()
		const repo = new ClusterRepository()
		let finish!: () => void
		vi.spyOn(repo, "put").mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve
				}),
		)
		const config = { deployCode: "private" } as Parameters<typeof repo.setClusterConfig>[0]
		const saved = repo.setClusterConfig(config)
		expect(Storage.set).toHaveBeenCalledWith("cluster:private", config)
		finish()
		await saved
	})
})

describe("ConfigRepository setters when IndexedDB put fails", () => {
	let repository: ConfigRepository
	let tracker: ReturnType<typeof trackUnhandledRejections>

	beforeEach(() => {
		vi.clearAllMocks()
		repository = new ConfigRepository()
		vi.spyOn(repository, "get").mockResolvedValue(undefined)
		vi.spyOn(repository, "put").mockRejectedValue(putError())
		tracker = trackUnhandledRejections()
	})

	afterEach(() => {
		tracker.dispose()
	})

	const cases: Array<{
		name: string
		run: (repo: ConfigRepository) => Promise<void>
		eventKey: string
		storageKey: string
	}> = [
		{
			name: "setThemeConfig",
			run: (repo) => repo.setThemeConfig("dark"),
			eventKey: "set_theme_config_failed",
			storageKey: "config:theme",
		},
		{
			name: "setLocaleConfig",
			run: (repo) => repo.setLocaleConfig("en_US"),
			eventKey: "set_locale_config_failed",
			storageKey: "config:i18n",
		},
		{
			name: "setClusterConfig",
			run: (repo) => repo.setClusterConfig("cluster"),
			eventKey: "set_cluster_config_failed",
			storageKey: "config:cluster",
		},
		{
			name: "setClusterCacheConfig",
			run: (repo) => repo.setClusterCacheConfig("cluster"),
			eventKey: "set_cluster_cache_config_failed",
			storageKey: "config:clusterCodeCache",
		},
		{
			name: "setFontScaleConfig",
			run: (repo) => repo.setFontScaleConfig(1.2),
			eventKey: "set_font_scale_config_failed",
			storageKey: "config:fontScale",
		},
	]

	it.each(cases)(
		"$name handles the failure and keeps the localStorage fallback",
		async ({ run, eventKey, storageKey }) => {
			await expect(run(repository)).resolves.toBeUndefined()
			await flushRejections()

			expect(tracker.reasons).toEqual([])
			expect(loggerError).toHaveBeenCalledWith(expect.objectContaining({ eventKey }))
			expect(Storage.set).toHaveBeenCalledWith(storageKey, expect.any(Object))
		},
	)
})

describe("ClusterRepository.setClustersConfig when IndexedDB put fails", () => {
	let tracker: ReturnType<typeof trackUnhandledRejections>

	beforeEach(() => {
		vi.clearAllMocks()
		tracker = trackUnhandledRejections()
	})

	afterEach(() => {
		tracker.dispose()
	})

	it("handles every failed put and keeps the localStorage fallback", async () => {
		const repository = new ClusterRepository()
		const put = vi.spyOn(repository, "put").mockRejectedValue(putError())
		const configs = [{ deployCode: "a" }, { deployCode: "b" }] as Parameters<
			ClusterRepository["setClustersConfig"]
		>[0]

		await expect(repository.setClustersConfig(configs)).resolves.toBeUndefined()
		await flushRejections()

		expect(put).toHaveBeenCalledTimes(2)
		expect(tracker.reasons).toEqual([])
		expect(loggerError).toHaveBeenCalledWith(
			expect.objectContaining({ eventKey: "set_clusters_config_failed" }),
		)
		expect(Storage.set).toHaveBeenCalledWith("cluster:a", expect.any(Object))
		expect(Storage.set).toHaveBeenCalledWith("cluster:b", expect.any(Object))
	})
})
