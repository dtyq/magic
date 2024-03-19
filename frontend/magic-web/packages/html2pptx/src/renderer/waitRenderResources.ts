import { throwIfAborted, waitForTimeout } from "./abort"

const CANVAS_DELAY_MS = 2000

/** 等待文档中的图片资源加载结束（成功或失败均放行） */
function waitForImages(iframeDocument: Document, signal?: AbortSignal): Promise<void> {
	const images = iframeDocument.querySelectorAll("img")
	const promises = Array.from(images).map((img) => {
		if (img.complete) return Promise.resolve()
		return new Promise<void>((resolveImage) => {
			const cleanup = () => {
				img.removeEventListener("load", onLoad)
				img.removeEventListener("error", onError)
				if (signal) signal.removeEventListener("abort", onAbort)
			}
			const onLoad = () => {
				cleanup()
				resolveImage()
			}
			const onError = () => {
				cleanup()
				resolveImage()
			}
			const onAbort = () => {
				cleanup()
				resolveImage()
			}
			img.addEventListener("load", onLoad, { once: true })
			img.addEventListener("error", onError, { once: true })
			signal?.addEventListener("abort", onAbort, { once: true })
		})
	})
	return Promise.all(promises).then(() => {})
}

/** 等待视频元数据可用，确保导出时可拿到稳定尺寸 */
function waitForVideos(iframeDocument: Document, signal?: AbortSignal): Promise<void> {
	const videos = iframeDocument.querySelectorAll("video")
	const promises = Array.from(videos).map((video) => {
		if (video.readyState >= 1) return Promise.resolve()
		return new Promise<void>((resolveVideo) => {
			const cleanup = () => {
				video.removeEventListener("loadedmetadata", onLoadedMetadata)
				video.removeEventListener("error", onError)
				if (signal) signal.removeEventListener("abort", onAbort)
			}
			const onLoadedMetadata = () => {
				cleanup()
				resolveVideo()
			}
			const onError = () => {
				cleanup()
				resolveVideo()
			}
			const onAbort = () => {
				cleanup()
				resolveVideo()
			}
			video.addEventListener("loadedmetadata", onLoadedMetadata, { once: true })
			video.addEventListener("error", onError, { once: true })
			signal?.addEventListener("abort", onAbort, { once: true })
		})
	})
	return Promise.all(promises).then(() => {})
}

/** 为 canvas 渲染增加短暂缓冲，避免抓取到未完成绘制的帧 */
function waitForCanvasDelay(
	iframeDocument: Document,
	signal?: AbortSignal,
): Promise<void> {
	const hasCanvas = Boolean(iframeDocument.querySelector("canvas"))
	if (!hasCanvas) return Promise.resolve()
	return waitForTimeout({ ms: CANVAS_DELAY_MS, signal })
}

/** 统一等待导出所需媒体资源收敛 */
export async function waitForRenderResources({
	iframeDocument,
	signal,
}: {
	iframeDocument: Document
	signal?: AbortSignal
}): Promise<void> {
	throwIfAborted(signal)
	await waitForCanvasDelay(iframeDocument, signal)
	throwIfAborted(signal)
	await Promise.all([
		waitForImages(iframeDocument, signal),
		waitForVideos(iframeDocument, signal),
	])
	throwIfAborted(signal)
}
