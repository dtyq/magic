import { describe, expect, it } from "vitest"
import { ShareType } from "../../types"
import {
	isTopicShareTypePermitted,
	resolveTopicPasswordEnabled,
	resolveTopicSharePermissionResource,
	resolveTopicShareTypePermissions,
} from "../useTopicShareTypePermissions"

describe("resolveTopicShareTypePermissions", () => {
	it("restricts nothing while the permission request is still loading", () => {
		const permissions = resolveTopicShareTypePermissions(undefined)

		expect(permissions.permittedTypes).toBeUndefined()
		expect(permissions.allowsPublicShare).toBe(true)
		expect(permissions.allowsPasswordShare).toBe(true)
		expect(permissions.hasNoPermittedShareType).toBe(false)
		expect(permissions.isPasswordSwitchLocked).toBe(false)
	})

	it("locks the password switch on when only password protection is granted", () => {
		const permissions = resolveTopicShareTypePermissions([ShareType.PasswordProtected])

		expect(permissions.allowsPublicShare).toBe(false)
		expect(permissions.allowsPasswordShare).toBe(true)
		expect(permissions.isPasswordSwitchLocked).toBe(true)
		expect(resolveTopicPasswordEnabled(false, permissions)).toBe(true)
	})

	it("locks the password switch off when only public access is granted", () => {
		const permissions = resolveTopicShareTypePermissions([ShareType.Public])

		expect(permissions.allowsPublicShare).toBe(true)
		expect(permissions.allowsPasswordShare).toBe(false)
		expect(permissions.isPasswordSwitchLocked).toBe(true)
		expect(resolveTopicPasswordEnabled(true, permissions)).toBe(false)
	})

	it("keeps the switch untouched when both methods are granted", () => {
		const permissions = resolveTopicShareTypePermissions([
			ShareType.Public,
			ShareType.PasswordProtected,
		])

		expect(permissions.isPasswordSwitchLocked).toBe(false)
		expect(resolveTopicPasswordEnabled(true, permissions)).toBe(true)
		expect(resolveTopicPasswordEnabled(false, permissions)).toBe(false)
	})

	it("treats a team-only permission group as no topic method at all", () => {
		const permissions = resolveTopicShareTypePermissions([ShareType.Organization])

		expect(permissions.permittedTypes).toEqual([])
		expect(permissions.hasNoPermittedShareType).toBe(true)
		expect(resolveTopicPasswordEnabled(true, permissions)).toBe(false)
	})

	it("has no default method while the permissions are unknown", () => {
		expect(resolveTopicShareTypePermissions(undefined).defaultShareType).toBeUndefined()
	})

	it("defaults a new share to password protection when it is granted", () => {
		expect(resolveTopicShareTypePermissions([ShareType.Public]).defaultShareType).toBe(
			ShareType.Public,
		)
		expect(
			resolveTopicShareTypePermissions([ShareType.PasswordProtected, ShareType.Public])
				.defaultShareType,
		).toBe(ShareType.PasswordProtected)
	})

	it("still defaults to password protection with no restriction granted order", () => {
		expect(
			resolveTopicShareTypePermissions([ShareType.PasswordProtected]).defaultShareType,
		).toBe(ShareType.PasswordProtected)
	})
})

describe("isTopicShareTypePermitted", () => {
	it("allows every type while the permissions are unknown", () => {
		expect(isTopicShareTypePermitted(ShareType.Public, undefined)).toBe(true)
	})

	it("rejects a closed type and accepts a granted one", () => {
		expect(isTopicShareTypePermitted(ShareType.Public, [ShareType.PasswordProtected])).toBe(
			false,
		)
		expect(
			isTopicShareTypePermitted(ShareType.PasswordProtected, [ShareType.PasswordProtected]),
		).toBe(true)
	})

	it("ignores the saved type until a share exists", () => {
		expect(isTopicShareTypePermitted(undefined, [ShareType.PasswordProtected])).toBe(true)
	})
})

describe("resolveTopicSharePermissionResource", () => {
	it("uses the topic group as soon as the response carries it", () => {
		expect(
			resolveTopicSharePermissionResource(
				{
					"project.share_public": true,
					"project.share_password": true,
					"topic.share_public": true,
					"topic.share_password": false,
				},
				"project",
			),
		).toBe("topic")
	})

	it("keeps the owning page group when the backend has no topic group yet", () => {
		expect(
			resolveTopicSharePermissionResource({ "project.share_public": true }, "project"),
		).toBe("project")
		expect(
			resolveTopicSharePermissionResource({ "micro_app.share_public": true }, "microApp"),
		).toBe("microApp")
	})

	it("falls back while the permissions are unavailable", () => {
		expect(resolveTopicSharePermissionResource(undefined, "microApp")).toBe("microApp")
	})
})
