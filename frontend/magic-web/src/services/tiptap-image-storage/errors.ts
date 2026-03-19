/**
 * Error thrown when image storage is unavailable
 * This typically occurs in private browsing mode or when IndexedDB is disabled
 */
export class ImageStorageUnavailableError extends Error {
	constructor(message = "Image storage is unavailable") {
		super(message)
		this.name = "ImageStorageUnavailableError"
	}
}

/**
 * Error thrown when image validation fails
 * This includes file type, size, or format validation errors
 */
export class ImageValidationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "ImageValidationError"
	}
}

/**
 * Error thrown when image storage quota is exceeded
 */
export class ImageStorageQuotaError extends Error {
	constructor(message = "Image storage quota exceeded") {
		super(message)
		this.name = "ImageStorageQuotaError"
	}
}
