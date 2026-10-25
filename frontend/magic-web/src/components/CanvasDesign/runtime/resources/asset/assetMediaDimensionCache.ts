import type { CanvasAssetMediaType } from "../../../public/magic-types"
import { assetLibrarySessionStore, type AssetMediaDimensions } from "./AssetLibrarySessionStore"

export type { AssetMediaDimensions }

const PROBE_TIMEOUT_MS = 10_000

function isPositiveDimension(value: number): boolean {
	return Number.isFinite(value) && value > 0
}

/** 记住素材预览或导入时量到的原始宽高，供稍后创建画布元素复用。 */
export function rememberAssetMediaDimensions(
	assetId: string,
	dimensions: AssetMediaDimensions,
): void {
	assetLibrarySessionStore.rememberAssetMediaDimensions(assetId, dimensions)
}

export function getRememberedAssetMediaDimensions(
	assetId: string,
): AssetMediaDimensions | undefined {
	return assetLibrarySessionStore.getRememberedAssetMediaDimensions(assetId)
}

/** 用签名地址读取图片或视频的编码尺寸，不把结果写入画布文档。 */
export function probeAssetMediaDimensionsFromUrl(
	url: string,
	mediaType: CanvasAssetMediaType,
): Promise<AssetMediaDimensions | null> {
	if (mediaType === "audio" || !url.trim()) return Promise.resolve(null)
	if (typeof document === "undefined") return Promise.resolve(null)

	return new Promise((resolve) => {
		let settled = false
		const finish = (dimensions: AssetMediaDimensions | null) => {
			if (settled) return
			settled = true
			window.clearTimeout(timer)
			resolve(dimensions)
		}
		const timer = window.setTimeout(() => finish(null), PROBE_TIMEOUT_MS)
		const element = document.createElement(mediaType === "video" ? "video" : "img")

		if (element instanceof HTMLVideoElement) {
			element.preload = "metadata"
			element.muted = true
			element.onloadedmetadata = () => {
				finish(
					isPositiveDimension(element.videoWidth) &&
						isPositiveDimension(element.videoHeight)
						? { width: element.videoWidth, height: element.videoHeight }
						: null,
				)
				element.removeAttribute("src")
				element.load()
			}
		} else {
			element.onload = () => {
				finish(
					isPositiveDimension(element.naturalWidth) &&
						isPositiveDimension(element.naturalHeight)
						? { width: element.naturalWidth, height: element.naturalHeight }
						: null,
				)
			}
		}
		element.onerror = () => finish(null)
		element.src = url
	})
}
