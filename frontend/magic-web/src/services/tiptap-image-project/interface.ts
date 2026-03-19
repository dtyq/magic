/**
 * Project Image Storage Interface
 * Interface for uploading images to OSS and saving them to project
 */

export interface UploadImageResult {
	file_id: string
	file_key: string
	file_name: string
	relative_file_path: string
	file_size: number
}

export interface UploadImageOptions {
	/**
	 * Optional progress callback
	 * @param progress - Upload progress (0-100)
	 */
	onProgress?: (progress: number) => void

	/**
	 * Optional abort signal for cancellation support
	 */
	signal?: AbortSignal
}

export interface ProjectImageStorageInterface {
	/**
	 * Upload an image file to OSS and save to project
	 * @param file - The image file to upload
	 * @param projectId - The project ID
	 * @param folderPath - The folder path in project (default: "images")
	 * @param options - Optional upload options (progress callback, abort signal)
	 * @returns Promise resolving to upload result with file_id and other metadata
	 */
	uploadImage(
		file: File,
		projectId: string,
		folderPath?: string,
		options?: UploadImageOptions,
	): Promise<UploadImageResult>

	/**
	 * Get temporary download URL for an image by its file_id
	 * @param fileId - The file ID
	 * @returns Promise resolving to the temporary image URL
	 */
	getImageUrl(fileId: string): Promise<string | null>

	/**
	 * Delete an image from the project
	 * @param fileId - The file ID to delete
	 * @returns Promise resolving when deletion is complete
	 */
	deleteImage(fileId: string): Promise<void>

	/**
	 * Check if the upload service is available
	 * @returns Promise resolving to true if service is available, false otherwise
	 */
	checkAvailability(): Promise<boolean>
}
