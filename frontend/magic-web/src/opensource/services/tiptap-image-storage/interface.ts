/**
 * Image Storage Interface
 * Interface for image storage implementations, allowing for dependency injection
 */
export interface ImageStorageInterface {
	/**
	 * Save an image file to storage
	 * @param file - The image file to save
	 * @param expiresInDays - Number of days until the image expires (default: 7)
	 * @returns Promise resolving to a unique identifier for the stored image
	 */
	saveImage(file: File, expiresInDays?: number): Promise<string>

	/**
	 * Retrieve an image from storage by its ID
	 * @param id - The unique identifier of the image
	 * @returns Promise resolving to the image Blob, or null if not found
	 */
	getImage(id: string): Promise<Blob | null>

	/**
	 * Delete an image from storage
	 * @param id - The unique identifier of the image to delete
	 * @returns Promise resolving when deletion is complete
	 */
	deleteImage(id: string): Promise<void>

	/**
	 * Check if the storage mechanism is available
	 * @returns Promise resolving to true if storage is available, false otherwise
	 */
	checkAvailability(): Promise<boolean>

	/**
	 * Clean up expired images from storage
	 * @returns Promise resolving to the number of images deleted
	 */
	cleanExpiredImages(): Promise<number>
}
