import { beforeEach, describe, expect, it, vi } from "vitest"
import type { HtmlPermissionConfirmRequest } from "../IframePermissionService"
import { htmlMicroAppPreviewLogger } from "../../../utils/htmlMicroAppPreviewLogger"
import { createService } from "./IframePermissionService.testUtils"

describe("IframePermissionService", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.spyOn(htmlMicroAppPreviewLogger, "warn").mockImplementation(() => undefined)
	})

	it("rejects undeclared manifest scopes with diagnostics and without prompting", async () => {
		const onMissingDeclaration = vi.fn()
		const { service, grantStore, confirmPermission } = createService({
			onMissingDeclaration,
		})

		const allowed = await service.authorize("project.message.write")

		expect(allowed).toBe(false)
		expect(confirmPermission).not.toHaveBeenCalled()
		expect(grantStore.save).not.toHaveBeenCalled()
		expect(htmlMicroAppPreviewLogger.warn).toHaveBeenCalledWith(
			"Permission blocked: scope not declared in app.json",
			{
				appName: "Manifest App",
				declaredScopes: ["llm.use"],
				scope: "project.message.write",
			},
		)
		expect(onMissingDeclaration).toHaveBeenCalledWith({
			appName: "Manifest App",
			declaredScopes: ["llm.use"],
			scope: "project.message.write",
		})
	})

	it("saves a grant using the selected ttl for declared manifest scopes", async () => {
		const { service, grantStore, confirmPermission } = createService()

		const allowed = await service.authorize("llm.use")

		expect(allowed).toBe(true)
		expect(confirmPermission).toHaveBeenCalledWith(
			expect.objectContaining<Partial<HtmlPermissionConfirmRequest>>({
				appName: "Manifest App",
				mode: "manifest",
				scopes: ["llm.use"],
				reason: "Analyze project data",
			}),
		)
		expect(grantStore.save).toHaveBeenCalledWith(
			expect.objectContaining({
				mode: "manifest",
				scope: "llm.use",
				expiresAt: 87_400_000,
			}),
		)
		expect(confirmPermission.mock.calls[0][0].ttlOptions.map((option) => option.ttlMs)).toEqual(
			[
				60 * 60 * 1000,
				8 * 60 * 60 * 1000,
				24 * 60 * 60 * 1000,
				7 * 24 * 60 * 60 * 1000,
				30 * 24 * 60 * 60 * 1000,
			],
		)
		expect(confirmPermission.mock.calls[0][0].defaultTtlMs).toBe(24 * 60 * 60 * 1000)
	})

	it("does not save reusable grant when user selects current request only", async () => {
		const { service, grantStore } = createService({
			confirmPermission: vi.fn(async () => ({ allowed: true, ttlMs: 0 })),
			appConfigState: {
				status: "loaded",
				config: {
					name: "Writer",
					permissions: { scopes: ["fs.project.write"] },
				},
			},
		})

		const allowed = await service.authorize("fs.project.write")

		expect(allowed).toBe(true)
		expect(grantStore.save).not.toHaveBeenCalled()
	})

	it("persists and reuses an always-valid grant", async () => {
		const { service, grantStore, confirmPermission } = createService({
			appConfigState: {
				status: "loaded",
				config: {
					name: "Profile App",
					permissions: { scopes: ["user.profile.name"] },
				},
			},
			confirmPermission: vi.fn(async () => ({ allowed: true, ttlMs: null })),
		})

		await service.authorize("user.profile.name")
		await service.authorize("user.profile.name")

		expect(grantStore.grants[0]).toMatchObject({
			scope: "user.profile.name",
			expiresAt: null,
		})
		expect(confirmPermission).toHaveBeenCalledTimes(1)
	})

	it("reuses an unexpired grant without prompting", async () => {
		const { service, grantStore, confirmPermission } = createService()

		await service.authorize("llm.use")
		await service.authorize("llm.use")

		expect(confirmPermission).toHaveBeenCalledTimes(1)
		expect(grantStore.save).toHaveBeenCalledTimes(1)
		expect(grantStore.getAppGrants).toHaveBeenCalled()
	})

	it("prompts legacy apps with permanent access as an available ttl option", async () => {
		const { service, confirmPermission } = createService({
			appConfigState: { status: "absent" },
		})

		const allowed = await service.authorize("project.files.download")

		expect(allowed).toBe(true)
		expect(confirmPermission).toHaveBeenCalledWith(
			expect.objectContaining<Partial<HtmlPermissionConfirmRequest>>({
				mode: "legacy",
				scopes: ["project.files.download"],
				isLegacy: true,
			}),
		)
		const request = confirmPermission.mock.calls[0][0]
		expect(request.ttlOptions.map((option) => option.ttlMs)).toEqual([
			60 * 60 * 1000,
			8 * 60 * 60 * 1000,
			24 * 60 * 60 * 1000,
			null,
		])
		expect(request.defaultTtlMs).toBe(60 * 60 * 1000)
	})

	it("offers longer but still bounded ttl options for manifest project writes", async () => {
		const { service, confirmPermission } = createService({
			appConfigState: {
				status: "loaded",
				config: {
					name: "Writer",
					permissions: { scopes: ["fs.project.write"] },
				},
			},
		})

		await service.authorize("fs.project.write")

		expect(confirmPermission.mock.calls[0][0].ttlOptions.map((option) => option.ttlMs)).toEqual(
			[0, 60 * 60 * 1000, 8 * 60 * 60 * 1000, 24 * 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000],
		)
		expect(confirmPermission.mock.calls[0][0].defaultTtlMs).toBe(60 * 60 * 1000)
	})

	it("omits one-time access when permission is granted before use", async () => {
		const { service, confirmPermission } = createService({
			appConfigState: { status: "absent" },
		})

		expect(await service.authorize("fs.project.write", { allowOnce: false })).toBe(true)

		const request = confirmPermission.mock.calls[0][0]
		expect(request.ttlOptions.map((option) => option.ttlMs)).toEqual([
			60 * 60 * 1000,
			8 * 60 * 60 * 1000,
			null,
		])
		expect(request.defaultTtlMs).toBe(60 * 60 * 1000)
	})

	it("does not prompt for advance authorization when the grant cannot be persisted", async () => {
		const { service, confirmPermission } = createService({
			appInstance: {
				userId: "",
				projectId: "project-1",
				appRootDir: "app/",
				entryPath: "app/index.html",
				content: "<html>manifest</html>",
			},
		})

		expect(await service.authorize("llm.use", { allowOnce: false })).toBe(false)
		expect(confirmPermission).not.toHaveBeenCalled()
	})

	it("rejects while app config is loading without prompting", async () => {
		const { service, grantStore, confirmPermission } = createService({
			appConfigState: { status: "loading" },
		})

		const allowed = await service.authorize("llm.use")

		expect(allowed).toBe(false)
		expect(confirmPermission).not.toHaveBeenCalled()
		expect(grantStore.save).not.toHaveBeenCalled()
	})

	it("falls back to legacy confirmation when app config failed to load", async () => {
		const { service, grantStore, confirmPermission } = createService({
			appConfigState: { status: "error", error: "HTTP 500" },
		})

		const allowed = await service.authorize("llm.use")

		expect(allowed).toBe(true)
		expect(confirmPermission).toHaveBeenCalledWith(
			expect.objectContaining<Partial<HtmlPermissionConfirmRequest>>({
				mode: "legacy",
				isLegacy: true,
				appConfigLoadError: "HTTP 500",
				scopes: ["llm.use"],
			}),
		)
		expect(grantStore.save).toHaveBeenCalledWith(
			expect.objectContaining({
				mode: "legacy",
				scope: "llm.use",
			}),
		)
		expect(htmlMicroAppPreviewLogger.warn).toHaveBeenCalledWith(
			"Permission fallback: app.json unavailable, using legacy confirmation",
			{
				scopes: ["llm.use"],
				error: "HTTP 500",
			},
		)
	})

	it("authorizes user info scopes together and persists one grant per scope", async () => {
		const { service, grantStore, confirmPermission } = createService({
			appConfigState: {
				status: "loaded",
				config: {
					name: "Profile App",
					permissions: {
						scopes: ["user.profile.name", "user.profile.identity"],
					},
				},
			},
		})

		const allowed = await service.authorizeMany(
			["user.profile.name", "user.profile.identity"],
			{ reason: "Build a profile card", presentation: "userInfo" },
		)

		expect(allowed).toBe(true)
		expect(confirmPermission).toHaveBeenCalledWith(
			expect.objectContaining({
				scopes: ["user.profile.name", "user.profile.identity"],
				reason: "Build a profile card",
				presentation: "userInfo",
			}),
		)
		expect(grantStore.save).toHaveBeenCalledTimes(2)
	})

	it("includes legacy userInfo declarations in the unified manifest scopes", async () => {
		const { service, confirmPermission } = createService({
			appConfigState: {
				status: "loaded",
				config: {
					permissions: {
						userInfo: { scopes: ["user.profile.organization"] },
					},
				},
			},
		})

		expect(await service.authorize("user.profile.organization")).toBe(true)
		expect(confirmPermission).toHaveBeenCalledOnce()
	})

	it("returns declaration diagnostics and only current app grants in snapshots", async () => {
		const { service, grantStore } = createService({
			appConfigState: {
				status: "loaded",
				config: {
					name: "Diagnostic App",
					permissions: {
						scopes: ["llm.use", "llm.use", "future.scope"] as never,
					},
				},
			},
		})
		await service.authorize("llm.use")
		grantStore.grants.push({
			...grantStore.grants[0],
			projectId: "another-project",
			scope: "project.message.write",
		})

		const snapshot = await service.getPermissionSnapshot()

		expect(snapshot.activeGrantCount).toBe(1)
		expect(snapshot.permissions.find((item) => item.scope === "llm.use")?.grant).toBeDefined()
		expect(snapshot.permissions.find((item) => item.scope === "future.scope")).toMatchObject({
			supported: false,
			declarationStatus: "unsupported",
		})
		expect(snapshot.diagnostics).toEqual(
			expect.arrayContaining([
				{ code: "scopeDuplicate", scope: "llm.use" },
				{ code: "scopeUnsupported", scope: "future.scope" },
			]),
		)
	})

	it("treats malformed permissions.scopes as an empty declaration", async () => {
		const { service, confirmPermission } = createService({
			appConfigState: {
				status: "loaded",
				config: {
					permissions: { scopes: "llm.use" as never },
				},
			},
		})

		expect(await service.authorize("llm.use")).toBe(false)
		expect(confirmPermission).not.toHaveBeenCalled()
		expect((await service.getPermissionSnapshot()).diagnostics).toContainEqual({
			code: "scopesInvalid",
		})
	})

	it("prunes expired grants when reading the permission snapshot", async () => {
		let now = 1_000_000
		const { service, grantStore } = createService({
			getNow: () => now,
			confirmPermission: vi.fn(async () => ({ allowed: true, ttlMs: 60 * 60 * 1000 })),
		})
		await service.authorize("llm.use")
		now += 2 * 60 * 60 * 1000

		const snapshot = await service.getPermissionSnapshot()

		expect(snapshot.activeGrantCount).toBe(0)
		expect(grantStore.grants).toHaveLength(0)
	})

	it("updates an active grant duration from the current time", async () => {
		let now = 1_000_000
		const onGrantsChanged = vi.fn()
		const { service, grantStore } = createService({
			getNow: () => now,
			onGrantsChanged,
		})
		await service.authorize("llm.use")
		grantStore.grants.push({
			...grantStore.grants[0],
			projectId: "another-project",
		})
		now += 60_000

		const snapshot = await service.updateGrantTtl("llm.use", 8 * 60 * 60 * 1000)

		expect(grantStore.grants).toContainEqual(
			expect.objectContaining({
				scope: "llm.use",
				grantedAt: now,
				expiresAt: now + 8 * 60 * 60 * 1000,
			}),
		)
		expect(
			snapshot.permissions
				.find((item) => item.scope === "llm.use")
				?.ttlOptions.map((option) => option.ttlMs),
		).toContain(8 * 60 * 60 * 1000)
		expect(onGrantsChanged).toHaveBeenCalledTimes(2)
		expect(grantStore.grants.some((grant) => grant.projectId === "another-project")).toBe(true)
	})

	it("updates an eligible grant to always allow and back to a finite duration", async () => {
		let now = 1_000_000
		const { service, grantStore } = createService({
			getNow: () => now,
			appConfigState: {
				status: "loaded",
				config: {
					name: "Profile App",
					permissions: { scopes: ["user.profile.name"] },
				},
			},
			confirmPermission: vi.fn(async () => ({
				allowed: true,
				ttlMs: 7 * 24 * 60 * 60 * 1000,
			})),
		})
		await service.authorize("user.profile.name")

		await service.updateGrantTtl("user.profile.name", null)
		expect(grantStore.grants[0].expiresAt).toBeNull()

		now += 60_000
		await service.updateGrantTtl("user.profile.name", 24 * 60 * 60 * 1000)
		expect(grantStore.grants[0]).toMatchObject({
			grantedAt: now,
			expiresAt: now + 24 * 60 * 60 * 1000,
		})
	})

	it("rejects non-persistent durations when updating an active grant", async () => {
		const { service, grantStore } = createService({
			appConfigState: {
				status: "loaded",
				config: {
					name: "Writer",
					permissions: { scopes: ["fs.project.write"] },
				},
			},
			confirmPermission: vi.fn(async () => ({ allowed: true, ttlMs: 60 * 60 * 1000 })),
		})
		await service.authorize("fs.project.write")

		await expect(service.updateGrantTtl("fs.project.write", 0)).rejects.toThrow(
			"Permission duration is not allowed",
		)
		expect(grantStore.grants[0].expiresAt).toBe(4_600_000)
	})

	it("revokes one scope or all scopes without removing other app grants", async () => {
		const { service, grantStore } = createService({
			appConfigState: {
				status: "loaded",
				config: {
					permissions: { scopes: ["llm.use", "project.files.download"] },
				},
			},
		})
		await service.authorizeMany(["llm.use", "project.files.download"])
		grantStore.grants.push({
			...grantStore.grants[0],
			projectId: "another-project",
		})

		let snapshot = await service.revoke("llm.use")
		expect(snapshot.activeGrantCount).toBe(1)
		expect(grantStore.grants.some((grant) => grant.projectId === "another-project")).toBe(true)

		snapshot = await service.revokeAll()
		expect(snapshot.activeGrantCount).toBe(0)
		expect(grantStore.grants).toHaveLength(1)
		expect(grantStore.grants[0].projectId).toBe("another-project")
	})

	it("prompts again after the current scope is revoked", async () => {
		const { service, confirmPermission } = createService()
		await service.authorize("llm.use")
		await service.revoke("llm.use")

		expect(await service.authorize("llm.use")).toBe(true)
		expect(confirmPermission).toHaveBeenCalledTimes(2)
	})

	it("shares one in-flight decision for concurrent requests with the same scope", async () => {
		let resolveConfirmation!: (result: { allowed: boolean; ttlMs: number | null }) => void
		const confirmPermission = vi.fn(
			() =>
				new Promise<{ allowed: boolean; ttlMs: number | null }>((resolve) => {
					resolveConfirmation = resolve
				}),
		)
		const { service } = createService({ confirmPermission })

		const first = service.authorize("llm.use")
		const second = service.authorize("llm.use")
		// Fingerprinting uses async WebCrypto; wait for the observable prompt, not one timer tick.
		await vi.waitFor(() => expect(confirmPermission).toHaveBeenCalledOnce())

		expect(confirmPermission).toHaveBeenCalledOnce()
		resolveConfirmation({ allowed: true, ttlMs: 60 * 60 * 1000 })

		expect(await Promise.all([first, second])).toEqual([true, true])
	})

	it("processes different scopes in FIFO order without overlapping confirmations", async () => {
		const confirmations: Array<(result: { allowed: boolean; ttlMs: number | null }) => void> =
			[]
		const confirmPermission = vi.fn(
			() =>
				new Promise<{ allowed: boolean; ttlMs: number | null }>((resolve) => {
					confirmations.push(resolve)
				}),
		)
		const { service } = createService({
			confirmPermission,
			appConfigState: {
				status: "loaded",
				config: {
					name: "Manifest App",
					permissions: { scopes: ["llm.use", "project.files.download"] },
				},
			},
		})

		const first = service.authorize("llm.use")
		const second = service.authorize("project.files.download")
		await vi.waitFor(() => expect(confirmPermission).toHaveBeenCalledOnce())

		expect(confirmPermission).toHaveBeenCalledOnce()
		expect(confirmPermission.mock.calls[0][0].scopes).toEqual(["llm.use"])

		confirmations[0]({ allowed: true, ttlMs: 60 * 60 * 1000 })
		await vi.waitFor(() => expect(confirmPermission).toHaveBeenCalledTimes(2))

		expect(confirmPermission).toHaveBeenCalledTimes(2)
		expect(confirmPermission.mock.calls[1][0].scopes).toEqual(["project.files.download"])
		confirmations[1]({ allowed: true, ttlMs: 60 * 60 * 1000 })

		expect(await Promise.all([first, second])).toEqual([true, true])
	})

	it("rechecks persisted grants for a later queued request", async () => {
		const confirmPermission = vi.fn(async () => ({
			allowed: true,
			ttlMs: 60 * 60 * 1000,
		}))
		const { service } = createService({
			confirmPermission,
			appConfigState: {
				status: "loaded",
				config: {
					name: "Manifest App",
					permissions: { scopes: ["llm.use", "project.files.download"] },
				},
			},
		})

		const first = service.authorizeMany(["llm.use", "project.files.download"])
		const second = service.authorize("llm.use")

		expect(await Promise.all([first, second])).toEqual([true, true])
		expect(confirmPermission).toHaveBeenCalledOnce()
	})

	it("shares one-time access only with the current concurrent batch", async () => {
		const confirmPermission = vi.fn(async () => ({ allowed: true, ttlMs: 0 }))
		const { service } = createService({
			confirmPermission,
			appConfigState: { status: "absent" },
		})

		const first = service.authorize("project.message.write")
		const second = service.authorize("project.message.write")
		expect(await Promise.all([first, second])).toEqual([true, true])
		expect(confirmPermission).toHaveBeenCalledOnce()

		expect(await service.authorize("project.message.write")).toBe(true)
		expect(confirmPermission).toHaveBeenCalledTimes(2)
	})

	it("shares a denial with concurrent waiters without caching it", async () => {
		const confirmPermission = vi.fn(async () => ({ allowed: false, ttlMs: 0 }))
		const { service } = createService({ confirmPermission })

		const first = service.authorize("llm.use")
		const second = service.authorize("llm.use")
		expect(await Promise.all([first, second])).toEqual([false, false])
		expect(confirmPermission).toHaveBeenCalledOnce()

		expect(await service.authorize("llm.use")).toBe(false)
		expect(confirmPermission).toHaveBeenCalledTimes(2)
	})

	it("resolves queued and in-flight requests as denied when disposed", async () => {
		let resolveConfirmation!: (result: { allowed: boolean; ttlMs: number | null }) => void
		const confirmPermission = vi.fn(
			() =>
				new Promise<{ allowed: boolean; ttlMs: number | null }>((resolve) => {
					resolveConfirmation = resolve
				}),
		)
		const { service } = createService({
			confirmPermission,
			appConfigState: {
				status: "loaded",
				config: {
					name: "Manifest App",
					permissions: { scopes: ["llm.use", "project.files.download"] },
				},
			},
		})

		const first = service.authorize("llm.use")
		const second = service.authorize("project.files.download")
		await vi.waitFor(() => expect(confirmPermission).toHaveBeenCalledOnce())
		service.dispose()

		expect(await first).toBe(false)
		expect(await second).toBe(false)
		resolveConfirmation({ allowed: true, ttlMs: 60 * 60 * 1000 })

		expect(confirmPermission).toHaveBeenCalledOnce()
	})
})
