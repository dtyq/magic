import { SuperMagicApi } from "@/apis"
import { SLIDES_TEMPLATE_UPLOAD_API_ENABLED } from "@/apis/modules/slidesTemplateUpload"
import { createRandomUuidV4 } from "@/utils/create-random-uuid-v4"
import type {
	SlidesTemplateCodeAvailability,
	SlidesTemplateItem,
} from "@/pages/superMagic/components/MainInputContainer/scenes/Slides/slidesTemplateState"
import { SLIDES_TEMPLATE_IMAGE_PROCESS } from "@/pages/superMagic/components/MainInputContainer/scenes/Slides/slidesTemplateState"

export type MySlidesTemplateSection = "created" | "favorites" | "used"

export interface MySlidesTemplatePage {
	items: SlidesTemplateItem[]
	page: number
	pageSize: number
	hasMore: boolean
}

export interface MySlidesTemplateListParams {
	page: number
	pageSize: number
	keyword?: string
}

export interface MySlidesTemplateAdapter {
	enabled: boolean
	saveEnabled: boolean
	listMine(params: MySlidesTemplateListParams): Promise<MySlidesTemplatePage>
	listFavorites(params: MySlidesTemplateListParams): Promise<MySlidesTemplatePage>
	listUsed(params: MySlidesTemplateListParams): Promise<MySlidesTemplatePage>
	checkByCode(input: { code: string }): Promise<{ status: SlidesTemplateCodeAvailability }>
	loadDetail(code: string): Promise<SlidesTemplateItem>
	favorite(code: string): Promise<void>
	unfavorite(code: string): Promise<void>
	remove(code: string): Promise<void>
	saveFromFolder(input: {
		projectId: string
		directoryId: string
		code?: string
	}): Promise<SlidesTemplateItem>
}

export class MySlidesTemplateAdapterUnavailableError extends Error {
	constructor() {
		super("My slides template upload adapter is not configured")
		this.name = "MySlidesTemplateAdapterUnavailableError"
	}
}

const changedListeners = new Set<() => void>()

export function subscribeMySlidesTemplatesChanged(listener: () => void) {
	changedListeners.add(listener)
	return () => {
		changedListeners.delete(listener)
	}
}

function notifyMySlidesTemplatesChanged() {
	changedListeners.forEach((listener) => listener())
}

export async function createAvailableSlidesTemplateCode() {
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const code = `SLIDE-${createRandomUuidV4().replace(/-/g, "").slice(0, 16).toUpperCase()}`
		const availability = await mySlidesTemplateAdapter.checkByCode({ code })
		if (availability.status === "UNUSED") return code
	}
	throw new Error("Failed to generate an available slide template code")
}

function toPage(response: {
	page: number
	page_size: number
	list: SlidesTemplateItem[]
}): MySlidesTemplatePage {
	return {
		items: response.list ?? [],
		page: response.page,
		pageSize: response.page_size,
		hasMore: (response.list?.length ?? 0) >= response.page_size,
	}
}

export const mySlidesTemplateAdapter: MySlidesTemplateAdapter = {
	enabled: true,
	saveEnabled: SLIDES_TEMPLATE_UPLOAD_API_ENABLED,

	async listMine({ page, pageSize, keyword }) {
		const response = await SuperMagicApi.getSlidesTemplates(
			{
				scope: "user",
				page,
				page_size: pageSize,
				...(keyword ? { keyword } : {}),
			},
			{ xMagicImageProcess: SLIDES_TEMPLATE_IMAGE_PROCESS },
		)
		return toPage(response)
	},

	async listFavorites({ page, pageSize, keyword }) {
		return toPage(
			await SuperMagicApi.getFavoriteSlidesTemplates(
				{
					page,
					page_size: pageSize,
					...(keyword ? { keyword } : {}),
				},
				{ xMagicImageProcess: SLIDES_TEMPLATE_IMAGE_PROCESS },
			),
		)
	},

	async listUsed({ page, pageSize }) {
		return toPage(
			await SuperMagicApi.getUsedSlidesTemplates(
				{ page, page_size: pageSize },
				{ xMagicImageProcess: SLIDES_TEMPLATE_IMAGE_PROCESS },
			),
		)
	},

	async checkByCode({ code }) {
		return SuperMagicApi.getSlidesTemplateCodeAvailability(code)
	},

	async loadDetail(code) {
		return SuperMagicApi.getSlidesTemplateDetail(code, {
			xMagicImageProcess: SLIDES_TEMPLATE_IMAGE_PROCESS,
		})
	},

	async favorite(code) {
		await SuperMagicApi.favoriteSlidesTemplate(code)
	},

	async unfavorite(code) {
		await SuperMagicApi.unfavoriteSlidesTemplate(code)
	},

	async remove(code) {
		await SuperMagicApi.deleteSlidesTemplate(code)
		notifyMySlidesTemplatesChanged()
	},

	async saveFromFolder(input) {
		if (!SLIDES_TEMPLATE_UPLOAD_API_ENABLED) {
			throw new MySlidesTemplateAdapterUnavailableError()
		}
		const { SlidesTemplateUploadApi } = await import("@/apis")
		const template = await SlidesTemplateUploadApi.saveFromFolder(input)
		notifyMySlidesTemplatesChanged()
		return template
	},
}
