export const MEDIA_RESOURCE_IMAGE_EXTENSIONS = [
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".bmp",
	".svg",
] as const

export const MEDIA_RESOURCE_VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".avi", ".mkv"] as const

export const MEDIA_RESOURCE_AUDIO_EXTENSIONS = [
	".mp3",
	".wav",
	".ogg",
	".m4a",
	".aac",
	".flac",
] as const

export type MediaResourcePathKind = "image" | "video" | "audio" | "other"

export function getMediaResourcePathKind(path: string): MediaResourcePathKind {
	const lowerPath = path.toLowerCase()
	if (MEDIA_RESOURCE_IMAGE_EXTENSIONS.some((extension) => lowerPath.endsWith(extension))) {
		return "image"
	}
	if (MEDIA_RESOURCE_VIDEO_EXTENSIONS.some((extension) => lowerPath.endsWith(extension))) {
		return "video"
	}
	if (MEDIA_RESOURCE_AUDIO_EXTENSIONS.some((extension) => lowerPath.endsWith(extension))) {
		return "audio"
	}
	return "other"
}
