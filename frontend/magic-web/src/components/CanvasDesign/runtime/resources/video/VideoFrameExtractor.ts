export interface VideoFrameExtractorOptions {
	timeoutMs?: number
	signal?: AbortSignal
}

export interface ExtractedVideoFrame {
	blob: Blob
	width: number
	height: number
}

const RVFC_FALLBACK_DELAY_MS = 250

/**
 * 从独立 video consumer 截取视频尾帧。
 *
 * 这里不复用预览 loader：预览 loader 固定截取首帧，并且会把结果登记到
 * VideoResourceManager。续写只需要一次性的原尺寸图片，因此必须隔离播放和缓存状态。
 */
export function extractVideoTailFrame(
	ossSrc: string,
	options: VideoFrameExtractorOptions = {},
): Promise<ExtractedVideoFrame | null> {
	return new Promise((resolve) => {
		const video = document.createElement("video")
		const canvas = document.createElement("canvas")
		const timeoutMs = options.timeoutMs ?? 30_000
		let settled = false
		let timeoutId: ReturnType<typeof setTimeout> | null = null
		let fallbackTimerId: ReturnType<typeof setTimeout> | null = null
		let frameCallbackId: number | null = null
		let fallbackAnimationFrameId: number | null = null
		let targetTime: number | null = null
		let seekStarted = false
		let captureScheduled = false
		let captureStarted = false
		let sourceAssigned = false

		const cleanup = () => {
			video.removeEventListener("loadedmetadata", handleLoadedMetadata)
			video.removeEventListener("loadeddata", handleLoadedData)
			video.removeEventListener("seeked", handleSeeked)
			video.removeEventListener("error", handleError)
			options.signal?.removeEventListener("abort", handleAbort)
			if (timeoutId) clearTimeout(timeoutId)
			if (fallbackTimerId) clearTimeout(fallbackTimerId)
			if (frameCallbackId !== null && typeof video.cancelVideoFrameCallback === "function") {
				video.cancelVideoFrameCallback(frameCallbackId)
			}
			if (fallbackAnimationFrameId !== null) {
				cancelAnimationFrame(fallbackAnimationFrameId)
			}
			if (sourceAssigned) {
				video.pause()
				video.removeAttribute("src")
				video.load()
			}
			canvas.width = 0
			canvas.height = 0
		}

		const finish = (result: ExtractedVideoFrame | null) => {
			if (settled) return
			settled = true
			cleanup()
			resolve(result)
		}

		const drawFrame = () => {
			if (captureStarted) return
			captureStarted = true
			if (settled || options.signal?.aborted) {
				finish(null)
				return
			}

			const width = Math.max(1, video.videoWidth || 1)
			const height = Math.max(1, video.videoHeight || 1)
			canvas.width = width
			canvas.height = height
			const context = canvas.getContext("2d")
			if (!context) {
				finish(null)
				return
			}

			try {
				context.drawImage(video, 0, 0, width, height)
			} catch {
				// 跨域资源未开放 CORS 时 drawImage 会抛出，当前来源只需失败并继续批量任务。
				finish(null)
				return
			}

			try {
				canvas.toBlob(
					(blob) => finish(blob ? { blob, width, height } : null),
					"image/jpeg",
					0.92,
				)
			} catch {
				finish(null)
			}
		}

		const handleSeeked = () => {
			if (settled || captureScheduled) return
			captureScheduled = true
			const scheduleAnimationFrameFallback = () => {
				if (settled || captureStarted) return
				fallbackAnimationFrameId = requestAnimationFrame(() => {
					fallbackAnimationFrameId = null
					drawFrame()
				})
			}
			if (typeof video.requestVideoFrameCallback === "function") {
				frameCallbackId = video.requestVideoFrameCallback(() => {
					frameCallbackId = null
					drawFrame()
				})
				fallbackTimerId = setTimeout(scheduleAnimationFrameFallback, RVFC_FALLBACK_DELAY_MS)
				return
			}
			fallbackAnimationFrameId = requestAnimationFrame(() => {
				fallbackAnimationFrameId = null
				drawFrame()
			})
		}

		const handleLoadedMetadata = () => {
			if (seekStarted) return
			if (!Number.isFinite(video.duration) || video.duration < 0) {
				finish(null)
				return
			}
			targetTime = Math.max(0, video.duration - 0.05)
			seekStarted = true
			try {
				video.currentTime = targetTime
			} catch {
				finish(null)
			}
		}

		const handleLoadedData = () => {
			if (!seekStarted && video.readyState >= HTMLMediaElement.HAVE_METADATA) {
				handleLoadedMetadata()
			}
			// 极短视频的目标时间可能仍是 0，此时浏览器不一定派发 seeked。
			if (
				targetTime !== null &&
				!video.seeking &&
				Math.abs(video.currentTime - targetTime) < 1e-6
			) {
				handleSeeked()
			}
		}

		const handleError = () => finish(null)
		const handleAbort = () => finish(null)

		if (options.signal?.aborted) {
			finish(null)
			return
		}

		video.crossOrigin = "anonymous"
		video.preload = "auto"
		video.playsInline = true
		video.muted = true
		video.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true })
		video.addEventListener("loadeddata", handleLoadedData, { once: true })
		video.addEventListener("seeked", handleSeeked, { once: true })
		video.addEventListener("error", handleError, { once: true })
		options.signal?.addEventListener("abort", handleAbort, { once: true })
		timeoutId = setTimeout(() => finish(null), timeoutMs)
		sourceAssigned = true
		video.src = ossSrc
		video.load()
	})
}
