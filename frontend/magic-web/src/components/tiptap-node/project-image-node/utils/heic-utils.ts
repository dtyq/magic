/**
 * Utilities for detecting and converting HEIC/HEIF images
 * Browsers (except Safari on Apple platforms) cannot render HEIC natively.
 * We detect HEIC URLs or magic-bytes and convert to JPEG via heic2any.
 */

const HEIC_EXTENSIONS = /\.(heic|heif)$/i

/**
 * Returns true when the URL path suggests a HEIC/HEIF image.
 * Strip query-string before checking the extension.
 */
export function isHeicUrl(url: string): boolean {
	try {
		const pathname = new URL(url).pathname
		return HEIC_EXTENSIONS.test(pathname)
	} catch {
		// Relative paths or non-standard URLs
		return HEIC_EXTENSIONS.test(url.split("?")[0])
	}
}

/**
 * Check the first 12 bytes of an ArrayBuffer for HEIC/HEIF magic bytes.
 * HEIC files start with an ftyp box whose brand is one of:
 * heic, heix, hevc, hevx, mif1, msf1, avif, avis …
 */
export function isHeicBuffer(buffer: ArrayBuffer): boolean {
	const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 12))
	// bytes 4-7 are the box type ("ftyp")
	const boxType = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7])
	if (boxType !== "ftyp") return false
	const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
	return /^(heic|heix|hevc|hevx|mif1|msf1)/.test(brand)
}

// Cache converted blob URLs to avoid redundant conversions
const heicBlobCache = new Map<string, string>()

/**
 * Convert a HEIC/HEIF image URL to a JPEG blob URL.
 * Returns the original URL unchanged when conversion is unnecessary or fails.
 *
 * @param url - The resolved image URL (absolute)
 * @returns A JPEG blob URL, or the original URL if not HEIC / on failure
 */
export async function convertHeicUrlToBlob(url: string): Promise<string> {
	if (heicBlobCache.has(url)) {
		return heicBlobCache.get(url)!
	}

	try {
		const response = await fetch(url)
		if (!response.ok) return url

		const buffer = await response.arrayBuffer()

		// Double-check: if URL extension wasn't HEIC but magic bytes confirm it
		const probablyHeic = isHeicUrl(url) || isHeicBuffer(buffer)
		if (!probablyHeic) return url

		const blob = new Blob([buffer])

		// Dynamically import heic2any to keep it out of the initial bundle
		const heic2any = (await import("heic2any")).default

		const converted = await heic2any({
			blob,
			toType: "image/jpeg",
			quality: 0.92,
		})

		const outputBlob = Array.isArray(converted) ? converted[0] : converted
		const blobUrl = URL.createObjectURL(outputBlob)

		heicBlobCache.set(url, blobUrl)
		return blobUrl
	} catch {
		// Conversion failed – fall back to original URL and let the browser handle it
		return url
	}
}
