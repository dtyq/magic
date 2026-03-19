import { isTosPublicImageUrl, buildResizeProcess } from "./tos-image"

/**
 * Get image URL with specified height (px)
 * For TOS images, applies resize transformation to get 2x resolution
 * @param logo Original logo URL
 * @param height Target height in pixels
 * @returns Processed logo URL with height transformation applied
 */

export function getImageUrlWithHeight(logo: string, height: number): string {
	if (isTosPublicImageUrl(logo)) {
		// Resize logo to specified height, get 2x image
		return `${logo}?x-tos-process=image/${buildResizeProcess({ h: height })}`
	}
	return logo
}
