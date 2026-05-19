import type { MediaResourcePathKind } from "../../canvas/utils/mediaResourcePathKind"

export type PreviewableMediaResourceKind = Exclude<MediaResourcePathKind, "other">

export interface MediaResourceFullscreenPreviewItem {
	path: string
	fileName: string
	kind: PreviewableMediaResourceKind
}
