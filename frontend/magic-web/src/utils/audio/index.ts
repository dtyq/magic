/**
 * Audio conversion utilities
 */

/**
 * Get file extension from MIME type
 * @param mimeType - The MIME type of the audio
 * @returns string - The appropriate file extension
 */
function getExtensionFromMimeType(mimeType: string): string {
	const mimeToExt: Record<string, string> = {
		"audio/mp4": "m4a",
		"audio/mp4;codecs=aac": "m4a",
		"audio/3gpp": "3gp",
		"audio/webm": "webm",
		"audio/webm;codecs=opus": "webm",
		"audio/ogg": "ogg",
		"audio/ogg;codecs=opus": "ogg",
		"audio/wav": "wav",
		"audio/mpeg": "mp3",
	}

	return mimeToExt[mimeType] || "m4a" // 默认使用m4a
}

/**
 * Convert audio blob to appropriate format based on its actual MIME type
 * @param audioBlob - The audio blob to process
 * @param filename - The base filename (without extension)
 * @param actualMimeType - The actual MIME type used for recording
 * @returns Promise<File> - The properly formatted audio file
 */
export async function convertBlobToAudioFile(
	audioBlob: Blob,
	filename: string = "voice_message",
	actualMimeType?: string,
): Promise<File> {
	// Use the actual MIME type if provided, otherwise use the blob's type
	const mimeType = actualMimeType || audioBlob.type || "audio/mp4"

	// Get appropriate file extension
	const extension = getExtensionFromMimeType(mimeType)

	// Create file with correct name and type
	const audioFile = new File([audioBlob], `${filename}.${extension}`, {
		type: mimeType,
		lastModified: Date.now(),
	})

	console.log(
		`Created audio file: ${audioFile.name} (${audioFile.type}, ${audioFile.size} bytes)`,
	)

	return audioFile
}

/**
 * @deprecated Use convertBlobToAudioFile instead
 * Convert Blob to M4A format (legacy function for backward compatibility)
 */
export async function convertBlobToM4A(
	audioBlob: Blob,
	filename: string = "voice_message",
): Promise<File> {
	console.warn("convertBlobToM4A is deprecated, use convertBlobToAudioFile instead")
	return convertBlobToAudioFile(audioBlob, filename, "audio/mp4")
}

/**
 * Validate audio file size with dynamic extension based on MIME type
 * @param audioData - The audio blob data
 * @param maxSizeMB - Maximum size in MB
 * @param actualMimeType - The actual MIME type of the audio
 * @returns boolean - Whether the file size is valid
 */
export function validateAudioFileSizeByType(
	audioData: Blob,
	maxSizeMB: number,
	actualMimeType?: string,
): boolean {
	const mimeType = actualMimeType || audioData.type || "audio/mp4"
	const extension = getExtensionFromMimeType(mimeType)

	// Create a temporary file with correct extension for validation
	const tempFile = new File([audioData], `temp.${extension}`, {
		type: mimeType,
	})

	return validateAudioFileSize(tempFile, maxSizeMB)
}

/**
 * Calculate audio duration from blob
 * @param audioBlob - The audio blob
 * @returns Promise<number> - Duration in seconds
 */
export async function getAudioDuration(audioBlob: Blob): Promise<number> {
	return new Promise((resolve, reject) => {
		const audio = new Audio()
		const objectUrl = URL.createObjectURL(audioBlob)

		audio.addEventListener("loadedmetadata", () => {
			URL.revokeObjectURL(objectUrl)
			resolve(audio.duration)
		})

		audio.addEventListener("error", (error) => {
			URL.revokeObjectURL(objectUrl)
			reject(error)
		})

		audio.src = objectUrl
	})
}

/**
 * Validate audio file size
 * @param file - The audio file
 * @param maxSizeInMB - Maximum size in MB (default: 10MB)
 * @returns boolean - Whether the file size is valid
 */
export function validateAudioFileSize(file: File, maxSizeInMB: number = 10): boolean {
	const maxSizeInBytes = maxSizeInMB * 1024 * 1024
	return file.size <= maxSizeInBytes
}

/**
 * Generate unique filename for audio
 * @param prefix - Filename prefix (default: "voice")
 * @returns string - Unique filename
 */
export function generateAudioFilename(prefix: string = "voice"): string {
	const timestamp = Date.now()
	const random = Math.random().toString(36).substring(2, 8)
	return `${prefix}_${timestamp}_${random}`
}
