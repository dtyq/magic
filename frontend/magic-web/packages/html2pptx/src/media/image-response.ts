/**
 * Validate a fetched image by its payload instead of trusting a URL suffix or
 * an incorrect server Content-Type. CDN login pages commonly return 200
 * text/html for an image URL; accepting that response only moves the failure
 * into PptxGenJS and aborts the whole presentation.
 */
export async function validateImageBlobResponse(
	blob: Blob,
	sourceHint: string,
	declaredContentType?: string,
	fallbackContentType?: string,
): Promise<Blob> {
	const declared = normalizeMime(declaredContentType)
	const blobType = normalizeMime(blob.type)
	if (declared === "text/html" || blobType === "text/html") {
		throw new TypeError(`Image response is HTML instead of an image: ${sourceHint}`)
	}

	const header = new Uint8Array(await blob.slice(0, 512).arrayBuffer())
	const detected = detectImageContentType(header)
	if (!detected) {
		throw new TypeError(`Image response has an unsupported or invalid payload: ${sourceHint}`)
	}

	// Payload signatures are authoritative. This prevents a URL ending in
	// .png from making an HTML/login response look like image/png.
	const contentType = detected || blobType || declared || normalizeMime(fallbackContentType)
	return blob.type === contentType ? blob : blob.slice(0, blob.size, contentType)
}

/** Detect the formats PowerPoint packaging supports without decoding pixels. */
export function detectImageContentType(bytes: Uint8Array): string | undefined {
	if (matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png"
	if (matches(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg"
	if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") return "image/gif"
	if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp"

	const text = new TextDecoder().decode(bytes).replace(/^\uFEFF/, "").trimStart().toLowerCase()
	if (text.startsWith("<?xml") || text.startsWith("<svg") || text.startsWith("<!doctype svg")) {
		return "image/svg+xml"
	}
	return undefined
}

function normalizeMime(value?: string): string {
	return value?.split(";", 1)[0]?.trim().toLowerCase() || ""
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
	return String.fromCharCode(...bytes.subarray(offset, offset + length))
}

function matches(bytes: Uint8Array, signature: number[]): boolean {
	return signature.every((value, index) => bytes[index] === value)
}
