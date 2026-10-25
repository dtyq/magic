import type {
	EditionSessionData,
	LoadEditionSessionOptions,
} from "@magic-admin-v2/standalone/organization/types"

export async function loadEditionSession(
	options: LoadEditionSessionOptions,
): Promise<EditionSessionData> {
	void options
	return {
		isPersonalOrganization: false,
		hasTeamshareAllPermissions: false,
		organizations: [],
		teamsharePermissionKeys: [],
	}
}
