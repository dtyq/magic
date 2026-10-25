import type { User } from "@/types/user"

interface OrganizationOption {
	organization?: User.UserOrganization
	magicOrganization?: User.MagicOrganization
}

/** Third-party metadata enriches rows; it must not hide available Magic organizations. */
export function getAccountOrganizationOptions(account: User.UserAccount): OrganizationOption[] {
	const organizations = account.organizations ?? []
	const metadata = account.teamshareOrganizations ?? []
	const options: OrganizationOption[] = metadata.map((organization) => ({
		organization,
		magicOrganization: organizations.find(
			(item) => item.third_platform_organization_code === organization.organization_code,
		),
	}))
	const matchedCodes = new Set(metadata.map((item) => item.organization_code))
	for (const magicOrganization of organizations) {
		if (!matchedCodes.has(magicOrganization.third_platform_organization_code)) {
			options.push({ magicOrganization })
		}
	}
	return options
}
