import type { ImageProcessOptions } from "@/utils/image-processing"

/**
 * Canonical OSS rendition for small project-file images.
 *
 * Keep this contract shared by every thumbnail entry point so the same file,
 * scope, version, and rendition can reuse one temporary download URL.
 */
export const SHARED_MEDIA_THUMBNAIL_IMAGE_PROCESS: ImageProcessOptions = {
	resize: { w: 320, h: 320, m: "lfit" },
	quality: 45,
	format: "webp",
	autoOrient: 1,
}

export const SHARED_MEDIA_THUMBNAIL_RENDITION_KEY = "320x320-lfit-q45-webp-auto1"
