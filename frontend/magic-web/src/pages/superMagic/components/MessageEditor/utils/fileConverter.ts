/**
 * Convert base64 string to File object
 * @param base64 - Base64 string (with or without data URI prefix)
 * @param fileName - Name for the created file
 * @returns File object
 */
export function base64ToFile(base64: string, fileName: string): File {
	// Remove data URI prefix if exists (e.g., "data:image/png;base64,")
	const base64Data = base64.includes(",") ? base64.split(",")[1] : base64

	// Decode base64 to binary string
	const binaryString = atob(base64Data)

	// Convert binary string to Uint8Array
	const bytes = new Uint8Array(binaryString.length)
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i)
	}

	// Determine MIME type from file extension or data URI
	let mimeType = "application/octet-stream"
	if (base64.includes("data:")) {
		const match = base64.match(/data:([^;]+);/)
		if (match) {
			mimeType = match[1]
		}
	} else {
		// Try to infer from file extension
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
			mimeType = mimeMap[ext] || mimeType
		}
	}

	// Create Blob and File
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
