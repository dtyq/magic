import { PERMISSION_KEY_MAP } from "@magic-admin-v2/constants/permissions"
import type { AccessContext } from "@magic-admin-v2/runtime/types"

export type RightsScope = "magic" | "teamshare"

export function hasRights(
	context: AccessContext,
	keys: string | readonly string[],
	scope: RightsScope = "magic",
) {
	const permissionKeys = Array.isArray(keys) ? keys : [keys]

	if (scope === "teamshare") {
		return hasTeamshareRights(context, permissionKeys)
	}

	return hasMagicRights(context, permissionKeys)
}

export function hasMagicRights(context: AccessContext, keys: readonly string[]) {
	const permissions = context.magicPermissionKeys

	return keys.some((key) => {
		if (permissions.includes(key)) return true
		if (
			permissions.includes(PERMISSION_KEY_MAP.MAGIC_PLATFORM_PERMISSIONS) &&
			(key.startsWith("platform.") || key.startsWith("admin.") || key.startsWith("workspace."))
		) {
			return true
		}
		if (
			permissions.includes(PERMISSION_KEY_MAP.MAGIC_ALL_PERMISSIONS) &&
			(key.startsWith("admin.") || key.startsWith("workspace."))
		) {
			return true
		}
		if (
			permissions.includes(PERMISSION_KEY_MAP.MAGIC_PERSON_PERMISSIONS) &&
			key.startsWith("workspace.")
		) {
			return true
		}
		if (
			key === PERMISSION_KEY_MAP.MAGIC_PERSON_PERMISSIONS &&
			permissions.includes(PERMISSION_KEY_MAP.MAGIC_ALL_PERMISSIONS)
		) {
			return true
		}
		return false
	})
}

export function hasTeamshareRights(context: AccessContext, keys: readonly string[]) {
	if (
		context.hasTeamshareAllPermissions ||
		context.teamsharePermissionKeys.includes(PERMISSION_KEY_MAP.TEAMSHARE_ALL_PERMISSIONS) ||
		context.teamsharePermissionKeys.includes(PERMISSION_KEY_MAP.ORGANIZATION_OWNER)
	) {
		return true
	}

	return keys.some((key) => context.teamsharePermissionKeys.includes(key))
}
