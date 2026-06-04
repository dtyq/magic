/**
 * Infer MIME type from a base64 data URI or file extension.
 */
function inferMimeType(base64: string, fileName: string): string {
	if (base64.includes("data:")) {
		const match = base64.match(/data:([^;]+);/)
		if (match) return match[1]
	}
	const ext = fileName.split(".").pop()?.toLowerCase()
	if (ext) {
		const mimeMap: Record<string, string> = {
			jpg: "image/jpeg",
			jpeg: "image/jpeg",
			png: "image/png",
			gif: "image/gif",
			webp: "image/webp",
			pdf: "application/pdf",
			txt: "text/plain",
			json: "application/json",
			mp3: "audio/mpeg",
			mp4: "video/mp4",
			mov: "video/quicktime",
			m4a: "audio/mp4",
		}
		if (mimeMap[ext]) return mimeMap[ext]
	}
	return "application/octet-stream"
}

/**
 * Convert base64 string to File object (async version).
 * Uses fetch() to decode base64 which is non-blocking, avoids atob() memory
 * duplication, and works efficiently for large files.
 * @param base64 - Base64 string (with or without data URI prefix)
 * @param fileName - Name for the created file
 * @returns File object
 */
export async function base64ToFile(base64: string, fileName: string): Promise<File> {
	const mimeType = inferMimeType(base64, fileName)

	// Build a proper data URI for fetch-based decoding
	const dataUri = base64.includes("data:")
		? base64
		: `data:${mimeType};base64,${base64}`

	// fetch(dataURI) decodes base64 off the main thread, avoiding atob + loop overhead
	const res = await fetch(dataUri)
	const blob = await res.blob()

	return new File([blob], fileName, { type: mimeType })
}

/**
 * @deprecated Use the async version of base64ToFile instead.
 * Synchronous base64 to File conversion — kept for backward compatibility
 * with callers that cannot use async/await.
 */
export function base64ToFileSync(base64: string, fileName: string): File {
	const base64Data = base64.includes(",") ? base64.split(",")[1] : base64
	const binaryString = atob(base64Data)
	const bytes = new Uint8Array(binaryString.length)
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i)
	}
	const mimeType = inferMimeType(base64, fileName)
	const blob = new Blob([bytes], { type: mimeType })
	return new File([blob], fileName, { type: mimeType })
}

/**
 * Extract file name from file path
 * @param filePath - File path (e.g., "file://var/mobile/.../document.pdf")
 * @returns File name
 */
export function extractFileNameFromPath(filePath: string): string {
	// Extract the last segment after the last slash
	const segments = filePath.split("/")
	const fileName = segments[segments.length - 1]

	// Decode URI components if needed
	try {
		return decodeURIComponent(fileName)
	} catch (error) {
		return fileName
	}
}
