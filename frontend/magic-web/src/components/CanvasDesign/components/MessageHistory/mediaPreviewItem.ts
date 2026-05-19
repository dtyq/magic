import { getMediaResourcePathKind } from "../../canvas/utils/mediaResourcePathKind"
import type { MediaResourceFullscreenPreviewItem } from "../MediaResourceFullscreenPreview"

export function buildPreviewMediaResourceItem(
	path: string,
): MediaResourceFullscreenPreviewItem | null {
	const kind = getMediaResourcePathKind(path)
	if (kind === "other") return null
	return {
		path,
		fileName: path.split("/").pop() ?? path,
		kind,
	}
}
