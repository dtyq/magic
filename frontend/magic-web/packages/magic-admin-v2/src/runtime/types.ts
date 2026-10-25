import type { ApiClients, ApiError } from "@magic-admin-v2/api/types"
import type { Capabilities } from "@magic-admin-v2/capabilities/types"
import type { RuntimeMode } from "@magic-admin-v2/constants/runtime"
import type { Language } from "@magic-admin-v2/i18n/resources"
import type { PlatformInfoDetails } from "@magic-admin-v2/features/platform-info/types"

export type AuthorizationSnapshot = {
	organizationCode: string
	/** Teamshare 超级管理员或组织所有者，仅用于 Teamshare 权限域。 */
	hasTeamshareAllPermissions: boolean
	isOfficialOrganization: boolean
	isPersonalOrganization: boolean
	magicPermissionKeys: readonly string[]
	teamsharePermissionKeys: readonly string[]
}

export type AuthState =
	| { status: "loading" }
	| { status: "unauthenticated" }
	| { status: "error"; error: Error }
	| { status: "authenticated"; authorization: AuthorizationSnapshot }

export type OrganizationInfo = {
	organizationCode: string
	teamshareOrganizationCode?: string
	name: string
	logo?: string
}

export type OrganizationContext = {
	current: OrganizationInfo
	organizations: readonly OrganizationInfo[]
	switchOrganization?: (organizationCode: string) => Promise<void>
}

export type AccountInfo = {
	accountId: string
	name: string
	avatar?: string
	deployCode?: string
	platformName?: string
	organizations: readonly OrganizationInfo[]
}

export type AccountContext = {
	current: AccountInfo | null
	accounts: readonly AccountInfo[]
	switchAccountOrganization?: (accountId: string, organizationCode: string) => Promise<void>
	addAccount?: () => Promise<void> | void
	logoutAccount?: (accountId: string) => Promise<void>
}

export type UserInfo = {
	id: string
	name: string
	avatar?: string
}

export type Theme = "light" | "dark"

export type AccessContext = AuthorizationSnapshot & {
	user: UserInfo
	organization: OrganizationInfo
}

export type BridgeConfig = {
	mode: RuntimeMode
	apiClients: ApiClients
	capabilities: Capabilities
	auth: AuthState
	user: UserInfo | null
	organization: OrganizationContext
	account?: AccountContext
	language: Language
	onLanguageChange?: (language: Language) => void | Promise<void>
	/** 初始/宿主传入的主题。未传入时由 admin-v2 自己维护。 */
	theme?: Theme
	/** 宿主需要接管主题时使用；不传则主题切换仅作用于 admin-v2。 */
	onThemeChange?: (theme: Theme) => void | Promise<void>
	defaultTheme?: Theme
	/** Platform branding loaded by the host during public app initialization. */
	platformInfo?: PlatformInfoDetails
	onUnauthorized?: (error: ApiError) => void
}
