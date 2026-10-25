import { describe, expect, it } from "vitest"
import { findFirstAccessibleRoutePath } from "../routeAccess"
import { PermissionSource } from "@admin/utils/routeMeta"

const context = {
	isOfficialOrg: true,
	isPersonalOrganization: false,
	userPermissions: ["model"],
	teamshareUserPermissions: [],
	env: { MAGIC_APP_ENV: "saas-test" },
}

describe("FirstAccessibleRedirect", () => {
	it("skips an inaccessible first menu and returns the first visible route", () => {
		const routes = [
			{
				path: "/admin/platform/package",
				title: "package",
				validate: () => false,
			},
			{
				path: "/admin/platform/model",
				title: "model",
				validate: () => true,
			},
		]

		expect(findFirstAccessibleRoutePath(routes, context)).toBe("/admin/platform/model")
	})

	it("resolves a nested menu after the first child loses permission", () => {
		const parent = {
			path: "/admin/platform",
			validate: (permissions: string[]) => permissions.includes("platform"),
			children: [
				{
					path: "/admin/platform/package",
					title: "package",
					validate: () => false,
				},
				{
					path: "/admin/platform/model",
					title: "model",
					validate: (permissions: string[]) => permissions.includes("model"),
				},
			],
		}

		expect(
			findFirstAccessibleRoutePath(
				parent.children,
				{ ...context, userPermissions: ["platform", "model"] },
				[parent],
			),
		).toBe("/admin/platform/model")
	})

	it("inherits teamshare permission source and environment constraints", () => {
		const routes = [
			{
				path: "/admin/enterprise",
				title: "enterprise",
				meta: { permissionSource: PermissionSource.Teamshare },
				children: [
					{
						path: "/admin/enterprise/organization",
						title: "organization",
						validate: (permissions: string[]) =>
							permissions.includes("organization.read"),
					},
					{
						path: "/admin/enterprise/provider",
						title: "provider",
						validateEnvironment: (env: { MAGIC_APP_ENV?: string }) =>
							env.MAGIC_APP_ENV?.startsWith("saas") ?? false,
					},
				],
			},
		]

		expect(
			findFirstAccessibleRoutePath(routes, {
				...context,
				userPermissions: [],
				teamshareUserPermissions: ["organization.read"],
			}),
		).toBe("/admin/enterprise")
	})
})
