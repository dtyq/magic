import { PERMISSION_KEY_MAP } from "@magic-admin-v2/constants/permissions"
import type { AccessContext } from "@magic-admin-v2/runtime/types"
import type { RouteValidate } from "@magic-admin-v2/routes/types"
import { hasMagicRights, hasTeamshareRights } from "@magic-admin-v2/permissions/rights"

export const MAGIC_PLATFORM_PERMISSIONS = PERMISSION_KEY_MAP.MAGIC_PLATFORM_PERMISSIONS

export function allowMagic(...permissionKeys: string[]): RouteValidate {
	return (context) => permissionKeys.some((key) => hasMagicPermission(context, key))
}

export function allowTeamshare(...permissionKeys: string[]): RouteValidate {
	return (context) => hasTeamshareRights(context, permissionKeys)
}

export const officialOrganization: RouteValidate = (context) => context.isOfficialOrganization

export const denyPersonalOrganization: RouteValidate = (context) => !context.isPersonalOrganization

export function and(...validators: RouteValidate[]): RouteValidate {
	return (context) => validators.every((validate) => validate(context))
}

function hasMagicPermission(context: AccessContext, permissionKey: string) {
	return hasMagicRights(context, [permissionKey])
}
