import { useEffect, useMemo, useRef } from "react"
import type { MediaPreviewImageActions, MediaPreviewCrop } from "@/components/base/MediaPreview"
import { DownloadImageMode } from "@/pages/superMagic/pages/Workspace/types"
import { useOptionalCanvas } from "../../../app/providers/CanvasProvider"
import { AttachmentSource } from "../../../public/magic-types"
import { ElementTypeEnum, type ImageElement } from "../../../runtime/document/types"
import { OSS_URL_EXPIRY_SAFETY_WINDOW_MS } from "../../../runtime/resources/offline-cache/ossExpiryUtils"

/** 引用只适配宿主下载的元素参数，不改变选择、文档内容或资源归属。 */
export function useCanvasImagePreviewActions(
	path: string | undefined,
	fileName: string,
	{ crop, element }: { crop?: MediaPreviewCrop; element?: ImageElement } = {},
): MediaPreviewImageActions | undefined {
	const canvas = useOptionalCanvas()
	const entry = path ? canvas?.imageResourceManager.getEntry(path) : undefined
	const isAIImage = entry?.source === AttachmentSource.AI
	const activeRef = useRef({ canvas, path, mounted: true })
	activeRef.current = { canvas, path, mounted: true }
	useEffect(() => {
		activeRef.current.mounted = true
		return () => {
			activeRef.current.mounted = false
		}
	}, [canvas, path])
	return useMemo(() => {
		if (!canvas || !path) return undefined
		return {
			resourceKey: [canvas.id, path, crop?.x, crop?.y, crop?.width, crop?.height].join("|"),
			isAIImage,
			load: async ({ signal, forceRefresh }) => {
				if (signal.aborted) return null
				const resource = await canvas.imageResourceManager.ensureFreshOssInfo(path, {
					forceRefresh,
					allowCachedFallback: false,
				})
				if (
					signal.aborted ||
					!resource?.ossSrc ||
					!activeRef.current.mounted ||
					activeRef.current.canvas !== canvas ||
					activeRef.current.path !== path
				)
					return null
				return {
					url: resource.ossSrc,
					refreshAt: resource.expiresAt
						? resource.expiresAt - OSS_URL_EXPIRY_SAFETY_WINDOW_MS
						: undefined,
				}
			},
			onDownload:
				canvas.permissionManager.canDownloadFiles() &&
				canvas.magicConfigManager.config?.methods?.downloadFiles
					? async (mode) => {
							if (!canvas.permissionManager.canDownloadFiles()) return
							const methods = canvas.magicConfigManager.config?.methods
							if (!methods?.downloadFiles) return
							const current = element
								? canvas.getElementForContentView(element)
								: undefined
							const target: ImageElement = current ?? {
								id: path,
								name: fileName,
								type: ElementTypeEnum.Image,
								activeContentId: path,
								mainContentId: path,
								contents: [{ contentId: path, src: path, crop }],
							}
							const image = await canvas.imageResourceManager.getResource(path, {
								variant: "preview",
							})
							const dimensions = image?.imageInfo
							if (
								!activeRef.current.mounted ||
								activeRef.current.canvas !== canvas ||
								activeRef.current.path !== path ||
								!canvas.permissionManager.canDownloadFiles()
							)
								return
							await methods.downloadFiles(
								[target],
								mode === DownloadImageMode.HighQuality,
								false,
								{
									downloadMode:
										mode === DownloadImageMode.NormalDownload
											? "normal"
											: "default",
									sourceDimensionsByElementId: dimensions
										? {
												[target.id]: {
													width: dimensions.naturalWidth,
													height: dimensions.naturalHeight,
												},
											}
										: undefined,
								},
							)
						}
					: undefined,
		} satisfies MediaPreviewImageActions
	}, [canvas, path, fileName, crop, element, isAIImage])
}
