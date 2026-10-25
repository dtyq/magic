import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PERMISSION_KEY_MAP } from "../../../src/constants/permissions.ts"
import type { AccessContext } from "../../../src/runtime/types.ts"
import {
	allowMagic,
	allowTeamshare,
	denyPersonalOrganization,
	officialOrganization,
} from "../../../src/routes/access.ts"
import { hasRights } from "../../../src/permissions/rights.ts"

function createAccess(overrides: Partial<AccessContext> = {}): AccessContext {
	return {
		organizationCode: "organization-code",
		hasTeamshareAllPermissions: false,
		isOfficialOrganization: false,
		isPersonalOrganization: false,
		magicPermissionKeys: [],
		teamsharePermissionKeys: [],
		user: { id: "user-id", name: "Admin" },
		organization: {
			organizationCode: "organization-code",
			name: "Organization",
		},
		...overrides,
	}
}

describe("Magic access", () => {
	const platformAccess = allowMagic(PERMISSION_KEY_MAP.PLATFORM_INFO_MANAGEMENT_QUERY)

	it("lets the platform group cover platform permissions", () => {
		const access = createAccess({
			magicPermissionKeys: [PERMISSION_KEY_MAP.MAGIC_PLATFORM_PERMISSIONS],
		})

		assert.equal(platformAccess(access), true)
	})

	it("does not let the administrator group cover platform permissions", () => {
		const access = createAccess({
			magicPermissionKeys: [PERMISSION_KEY_MAP.MAGIC_ALL_PERMISSIONS],
		})

		assert.equal(platformAccess(access), false)
	})

	it("does not let the member group cover platform permissions", () => {
		const access = createAccess({
			magicPermissionKeys: [PERMISSION_KEY_MAP.MAGIC_PERSON_PERMISSIONS],
		})

		assert.equal(platformAccess(access), false)
	})

	it("keeps permission-group nesting consistent when a route validates a group key", () => {
		const memberGroupAccess = allowMagic(PERMISSION_KEY_MAP.MAGIC_PERSON_PERMISSIONS)

		assert.equal(
			memberGroupAccess(
				createAccess({
					magicPermissionKeys: [PERMISSION_KEY_MAP.MAGIC_ALL_PERMISSIONS],
				}),
			),
			true,
		)
	})

	it("does not let Teamshare full access unlock Magic permissions", () => {
		const access = createAccess({ hasTeamshareAllPermissions: true })

		assert.equal(platformAccess(access), false)
	})

	it("supports single and any-of permission checks without broadening admin prefixes", () => {
		const access = createAccess({
			magicPermissionKeys: [
				PERMISSION_KEY_MAP.MAGIC_PLATFORM_PERMISSIONS,
				PERMISSION_KEY_MAP.APP_MENU_QUERY,
			],
		})

		assert.equal(hasRights(access, PERMISSION_KEY_MAP.APP_MENU_QUERY), true)
		assert.equal(
			hasRights(access, ["missing.permission", PERMISSION_KEY_MAP.APP_MENU_QUERY]),
			true,
		)
		assert.equal(hasRights(access, "menu.unrelated.permission"), false)
	})
})

describe("Teamshare access", () => {
	it("accepts Teamshare super administrators and organization owners", () => {
		const organizationAccess = allowTeamshare()

		assert.equal(organizationAccess(createAccess({ hasTeamshareAllPermissions: true })), true)
		assert.equal(
			organizationAccess(
				createAccess({
					teamsharePermissionKeys: [PERMISSION_KEY_MAP.ORGANIZATION_OWNER],
				}),
			),
			true,
		)
	})

	it("does not treat an empty permission list as allowed", () => {
		assert.equal(allowTeamshare()(createAccess()), false)
	})

	it("does not let Magic permission groups unlock Teamshare permissions", () => {
		assert.equal(
			allowTeamshare()(
				createAccess({
					magicPermissionKeys: [PERMISSION_KEY_MAP.MAGIC_PLATFORM_PERMISSIONS],
				}),
			),
			false,
		)
	})
})

describe("organization attributes", () => {
	it("cannot be bypassed by Teamshare full access", () => {
		const access = createAccess({
			hasTeamshareAllPermissions: true,
			isOfficialOrganization: false,
			isPersonalOrganization: true,
		})

		assert.equal(officialOrganization(access), false)
		assert.equal(denyPersonalOrganization(access), false)
	})
})
