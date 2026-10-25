import type { MediaPreviewType } from "@/components/base/MediaPreview"

export type FileMentionRenderType = MediaPreviewType | "other"
export type FileMentionRenderFeature = "icon" | "tooltip"

/** 文件 Mention 的展示开关，覆盖图片、视频、音频和其他文件。 */
export interface FileMentionRenderConfig {
	/** 允许挂载文件 Icon 的类型；当前只有图片、视频挂载。 */
	icon?: readonly FileMentionRenderType[]
	/** 允许渲染媒体预览 Tooltip 的类型。 */
	tooltip?: readonly FileMentionRenderType[]
}

export const DEFAULT_FILE_MENTION_RENDER_CONFIG: Required<FileMentionRenderConfig> = {
	icon: ["image", "video"],
	tooltip: ["image", "video"],
}

export function getFileMentionRenderType(
	mediaType: MediaPreviewType | null | undefined,
): FileMentionRenderType {
	return mediaType ?? "other"
}

export function isFileMentionFeatureEnabled(
	feature: FileMentionRenderFeature,
	renderType: FileMentionRenderType,
	config: FileMentionRenderConfig = DEFAULT_FILE_MENTION_RENDER_CONFIG,
) {
	return (config[feature] ?? []).includes(renderType)
}
