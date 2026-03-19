import { useMemo } from "react"
import type { AnyExtension } from "@tiptap/react"
import { useTranslation } from "react-i18next"
import { ImageStorageDatabase } from "@/services/tiptap-image-storage"
import { SaveImageToStorageExtension } from "@/components/tiptap-node/storage-image-node/save-image-to-storage-extension"
import { StorageImageNode } from "@/components/tiptap-node/storage-image-node"
import { MAX_FILE_SIZE } from "@/lib/tiptap-utils"
import ProjectImageNode from "@/components/tiptap-node/project-image-node/project-image-node-extension"
import magicToast from "@/components/base/MagicToaster/utils"

export interface UseStorageImageExtensionsOptions {
	/**
	 * Enable storage image extensions
	 * @default true
	 */
	enabled?: boolean

	/**
	 * Maximum file size in bytes
	 * @default 5 * 1024 * 1024 (5MB)
	 */
	maxSize?: number

	/**
	 * Number of days until images expire
	 * @default 7
	 */
	expiresInDays?: number

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
	onSuccess?: (id: string) => void
}

/**
 * Hook to provide storage image extensions for Tiptap editor
 * Handles paste/drop of image files and stores them in IndexedDB
 */
export function useStorageImageExtensions(
	options: UseStorageImageExtensionsOptions = {},
): AnyExtension[] {
	const {
		enabled = true,
		maxSize = MAX_FILE_SIZE,
		expiresInDays = 7,
		onError: customOnError,
		onStorageUnavailable: customOnStorageUnavailable,
		onSuccess: customOnSuccess,
	} = options

	const { t } = useTranslation("tiptap")

	// Get singleton image storage service
	const imageStorage = useMemo(() => ImageStorageDatabase.getInstance(), [])

	const extensions = useMemo(() => {
		if (!enabled) {
			return []
		}

		return [
			ProjectImageNode,
			// Storage Image Extensions - handle paste/drop of image files
			SaveImageToStorageExtension.configure({
				imageStorage,
				maxSize,
				expiresInDays,
				onError: (error) => {
					if (customOnError) {
						customOnError(error)
					} else if (error.message.includes("too large")) {
						magicToast.error(
							t("imageStorage.errors.fileTooLarge", {
								maxSize: maxSize / (1024 * 1024),
							}),
						)
					} else {
						magicToast.error(t("imageStorage.errors.saveFailed"))
					}
				},
				onStorageUnavailable: () => {
					if (customOnStorageUnavailable) {
						customOnStorageUnavailable()
					} else {
						magicToast.warning(t("imageStorage.errors.storageUnavailable"))
					}
				},
				onSuccess: customOnSuccess,
			}),
			StorageImageNode.configure({
				imageStorage,
				onError: (error) => {
					if (customOnError) {
						customOnError(error)
					} else {
						// message.error(t("imageStorage.errors.loadFailed"))
						console.error("Storage image error:", error)
					}
				},
			}),
		]
	}, [
		enabled,
		imageStorage,
		maxSize,
		expiresInDays,
		customOnError,
		customOnStorageUnavailable,
		customOnSuccess,
		t,
	])

	return extensions
}
