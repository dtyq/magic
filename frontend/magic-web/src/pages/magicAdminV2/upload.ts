import { createUploadCapabilities } from "@dtyq/magic-admin-v2/upload"
import { defaultMagicClient as magicClient } from "@/infrastructure/network/http/runtime"
import { configStore } from "@/models/config"
import { userStore } from "@/models/user"
import { env } from "@/utils/env"
import { genRequestUrl } from "@/utils/http"
import { getCurrentLang } from "@/utils/locale"

const capabilities = createUploadCapabilities({
	client: magicClient,
	getPublicImageUploadContext: () => {
		const organizationCode = userStore.user.organizationCode.trim()
		return {
			authorization: userStore.user.authorization?.trim() ?? "",
			language: getCurrentLang(configStore.i18n.displayLanguage),
			organizationCode,
			uploadUrl: `${env("MAGIC_SERVICE_BASE_URL")}${genRequestUrl(
				"/api/v1/file/temporary-credential",
			)}?organization_code=${encodeURIComponent(organizationCode)}`,
		}
	},
})

export const { uploadFile, uploadPublicImage } = capabilities
