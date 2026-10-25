import type { ElementNode } from "../ir/dom"
import type { PPTImageNode, PPTNodeBase } from "../ir/node"
import type { SlideConfig } from "../api/options"
import { computeEffectiveOpacity } from "../shared/color"
import { pxToInch, resolveEffectiveRadius, getGlobalTransform } from "../shared/unit"
import { createMediaAssetKey, getOriginalMediaPath } from "../media/asset-identity"
import { createMediaSourceDescriptor } from "../media/source-descriptor"
import { extractCssImageUrls } from "../shared/css-image-url"

/**
 * Parse an image from an IMG tag or background-image.
 */
export function parseImage(
	node: ElementNode,
	base: PPTNodeBase,
	config: SlideConfig,
	iWindow: Window,
): PPTImageNode | null {
	const { tagName, style, element, rect } = node

	// Compute cumulative opacity from the collected ElementNode to avoid another getComputedStyle call.
	const opacity = computeEffectiveOpacity(node)
	const transparency = opacity < 1 ? Math.round((1 - opacity) * 100) : undefined

	const radiusPx = resolveEffectiveRadius(node)
	const radius = radiusPx > 0 ? pxToInch(radiusPx, config) : undefined

	// Correct transform effects, including rotation and scale.
	const { rotation, scaleX, scaleY } = getGlobalTransform(node)

	const finalRect = { ...base }
	const rotate = rotation !== 0 ? rotation : undefined

	// Apply correction whenever rotation or meaningful scale is present.
	if (rotate || Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
		// Use the original layout size multiplied by cumulative scale.
		const realW = node.layout.offsetWidth * scaleX
		const realH = node.layout.offsetHeight * scaleY

		// Calculate the center of the current bounding box.
		const cx = rect.x + rect.w / 2
		const cy = rect.y + rect.h / 2

		// Infer the pre-transform top-left position.
		const x = cx - realW / 2
		const y = cy - realH / 2

		finalRect.x = pxToInch(x, config)
		finalRect.y = pxToInch(y, config)
		finalRect.w = pxToInch(realW, config)
		finalRect.h = pxToInch(realH, config)
	}

	// Handle IMG tags.
	if (tagName === "IMG") {
		const imgElement = element as HTMLImageElement
		const src = imgElement.src || imgElement.getAttribute("src")

		if (!src) return null

		// Map CSS object-fit to PPT sizing to avoid unwanted cropping from the default cover behavior.
		const objectFit = (style.objectFit || "").trim().toLowerCase()
		let sizing: "cover" | "contain" | "stretch" = "stretch"
		if (objectFit === "cover") sizing = "cover"
		else if (objectFit === "contain" || objectFit === "scale-down" || objectFit === "none")
			sizing = "contain"
		else if (objectFit === "fill" || !objectFit) sizing = "stretch"

		const intrinsicSize =
			imgElement.naturalWidth > 0 && imgElement.naturalHeight > 0
				? { width: imgElement.naturalWidth, height: imgElement.naturalHeight }
				: undefined
		const objectPosition = parseObjectPosition(style.objectPosition, rect.w, rect.h)
		const assetKey = createMediaAssetKey("image", getOriginalMediaPath(imgElement))

		return {
			...finalRect,
			type: "image",
			assetKey,
			source: createMediaSourceDescriptor(src, { key: assetKey }),
			sizing,
			intrinsicSize,
			objectPosition,
			transparency,
			radius, // Apply corner radius.
			rotate, // Apply rotation.
		}
	}

	// Handle background-image.
	const bgImage = style.backgroundImage
	if (!bgImage || bgImage === "none") return null

	// Gradient layers are represented by parseShape. Compound background layer
	// rendering needs separate z-order handling and is intentionally unchanged here.
	if (bgImage.includes("gradient")) return null

	// Extract the first URL-backed image without making assumptions about its
	// quoting, escaping, file extension, query string, or containing function.
	const [src] = extractCssImageUrls(bgImage)
	if (!src) return null
	const originalPath = getOriginalMediaPath(element)
	const assetKey = createMediaAssetKey("image", originalPath)

	// Parse background-size to determine the sizing mode.
	const bgSize = style.backgroundSize
	let sizing: "cover" | "contain" | "stretch" = "cover"
	if (bgSize === "contain") sizing = "contain"
	else if (bgSize === "100% 100%" || bgSize === "stretch") sizing = "stretch"

	return {
		...finalRect,
		type: "image",
		assetKey,
		source: createMediaSourceDescriptor(src, { key: assetKey }),
		sizing,
		transparency,
		radius, // Apply corner radius.
		rotate, // Apply rotation.
	}
}

/** Preserve CSS object-position because PptxGenJS cover defaults to centering. */
function parseObjectPosition(
	value: string | undefined,
	boxW: number,
	boxH: number,
): { x: number; y: number; offsetX?: number; offsetY?: number } | undefined {
	if (!value) return undefined
	const tokens = value.trim().toLowerCase().split(/\s+/).filter(Boolean)
	if (!tokens.length) return undefined
	let xToken = tokens[0]
	let yToken = tokens[1] ?? "center"
	if (tokens.length === 1 && (xToken === "top" || xToken === "bottom")) {
		yToken = xToken
		xToken = "center"
	} else if (tokens.length > 1 && (xToken === "top" || xToken === "bottom")) {
		;[xToken, yToken] = [yToken, xToken]
	}
	const parse = (
		token: string,
		axis: "x" | "y",
	): { fraction: number; offset?: number } | undefined => {
		const keywords =
			axis === "x" ? { left: 0, center: 0.5, right: 1 } : { top: 0, center: 0.5, bottom: 1 }
		if (token in keywords) {
			const fraction = keywords[token as keyof typeof keywords]
			return fraction === undefined ? undefined : { fraction }
		}
		const percent = token.match(/^(-?(?:\d+\.?\d*|\.\d+))%$/)
		if (percent) return { fraction: Number(percent[1]) / 100 }
		const px = token.match(/^(-?(?:\d+\.?\d*|\.\d+))px$/)
		if (px) return { fraction: 0.5, offset: Number(px[1]) }
		return undefined
	}
	const x = parse(xToken, "x")
	const y = parse(yToken, "y")
	if (!x || !y) return undefined
	if (
		x.fraction === 0.5 &&
		y.fraction === 0.5 &&
		x.offset === undefined &&
		y.offset === undefined
	)
		return undefined
	return {
		x: x.fraction,
		y: y.fraction,
		...(x.offset === undefined ? {} : { offsetX: x.offset / Math.max(1, boxW) }),
		...(y.offset === undefined ? {} : { offsetY: y.offset / Math.max(1, boxH) }),
	}
}
