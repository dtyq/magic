import { loadEditionSession } from "@magic-admin-v2/standalone/organization/edition"
import type {
	ContactOrganization,
	LoadStandaloneSessionOptions,
	MagicOrganization,
	StandaloneSession,
} from "@magic-admin-v2/standalone/organization/types"

const magicOrganizationStatusUrl = "/api/v1/auth/status?login_code="
const contactOrganizationsUrl = "/api/v1/contact/accounts/me/organizations"
const accountUserInfoUrl = "/api/v1/contact/accounts/me/users"
const officialOrganizationInfoUrl = "/api/v1/admin/service-providers/office-info"
const permissionListUrl = "/api/v1/permissions/me"

type AccountUser = {
	avatar?: string
	avatar_url?: string
	magic_id?: string
	nickname?: string
	real_name?: string
	user_id?: string
}

export async function loadStandaloneSession({
	clients,
	config,
	context,
	organizationCode,
}: LoadStandaloneSessionOptions): Promise<StandaloneSession> {
	const magicOrganizations = await clients.magic
		.get<MagicOrganization[]>(magicOrganizationStatusUrl)
		.catch(() => [])
	const requestedOrganizationCode =
		organizationCode ||
		context.getMagicOrganizationCode() ||
		magicOrganizations[0]?.magic_organization_code ||
		""

	if (!requestedOrganizationCode) {
		throw new Error("STANDALONE_ORGANIZATION_REQUIRED")
	}

	const currentOrganization =
		magicOrganizations.find(
			(organization) => organization.magic_organization_code === requestedOrganizationCode,
		) ?? createFallbackOrganization(requestedOrganizationCode, config)
	context.setOrganization({
		magicOrganizationCode: currentOrganization.magic_organization_code,
		teamshareOrganizationCode:
			currentOrganization.third_platform_organization_code ||
			config.teamshareOrganizationCode,
	})

	const [
		contactOrganizationsResult,
		accountUsersResult,
		officialOrganizationResult,
		permissionListResult,
		edition,
	] = await Promise.all([
		clients.magic
			.get<{ items?: ContactOrganization[] }>(contactOrganizationsUrl)
			.catch(() => ({ items: [] })),
		clients.magic
			.get<{ items?: AccountUser[] }>(accountUserInfoUrl)
			.catch(() => ({ items: [] })),
		clients.magic
			.get<{ is_official?: boolean }>(officialOrganizationInfoUrl)
			.catch(() => ({ is_official: false })),
		clients.magic
			.get<{ permission_key?: string[] }>(permissionListUrl)
			.catch(() => ({ permission_key: [] })),
		loadEditionSession({
			clients,
			context,
			currentOrganization,
			magicOrganizations:
				magicOrganizations.length > 0 ? magicOrganizations : [currentOrganization],
		}),
	])
	const contactOrganizations = contactOrganizationsResult.items ?? []
	const contactOrganizationByCode = new Map(
		contactOrganizations.map((organization) => [
			organization.magic_organization_code,
			organization,
		]),
	)
	const editionOrganizationByCode = new Map(
		edition.organizations.map((organization) => [organization.organizationCode, organization]),
	)
	const organizations = (
		magicOrganizations.length > 0 ? magicOrganizations : [currentOrganization]
	).map((organization) => {
		const contactOrganization = contactOrganizationByCode.get(
			organization.magic_organization_code,
		)
		const editionOrganization = editionOrganizationByCode.get(
			organization.magic_organization_code,
		)
		return {
			organizationCode: organization.magic_organization_code,
			teamshareOrganizationCode:
				editionOrganization?.teamshareOrganizationCode ||
				organization.third_platform_organization_code ||
				organization.magic_organization_code,
			logo: organization.organization_logo || editionOrganization?.logo || undefined,
			name:
				contactOrganization?.name ||
				editionOrganization?.name ||
				organization.organization_name ||
				organization.magic_organization_code,
		}
	})
	const runtimeCurrentOrganization =
		organizations.find(
			(organization) =>
				organization.organizationCode === currentOrganization.magic_organization_code,
		) ?? organizations[0]
	const magicPermissionKeys = permissionListResult.permission_key ?? []
	const contactCurrentOrganization = contactOrganizationByCode.get(
		currentOrganization.magic_organization_code,
	)
	const accountUser = accountUsersResult.items?.[0]

	return {
		authorization: {
			organizationCode: runtimeCurrentOrganization.organizationCode,
			hasTeamshareAllPermissions: edition.hasTeamshareAllPermissions,
			isOfficialOrganization: officialOrganizationResult.is_official === true,
			isPersonalOrganization:
				edition.isPersonalOrganization ||
				contactCurrentOrganization?.organization_type === 1,
			magicPermissionKeys,
			teamsharePermissionKeys: edition.teamsharePermissionKeys,
		},
		currentOrganization: runtimeCurrentOrganization,
		organizations,
		user:
			edition.user ||
			(accountUser
				? {
						id: accountUser.user_id || accountUser.magic_id || config.userId,
						name:
							accountUser.real_name ||
							accountUser.nickname ||
							accountUser.user_id ||
							config.userName,
						avatar: accountUser.avatar || accountUser.avatar_url || undefined,
					}
				: {
						id: config.userId,
						name: config.userName,
						avatar: config.userAvatar || undefined,
					}),
	}
}

function createFallbackOrganization(
	organizationCode: string,
	config: LoadStandaloneSessionOptions["config"],
): MagicOrganization {
	return {
		magic_organization_code: organizationCode,
		organization_name: organizationCode,
		third_platform_organization_code: config.teamshareOrganizationCode || organizationCode,
	}
}
