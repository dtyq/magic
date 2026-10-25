import type { AssetItem, AssetMediaType } from "@/apis"
import type { MediaResourceFullscreenPreviewItem } from "../../fullscreen/media-resource/types"

const IMAGE_EXTENSIONS = new Set([
	"jpg",
	"jpeg",
	"png",
	"webp",
	"bmp",
	"tif",
	"tiff",
	"gif",
	"heic",
	"heif",
])

const VIDEO_EXTENSIONS = new Set(["mp4", "mov"])

export type AssetLibraryMediaFilter = "ALL" | "IMAGE" | "VIDEO"

export type AssetLibraryUploadMode = "save" | "verify"

export function canFilterAssetLibraryMedia(mediaTypes: readonly AssetMediaType[]): boolean {
	return mediaTypes.includes("IMAGE") && mediaTypes.includes("VIDEO")
}

export function canUploadAssetLibraryMedia(mediaTypes: readonly AssetMediaType[]): boolean {
	return mediaTypes.includes("IMAGE") || mediaTypes.includes("VIDEO")
}

export function resolveAssetLibraryQueryMediaTypes(
	mediaTypes: readonly AssetMediaType[],
	filter: AssetLibraryMediaFilter,
): AssetMediaType[] {
	if (!canFilterAssetLibraryMedia(mediaTypes) || filter === "ALL") return [...mediaTypes]
	const selected = mediaTypes.filter((mediaType) => mediaType === filter)
	return selected.length > 0 ? selected : [...mediaTypes]
}

export function getAssetFileExtension(fileName: string): string {
	const extension = fileName.split(".").pop()?.toLowerCase() ?? ""
	return extension === fileName.toLowerCase() ? "" : extension
}

export function resolveUploadAssetMediaType(
	fileName: string,
	allowedMediaTypes: readonly AssetMediaType[],
): AssetMediaType | null {
	const extension = getAssetFileExtension(fileName)
	if (IMAGE_EXTENSIONS.has(extension) && allowedMediaTypes.includes("IMAGE")) return "IMAGE"
	if (VIDEO_EXTENSIONS.has(extension) && allowedMediaTypes.includes("VIDEO")) return "VIDEO"
	return null
}

export function getAssetUploadAccept(mediaTypes: readonly AssetMediaType[]): string {
	const accept: string[] = []
	if (mediaTypes.includes("IMAGE")) {
		accept.push(
			"image/jpeg",
			"image/png",
			"image/webp",
			"image/bmp",
			"image/tiff",
			"image/gif",
			"image/heic",
			"image/heif",
			".jpg",
			".jpeg",
			".png",
			".webp",
			".bmp",
			".tif",
			".tiff",
			".gif",
			".heic",
			".heif",
		)
	}
	if (mediaTypes.includes("VIDEO")) {
		accept.push("video/mp4", "video/quicktime", ".mp4", ".mov")
	}
	return accept.join(",")
}

export function getAssetDisplayName(fileName: string): string {
	const extension = getAssetFileExtension(fileName)
	if (!extension) return fileName
	return fileName.slice(0, -(extension.length + 1)) || fileName
}

export function formatAssetDuration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return ""
	const totalSeconds = Math.round(seconds)
	const minutes = Math.floor(totalSeconds / 60)
	const remainSeconds = totalSeconds % 60
	return `${String(minutes).padStart(2, "0")}:${String(remainSeconds).padStart(2, "0")}`
}

/** 将资产库条目转为画布全屏预览项；未知媒体类型不猜测为图片。 */
export function toAssetLibraryFullscreenPreviewItem(
	asset: AssetItem,
): MediaResourceFullscreenPreviewItem | null {
	const previewSrc = asset.file_url?.trim()
	if (!previewSrc || !asset.asset_media_type) return null

	const kind =
		asset.asset_media_type === "VIDEO"
			? "video"
			: asset.asset_media_type === "AUDIO"
				? "audio"
				: asset.asset_media_type === "IMAGE"
					? "image"
					: null
	if (!kind) return null

	return {
		path: previewSrc,
		fileName: asset.name,
		kind,
		previewSrc,
	}
}
