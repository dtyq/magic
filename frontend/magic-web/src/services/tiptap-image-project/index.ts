import { Upload } from "@dtyq/upload-sdk"
import { superMagicUploadTokenService } from "@/pages/superMagic/components/MessageEditor/services/UploadTokenService"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import { UploadSource } from "@/pages/superMagic/components/MessageEditor/hooks/useFileUpload"
import type {
	ProjectImageStorageInterface,
	UploadImageResult,
	UploadImageOptions,
} from "./interface"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { normalizeImageName } from "@/services/tiptap-image-storage"

/**
 * Generate unique filename with timestamp
 * @param originalName - Original file name
 * @returns File name with timestamp and normalized (without spaces and brackets)
 */
function generateUniqueFileName(originalName: string): string {
	// First normalize the name (remove spaces and brackets)
	const normalizedName = normalizeImageName(originalName)
	const timestamp = Date.now()
	const lastDotIndex = normalizedName.lastIndexOf(".")

	if (lastDotIndex === -1) {
		// No extension
		return `${normalizedName}_${timestamp}`
	}

	const nameWithoutExt = normalizedName.substring(0, lastDotIndex)
	const extension = normalizedName.substring(lastDotIndex)

	return `${nameWithoutExt}_${timestamp}${extension}`
}

/**
 * Project Image Storage Service
 * Handles uploading images to OSS and saving them to project
 */
class ProjectImageStorageService implements ProjectImageStorageInterface {
	private upload: Upload

	constructor() {
		this.upload = new Upload()
	}

	/**
	 * Upload an image file to OSS and save to project
	 */
	async uploadImage(
		file: File,
		projectId: string,
		folderPath: string = "images",
		options?: UploadImageOptions,
	): Promise<UploadImageResult> {
		if (!projectId) {
			throw new Error("Project ID is required")
		}

		try {
			// Generate unique filename with timestamp
			const uniqueFileName = generateUniqueFileName(file.name)

			// Step 1: Get upload credentials
			const customCredentials = await superMagicUploadTokenService.getUploadToken(
				projectId,
				folderPath,
			)

			if (!customCredentials) {
				throw new Error("Failed to get upload credentials")
			}

			// Check for abort signal
			if (options?.signal?.aborted) {
				throw new Error("Upload cancelled")
			}

			// Step 2: Upload to OSS
			const uploadResult = await new Promise<{ key: string; name: string; size: number }>(
				(resolve, reject) => {
					// Listen for abort signal
					const abortHandler = () => {
						reject(new Error("tiptap:projectImage.errors.uploadCancelled"))
					}

					options?.signal?.addEventListener("abort", abortHandler)

					const { success, fail, progress } = this.upload.upload({
						file,
						fileName: uniqueFileName,
						customCredentials,
						body: JSON.stringify({
							storage: "private",
							sts: true,
							content_type: file.type || "image/jpeg",
						}),
					})

					// Handle progress updates
					progress?.((progressEvent) => {
						if (
							options?.onProgress &&
							progressEvent &&
							typeof progressEvent === "object" &&
							"percent" in progressEvent &&
							typeof (progressEvent as { percent?: number }).percent === "number"
						) {
							options.onProgress(
								Math.round((progressEvent as { percent: number }).percent),
							)
						}
					})

					success?.((res) => {
						options?.signal?.removeEventListener("abort", abortHandler)

						if (res) {
							resolve({
								key: res.data?.path,
								name: uniqueFileName,
								size: file.size,
							})
						} else {
							reject(new Error("Upload failed"))
						}
					})

					fail?.((error) => {
						options?.signal?.removeEventListener("abort", abortHandler)
						reject(new Error(`Upload failed: ${error}`))
					})
				},
			)

			// Step 3: Save to project
			const saveResult = await superMagicUploadTokenService.saveFileToProject({
				project_id: projectId,
				file_key: uploadResult.key,
				file_name: uploadResult.name,
				file_size: uploadResult.size,
				file_type: "user_upload",
				storage_type: "workspace",
				source: UploadSource.ProjectFile,
			})

			pubsub.publish(PubSubEvents.Update_Attachments)

			// Step 4: Return result with file_id and metadata
			return {
				file_id: saveResult.file_id,
				file_key: saveResult.file_key,
				file_name: saveResult.file_name,
				relative_file_path: saveResult.relative_file_path,
				file_size: saveResult.file_size,
			}
		} catch (error) {
			console.error("ProjectImageStorageService: Upload image failed", error)
			throw error instanceof Error ? error : new Error("Failed to upload image")
		}
	}

	/**
	 * Get temporary download URL for an image by its file_id
	 */
	async getImageUrl(fileId: string): Promise<string | null> {
		if (!fileId) {
			return null
		}

		try {
			const result = await getTemporaryDownloadUrl({ file_ids: [fileId] })

			if (result && result.length > 0 && result[0]?.url) {
				return result[0].url
			}

			return null
		} catch (error) {
			console.error("ProjectImageStorageService: Get image URL failed", error)
			return null
		}
	}

	/**
	 * Delete an image from the project
	 * Note: This is a placeholder - implement actual deletion logic if needed
	 */
	async deleteImage(fileId: string): Promise<void> {
		if (!fileId) {
			return
		}

		// TODO: Implement actual deletion if backend API is available
		console.warn("ProjectImageStorageService: Delete image not implemented", fileId)
	}

	/**
	 * Check if the upload service is available
	 */
	async checkAvailability(): Promise<boolean> {
		try {
			// Simple check - if we can import the service, it's available
			return typeof superMagicUploadTokenService !== "undefined"
		} catch {
			return false
		}
	}
}

// Export singleton instance
export const projectImageStorage = new ProjectImageStorageService()

// Re-export types
export type { ProjectImageStorageInterface, UploadImageResult } from "./interface"
