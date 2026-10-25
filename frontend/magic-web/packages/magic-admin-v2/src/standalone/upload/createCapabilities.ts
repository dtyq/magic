import type { ApiClients } from "@magic-admin-v2/api/types"
import { BaseRequestUrl } from "@magic-admin-v2/api/constants/base"
import { createUploadCapabilities } from "@magic-admin-v2/capabilities/upload"
import type { StandaloneRequestContext } from "@magic-admin-v2/standalone/api/context"
import type { StandaloneConfig } from "@magic-admin-v2/standalone/config"

export function createStandaloneUploadCapabilities({
	clients,
	config,
	context,
}: {
	clients: ApiClients
	config: StandaloneConfig
	context: StandaloneRequestContext
}) {
	return createUploadCapabilities({
		client: clients.magic,
		getPublicImageUploadContext: () => {
			const organizationCode = context.getMagicOrganizationCode()
			return {
				authorization: context.getMagicAuthorization(),
				language: context.getLanguage(),
				organizationCode,
				uploadUrl: createUploadUrl(config.magicBaseUrl, organizationCode),
			}
		},
	})
}

function createUploadUrl(baseUrl: string, organizationCode: string) {
	const endpoint = `${BaseRequestUrl.temporaryCredential}?organization_code=${encodeURIComponent(
		organizationCode,
	)}`
	return baseUrl ? `${baseUrl.replace(/\/$/, "")}${endpoint}` : endpoint
}
