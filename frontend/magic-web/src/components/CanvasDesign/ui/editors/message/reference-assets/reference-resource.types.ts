import type { ReactNode } from "react"
import type { ResolvedCanvasResourceReference } from "../../../../public/resource-reference"

export const REFERENCE_RESOURCE_TYPES = {
	image: "image",
	file: "file",
	video: "video",
	audio: "audio",
} as const

export type ReferenceResourceType =
	(typeof REFERENCE_RESOURCE_TYPES)[keyof typeof REFERENCE_RESOURCE_TYPES]

export type ReferenceResourceTypeFilter = ReferenceResourceType | ReferenceResourceType[]

/** 参考资源可参与生成请求的媒体类型。 */
export type ReferenceResourceAssetType = "image" | "video" | "audio"

/**
 * 参考资源的运行时描述。
 *
 * `path` 是唯一需要持久化/提交的值；其余字段只用于当前编辑会话中的
 * identity 比较、展示和类型决策，避免把 opaque URI 当作文件路径处理。
 */
export interface ReferenceResourceDescriptor {
	path: string
	identity: string
	resourceKind: ResolvedCanvasResourceReference["resourceKind"]
	fileName: string
	src: string
	assetType?: ReferenceResourceAssetType
}

export const REFERENCE_RESOURCE_SOURCE_TYPES = {
	localUpload: "local-upload",
	projectSelect: "project-select",
	assets: "assets",
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
