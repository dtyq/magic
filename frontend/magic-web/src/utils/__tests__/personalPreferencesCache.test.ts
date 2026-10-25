import { beforeEach, describe, expect, it, vi } from "vitest"

const mockUser = vi.hoisted(() => ({
	authorization: "token",
	organizationCode: "organization-1",
	userInfo: {
		user_id: "user-1",
		organization_code: "organization-1",
	},
}))

vi.mock("@/models/user", () => ({
	userStore: {
		user: mockUser,
	},
}))

import {
	getCachedPersonalPreferences,
	getPersonalPreferencesUserKey,
	isLongTermMemoryEnabled,
	setCachedPersonalPreferences,
} from "../personalPreferencesCache"

describe("personalPreferencesCache", () => {
	beforeEach(() => {
		localStorage.clear()
		mockUser.authorization = "token"
		mockUser.organizationCode = "organization-1"
		mockUser.userInfo.user_id = "user-1"
		mockUser.userInfo.organization_code = "organization-1"
	})

	it("uses enabled as the backward-compatible default", () => {
		expect(isLongTermMemoryEnabled()).toBe(true)
		expect(isLongTermMemoryEnabled({})).toBe(true)
		expect(
			isLongTermMemoryEnabled({
				long_term_memory_enabled: "false" as unknown as boolean,
			}),
		).toBe(true)
		expect(isLongTermMemoryEnabled({ long_term_memory_enabled: false })).toBe(false)
	})

	it("isolates cached preferences by user and organization", () => {
		const originalUserKey = getPersonalPreferencesUserKey()
		setCachedPersonalPreferences({ long_term_memory_enabled: false }, originalUserKey)
		expect(getCachedPersonalPreferences(originalUserKey)?.long_term_memory_enabled).toBe(false)

		mockUser.organizationCode = "organization-2"
		expect(getCachedPersonalPreferences(getPersonalPreferencesUserKey())).toBeNull()
	})
})
