import type { AttachmentItem } from "../../../TopicFilesButton/hooks/types"

export interface SlidesTemplateLocalizedText {
	zh_CN?: string
	en_US?: string
	[key: string]: string | undefined
}

export interface SlidesTemplateManifestSlide {
	file: string
	title: string
	layout: string
	description: string
	[key: string]: unknown
}

export interface SlidesTemplateManifest {
	schema_version: "1.0"
	template_id?: string
	category_code?: string
	tag_codes?: string[]
	label?: SlidesTemplateLocalizedText
	description?: SlidesTemplateLocalizedText
	files: {
		slides_dir: "slides"
		[key: string]: unknown
	}
	slides: SlidesTemplateManifestSlide[]
	[key: string]: unknown
}

export interface SlidesTemplatePPTModel {
	rootFileId: string
	rootPath: string
	manifestFileId: string
	slidePaths: string[]
	manifest: SlidesTemplateManifest
	displayConfig: {
		type: "slide"
		slides: string[]
	}
}

export interface SlidesTemplateProjectContext extends SlidesTemplatePPTModel {
	root: AttachmentItem
	manifestFile: AttachmentItem
	slidesDirectory: AttachmentItem
	slideFiles: Map<string, AttachmentItem>
}
