import type { PPTImageNode, Slide } from "../ir/node"
import { log, LogLevel } from "../logger"

type ImageProps = Parameters<Slide["addImage"]>[0]

export function drawImage(slide: Slide, node: PPTImageNode): void {
	const { x, y, w, h, sizing, intrinsicSize, objectPosition, transparency, rotate } = node
	const source = node.source
	if (!source) throw new TypeError("Image node must provide a source descriptor")

	const options: ImageProps = {
		x,
		y,
		w,
		h,
		source,
	}

	if (
		(sizing === "cover" || sizing === "contain") &&
		intrinsicSize &&
		Number.isFinite(intrinsicSize.width) &&
		Number.isFinite(intrinsicSize.height) &&
		intrinsicSize.width > 0 &&
		intrinsicSize.height > 0
	) {
		// PptxGenJS derives the source aspect ratio from the image option's initial w/h,
		// then replaces them with the sizing box. Use a normalized intrinsic frame here;
		// otherwise target w/h are mistaken for the source ratio and cover/contain becomes stretch.
		const maxDimension = Math.max(intrinsicSize.width, intrinsicSize.height)
		options.w = intrinsicSize.width / maxDimension
		options.h = intrinsicSize.height / maxDimension
	}

	if (rotate !== undefined) options.rotate = rotate

	if (transparency !== undefined) options.transparency = transparency

	if (sizing === "cover" || sizing === "contain") {
		if (objectPosition && intrinsicSize) {
			const sourceRatio = intrinsicSize.width / intrinsicSize.height
			const boxRatio = w / h
			const useCover = sizing === "cover"
			// A crop with negative edges is how PptxGenJS implements `contain` letterboxing.
			// Keeping the complete scaled source frame lets asymmetric crop offsets preserve
			// CSS object-position without moving or resizing the image's layout box.
			const sourceW = useCover
				? sourceRatio < boxRatio
					? w
					: h * sourceRatio
				: sourceRatio > boxRatio
					? w
					: h * sourceRatio
			const sourceH = useCover
				? sourceRatio < boxRatio
					? w / sourceRatio
					: h
				: sourceRatio > boxRatio
					? w / sourceRatio
					: h
			const dx = (w - sourceW) * objectPosition.x + (objectPosition.offsetX ?? 0) * w
			const dy = (h - sourceH) * objectPosition.y + (objectPosition.offsetY ?? 0) * h
			// Crop coordinates are measured in the scaled source frame, not the final box.
			options.w = sourceW
			options.h = sourceH
			options.sizing = { type: "crop", w, h, x: -dx, y: -dy }
		} else {
			options.sizing = { type: sizing, w, h }
		}
	} else if (sizing === "crop") {
		options.sizing = {
			type: "crop",
			w,
			h,
			x: 0,
			y: 0,
		}
	}

	try {
		slide.addImage(options)
	} catch (error) {
		log(LogLevel.L3, "Failed to add image", {
			sourceKey: source.key,
			error: String(error),
		})
		throw error
	}
}
