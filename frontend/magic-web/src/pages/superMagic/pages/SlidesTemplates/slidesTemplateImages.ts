import {
	buildFormatProcess,
	buildQualityProcess,
	buildResizeProcess,
	combineProcesses,
	isTosPublicImageUrl,
} from "@/utils/tos-image"

const CARD_IMAGE_WIDTH = 720
const PREVIEW_IMAGE_WIDTH = 1920

function applyTosImageProcess(imageUrl: string | undefined, width: number, quality: number) {
	if (!imageUrl || !isTosPublicImageUrl(imageUrl)) return imageUrl

	const process = combineProcesses([
		buildResizeProcess({ w: width }),
		buildQualityProcess({ Q: quality }),
		buildFormatProcess({ format: "webp" }),
	])
	if (!process) return imageUrl

	try {
		const url = new URL(imageUrl)
		url.searchParams.set("x-tos-process", process)
		return url.toString()
	} catch {
		return imageUrl
	}
}

export function getSlidesTemplateCardImageUrl(imageUrl: string | undefined) {
	return applyTosImageProcess(imageUrl, CARD_IMAGE_WIDTH, 82)
}

/**
 * Normalizes every image used by the detail preview to one full-preview variant.
 * The same URL is shared by the stage, ambient background, preloader, and thumbnail rail.
 */
export function getSlidesTemplatePreviewImageUrl(imageUrl: string | undefined) {
	return applyTosImageProcess(imageUrl, PREVIEW_IMAGE_WIDTH, 84)
}
