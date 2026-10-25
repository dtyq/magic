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

const BASE64_YIELD_THRESHOLD = 1024 * 1024
const BASE64_DECODE_CHUNK_SIZE = 32 * 1024
export const MAX_BASE64_FILE_BYTES = 100 * 1024 * 1024

function getBase64Payload(base64: string): string {
	const separatorIndex = base64.indexOf(",")
	if (separatorIndex < 0) return base64

	const metadata = base64.slice(0, separatorIndex)
	if (!/^data:[^,]*;base64$/i.test(metadata.trim())) {
		throw new Error("Invalid base64 data URL")
	}
	return base64.slice(separatorIndex + 1)
}

function normalizeBase64Payload(base64: string): string {
	const payload = getBase64Payload(base64).replace(/[\t\n\f\r ]/g, "")
	if (!/^[A-Za-z0-9+/]*={0,2}$/.test(payload) || payload.length % 4 === 1) {
		throw new Error("Invalid base64 payload")
	}
	const paddingLength = payload.length - payload.replace(/=+$/, "").length
	if (paddingLength > 0 && payload.length % 4 !== 0) {
		throw new Error("Invalid base64 payload")
	}
	return payload.padEnd(Math.ceil(payload.length / 4) * 4, "=")
}

function getDecodedByteLength(payload: string): number {
	if (!payload) return 0
	const paddingLength = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0
	return (payload.length / 4) * 3 - paddingLength
}

function decodeBase64Character(value: string): number {
	if (value >= "A" && value <= "Z") return value.charCodeAt(0) - 65
	if (value >= "a" && value <= "z") return value.charCodeAt(0) - 71
	if (value >= "0" && value <= "9") return value.charCodeAt(0) + 4
	if (value === "+") return 62
	if (value === "/") return 63
	return 0
}

function decodeBase64Chunk(
	payload: string,
	start: number,
	end: number,
	output: Uint8Array,
	outputOffset: number,
): number {
	for (let offset = start; offset < end; offset += 4) {
		const first = decodeBase64Character(payload[offset])
		const second = decodeBase64Character(payload[offset + 1])
		const third = payload[offset + 2] === "=" ? 0 : decodeBase64Character(payload[offset + 2])
		const fourth = payload[offset + 3] === "=" ? 0 : decodeBase64Character(payload[offset + 3])

		output[outputOffset++] = (first << 2) | (second >> 4)
		if (outputOffset < output.length)
			output[outputOffset++] = ((second & 15) << 4) | (third >> 2)
		if (outputOffset < output.length) output[outputOffset++] = ((third & 3) << 6) | fourth
	}
	return outputOffset
}

function assertDecodedSize(decodedByteLength: number, maxBytes: number): void {
	if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
		throw new Error("Invalid maximum file size")
	}
	if (decodedByteLength > maxBytes) {
		throw new Error(`Base64 file exceeds the ${maxBytes} byte limit`)
	}
}

function assertEncodedSize(encodedLength: number, maxBytes: number): void {
	// Reject oversized strings before normalizing or allocating the decoded buffer.
	const maxEncodedLength = Math.ceil((maxBytes * 4) / 3) + 4096
	if (encodedLength > maxEncodedLength) {
		throw new Error(`Base64 input exceeds the ${maxBytes} byte limit`)
	}
}

function yieldToBrowser(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0)
	})
}

/**
 * Convert base64 string to File object (async version).
 * Decodes the payload in chunks so large screenshots do not monopolize the
 * main thread while the browser is processing the upload request.
 * @param base64 - Base64 string (with or without data URI prefix)
 * @param fileName - Name for the created file
 * @returns File object
 */
export async function base64ToFile(
	base64: string,
	fileName: string,
	maxBytes = MAX_BASE64_FILE_BYTES,
): Promise<File> {
	assertDecodedSize(0, maxBytes)
	assertEncodedSize(base64.length, maxBytes)
	const mimeType = inferMimeType(base64, fileName)
	const payload = normalizeBase64Payload(base64)
	const decodedByteLength = getDecodedByteLength(payload)
	assertDecodedSize(decodedByteLength, maxBytes)
	const output = new Uint8Array(decodedByteLength)
	let outputOffset = 0
	let processedBytes = 0
	for (let offset = 0; offset < payload.length; offset += BASE64_DECODE_CHUNK_SIZE) {
		const end = Math.min(offset + BASE64_DECODE_CHUNK_SIZE, payload.length)
		outputOffset = decodeBase64Chunk(payload, offset, end, output, outputOffset)
		processedBytes +=
			Math.min(Math.floor(end / 4) * 3, decodedByteLength) -
			Math.min(Math.floor(offset / 4) * 3, decodedByteLength)
		if (processedBytes >= BASE64_YIELD_THRESHOLD && end < payload.length) {
			processedBytes = 0
			await yieldToBrowser()
		}
	}

	return new File([output], fileName, { type: mimeType })
}

/**
 * @deprecated Use the async version of base64ToFile instead.
 * Synchronous base64 to File conversion — kept for backward compatibility
 * with callers that cannot use async/await.
 */
export function base64ToFileSync(base64: string, fileName: string): File {
	assertEncodedSize(base64.length, MAX_BASE64_FILE_BYTES)
	const mimeType = inferMimeType(base64, fileName)
	const payload = normalizeBase64Payload(base64)
	const decodedByteLength = getDecodedByteLength(payload)
	assertDecodedSize(decodedByteLength, MAX_BASE64_FILE_BYTES)
	const output = new Uint8Array(decodedByteLength)
	decodeBase64Chunk(payload, 0, payload.length, output, 0)
	return new File([output], fileName, { type: mimeType })
}

/** Creates a File from binary data received through a transferable ArrayBuffer. */
export function arrayBufferToFile(
	buffer: ArrayBuffer,
	fileName: string,
	mimeType = "application/octet-stream",
	maxBytes = MAX_BASE64_FILE_BYTES,
): File {
	assertDecodedSize(buffer.byteLength, maxBytes)
	return new File([buffer], fileName, { type: mimeType })
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
