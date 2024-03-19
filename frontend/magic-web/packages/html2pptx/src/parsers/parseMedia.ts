/**
 * 媒体解析器
 * 将 HTML <video> 和 <audio> 转换为 PPT 媒体格式
 */

import type { ElementNode, PPTMediaNode, PPTNodeBase, SlideConfig } from "../types/index"
import { log, LogLevel } from "../logger"

/**
 * 解析媒体元素
 */
export function parseMedia(
	node: ElementNode,
	base: PPTNodeBase,
	_config: SlideConfig,
	_iWindow: Window,
): PPTMediaNode | null {
	const { element, tagName } = node

	if (tagName === "VIDEO") {
		return parseVideoElement(element as HTMLVideoElement, base)
	}

	if (tagName === "AUDIO") {
		return parseAudioElement(element as HTMLAudioElement, base)
	}

	return null
}

/**
 * 解析 video 元素
 */
function parseVideoElement(
	video: HTMLVideoElement,
	base: PPTNodeBase,
): PPTMediaNode | null {
	const src = video.src || video.querySelector("source")?.src

	if (!src) {
		log(LogLevel.L3, "Video element has no src")
		return null
	}

	const cover = video.poster || undefined
	const extn = getFileExtension(src)

	return {
		...base,
		type: "media",
		mediaType: "video",
		path: src,
		cover,
		extn,
	}
}

/**
 * 解析 audio 元素
 */
function parseAudioElement(
	audio: HTMLAudioElement,
	base: PPTNodeBase,
): PPTMediaNode | null {
	const src = audio.src || audio.querySelector("source")?.src

	if (!src) {
		log(LogLevel.L3, "Audio element has no src")
		return null
	}

	const extn = getFileExtension(src)

	return {
		...base,
		type: "media",
		mediaType: "audio",
		path: src,
		extn,
	}
}


/**
 * 获取文件扩展名
 */
function getFileExtension(url: string): string | undefined {
	try {
		const pathname = new URL(url, "http://dummy").pathname
		const ext = pathname.split(".").pop()?.toLowerCase()
		if (ext && ext.length <= 5) {
			return ext
		}
	} catch {
		const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/)
		if (match?.[1]) {
			return match[1].toLowerCase()
		}
	}
	return undefined
}
