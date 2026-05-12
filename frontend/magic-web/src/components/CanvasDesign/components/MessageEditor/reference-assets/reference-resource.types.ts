import type { ReactNode } from "react"

export const REFERENCE_RESOURCE_TYPES = {
	image: "image",
	file: "file",
	video: "video",
	audio: "audio",
} as const

export type ReferenceResourceType =
	(typeof REFERENCE_RESOURCE_TYPES)[keyof typeof REFERENCE_RESOURCE_TYPES]

export type ReferenceResourceTypeFilter = ReferenceResourceType | ReferenceResourceType[]

export const REFERENCE_RESOURCE_SOURCE_TYPES = {
	localUpload: "local-upload",
	projectSelect: "project-select",
} as const

export type ReferenceResourceSourceType =
	(typeof REFERENCE_RESOURCE_SOURCE_TYPES)[keyof typeof REFERENCE_RESOURCE_SOURCE_TYPES]

export interface ReferenceResourceSourceOption {
	value: ReferenceResourceSourceType
	label: string
	disabled?: boolean
	/** 不传时由 ReferenceResourcePopover 按 value 使用默认图标 */
	icon?: ReactNode
}

export interface ReferenceResourceFileInfo {
	src: string
	fileName: string
	path: string
}

/** 单类型 min/max 范围，供拖入/上传/面板选择的限制门卫共用 */
export interface ReferenceAssetTypeRange {
	min: number
	max: number
}

/** 按资源类型划分的限制对象（与 VideoReferenceAssetLimits 鸭类型兼容） */
export interface ReferenceAssetPerTypeLimits {
	reference_images: ReferenceAssetTypeRange
	reference_videos: ReferenceAssetTypeRange
	reference_audios: ReferenceAssetTypeRange
	total: ReferenceAssetTypeRange
}

/** 当前已选各类型资源的数量快照 */
export interface ReferenceAssetTypeCounts {
	images: number
	videos: number
	audios: number
}

/** 文件所属的资源大类 */
export type ReferenceAssetFileClass = "image" | "video" | "audio" | "unknown"
