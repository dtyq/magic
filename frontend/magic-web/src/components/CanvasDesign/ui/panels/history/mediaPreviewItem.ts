import { getMediaResourcePathKind } from "../../../runtime/resources/media-common/mediaResourcePathKind"
import type { CanvasAssetMediaType } from "../../../public/magic-types"
import type { MediaResourceFullscreenPreviewItem } from "../../fullscreen/media-resource/index"
import { getFullscreenMediaFileLabel } from "../../fullscreen/shell/getFullscreenMediaFileLabel"

export function buildPreviewMediaResourceItem(
	path: string,
	mediaType?: CanvasAssetMediaType | null,
): MediaResourceFullscreenPreviewItem | null {
	const kind = getMediaResourcePathKind(path, { mediaType })
	if (kind === "other") return null
	return {
		path,
		fileName: getFullscreenMediaFileLabel(path),
		kind,
	}
}
