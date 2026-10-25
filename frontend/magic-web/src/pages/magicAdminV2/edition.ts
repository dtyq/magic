import type {
	ApiClients,
	AuthorizationSnapshot,
	HttpClient as RuntimeHttpClient,
} from "@dtyq/magic-admin-v2"
import { defaultMagicClient as magicClient } from "@/infrastructure/network/http/runtime"
import type { AuthorizationLoaderInput } from "@/pages/magicAdminV2/types"

type OfficialOrganizationResponse = {
	is_official?: boolean
}

type PermissionListResponse = {
	permission_key?: string[]
}

const magic = magicClient as unknown as RuntimeHttpClient

// The open-source build only needs Magic. The cast keeps this physical fallback
// type-checkable in an enterprise checkout, where ApiClients is overlaid.
export const apiClients = { magic } as ApiClients

export async function loadAuthorization({
	organizationCode,
	isPersonalOrganization,
}: AuthorizationLoaderInput): Promise<AuthorizationSnapshot> {
	const [officialOrganization, permissionList] = await Promise.all([
		magic.get<OfficialOrganizationResponse>("/api/v1/admin/service-providers/office-info"),
		magic.get<PermissionListResponse>("/api/v1/permissions/me"),
	])
	const magicPermissionKeys = permissionList.permission_key ?? []

	return {
		organizationCode,
		hasTeamshareAllPermissions: false,
		isOfficialOrganization: officialOrganization.is_official === true,
		isPersonalOrganization,
		magicPermissionKeys,
		teamsharePermissionKeys: [],
	}
}
