import type { SlidesTemplateManifestSlide } from "./types"

export interface SlidesTemplateSettingsFormState {
	categoryCode: string
	descriptionEn: string
	descriptionZh: string
	labelEn: string
	labelZh: string
	slides: SlidesTemplateManifestSlide[]
	tagCodes: string[]
}

export type SlidesTemplateSettingsFormErrors = Record<string, string>
