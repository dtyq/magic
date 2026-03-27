import type {
	AllowedPublishTargetType,
	PublishToType,
	SkillI18nText,
	SkillSourceType,
} from "@/apis/modules/skills"

export type SkillEditPublishStatus = "draft" | "published"

export interface SkillEditSkillInfo {
	id: string
	code: string
	name: string
	nameI18n: SkillI18nText
	description: string
	logo?: string
	versionCode?: string
	sourceType?: SkillSourceType
	publishStatus: SkillEditPublishStatus
	publishType?: PublishToType | null
	allowedPublishTargetTypes?: AllowedPublishTargetType[]
}

export interface SkillEditProjectInfo {
	id: string
	name: string
	coverLabel: string
}

export type SkillEditAttachmentKind = "file" | "folder"

export interface SkillEditAttachmentItem {
	id: string
	name: string
	kind: SkillEditAttachmentKind
	children?: SkillEditAttachmentItem[]
}
