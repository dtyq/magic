import type { ImageProcessOptions } from "@/utils/image-processing"

/** Card content images displayed in phone-frame views (feed, detail, scroll). */
export const CARD_IMAGE_PROCESS: ImageProcessOptions = {
	resize: { w: 800, m: "lfit" },
	quality: 85,
	format: "webp",
}

/** Card thumbnails in the edit sidebar (~200px wide). */
export const CARD_THUMBNAIL_IMAGE_PROCESS: ImageProcessOptions = {
	resize: { w: 400, m: "lfit" },
	quality: 80,
	format: "webp",
}
