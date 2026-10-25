import { describe, expect, it, vi } from "vitest"
import type { HTMLAppConfig, HtmlPermissionScope } from "../../types"
import type {
	HtmlPermissionConfirmRequest,
	IframePermissionAppInstance,
	IframePermissionService,
} from "../IframePermissionService"
import type { HtmlPermissionGrantIdentity } from "../HtmlPermissionGrantStore"
import { HtmlPermissionAuthorizationQueue } from "../HtmlPermissionAuthorizationQueue"
import {
	createMemoryLegacyMigrationMarker,
	createService,
	MemoryGrantStore,
} from "./IframePermissionService.testUtils"

const DAY = 24 * 60 * 60 * 1000

const baseInstance: IframePermissionAppInstance = {
	userId: "user-1",
	projectId: "project-1",
	appRootDir: "app/",
	entryPath: "app/index.html",
	entryFileId: "file-1",
	content: "<html>manifest</html>",
	runtimeFingerprint: "runtime-v1",
}

function allowAll() {
	return vi.fn(async (request: HtmlPermissionConfirmRequest) => ({
		allowed: true,
		ttlMs: request.scopes.includes("llm.use") ? DAY : request.defaultTtlMs,
	}))
}

function manifest(config: Partial<HTMLAppConfig> = {}) {
	return {
		status: "loaded" as const,
		config: {
			name: "Manifest App",
			entry: "index.html",
			permissions: { scopes: ["llm.use"] as HtmlPermissionScope[] },
			...config,
		} as HTMLAppConfig,
	}
}

/** Builds the identity earlier versions used, so tests can seed pre-upgrade grants. */
async function legacyIdentityOf(
	service: IframePermissionService,
	mode: "manifest" | "legacy",
	config: HTMLAppConfig | null,
): Promise<HtmlPermissionGrantIdentity> {
	return (
		service as unknown as {
			buildLegacyGrantIdentity: (
				mode: "manifest" | "legacy",
				config: HTMLAppConfig | null,
			) => Promise<HtmlPermissionGrantIdentity>
		}
	).buildLegacyGrantIdentity(mode, config)
}

describe("IframePermissionService stable app identity", () => {
	it("keeps grants when the entry content changes", async () => {
		const store = new MemoryGrantStore()
		const confirmPermission = allowAll()
		await createService({ grantStore: store, confirmPermission }).service.authorize("llm.use")

		const edited = createService({
			grantStore: store,
			confirmPermission,
			appInstance: { ...baseInstance, content: "<html>changed source</html>" },
		})

		expect(await edited.service.authorize("llm.use")).toBe(true)
		expect(confirmPermission).toHaveBeenCalledOnce()
	})

	it("keeps read-only grants when sibling executable files change", async () => {
		const store = new MemoryGrantStore()
		const confirmPermission = allowAll()
		const config = manifest({
			permissions: { scopes: ["fs.project.read"] },
		})
		await createService({
			grantStore: store,
			confirmPermission,
			appConfigState: config,
			appInstance: { ...baseInstance, runtimeFingerprint: "runtime-v1" },
		}).service.authorize("fs.project.read")

		const edited = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: config,
			appInstance: { ...baseInstance, runtimeFingerprint: "runtime-v2" },
		})

		expect(await edited.service.authorize("fs.project.read")).toBe(true)
		expect(confirmPermission).toHaveBeenCalledOnce()
		expect(edited.confirmCodeChange).not.toHaveBeenCalled()
	})

	it("keeps legacy-mode grants across content edits", async () => {
		const store = new MemoryGrantStore()
		const confirmPermission = allowAll()
		await createService({
			grantStore: store,
			confirmPermission,
			appConfigState: { status: "absent" },
		}).service.authorize("llm.use")

		const edited = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: { status: "absent" },
			appInstance: { ...baseInstance, content: "<html>changed</html>" },
		})

		expect(await edited.service.authorize("llm.use")).toBe(true)
		expect(confirmPermission).toHaveBeenCalledOnce()
	})

	it("keeps grants when the app is renamed or moved but keeps its file id", async () => {
		const store = new MemoryGrantStore()
		const confirmPermission = allowAll()
		await createService({ grantStore: store, confirmPermission }).service.authorize("llm.use")

		const moved = createService({
			grantStore: store,
			confirmPermission,
			appInstance: {
				...baseInstance,
				appRootDir: "moved/dir/",
				entryPath: "moved/dir/home.html",
			},
		})

		expect(await moved.service.authorize("llm.use")).toBe(true)
		expect(confirmPermission).toHaveBeenCalledOnce()
	})

	it("asks again for a copy that has a different entry file id", async () => {
		const store = new MemoryGrantStore()
		const confirmPermission = allowAll()
		await createService({ grantStore: store, confirmPermission }).service.authorize("llm.use")

		const copy = createService({
			grantStore: store,
			confirmPermission,
			appInstance: { ...baseInstance, entryFileId: "file-copy" },
		})
		await copy.service.authorize("llm.use")

		expect(confirmPermission).toHaveBeenCalledTimes(2)
	})

	it("keys micro apps on appId regardless of entry file or path", async () => {
		const store = new MemoryGrantStore()
		const confirmPermission = allowAll()
		const microApp = {
			...baseInstance,
			appId: "app-1",
			appRootDir: "",
			entryPath: "index.html",
		}
		await createService({
			grantStore: store,
			confirmPermission,
			appInstance: microApp,
		}).service.authorize("llm.use")

		const sameApp = createService({
			grantStore: store,
			confirmPermission,
			appInstance: { ...microApp, entryFileId: "file-2", content: "changed" },
		})
		expect(await sameApp.service.authorize("llm.use")).toBe(true)
		expect(confirmPermission).toHaveBeenCalledOnce()

		const otherApp = createService({
			grantStore: store,
			confirmPermission,
			appInstance: { ...microApp, appId: "app-2" },
		})
		await otherApp.service.authorize("llm.use")
		expect(confirmPermission).toHaveBeenCalledTimes(2)
	})

	it("only prompts for newly declared scopes when the declaration grows", async () => {
		const store = new MemoryGrantStore()
		const confirmPermission = allowAll()
		await createService({ grantStore: store, confirmPermission }).service.authorize("llm.use")

		const grown = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: manifest({
				permissions: { scopes: ["llm.use", "fs.project.read"] },
			}),
		})
		expect(await grown.service.authorizeMany(["llm.use", "fs.project.read"])).toBe(true)

		expect(confirmPermission).toHaveBeenCalledTimes(2)
		expect(confirmPermission.mock.calls[1][0].scopes).toEqual(["fs.project.read"])
	})

	it("falls back to one-time consent when the app has no stable id", async () => {
		const store = new MemoryGrantStore()
		const confirmPermission = vi.fn(async (request: HtmlPermissionConfirmRequest) => ({
			allowed: true,
			ttlMs: request.defaultTtlMs,
		}))
		const noId = createService({
			grantStore: store,
			confirmPermission,
			appInstance: { ...baseInstance, entryFileId: "" },
		})

		expect(await noId.service.authorize("llm.use")).toBe(true)
		expect(store.grants).toHaveLength(0)
		expect(await noId.service.authorize("llm.use")).toBe(true)
		expect(confirmPermission).toHaveBeenCalledTimes(2)
	})
})

describe("IframePermissionService legacy grant migration", () => {
	it("retries migration after a failed save, including after a service reload", async () => {
		const store = new MemoryGrantStore()
		const marker = createMemoryLegacyMigrationMarker()
		const config = manifest()
		const options = {
			grantStore: store,
			legacyMigrationMarker: marker,
			appConfigState: config,
			appInstance: baseInstance,
		}
		const first = createService(options).service
		const legacyIdentity = await legacyIdentityOf(first, "manifest", config.config)
		await store.save({ ...legacyIdentity, scope: "llm.use", grantedAt: 500, expiresAt: null })
		store.save.mockResolvedValueOnce(false)

		expect((await first.getPermissionSnapshot()).activeGrantCount).toBe(0)
		expect(store.grants[0].entryFileId).toBeUndefined()

		const reloaded = createService(options).service
		expect((await reloaded.getPermissionSnapshot()).activeGrantCount).toBe(1)
		expect(store.grants).toHaveLength(1)
		expect(store.grants[0].entryFileId).toBe("file-1")
	})

	it("adopts a grant saved under the old content fingerprint and keeps its expiry", async () => {
		const store = new MemoryGrantStore()
		const confirmPermission = allowAll()
		const config = manifest()
		const { service } = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: config,
		})
		const legacyIdentity = await legacyIdentityOf(service, "manifest", config.config)
		await store.save({
			...legacyIdentity,
			scope: "llm.use",
			grantedAt: 500,
			expiresAt: 999_999_999,
		})

		expect(await service.authorize("llm.use")).toBe(true)

		expect(confirmPermission).not.toHaveBeenCalled()
		expect(store.grants).toHaveLength(1)
		expect(store.grants[0]).toMatchObject({
			entryFileId: "file-1",
			scope: "llm.use",
			grantedAt: 500,
			expiresAt: 999_999_999,
		})
	})

	it("does not adopt expired legacy grants", async () => {
		const store = new MemoryGrantStore()
		const confirmPermission = allowAll()
		const config = manifest()
		const { service } = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: config,
		})
		const legacyIdentity = await legacyIdentityOf(service, "manifest", config.config)
		await store.save({ ...legacyIdentity, scope: "llm.use", grantedAt: 1, expiresAt: 2 })

		await service.authorize("llm.use")

		expect(confirmPermission).toHaveBeenCalledOnce()
	})

	it("ignores legacy grants made for different content", async () => {
		const store = new MemoryGrantStore()
		const confirmPermission = allowAll()
		const config = manifest()
		const older = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: config,
			appInstance: { ...baseInstance, content: "<html>older</html>" },
		})
		const oldIdentity = await legacyIdentityOf(older.service, "manifest", config.config)
		await store.save({ ...oldIdentity, scope: "llm.use", grantedAt: 500, expiresAt: null })

		await createService({
			grantStore: store,
			confirmPermission,
			appConfigState: config,
		}).service.authorize("llm.use")

		expect(confirmPermission).toHaveBeenCalledOnce()
	})

	it("does not adopt legacy grants for scopes the manifest no longer declares", async () => {
		const store = new MemoryGrantStore()
		const confirmPermission = allowAll()
		const config = manifest()
		const { service } = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: config,
		})
		const legacyIdentity = await legacyIdentityOf(service, "manifest", config.config)
		await store.save({
			...legacyIdentity,
			scope: "fs.project.read",
			grantedAt: 500,
			expiresAt: null,
		})

		const snapshot = await service.getPermissionSnapshot()

		expect(snapshot.activeGrantCount).toBe(0)
		expect(store.grants).toHaveLength(1)
	})

	it("records the current code version on adopted grants", async () => {
		const store = new MemoryGrantStore()
		const confirmPermission = allowAll()
		const config = manifest()
		const instance = { ...baseInstance, runtimeFingerprint: "runtime-v1" }
		const { service, confirmCodeChange } = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: config,
			appInstance: instance,
		})
		const legacyIdentity = await legacyIdentityOf(service, "manifest", config.config)
		await store.save({ ...legacyIdentity, scope: "llm.use", grantedAt: 500, expiresAt: null })

		expect(await service.authorize("llm.use")).toBe(true)

		// The old key only matches when the code is unchanged, so no code-change prompt follows.
		expect(confirmCodeChange).not.toHaveBeenCalled()
		expect(store.grants[0].codeFingerprint).toBeTruthy()
	})

	it("does not adopt old grants again after a revoke, even for an earlier version of the file", async () => {
		const store = new MemoryGrantStore()
		const confirmPermission = allowAll()
		const marker = createMemoryLegacyMigrationMarker()
		const config = manifest()
		const original = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: config,
			legacyMigrationMarker: marker,
		})
		const legacyIdentity = await legacyIdentityOf(original.service, "manifest", config.config)
		await store.save({ ...legacyIdentity, scope: "llm.use", grantedAt: 500, expiresAt: null })
		await original.service.revoke("llm.use")
		// An older grant for this content version is still stored under the legacy key.
		await store.save({ ...legacyIdentity, scope: "llm.use", grantedAt: 600, expiresAt: null })

		const reloaded = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: config,
			legacyMigrationMarker: marker,
		})
		await reloaded.service.authorize("llm.use")

		expect(confirmPermission).toHaveBeenCalledOnce()
	})

	it("does not bring back a revoked grant through migration", async () => {
		const store = new MemoryGrantStore()
		const confirmPermission = allowAll()
		const config = manifest()
		const { service } = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: config,
		})
		const legacyIdentity = await legacyIdentityOf(service, "manifest", config.config)
		await store.save({ ...legacyIdentity, scope: "llm.use", grantedAt: 500, expiresAt: null })

		await service.revoke("llm.use")
		const fresh = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: config,
		})
		await fresh.service.authorize("llm.use")

		expect(store.grants.filter((grant) => grant.scope === "llm.use")).toHaveLength(1)
		expect(confirmPermission).toHaveBeenCalledOnce()
	})
})

describe("IframePermissionService code change re-confirmation", () => {
	const manifestScopes = manifest({
		permissions: { scopes: ["llm.use", "fs.project.read"] },
	})

	async function grantWithRuntime(runtimeFingerprint: string) {
		const store = new MemoryGrantStore()
		const confirmPermission = allowAll()
		const first = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: manifestScopes,
			appInstance: { ...baseInstance, runtimeFingerprint },
		})
		await first.service.authorizeMany(["llm.use", "fs.project.read"])
		return { store, confirmPermission }
	}

	it("remembers high-risk consent across later code versions and service instances", async () => {
		const { store, confirmPermission } = await grantWithRuntime("runtime-v1")
		const later = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: manifestScopes,
			appInstance: { ...baseInstance, runtimeFingerprint: "runtime-v2" },
		})

		expect(await later.service.authorize("llm.use")).toBe(true)
		expect(later.confirmCodeChange).toHaveBeenCalledOnce()
		expect(later.confirmCodeChange.mock.calls[0][0].scopes).toEqual(["llm.use"])

		// Remember follows this app and scope, rather than just the currently visible version.
		await later.service.authorize("llm.use")
		expect(later.confirmCodeChange).toHaveBeenCalledOnce()
		expect(confirmPermission).toHaveBeenCalledOnce()
		const remembered = store.grants.find((grant) => grant.scope === "llm.use")!
		expect(remembered.reuseAcrossCodeChanges).toBe(true)
		for (const runtimeFingerprint of ["runtime-v3", "runtime-v4", "[]"]) {
			const reopened = createService({
				grantStore: store,
				confirmPermission,
				appConfigState: manifestScopes,
				appInstance: { ...baseInstance, runtimeFingerprint },
			})
			expect(await reopened.service.authorize("llm.use")).toBe(true)
			expect(reopened.confirmCodeChange).not.toHaveBeenCalled()
			const snapshot = await reopened.service.getPermissionSnapshot()
			expect(snapshot.needsReconfirmCount).toBe(0)
			expect(
				snapshot.permissions.find((item) => item.scope === "llm.use")?.needsReconfirm,
			).toBe(false)
		}
		expect(store.grants.find((grant) => grant.scope === "llm.use")).toEqual(remembered)
	})

	it.each(["revocation", "expiry"])(
		"preserves remembered consent on duration changes, but not after %s",
		async (end) => {
			const { store, confirmPermission } = await grantWithRuntime("runtime-v1")
			const later = createService({
				grantStore: store,
				confirmPermission,
				appConfigState: manifestScopes,
				appInstance: { ...baseInstance, runtimeFingerprint: "runtime-v2" },
			})
			await later.service.authorize("llm.use")
			await later.service.updateGrantTtl("llm.use", DAY)
			expect(
				store.grants.find((grant) => grant.scope === "llm.use")?.reuseAcrossCodeChanges,
			).toBe(true)
			if (end === "revocation") await later.service.revoke("llm.use")
			else await store.prune(1_000_000 + DAY + 1)
			await later.service.authorize("llm.use")
			expect(confirmPermission).toHaveBeenCalledTimes(2)
			expect(
				store.grants.find((grant) => grant.scope === "llm.use")?.reuseAcrossCodeChanges,
			).not.toBe(true)
		},
	)

	it("does not extend remembered consent to another permission or app", async () => {
		const { store, confirmPermission } = await grantWithRuntime("runtime-v1")
		const config = manifest({ permissions: { scopes: ["llm.use", "project.message.write"] } })
		const later = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: config,
			appInstance: { ...baseInstance, runtimeFingerprint: "runtime-v2" },
		})
		await later.service.authorize("llm.use")
		await later.service.authorize("project.message.write")
		expect(confirmPermission).toHaveBeenCalledTimes(2)
		expect(confirmPermission.mock.calls[1][0].scopes).toEqual(["project.message.write"])
		const other = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: config,
			appInstance: {
				...baseInstance,
				entryFileId: "other-file",
				runtimeFingerprint: "runtime-v3",
			},
		})
		await other.service.authorize("llm.use")
		expect(confirmPermission).toHaveBeenCalledTimes(3)
	})

	it("does not remember a failed persistence attempt", async () => {
		const { store, confirmPermission } = await grantWithRuntime("runtime-v1")
		store.save.mockResolvedValue(false)
		const later = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: manifestScopes,
			appInstance: { ...baseInstance, runtimeFingerprint: "runtime-v2" },
		})
		expect(await later.service.authorize("llm.use")).toBe(true)
		expect(await later.service.authorize("llm.use")).toBe(true)
		expect(later.confirmCodeChange).toHaveBeenCalledTimes(2)
		expect(
			store.grants.find((grant) => grant.scope === "llm.use")?.reuseAcrossCodeChanges,
		).not.toBe(true)
	})

	it("never asks about read-only scopes after the code changed", async () => {
		const { store, confirmPermission } = await grantWithRuntime("runtime-v1")
		const later = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: manifestScopes,
			appInstance: { ...baseInstance, runtimeFingerprint: "runtime-v2" },
		})

		expect(await later.service.authorize("fs.project.read")).toBe(true)
		expect(later.confirmCodeChange).not.toHaveBeenCalled()
	})

	it("keeps the old confirmed version when the user allows only once", async () => {
		const { store, confirmPermission } = await grantWithRuntime("runtime-v1")
		const later = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: manifestScopes,
			appInstance: { ...baseInstance, runtimeFingerprint: "runtime-v2" },
			confirmCodeChange: async () => "once",
		})

		expect(await later.service.authorize("llm.use")).toBe(true)
		expect(await later.service.authorize("llm.use")).toBe(true)
		expect(later.confirmCodeChange).toHaveBeenCalledTimes(2)
	})

	it("rejects the call when the user denies the code change", async () => {
		const { store, confirmPermission } = await grantWithRuntime("runtime-v1")
		const later = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: manifestScopes,
			appInstance: { ...baseInstance, runtimeFingerprint: "runtime-v2" },
			confirmCodeChange: async () => "deny",
		})

		expect(await later.service.authorize("llm.use")).toBe(false)
	})

	it("denies instead of silently reusing a stale grant when no confirmation hook exists", async () => {
		const { store, confirmPermission } = await grantWithRuntime("runtime-v1")
		const later = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: manifestScopes,
			appInstance: { ...baseInstance, runtimeFingerprint: "runtime-v2" },
		})
		;(
			later.service as unknown as { cfg: { confirmCodeChange?: unknown } }
		).cfg.confirmCodeChange = undefined

		expect(await later.service.authorize("llm.use")).toBe(false)
	})

	it("denies high-risk reuse until the project file list is loaded", async () => {
		const { store, confirmPermission } = await grantWithRuntime("runtime-v1")
		const notLoaded = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: manifestScopes,
			appInstance: { ...baseInstance, runtimeFingerprint: "[]" },
		})

		expect(await notLoaded.service.authorize("llm.use")).toBe(false)
		expect(notLoaded.confirmCodeChange).not.toHaveBeenCalled()
		expect(await notLoaded.service.authorize("fs.project.read")).toBe(true)
		const snapshot = await notLoaded.service.getPermissionSnapshot()
		expect(snapshot.permissions.find((item) => item.scope === "llm.use")).toMatchObject({
			codeStatus: "unknown",
			needsReconfirm: true,
		})
	})

	it("refreshes the code fingerprint when the lazy file list becomes ready or changes", async () => {
		const { store, confirmPermission } = await grantWithRuntime("runtime-v1")
		let runtime = "[]"
		const later = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: manifestScopes,
			appInstance: {
				...baseInstance,
				runtimeFingerprint: undefined,
				getRuntimeFingerprint: () => runtime,
			},
		})
		expect(await later.service.authorize("llm.use")).toBe(false)
		runtime = "runtime-v1"
		expect(await later.service.authorize("llm.use")).toBe(true)
		expect(later.confirmCodeChange).not.toHaveBeenCalled()
		runtime = "runtime-v2"
		expect(await later.service.authorize("llm.use")).toBe(true)
		expect(later.confirmCodeChange).toHaveBeenCalledOnce()
	})

	it("does not share a pending decision with a different code version", async () => {
		const queue = new HtmlPermissionAuthorizationQueue()
		const store = new MemoryGrantStore()
		let finishFirst!: (result: { allowed: boolean; ttlMs: number }) => void
		const first = createService({
			grantStore: store,
			authorizationQueue: queue,
			appInstance: baseInstance,
			confirmPermission: () =>
				new Promise((resolve) => {
					finishFirst = resolve
				}),
		})
		const firstRequest = first.service.authorize("llm.use")
		await vi.waitFor(() => expect(first.confirmPermission).toHaveBeenCalledOnce())
		const later = createService({
			grantStore: store,
			authorizationQueue: queue,
			appInstance: { ...baseInstance, runtimeFingerprint: "runtime-v2" },
			confirmCodeChange: async () => "deny",
		})
		const laterRequest = later.service.authorize("llm.use")
		finishFirst({ allowed: true, ttlMs: DAY })
		expect(await firstRequest).toBe(true)
		expect(await laterRequest).toBe(false)
		expect(later.confirmCodeChange).toHaveBeenCalledOnce()
	})

	it("treats a grant saved before code tracking as unconfirmed for high-risk scopes", async () => {
		const store = new MemoryGrantStore()
		const confirmPermission = allowAll()
		const seeded = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: manifestScopes,
			appInstance: { ...baseInstance, runtimeFingerprint: "runtime-v1" },
		})
		await seeded.service.authorizeMany(["llm.use", "fs.project.read"])
		store.grants = store.grants.map(({ codeFingerprint: _omit, ...grant }) => grant)

		const snapshot = await seeded.service.getPermissionSnapshot()
		const byScope = Object.fromEntries(snapshot.permissions.map((item) => [item.scope, item]))
		expect(byScope["llm.use"]).toMatchObject({ codeStatus: "unknown", needsReconfirm: true })
		expect(byScope["fs.project.read"]).toMatchObject({
			codeStatus: "unknown",
			needsReconfirm: false,
		})
	})

	it("reports changed grants in the snapshot and clears them when acknowledged", async () => {
		const { store, confirmPermission } = await grantWithRuntime("runtime-v1")
		const later = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: manifestScopes,
			appInstance: { ...baseInstance, runtimeFingerprint: "runtime-v2" },
		})

		const before = await later.service.getPermissionSnapshot()
		expect(before.codeChangedGrantCount).toBe(2)
		expect(before.needsReconfirmCount).toBe(1)
		const read = before.permissions.find((item) => item.scope === "fs.project.read")
		expect(read).toMatchObject({
			codeStatus: "changed",
			highRisk: false,
			needsReconfirm: false,
		})

		const after = await later.service.acknowledgeCodeChanges()
		expect(after.codeChangedGrantCount).toBe(0)
		expect(after.needsReconfirmCount).toBe(0)
		expect(after.activeGrantCount).toBe(2)
	})

	it("does not treat a duplicated file list entry as a code change", async () => {
		const entry = { fileId: "f1", path: "app/index.html", updatedAt: "2026-10-16 10:00:00" }
		const { store, confirmPermission } = await grantWithRuntime(JSON.stringify([entry]))
		const later = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: manifestScopes,
			appInstance: { ...baseInstance, runtimeFingerprint: JSON.stringify([entry, entry]) },
		})

		expect(await later.service.authorize("llm.use")).toBe(true)
		expect(later.confirmCodeChange).not.toHaveBeenCalled()
	})

	it("keeps the confirmed version when only the duration is changed", async () => {
		const { store, confirmPermission } = await grantWithRuntime("runtime-v1")
		const later = createService({
			grantStore: store,
			confirmPermission,
			appConfigState: manifestScopes,
			appInstance: { ...baseInstance, runtimeFingerprint: "runtime-v2" },
		})

		const snapshot = await later.service.updateGrantTtl("fs.project.read", 7 * DAY)

		expect(
			snapshot.permissions.find((item) => item.scope === "fs.project.read")?.codeStatus,
		).toBe("changed")
	})
})
