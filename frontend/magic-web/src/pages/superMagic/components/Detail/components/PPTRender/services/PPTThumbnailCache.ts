import cryptoUtils from "@/utils/crypto"
import {
	pptThumbnailCacheRepository,
	type PPTThumbnailCacheKey,
} from "@/services/superMagic/repositories/PPTThumbnailCacheRepository"

/** 随截图算法、注入逻辑或 HTML 资源预处理变化更新，避免复用旧缩略图。 */
const RENDERER_VERSION = 5

export type PPTThumbnailCacheMode = "use" | "refresh"

export interface PPTThumbnailCacheScope {
	clusterCode: string
	userId: string
	organizationCode: string
	projectId: string
	mainFileId: string
}

export interface PPTThumbnailCacheContext {
	scope: PPTThumbnailCacheScope
	slideIdentity: string
	path: string
	rawContent: string
	resourceVersionSignature: string
}

export interface PPTThumbnailRenderOptions {
	width: number
	height: number
	scale: number
	mimeType: string
	quality: number
}

export function createPPTThumbnailCacheKey(
	context: PPTThumbnailCacheContext,
	render: PPTThumbnailRenderOptions,
): PPTThumbnailCacheKey {
	const { clusterCode, userId, organizationCode, projectId, mainFileId } = context.scope
	const scope = JSON.stringify([clusterCode, userId, organizationCode, projectId, mainFileId])
	const contentHash = cryptoUtils.SHA256encryption(context.rawContent)
	return {
		key: JSON.stringify([
			scope,
			context.slideIdentity,
			contentHash,
			context.resourceVersionSignature,
			[
				RENDERER_VERSION,
				render.width,
				render.height,
				render.scale,
				render.mimeType,
				render.quality,
			],
		]),
		scope,
		slideIdentity: context.slideIdentity,
		path: context.path,
	}
}

/** 在服务仍持有本地 URL 时取得字节；不从外网下载图片，不持久保存 blob URL。 */
export async function savePPTThumbnail(
	identity: PPTThumbnailCacheKey,
	thumbnailUrl: string,
	shouldCommit: () => boolean,
): Promise<void> {
	if (!shouldCommit() || !/^(blob:|data:image\/)/.test(thumbnailUrl)) return
	try {
		let blob: Blob
		if (thumbnailUrl.startsWith("data:")) {
			// Data URL 已包含图片字节；交给全局 fetch 会让请求监控正则扫描整段 Base64，阻塞主线程。
			// 只匹配短头部，图片体直接解码；不能用隐藏的 fetch 实例绕过监控。
			const separatorIndex = thumbnailUrl.indexOf(",")
			if (separatorIndex === -1) return
			const mimeType = /^data:(image\/[^;,]+);base64$/i.exec(
				thumbnailUrl.slice(0, separatorIndex),
			)?.[1]
			if (!mimeType) return
			const binary = atob(thumbnailUrl.slice(separatorIndex + 1))
			const bytes = new Uint8Array(binary.length)
			for (let index = 0; index < binary.length; index++) {
				bytes[index] = binary.charCodeAt(index)
			}
			blob = new Blob([bytes], { type: mimeType })
		} else {
			const response = await fetch(thumbnailUrl)
			blob = await response.blob()
		}
		if (!shouldCommit()) return
		await pptThumbnailCacheRepository.putThumbnail(identity, blob, shouldCommit)
	} catch {
		// URL 可能已随页面释放；持久化失败不改变本次截图结果。
	}
}

export function deletePPTThumbnail(key: string): Promise<void> {
	return pptThumbnailCacheRepository.deleteThumbnail(key)
}
