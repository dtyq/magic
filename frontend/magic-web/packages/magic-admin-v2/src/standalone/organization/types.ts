import type { ApiClients } from "@magic-admin-v2/api/types"
import type {
	AuthorizationSnapshot,
	OrganizationInfo,
	UserInfo,
} from "@magic-admin-v2/runtime/types"
import type { StandaloneRequestContext } from "@magic-admin-v2/standalone/api/context"
import type { StandaloneConfig } from "@magic-admin-v2/standalone/config"

export type MagicOrganization = {
	magic_id?: string
	magic_organization_code: string
	magic_user_id?: string
	organization_logo?: string | null
	organization_name?: string
	third_platform_organization_code?: string
}

export type ContactOrganization = {
	magic_organization_code: string
	name?: string
	organization_type?: number
}

export type EditionSessionData = {
	isPersonalOrganization: boolean
	hasTeamshareAllPermissions: boolean
	organizations: readonly OrganizationInfo[]
	teamsharePermissionKeys: readonly string[]
	user?: UserInfo
}

export type LoadEditionSessionOptions = {
	clients: ApiClients
	context: StandaloneRequestContext
	currentOrganization: MagicOrganization
	magicOrganizations: readonly MagicOrganization[]
}

export type StandaloneSession = {
	authorization: AuthorizationSnapshot
	currentOrganization: OrganizationInfo
	organizations: readonly OrganizationInfo[]
	user: UserInfo
}

export type LoadStandaloneSessionOptions = {
	clients: ApiClients
	config: StandaloneConfig
	context: StandaloneRequestContext
	organizationCode?: string
}
