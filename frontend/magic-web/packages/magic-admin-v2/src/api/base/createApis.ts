import type { ApiClients } from "@magic-admin-v2/api/types"
import { createContactOrganizationApi } from "@magic-admin-v2/api/contact-organization/api"
import { createDataDashboardContactApi } from "@magic-admin-v2/api/data-dashboard-contact/api"
import { createAppMenuApi } from "@magic-admin-v2/features/platform-app-menu/api"
import { createPlatformInfoApi } from "@magic-admin-v2/features/platform-info/api"
import { createPlatformModelApi } from "@magic-admin-v2/features/platform-model-list/api"
import { createPlatformOfficialMarketplaceApi } from "@magic-admin-v2/features/platform-official-marketplace/api"
import { createPlatformOfficialStaffApi } from "@magic-admin-v2/features/platform-official-staff/api"
import { createPlatformProviderApi } from "@magic-admin-v2/features/platform-provider-list/api"
import { createPlatformPublishReviewApi } from "@magic-admin-v2/features/platform-publish-review/api"
import { createPlatformSystemCapabilitiesApi } from "@magic-admin-v2/features/platform-system-capabilities/api"
import { createPlatformSlidesTemplateApi } from "@magic-admin-v2/features/platform-slides-template/api"

/**
 * Feature API factories are added here as their modules are migrated away from
 * the legacy request singleton. Keeping the base registry Magic-only prevents
 * open-source builds from acquiring enterprise service dependencies.
 */
export function createBaseApis(clients: Pick<ApiClients, "magic">) {
	return {
		appMenu: createAppMenuApi(clients.magic),
		contactOrganization: createContactOrganizationApi(clients.magic),
		dataDashboardContact: createDataDashboardContactApi(clients.magic),
		platformInfo: createPlatformInfoApi(clients.magic),
		platformModel: createPlatformModelApi(clients.magic),
		officialMarketplace: createPlatformOfficialMarketplaceApi(clients.magic),
		officialStaff: createPlatformOfficialStaffApi(clients.magic),
		platformProviders: createPlatformProviderApi(clients.magic),
		publishReview: createPlatformPublishReviewApi(clients.magic),
		systemCapabilities: createPlatformSystemCapabilitiesApi(clients.magic),
		slidesTemplate: createPlatformSlidesTemplateApi(clients.magic),
	}
}

export type BaseApis = ReturnType<typeof createBaseApis>
