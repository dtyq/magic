import type { PPTMediaNode, Slide } from "../types/index"
import { log, LogLevel } from "../logger"
import { mediaToBase64 } from "../workers/media"

interface MediaOptions {
	x: number
	y: number
	w: number
	h: number
	type: "video" | "audio" | "online"
	path?: string
	data?: string
	link?: string
	cover?: string
	extn?: string
}

const mediaBase64Cache = new Map<string, Promise<string>>()

// 每次导出独立隔离：以 AbortSignal 为 key，每个导出有自己的任务队列
const _pendingBySignal = new WeakMap<AbortSignal, Set<Promise<void>>>()

function getPendingTasks(signal: AbortSignal): Set<Promise<void>> {
	if (!_pendingBySignal.has(signal)) _pendingBySignal.set(signal, new Set())
	return _pendingBySignal.get(signal)!
}

/**
 * 等待当前导出会话所有后台视频/音频下载任务完成。
 * 需在 pres.writeFile() 之前调用。
 */
export async function awaitPendingMedia(signal: AbortSignal): Promise<void> {
	const tasks = _pendingBySignal.get(signal)
	if (!tasks || tasks.size === 0) return
	await Promise.all([...tasks])
}

/**
 * 绘制媒体到幻灯片。
 * 视频/音频的 base64 下载在 Worker 线程异步完成，不阻塞当前页渲染。
 */
export function drawMedia(
	slide: Slide,
	node: PPTMediaNode,
	signal?: AbortSignal,
): void {
	const { x, y, w, h, mediaType, path, data, link, cover, extn } = node

	const options: MediaOptions = {
		x,
		y,
		w,
		h,
		type: mediaType,
	}

	switch (mediaType) {
		case "online":
			if (!link) {
				log(LogLevel.L3, "Online video requires link")
				return
			}
			options.link = link
			slide.addMedia(options)
			break

		case "video":
		case "audio":
			if (cover && mediaType === "video") options.cover = cover
			if (extn) options.extn = extn

			if (data) {
				options.data = data
				slide.addMedia(options)
			} else if (path) {
				if (path.startsWith("data:")) {
					options.data = path
					slide.addMedia(options)
				} else {
					// 发给 Worker 异步下载，不阻塞当前页
					const pendingTasks = signal ? getPendingTasks(signal) : null
					const task: Promise<void> = getCachedMediaBase64(path, signal)
						.then((dataUrl) => {
							options.data = dataUrl
							slide.addMedia(options)
						})
						.catch((error) => {
							log(LogLevel.L3, "Failed to convert media to base64, fallback to path", {
								error: String(error),
							})
							options.path = path
							slide.addMedia(options)
						})
						.finally(() => {
							pendingTasks?.delete(task)
						})
					pendingTasks?.add(task)
				}
			} else {
				log(LogLevel.L3, "Media requires path or data")
			}
			break

		default:
			log(LogLevel.L3, "Unknown media type", { mediaType })
	}
}

function getCachedMediaBase64(path: string, signal?: AbortSignal): Promise<string> {
	const cached = mediaBase64Cache.get(path)
	if (cached) return cached

	const task = mediaToBase64(path, signal).catch((error) => {
		mediaBase64Cache.delete(path)
		throw error
	})
	mediaBase64Cache.set(path, task)
	return task
}
