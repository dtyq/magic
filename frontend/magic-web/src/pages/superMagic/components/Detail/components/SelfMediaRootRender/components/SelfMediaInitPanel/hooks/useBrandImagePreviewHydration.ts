import { useEffect, useRef, useState } from "react"
import { useFileApi, type FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import type { BrandImageItem } from "../types"
import type { AttachmentNode } from "../../../services"
import { CARD_THUMBNAIL_IMAGE_PROCESS } from "../../../constants/imageProcess"

interface UseBrandImagePreviewHydrationParams {
	attachmentList?: AttachmentNode[]
	brandImages: BrandImageItem[]
	onBrandImagesChange: (brandImages: BrandImageItem[]) => void
}

interface PreviewResult {
	id: string
	previewUrl: string
}

function normalizeRelativePath(path: string): string {
	return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "")
}

function findFileIdByRelativePath(
	attachmentList: AttachmentNode[] | undefined,
	relativePath: string,
): string | null {
	if (!attachmentList?.length || !relativePath) return null
	const normalizedPath = normalizeRelativePath(relativePath)

	const stack = [...attachmentList]
	while (stack.length) {
		const node = stack.pop()
		if (!node) continue
		if (
			!node.is_directory &&
			normalizeRelativePath(node.relative_file_path || "") === normalizedPath
		) {
			return node.file_id || null
		}
		if (node.children?.length) stack.push(...node.children)
	}

	return null
}

/**
 * Batch-load preview URLs: single get-file-url call for all pending images,
 * then parallel blob downloads.
 */
async function batchLoadPreviewUrls(
	fileApi: Pick<FileApi, "getFileContentById">,
	items: Array<{ id: string; fileId: string }>,
): Promise<PreviewResult[]> {
	if (!items.length) return []

	const results = await Promise.allSettled(
		items.map(async ({ id, fileId }) => {
			const blob = (await fileApi.getFileContentById(fileId, {
				responseType: "blob",
				xMagicImageProcess: CARD_THUMBNAIL_IMAGE_PROCESS,
			})) as Blob
			if (!blob) return null
			return { id, previewUrl: URL.createObjectURL(blob) }
		}),
	)

	return results
		.map((r) => (r.status === "fulfilled" ? r.value : null))
		.filter((r): r is PreviewResult => Boolean(r?.previewUrl))
}

export function useBrandImagePreviewHydration({
	attachmentList,
	brandImages,
	onBrandImagesChange,
}: UseBrandImagePreviewHydrationParams) {
	const fileApi = useFileApi()
	const previewUrlsRef = useRef(new Map<string, string>())
	const [hydratingImageIds, setHydratingImageIds] = useState<Set<string>>(new Set())
	// Track which image IDs have been hydrated or are in-flight to prevent re-triggering
	const hydratedOrInflightRef = useRef(new Set<string>())

	useEffect(() => {
		previewUrlsRef.current.forEach((previewUrl, id) => {
			if (brandImages.some((item) => item.id === id)) return
			URL.revokeObjectURL(previewUrl)
			previewUrlsRef.current.delete(id)
			hydratedOrInflightRef.current.delete(id)
		})
	}, [brandImages])

	useEffect(() => {
		const pendingItems = brandImages.filter(
			(item) =>
				item.isImage &&
				item.uploadedPath &&
				!item.previewUrl &&
				!hydratedOrInflightRef.current.has(item.id),
		)
		if (!pendingItems.length || !attachmentList?.length) return

		// Resolve file IDs from attachmentList
		const itemsWithFileId: Array<{ id: string; fileId: string }> = []
		for (const item of pendingItems) {
			if (!item.uploadedPath) continue
			const fileId = findFileIdByRelativePath(attachmentList, item.uploadedPath)
			if (fileId) {
				itemsWithFileId.push({ id: item.id, fileId })
			}
		}
		if (!itemsWithFileId.length) return

		let cancelled = false
		const pendingIds = new Set(itemsWithFileId.map((item) => item.id))

		// Mark as in-flight to prevent duplicate requests
		pendingIds.forEach((id) => hydratedOrInflightRef.current.add(id))

		setHydratingImageIds((prev) => {
			const next = new Set(prev)
			pendingIds.forEach((id) => next.add(id))
			return next
		})

		void batchLoadPreviewUrls(fileApi, itemsWithFileId)
			.then((hydratedItems) => {
				if (!hydratedItems.length) return

				if (cancelled) {
					hydratedItems.forEach((item) => URL.revokeObjectURL(item.previewUrl))
					return
				}

				const previewUrlMap = new Map(
					hydratedItems.map((item) => [item.id, item.previewUrl]),
				)

				onBrandImagesChange(
					brandImages.map((item) => {
						const previewUrl = previewUrlMap.get(item.id)
						if (!previewUrl || item.previewUrl) return item

						const stalePreviewUrl = previewUrlsRef.current.get(item.id)
						if (stalePreviewUrl && stalePreviewUrl !== previewUrl) {
							URL.revokeObjectURL(stalePreviewUrl)
						}

						previewUrlsRef.current.set(item.id, previewUrl)
						return { ...item, previewUrl }
					}),
				)
			})
			.finally(() => {
				setHydratingImageIds((prev) => {
					const next = new Set(prev)
					pendingIds.forEach((id) => next.delete(id))
					return next
				})
			})

		return () => {
			cancelled = true
		}
	}, [attachmentList, brandImages, onBrandImagesChange, fileApi])

	useEffect(() => {
		const currentPreviewUrls = previewUrlsRef.current
		return () => {
			currentPreviewUrls.forEach((previewUrl) => {
				URL.revokeObjectURL(previewUrl)
			})
			currentPreviewUrls.clear()
		}
	}, [])

	return {
		hydratingImageIds,
	}
}
