import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"
import type { SlidesTemplateItem } from "@/pages/superMagic/components/MainInputContainer/scenes/Slides/slidesTemplateState"

const SLIDES_TEMPLATE_UPLOAD_API_PATH = "/api/v1/slides-templates/from-project"
export const SLIDES_TEMPLATE_UPLOAD_API_ENABLED = Boolean(SLIDES_TEMPLATE_UPLOAD_API_PATH)

export interface UploadSlidesTemplateFromFolderParams {
	projectId: string
	directoryId: string
	code?: string
}

export class SlidesTemplateUploadApiUnavailableError extends Error {
	constructor() {
		super("Slides template upload API is not configured")
		this.name = "SlidesTemplateUploadApiUnavailableError"
	}
}

export const generateSlidesTemplateUploadApi = (client: ServiceHttpClient) => ({
	enabled: SLIDES_TEMPLATE_UPLOAD_API_ENABLED,

	async saveFromFolder(input: UploadSlidesTemplateFromFolderParams) {
		if (!SLIDES_TEMPLATE_UPLOAD_API_PATH) {
			throw new SlidesTemplateUploadApiUnavailableError()
		}

		return client.post<SlidesTemplateItem>(SLIDES_TEMPLATE_UPLOAD_API_PATH, {
			project_id: input.projectId,
			directory_id: input.directoryId,
			...(input.code ? { code: input.code } : {}),
		})
	},
})
