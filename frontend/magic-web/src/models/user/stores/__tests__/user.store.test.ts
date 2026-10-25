import { describe, expect, it } from "vitest"

import { UserStore } from "../user.store"
import { hasMagicAdminPermission, hasTeamshareAdminIdentification } from "../../utils/adminAccess"
import type { User } from "@/types/user"

function createOrganization(overrides: Partial<User.UserOrganization> = {}): User.UserOrganization {
	return {
		id: "org-id",
		member_id: "member-id",
		platform_type: 1,
		real_name: "Tester",
		avatar: "",
		organization_code: "ts-org",
		organization_name: "Teamshare Org",
		organization_logo: [],
		is_admin: false,
		is_application_admin: false,
		is_complete_info: true,
		state_code: "",
		identifications: [],
		creator_id: "",
		is_personal_organization: false,
		active_count: 1,
		...overrides,
	}
}

describe("hasMagicAdminPermission", () => {
	it("returns false for empty permissions", () => {
		expect(hasMagicAdminPermission([])).toBe(false)
		expect(hasMagicAdminPermission(undefined)).toBe(false)
	})

	it("accepts magic permission groups and admin prefixes", () => {
		expect(hasMagicAdminPermission(["MAGIC_ALL_PERMISSIONS"])).toBe(true)
		expect(hasMagicAdminPermission(["MAGIC_PLATFORM_PERMISSIONS"])).toBe(true)
		expect(hasMagicAdminPermission(["admin.ai.application.menu.query"])).toBe(true)
		expect(hasMagicAdminPermission(["workspace.model.text.query"])).toBe(true)
		expect(hasMagicAdminPermission(["platform.setting.maintenance.query"])).toBe(true)
	})

	it("rejects ordinary magic member group without admin prefixes", () => {
		expect(hasMagicAdminPermission(["MAGIC_PERSON_PERMISSIONS"])).toBe(false)
	})
})

describe("hasTeamshareAdminIdentification", () => {
	it("returns false for empty identifications", () => {
		expect(hasTeamshareAdminIdentification([])).toBe(false)
		expect(hasTeamshareAdminIdentification(undefined)).toBe(false)
	})

	it("accepts teamshare super admin, owner and sub admin", () => {
		expect(hasTeamshareAdminIdentification(["super_admin"])).toBe(true)
		expect(hasTeamshareAdminIdentification(["organization_owner"])).toBe(true)
		expect(hasTeamshareAdminIdentification(["sub_admin"])).toBe(true)
	})

	it("accepts teamshare console sub permissions without role identifications", () => {
		expect(hasTeamshareAdminIdentification(["TeamshareOS_console_organization.read"])).toBe(
			true,
		)
		expect(hasTeamshareAdminIdentification(["TeamshareOS_user_group.all"])).toBe(true)
	})

	it("rejects unrelated teamshare identities", () => {
		expect(hasTeamshareAdminIdentification(["employee"])).toBe(false)
	})
})

describe("UserStore.canAccessAdmin", () => {
	it("is true for magic org admin even without permission keys", () => {
		const store = new UserStore()
		store.setIsAdmin(true)
		expect(store.canAccessAdmin).toBe(true)
	})

	it("is true for magic admin permission keys", () => {
		const store = new UserStore()
		store.setUserPermissions(["admin.ai.application.menu.query"])
		expect(store.canAccessAdmin).toBe(true)
	})

	it("is true for teamshare sub admin on the current organization", () => {
		const store = new UserStore()
		store.setTeamshareOrganization("ts-org", [
			createOrganization({ identifications: ["sub_admin"] }),
		])
		expect(store.canAccessAdmin).toBe(true)
	})

	it("is true for a teamshare console sub permission on the current organization", () => {
		const store = new UserStore()
		store.setTeamshareOrganization("ts-org", [
			createOrganization({
				identifications: ["TeamshareOS_console_organization.read"],
			}),
		])
		expect(store.canAccessAdmin).toBe(true)
	})

	it("is false for ordinary members without either permission system", () => {
		const store = new UserStore()
		store.setTeamshareOrganization("ts-org", [createOrganization()])
		store.setUserPermissions(["MAGIC_PERSON_PERMISSIONS"])
		expect(store.canAccessAdmin).toBe(false)
	})
})
