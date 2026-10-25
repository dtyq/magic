import type { PPTMediaNode, Slide } from "../ir/node"
import { log, LogLevel } from "../logger"
import { throwIfAborted } from "../sandbox/abort"

type MediaProps = Parameters<Slide["addMedia"]>[0]
type EmbeddedMediaProps = Exclude<MediaProps, { type: "online" }>
type OnlineMediaProps = Extract<MediaProps, { type: "online" }>

/**
 * Draw media onto the slide.
 * In the current export pipeline, media is materialized and written directly in this execution context.
 */
export async function drawMedia(
	slide: Slide,
	node: PPTMediaNode,
	signal?: AbortSignal,
): Promise<void> {
	throwIfAborted(signal)
	const { x, y, w, h, mediaType, source, link, autoplay } = node
	const coverSource = node.coverSource

	switch (mediaType) {
		case "online": {
			if (!link) {
				log(LogLevel.L3, "Online video requires link")
				return
			}
			const options: OnlineMediaProps = { x, y, w, h, type: "online", link }
			slide.addMedia(options)
			break
		}

		case "video":
		case "audio": {
			if (!source) {
				throw new TypeError(`${mediaType} node must provide a source descriptor`)
			}
			const options: EmbeddedMediaProps = { x, y, w, h, type: mediaType, source }
			if (mediaType === "video") {
				if (coverSource) options.coverSource = coverSource
			}
			if (autoplay !== undefined) options.autoplay = autoplay
			slide.addMedia(options)
			break
		}

		default:
			log(LogLevel.L3, "Unknown media type", { mediaType })
	}
}
