import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	MICRO_APP_SHARE_PASSWORD_KEY_PREFIX,
	MICRO_APP_SHARE_PASSWORD_TTL,
	microAppSharePasswordStore,
	rememberMicroAppShareResource,
	removeMicroAppSharePassword,
} from "../microAppSharePasswordStore"

describe("microAppSharePasswordStore", () => {
	beforeEach(() => {
		localStorage.clear()
		vi.restoreAllMocks()
	})

	it("stores a password for 30 days using the micro-app-only key", () => {
		vi.spyOn(Date, "now").mockReturnValue(1_000)
		microAppSharePasswordStore.save("resource-1", "secret")

		expect(microAppSharePasswordStore.read("resource-1")).toEqual({
			password: "secret",
			expiresAt: 1_000 + MICRO_APP_SHARE_PASSWORD_TTL,
		})
		expect(localStorage.getItem(`${MICRO_APP_SHARE_PASSWORD_KEY_PREFIX}resource-1`)).toContain(
			"secret",
		)
	})

	it("removes expired or invalid records", () => {
		vi.spyOn(Date, "now").mockReturnValue(2_000)
		localStorage.setItem(
			`${MICRO_APP_SHARE_PASSWORD_KEY_PREFIX}resource-1`,
			JSON.stringify({ password: "expired", expiresAt: 1_999 }),
		)

		expect(microAppSharePasswordStore.read("resource-1")).toBeNull()
		expect(localStorage.getItem(`${MICRO_APP_SHARE_PASSWORD_KEY_PREFIX}resource-1`)).toBeNull()
	})

	it("removes a remembered password explicitly", () => {
		microAppSharePasswordStore.save("resource-1", "secret")
		microAppSharePasswordStore.remove("resource-1")
		expect(microAppSharePasswordStore.read("resource-1")).toBeNull()
	})

	it("removes a password by app id after a published share is revoked", () => {
		microAppSharePasswordStore.save("resource-1", "secret")
		rememberMicroAppShareResource("app-1", "resource-1")
		removeMicroAppSharePassword("app-1")
		expect(microAppSharePasswordStore.read("resource-1")).toBeNull()
	})
})
