import { useMemo } from "react"
import type { AnyExtension } from "@tiptap/react"
import { useTranslation } from "react-i18next"
import { projectImageStorage } from "@/services/tiptap-image-project"
import {
	SaveImageToProjectExtension,
	ImageUploadErrorType,
} from "@/components/tiptap-node/project-image-node"
import { MAX_FILE_SIZE } from "@/lib/tiptap-utils"
import ProjectImageNode from "@/components/tiptap-node/project-image-node/project-image-node-extension"
import magicToast from "@/components/base/MagicToaster/utils"

export interface UseProjectImageExtensionsOptions {
	/**
	 * Project ID (required for upload)
	 */
	projectId?: string

	/**
	 * Current document path (relative to project root)
	 * Used to calculate relative paths from document to images
	 * @example "./docs/guide.md"
	 */
	documentPath?: string

	/**
	 * Folder path for images in project
	 * @default "images"
	 */
	folderPath?: string

	/**
	 * Maximum file size in bytes
	 * @default 5 * 1024 * 1024 (5MB)
	 */
	maxSize?: number

	/**
	 * Custom URL resolver function to convert relative paths to absolute URLs
	 * @example
	 * ```ts
	 * urlResolver: (relativePath) => {
	 *   return `https://cdn.example.com/projects/${projectId}/${relativePath}`
	 * }
	 * ```
	 */
	urlResolver?: (relativePath: string) => string | Promise<string>

	/**
	 * Custom error handler
	 */
	onError?: (error: Error) => void

	/**
	 * Custom storage unavailable handler
	 */
	onStorageUnavailable?: () => void

	/**
	 * Custom success handler
	 */
	onSuccess?: (relativePath: string) => void
}

/**
 * Hook to provide project image extensions for Tiptap editor
 * Handles paste/drop of image files, uploads to OSS, and saves to project
 *
 * @example
 * ```ts
 * const extensions = useProjectImageExtensions({
 *   projectId: '123',
 *   urlResolver: (relativePath) => {
 *     return `https://cdn.example.com/projects/123/${relativePath}`
 *   }
 * })
 * ```
 */
export function useProjectImageExtensions(
	options: UseProjectImageExtensionsOptions = {},
): AnyExtension[] {
	const {
		projectId,
		documentPath,
		folderPath,
		maxSize = MAX_FILE_SIZE,
		urlResolver,
		onError: customOnError,
		onStorageUnavailable: customOnStorageUnavailable,
		onSuccess: customOnSuccess,
	} = options

	const { t } = useTranslation("tiptap")

	const extensions = useMemo(() => {
		// Only add project image extensions if we have a project ID
		// if (!projectId) {
		// 	return []
		// }

		return [
			// Handle paste/drop of image files to project
			SaveImageToProjectExtension.configure({
				imageStorage: projectImageStorage,
				projectId,
				documentPath,
				folderPath,
				maxSize,
				onError: (error) => {
					// Allow custom error handler to override default behavior
					if (customOnError) {
						customOnError(error)
						return
					}

					// Display user-friendly error message based on error type
					const errorMessage = error.message

					switch (errorMessage) {
						// Validation errors - file issues detected before upload
						case ImageUploadErrorType.FILE_TOO_LARGE:
							magicToast.error(
								t("projectImage.errors.fileTooLarge", {
									maxSize: maxSize / (1024 * 1024),
								}),
							)
							break

						case ImageUploadErrorType.INVALID_FILE:
							magicToast.error(t("projectImage.errors.invalidFile"))
							break

						case ImageUploadErrorType.UNSUPPORTED_FILE_TYPE:
							magicToast.error(t("projectImage.errors.unsupportedFileType"))
							break

						// Configuration errors - missing required options
						case ImageUploadErrorType.PROJECT_ID_REQUIRED:
							magicToast.error(t("projectImage.errors.projectIdRequired"))
							break

						// Upload errors - network or server issues
						case ImageUploadErrorType.NETWORK_ERROR:
							magicToast.error(t("projectImage.errors.networkError"))
							break

						case ImageUploadErrorType.STORAGE_UNAVAILABLE:
							magicToast.error(t("projectImage.errors.storageUnavailable"))
							break

						case ImageUploadErrorType.UPLOAD_CANCELLED:
							magicToast.info(t("projectImage.errors.uploadCancelled"))
							break

						// Runtime errors - issues loading or accessing images
						case ImageUploadErrorType.LOAD_FAILED:
							magicToast.error(t("projectImage.errors.loadFailed"))
							break

						case ImageUploadErrorType.PATH_NOT_FOUND:
							magicToast.error(t("projectImage.errors.pathNotFound"))
							break

						// Default fallback for unknown errors
						case ImageUploadErrorType.UPLOAD_FAILED:
						default:
							magicToast.error(t("projectImage.errors.uploadFailed"))
							break
					}

					console.error("Project image upload error:", error)
				},
				onStorageUnavailable: () => {
					if (customOnStorageUnavailable) {
						customOnStorageUnavailable()
					} else {
						magicToast.warning(t("projectImage.errors.storageUnavailable"))
					}
				},
				onSuccess: (relativePath) => {
					if (customOnSuccess) {
						customOnSuccess(relativePath)
					}
					// No need to show success message as image is already visible in editor
					console.log("Project image uploaded:", relativePath)
				},
			}),
			// Render project images
			ProjectImageNode.configure({
				urlResolver,
				onError: (error) => {
					if (customOnError) {
						customOnError(error)
					} else {
						console.error("Project image load error:", error)
					}
				},
			}),
		]
	}, [
		projectId,
		documentPath,
		folderPath,
		maxSize,
		urlResolver,
		customOnError,
		customOnStorageUnavailable,
		customOnSuccess,
		t,
	])

	return extensions
}
