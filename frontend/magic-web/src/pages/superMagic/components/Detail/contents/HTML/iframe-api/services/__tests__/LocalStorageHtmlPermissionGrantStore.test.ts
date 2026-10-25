import { IDBFactory } from "fake-indexeddb"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { htmlMicroAppPreviewLogger } from "../../../utils/htmlMicroAppPreviewLogger"
import {
	createHtmlPermissionAppKey,
	HTML_PERMISSION_GRANTS_CHANGED_EVENT,
	LOCAL_STORAGE_HTML_PERMISSION_GRANT_STORE_KEY,
	MAX_HTML_PERMISSION_GRANTS,
	type HtmlPermissionGrant,
	type HtmlPermissionGrantIdentity,
} from "../HtmlPermissionGrantStore"
import { IndexedDbHtmlPermissionGrantStore } from "../IndexedDbHtmlPermissionGrantStore"
import {
	closeHtmlPermissionGrantDatabaseForTest,
	installWebLocksMock,
} from "./IframePermissionService.testUtils"

function grant(overrides: Partial<HtmlPermissionGrant> = {}): HtmlPermissionGrant {
	return {
		mode: "manifest",
		userId: "user-1",
		projectId: "project-1",
		appRootDir: "app/",
		entryPath: "app/index.html",
		appFingerprint: "abc123",
		scope: "llm.use",
		grantedAt: 1000,
		expiresAt: 3000,
		...overrides,
	}
}

function toIdentity(value: HtmlPermissionGrant): HtmlPermissionGrantIdentity {
	return {
		mode: value.mode,
		userId: value.userId,
		projectId: value.projectId,
		appRootDir: value.appRootDir,
		entryPath: value.entryPath,
		appFingerprint: value.appFingerprint,
	}
}

describe("IndexedDbHtmlPermissionGrantStore", () => {
	beforeEach(() => {
		vi.stubGlobal("indexedDB", new IDBFactory())
		installWebLocksMock()
		localStorage.clear()
		sessionStorage.clear()
		vi.restoreAllMocks()
	})

	it("persists grants in IndexedDB and replaces the same app and scope", async () => {
		const store = new IndexedDbHtmlPermissionGrantStore(() => 1000)
		const identity = toIdentity(grant())

		await store.save(grant({ expiresAt: 2000 }))
		await store.save(grant({ expiresAt: 3000 }))

		expect(await store.getGrant(identity, "llm.use")).toEqual(grant({ expiresAt: 3000 }))
		expect(await store.getAppGrants(identity)).toEqual([grant({ expiresAt: 3000 })])
		expect(localStorage.getItem(LOCAL_STORAGE_HTML_PERMISSION_GRANT_STORE_KEY)).toBeNull()
	})

	it("does not persist plaintext grant identity in localStorage", async () => {
		const item = grant()
		const store = new IndexedDbHtmlPermissionGrantStore(() => 1000)

		await store.save(item)

		expect(localStorage.getItem(LOCAL_STORAGE_HTML_PERMISSION_GRANT_STORE_KEY)).toBeNull()
		expect(createHtmlPermissionAppKey(toIdentity(item))).not.toContain(item.entryPath)
	})

	it("removes one scope or all scopes without affecting another app", async () => {
		const store = new IndexedDbHtmlPermissionGrantStore(() => 1000)
		const firstIdentity = toIdentity(grant())
		const otherAppGrant = grant({ entryPath: "other/index.html" })

		await store.save(grant({ scope: "llm.use" }))
		await store.save(grant({ scope: "project.message.write" }))
		await store.save(otherAppGrant)

		await store.remove(firstIdentity, "llm.use")
		expect(await store.getAppGrants(firstIdentity)).toEqual([
			grant({ scope: "project.message.write" }),
		])
		expect(await store.getAppGrants(toIdentity(otherAppGrant))).toEqual([otherAppGrant])

		await store.remove(firstIdentity)
		expect(await store.getAppGrants(firstIdentity)).toEqual([])
		expect(await store.getAppGrants(toIdentity(otherAppGrant))).toEqual([otherAppGrant])
	})

	it("discards the previous localStorage v2 data", async () => {
		const item = grant()
		const identity = toIdentity(item)
		localStorage.setItem(
			LOCAL_STORAGE_HTML_PERMISSION_GRANT_STORE_KEY,
			JSON.stringify({
				version: 2,
				apps: {
					[createHtmlPermissionAppKey(identity)]: {
						identity,
						grants: {
							[item.scope]: { grantedAt: item.grantedAt, expiresAt: item.expiresAt },
						},
					},
				},
			}),
		)

		new IndexedDbHtmlPermissionGrantStore(() => 1000)

		expect(localStorage.getItem(LOCAL_STORAGE_HTML_PERMISSION_GRANT_STORE_KEY)).toBeNull()
	})

	it("filters expired grants and preserves permanent grants", async () => {
		const store = new IndexedDbHtmlPermissionGrantStore(() => 2000)
		const identity = toIdentity(grant())

		await store.save(grant({ scope: "llm.use", expiresAt: 1500 }))
		await store.save(grant({ scope: "project.message.write", expiresAt: 2500 }))
		await store.save(grant({ scope: "user.profile.name", expiresAt: null }))

		expect(await store.getAppGrants(identity)).toEqual([
			grant({ scope: "project.message.write", expiresAt: 2500 }),
			grant({ scope: "user.profile.name", expiresAt: null }),
		])
		await store.prune(2000)
	})

	it("clears grants and notifies the current tab", async () => {
		const store = new IndexedDbHtmlPermissionGrantStore(() => 1000)
		const listener = vi.fn()
		await store.save(grant())
		window.addEventListener(HTML_PERMISSION_GRANTS_CHANGED_EVENT, listener)

		await store.clear()

		expect(await store.getAppGrants(toIdentity(grant()))).toEqual([])
		expect(listener).toHaveBeenCalledTimes(1)
		window.removeEventListener(HTML_PERMISSION_GRANTS_CHANGED_EVENT, listener)
	})

	it("keeps existing grants invalid after IndexedDB clear fails and the database reopens", async () => {
		let now = 1000
		const store = new IndexedDbHtmlPermissionGrantStore(() => now)
		const identity = toIdentity(grant({ expiresAt: null }))
		await store.save(grant({ expiresAt: null }))
		await closeHtmlPermissionGrantDatabaseForTest(store)

		now = 2000
		await expect(store.clear()).resolves.toBeUndefined()

		const reopenedStore = new IndexedDbHtmlPermissionGrantStore(() => now)
		expect(await reopenedStore.getAppGrants(identity)).toEqual([])

		now = 3000
		const newGrant = grant({ grantedAt: now, expiresAt: null })
		await reopenedStore.save(newGrant)
		expect(await reopenedStore.getAppGrants(identity)).toEqual([newGrant])
	})

	it("reports a revoke failure when the IndexedDB transaction cannot start", async () => {
		const store = new IndexedDbHtmlPermissionGrantStore(() => 1000)
		const identity = toIdentity(grant({ expiresAt: null }))
		await store.save(grant({ expiresAt: null }))
		await closeHtmlPermissionGrantDatabaseForTest(store)

		await expect(store.remove(identity, "llm.use")).rejects.toMatchObject({
			name: "InvalidStateError",
		})
	})

	it("does not restore a stale save after another store clears the session", async () => {
		const firstStore = new IndexedDbHtmlPermissionGrantStore(() => 1000)
		const secondStore = new IndexedDbHtmlPermissionGrantStore(() => 1000)
		const identity = toIdentity(grant())
		await firstStore.getAppGrants(identity)
		await secondStore.getAppGrants(identity)

		const pendingSave = firstStore.save(grant())
		await secondStore.clear()
		await pendingSave

		expect(await firstStore.getAppGrants(identity)).toEqual([])
		await firstStore.save(grant({ grantedAt: 2000 }))
		expect(await firstStore.getAppGrants(identity)).toEqual([grant({ grantedAt: 2000 })])
	})

	it("does not restore a grant after another store revokes it", async () => {
		const firstStore = new IndexedDbHtmlPermissionGrantStore(() => 1000)
		const secondStore = new IndexedDbHtmlPermissionGrantStore(() => 1000)
		const identity = toIdentity(grant())

		await firstStore.save(grant())
		const pendingSave = firstStore.save(grant({ grantedAt: 2000 }))
		await secondStore.remove(identity)
		await pendingSave

		expect(await firstStore.getAppGrants(identity)).toEqual([])
	})

	it("allows the store that cleared the session to save in the new epoch", async () => {
		const store = new IndexedDbHtmlPermissionGrantStore(() => 1000)
		const identity = toIdentity(grant())

		await store.save(grant())
		await store.clear()
		await store.save(grant({ grantedAt: 2000, expiresAt: 4000 }))

		expect(await store.getAppGrants(identity)).toEqual([
			grant({ grantedAt: 2000, expiresAt: 4000 }),
		])
	})

	it("serializes concurrent saves from two stores without losing either grant", async () => {
		const firstStore = new IndexedDbHtmlPermissionGrantStore(() => 1000)
		const secondStore = new IndexedDbHtmlPermissionGrantStore(() => 1000)
		const identity = toIdentity(grant())

		await Promise.all([
			firstStore.save(grant({ scope: "llm.use" })),
			secondStore.save(grant({ scope: "project.message.write" })),
		])

		expect(await firstStore.getAppGrants(identity)).toEqual([
			grant({ scope: "llm.use" }),
			grant({ scope: "project.message.write" }),
		])
	})

	it("evicts finite grants before permanent grants when the limit is exceeded", async () => {
		const store = new IndexedDbHtmlPermissionGrantStore(() => 1000)
		const grants = Array.from({ length: MAX_HTML_PERMISSION_GRANTS }, (_, index) =>
			grant({
				entryPath: `app/${index}.html`,
				grantedAt: index + 1,
				expiresAt: index === 0 ? 10_000 : null,
			}),
		)
		for (const item of grants) await store.save(item)
		vi.spyOn(htmlMicroAppPreviewLogger, "warn").mockImplementation(() => undefined)

		await store.save(grant({ entryPath: "app/new.html", grantedAt: 2000, expiresAt: null }))

		expect(await store.getAppGrants(toIdentity(grants[0]))).toEqual([])
		expect(await store.getAppGrants(toIdentity(grant({ entryPath: "app/new.html" })))).toEqual([
			grant({ entryPath: "app/new.html", grantedAt: 2000, expiresAt: null }),
		])
	}, 30_000)
})
