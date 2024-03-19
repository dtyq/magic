import type { ElementNode, PPTShapeNode, PPTNodeBase, SlideConfig, PPTFill } from "../types/index"
import { log, LogLevel } from "../logger"
import { colorToHex, getTransparency, hasVisibleBackground, isGradientBackground, parseGradient, parseBlur } from "../utils/color"
import { hasUniformBorder } from "../utils/element"
import { pxToInch, parseBorderRadius, isFullyRounded, pxToPt, ptToInch, getGlobalTransform } from "../utils/unit"
import { parseShadow } from "./parseShadow"
import { parseBackgroundLayout } from "./parseBackground"
import { mapBorderStyle } from "./parseBorder"
import { canUseFragmentedBackground, resolveFragmentFill } from "./shape/fragment"
import { parseClipPathPolygon } from "./shape/clipPath"

/**
 * 解析形状 (背景色、边框、圆角、渐变)
 */
export interface ParseShapeOptions {
	/** 跳过渐变解析（渐变已由截图处理，仅保留纯色填充和边框） */
	skipGradient?: boolean
}

export function parseShape(
	node: ElementNode,
	base: PPTNodeBase,
	config: SlideConfig,
	options?: ParseShapeOptions,
): PPTShapeNode | null {
	const { style, rect } = node

	// 如果有 url() 背景图，跳过（由 parseImage 处理）
	// 但渐变背景应该在这里处理
	const bgImage = style.backgroundImage
	if (bgImage && bgImage !== "none" && bgImage.includes("url(") && !bgImage.includes("gradient")) {
		return null
	}

	// 检查 background-clip: text，如果是文字裁剪，不处理渐变背景（交给文本处理）
	const isTextClip = style.backgroundClip === "text"
	// 检查是否有渐变背景（但排除 text-clip 的情况，以及调用方主动跳过渐变的情况）
	const hasGradient = !isTextClip && !options?.skipGradient && isGradientBackground(bgImage)
	// 检查是否有可见的纯色填充
	const hasFill = hasVisibleBackground(style.backgroundColor)
	// 检查四边边框是否一致（不一致的边框会由 parseBorderLines 处理）
	const hasBorder = hasUniformBorder(style)

	// 如果都没有，不生成形状节点
	if (!hasFill && !hasBorder && !hasGradient) return null

	// 解析填充
	let fill: PPTFill | null = null

	// 优先使用渐变背景
	if (hasGradient) {
		const gradient = parseGradient(bgImage)
		if (gradient) {
			// 检查所有 stop 是否都不透明
			const hasTransparency = gradient.stops.some((stop) => {
				const transparency = stop.transparency ?? 0
				return transparency > 0
			})

			if (!hasTransparency) {
				// 只有当渐变色本身没有透明度时，才考虑 opacity
				const opacity = parseFloat(style.opacity)
				if (opacity < 1) {
					// 只有当完全不透明时，才应用 opacity
					const newTransparency = Math.round((1 - opacity) * 100)
					gradient.stops.forEach((stop) => {
						stop.transparency = newTransparency
					})
				}
			}
			fill = gradient
		}
	}

	// 没有渐变时使用纯色
	if (!fill && hasFill) {
		let transparency = getTransparency(style.backgroundColor)

		// 如果颜色本身是不透明的，但设置了 opacity，则使用 opacity 作为透明度
		if (transparency === 0) {
			const opacity = parseFloat(style.opacity)
			if (opacity < 1) {
				transparency = Math.round((1 - opacity) * 100)
			}
		}

		fill = {
			type: "solid" as const,
			color: colorToHex(style.backgroundColor),
			transparency,
		}
	}

	// 解析边框（只处理四边一致的情况）
	let line = null
	if (hasBorder) {
		// 四边一致时使用任意一边（这里用 top）
		const borderWidthPx = parseFloat(style.borderTopWidth) || 1
		const borderTransparency = getTransparency(style.borderTopColor)
		line = {
			color: colorToHex(style.borderTopColor),
			width: pxToInch(borderWidthPx, config),
			style: mapBorderStyle(style.borderTopStyle),
			transparency: borderTransparency,
		}
	}

	// 解析圆角
	const radiusPx = parseBorderRadius(style.borderRadius, rect.w, rect.h)
	const radius = pxToInch(radiusPx, config)

	// 判断形状类型
	const clipPoints = parseClipPathPolygon(style.clipPath, base.w, base.h)
	let shapeType: "rect" | "roundRect" | "ellipse" | "custGeom" = "rect"
	if (clipPoints) {
		shapeType = "custGeom"
	} else {
		const isEllipse = isFullyRounded(style.borderRadius, rect.w, rect.h)
		if (isEllipse) {
			shapeType = "ellipse"
		} else if (radius > 0) {
			shapeType = "roundRect"
		}
	}

	// 解析阴影
	const shadow = parseShadow(style.boxShadow)

	// 解析 blur 滤镜，转换为柔化边缘
	const blurPx = parseBlur(style.filter)
	let softEdge = blurPx && blurPx > 0 ? pxToPt(blurPx) : undefined

	let finalRect = { ...base }
	
	const { rotation, scaleX, scaleY } = getGlobalTransform(node)
	let rotate = rotation !== 0 ? rotation : undefined

	// 检查是否有自定义背景尺寸/位置
	// 不论是渐变还是纯色填充，只要设置了 background-size/position 都应该生效
	let bgLayout = null
	if (hasGradient || hasFill) {
		bgLayout = parseBackgroundLayout(style, node.layout.offsetWidth, node.layout.offsetHeight)
	}

	// 有背景调整，或有旋转/缩放时，重新计算 geometry
	if (bgLayout || rotate || Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
		const elemW = node.layout.offsetWidth
		const elemH = node.layout.offsetHeight
		
		// 目标尺寸 (未缩放)
		const targetW = bgLayout ? bgLayout.w : elemW
		const targetH = bgLayout ? bgLayout.h : elemH
		
		// 目标相对于元素左上角的中心点偏移 (未缩放)
		const targetCenterX = bgLayout ? bgLayout.x + bgLayout.w / 2 : elemW / 2
		const targetCenterY = bgLayout ? bgLayout.y + bgLayout.h / 2 : elemH / 2
		
		// 元素几何中心相对于元素左上角的偏移
		const elemCenterX = elemW / 2
		const elemCenterY = elemH / 2
		
		// 偏移量 (从元素中心指向目标中心)
		const dx = targetCenterX - elemCenterX
		const dy = targetCenterY - elemCenterY
		
		// 应用旋转 (将偏移量旋转)
		const rad = (rotation || 0) * Math.PI / 180
		const cos = Math.cos(rad)
		const sin = Math.sin(rad)
		
		// 旋转后的偏移量 (先缩放再旋转，假设 transform-origin 为 center)
		const scaledDx = dx * scaleX
		const scaledDy = dy * scaleY
		
		const rotatedDx = scaledDx * cos - scaledDy * sin
		const rotatedDy = scaledDx * sin + scaledDy * cos
		
		// 元素的全局中心 (基于 bounding rect)
		const globalElemCenterX = rect.x + rect.w / 2
		const globalElemCenterY = rect.y + rect.h / 2
		
		// 目标的全局中心
		const globalTargetCenterX = globalElemCenterX + rotatedDx
		const globalTargetCenterY = globalElemCenterY + rotatedDy
		
		// 目标的最终尺寸 (应用缩放)
		const finalW = targetW * scaleX
		const finalH = targetH * scaleY
		
		finalRect.x = pxToInch(globalTargetCenterX - finalW / 2, config)
		finalRect.y = pxToInch(globalTargetCenterY - finalH / 2, config)
		finalRect.w = pxToInch(finalW, config)
		finalRect.h = pxToInch(finalH, config)
	}

	if (softEdge) {
		// 增加模糊半径的转换系数，让模糊效果更明显
		// PPT 的软边缘效果比 CSS blur 要弱，所以放大系数
		softEdge = Math.min(100, softEdge * 2.5)

		// 扩大形状尺寸
		// 左右各增加 softEdge 的大小
		const expansion = ptToInch(softEdge)
		finalRect.x -= expansion
		finalRect.y -= expansion
		finalRect.w += expansion * 2
		finalRect.h += expansion * 2
	}

	return {
		...finalRect,
		type: "shape",
		shapeType,
		fill,
		line,
		shadow,
		radius: shapeType === "roundRect" && radius > 0 ? radius : undefined,
		points: clipPoints ?? undefined,
		softEdge,
		rotate: rotate !== 0 ? rotate : undefined,
	}
}

/**
 * 通用分片背景解析：当元素在浏览器中被拆成多个渲染片段时，
 * 逐片段生成 shape，避免背景被合并成单一大矩形。
 */
export function parseFragmentedShapeNodes(
	node: ElementNode,
	base: PPTNodeBase,
	config: SlideConfig,
): PPTShapeNode[] {
	const { style, element, rect } = node
	const fill = resolveFragmentFill(style)
	if (!fill) return []

	const clientRects = Array.from(element.getClientRects())
	if (clientRects.length <= 1) return []
	if (!canUseFragmentedBackground(node)) return []

	const elementBounds = element.getBoundingClientRect()
	const offsetX = rect.x - elementBounds.left
	const offsetY = rect.y - elementBounds.top
	const baseRadiusPx = parseBorderRadius(style.borderRadius, rect.w, rect.h)

	return clientRects
		.map((fragment) => {
			if (fragment.width <= 0 || fragment.height <= 0) return null
			const fragmentLayout = parseBackgroundLayout(style, fragment.width, fragment.height)
			const targetX = fragment.left + offsetX + (fragmentLayout?.x ?? 0)
			const targetY = fragment.top + offsetY + (fragmentLayout?.y ?? 0)
			const targetW = fragmentLayout?.w ?? fragment.width
			const targetH = fragmentLayout?.h ?? fragment.height
			if (targetW <= 0 || targetH <= 0) return null

			const radiusPx = Math.min(
				baseRadiusPx,
				Math.min(targetW, targetH) / 2,
			)
			const radius = pxToInch(radiusPx, config)
			const shapeType: "rect" | "roundRect" | "ellipse" =
				radius > 0 ? "roundRect" : "rect"

			const shapeNode: PPTShapeNode = {
				...base,
				type: "shape",
				x: pxToInch(targetX, config),
				y: pxToInch(targetY, config),
				w: pxToInch(targetW, config),
				h: pxToInch(targetH, config),
				shapeType,
				fill,
				line: null,
				shadow: null,
				radius: shapeType === "roundRect" ? radius : undefined,
			}
			return shapeNode
		})
		.filter((shape): shape is PPTShapeNode => shape !== null)
}
