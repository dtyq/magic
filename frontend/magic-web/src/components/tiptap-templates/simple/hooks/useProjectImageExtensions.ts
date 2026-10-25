import { useMemo } from "react"
import type { AnyExtension } from "@/infrastructure/editors/tiptap/react"
import { useTranslation } from "react-i18next"
import { projectImageStorage } from "@/services/tiptap-image-project"
import {
	SaveImageToProjectExtension,
	ImageUploadErrorType,
} from "@/components/tiptap-node/project-image-node"
import { MAX_FILE_SIZE } from "@/infrastructure/editors/tiptap/utils"
import ProjectImageNode from "@/components/tiptap-node/project-image-node/project-image-node-extension"
import type { ProjectImageUrlResolver } from "@/components/tiptap-node/project-image-node/project-image-node-extension"
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
	urlResolver?: ProjectImageUrlResolver

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
	onSuccess?: (relativePath: string) => void | Promise<void>

	/**
	 * Async callback to resolve or create the images folder and return its file_id.
	 * Called before each upload to ensure the image is saved in the correct directory.
	 * When requireImagesFolderParentId is true, returning undefined is treated as an
	 * upload error so recording images cannot silently fall back to the project root.
	 * @param folderPath - The calculated folder path (e.g. "docs/images")
	 * @returns The file_id of the images folder, or undefined when it cannot be resolved
	 */
	resolveImagesFolderParentId?: (folderPath: string) => Promise<string | undefined>
	requireImagesFolderParentId?: boolean
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
		resolveImagesFolderParentId,
		requireImagesFolderParentId,
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
				resolveImagesFolderParentId,
				requireImagesFolderParentId,
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
				onSuccess: async (relativePath) => {
					await customOnSuccess?.(relativePath)
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
		resolveImagesFolderParentId,
		requireImagesFolderParentId,
		t,
	])

	return extensions
}
