import type { MediaResourcePathKind } from "../../../runtime/resources/media-common/mediaResourcePathKind"
import type { CropConfig } from "../../../runtime/document/types"

export type PreviewableMediaResourceKind = Exclude<MediaResourcePathKind, "other">

export interface MediaResourceFullscreenPreviewItem {
	path: string
	fileName: string
	kind: PreviewableMediaResourceKind
	crop?: CropConfig
	/**
	 * 直接可用的预览 URL（如资产库签名 file_url）。
	 * 传入后跳过画布 workspace path 解析，复用同一套全屏壳。
	 */
	previewSrc?: string
}
