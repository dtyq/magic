/**
 * Media parser.
 * Converts HTML <video> and <audio> elements into PPT media nodes.
 */

import type { ElementNode } from "../ir/dom"
import type { PPTMediaNode, PPTNodeBase } from "../ir/node"
import type { SlideConfig } from "../api/options"
import { log, LogLevel } from "../logger"
import { pxToInch } from "../shared/unit"
import {
	createMediaAssetKey,
	getOriginalMediaCoverPath,
	getOriginalMediaPath,
} from "../media/asset-identity"
import { createMediaSourceDescriptor } from "../media/source-descriptor"

/**
 * Parse a media element.
 */
export function parseMedia(
	node: ElementNode,
	base: PPTNodeBase,
	config: SlideConfig,
	_iWindow: Window,
): PPTMediaNode | null {
	const { element, tagName } = node

	if (tagName === "VIDEO") {
		return parseVideoElement(node, base, config)
	}

	if (tagName === "AUDIO") {
		return parseAudioElement(element as HTMLAudioElement, base)
	}

	return null
}

/**
 * Parse a video element.
 */
function parseVideoElement(
	node: ElementNode,
	base: PPTNodeBase,
	config: SlideConfig,
): PPTMediaNode | null {
	const video = node.element as HTMLVideoElement
	const sourceElement = video.querySelector("source")
	const src = video.src || sourceElement?.src

	if (!src) {
		log(LogLevel.L3, "Video element has no src")
		return null
	}

	const poster = video.poster?.trim()
	const mediaBase = resolveVideoMediaBase(node, base, config, video)
	const assetKey = createMediaAssetKey(
		"video",
		getOriginalMediaPath(video) ??
			(sourceElement ? getOriginalMediaPath(sourceElement) : undefined),
	)
	const coverAssetKey = createMediaAssetKey("cover", getOriginalMediaCoverPath(video))
	const source = createMediaSourceDescriptor(src, { key: assetKey })
	const coverSource = poster
		? createMediaSourceDescriptor(poster, { key: coverAssetKey })
		: undefined

	return {
		...mediaBase,
		type: "media",
		mediaType: "video",
		assetKey,
		coverAssetKey,
		source,
		coverSource,
		coverCaptureElement: poster ? undefined : video,
	}
}

function resolveVideoMediaBase(
	node: ElementNode,
	base: PPTNodeBase,
	config: SlideConfig,
	video: HTMLVideoElement,
): PPTNodeBase {
	const parentRect = node.parent?.rect
	if (
		parentRect &&
		parentRect.w > 0 &&
		parentRect.h > 0 &&
		(node.rect.w <= 0 || node.rect.h <= 0)
	) {
		return {
			...base,
			x: pxToInch(parentRect.x, config),
			y: pxToInch(parentRect.y, config),
			w: pxToInch(parentRect.w, config),
			h: pxToInch(parentRect.h, config),
		}
	}

	if (node.rect.w > 0 && node.rect.h <= 0 && video.videoWidth > 0 && video.videoHeight > 0) {
		return {
			...base,
			h: pxToInch((node.rect.w * video.videoHeight) / video.videoWidth, config),
		}
	}

	if (node.rect.h > 0 && node.rect.w <= 0 && video.videoWidth > 0 && video.videoHeight > 0) {
		return {
			...base,
			w: pxToInch((node.rect.h * video.videoWidth) / video.videoHeight, config),
		}
	}

	return base
}

/**
 * Parse an audio element.
 */
function parseAudioElement(audio: HTMLAudioElement, base: PPTNodeBase): PPTMediaNode | null {
	const sourceElement = audio.querySelector("source")
	const src = audio.src || sourceElement?.src

	if (!src) {
		log(LogLevel.L3, "Audio element has no src")
		return null
	}
	const assetKey = createMediaAssetKey(
		"audio",
		getOriginalMediaPath(audio) ??
			(sourceElement ? getOriginalMediaPath(sourceElement) : undefined),
	)

	return {
		...base,
		type: "media",
		mediaType: "audio",
		assetKey,
		source: createMediaSourceDescriptor(src, { key: assetKey }),
	}
}
