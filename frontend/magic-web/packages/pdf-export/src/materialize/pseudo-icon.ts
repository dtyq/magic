/**
 * 图标实体化工具
 * 将伪元素图标（Font Awesome、Antd Icon 等）转换为真实的图片或文本元素
 *
 * 移植自 html2pptx 的 materialize/pseudo-icon 模块
 */

import { log, LogLevel } from "../logger"

/** 图标备份信息，用于恢复原始 DOM */
export interface IconBackup {
	/** 原始图标元素 */
	element: Element
	/** 插入的替换元素 */
	replacement: HTMLElement
	/** 原始的 display 样式 */
	originalDisplay: string
}

interface RenderIconOptions {
	fontFamily: string
	fontSize: number
	color: string
	fontWeight: string
	iWindow: Window
	style?: CSSStyleDeclaration
}

/** 图标渲染的缩放因子，提升清晰度 */
const ICON_SCALE_FACTOR = 4

const BOX_MODEL_STYLES = [
	// 布局与尺寸
	"width",
	"height",
	"minWidth",
	"minHeight",
	"maxWidth",
	"maxHeight",
	"boxSizing",
	// 背景
	"background",
	"backgroundColor",
	"backgroundImage",
	"backgroundSize",
	"backgroundPosition",
	"backgroundRepeat",
	"backgroundClip",
	"backgroundOrigin",
	"backgroundAttachment",
	// 边框
	"border",
	"borderTop",
	"borderRight",
	"borderBottom",
	"borderLeft",
	"borderWidth",
	"borderStyle",
	"borderColor",
	"borderRadius",
	"borderTopLeftRadius",
	"borderTopRightRadius",
	"borderBottomRightRadius",
	"borderBottomLeftRadius",
	// 轮廓
	"outline",
	"outlineColor",
	"outlineStyle",
	"outlineWidth",
	"outlineOffset",
	// 阴影与不透明度
	"boxShadow",
	"opacity",
	// 变换原点
	"transformOrigin",
	// 可见性与裁剪
	"visibility",
	"clipPath",
	// 滤镜
	"filter",
	"backdropFilter",
	"transform",
]

/**
 * 将伪元素图标实体化
 * 遍历所有元素，检查是否存在可见的 ::before/::after 伪元素内容
 * 如果存在，将其转换为真实元素（优先转为图片，失败则转为文本 span）
 */
export function materializePseudoIcons(
	iDocument: Document,
	iWindow: Window,
): IconBackup[] {
	const backups: IconBackup[] = []

	// 注入隐藏伪元素的全局样式
	injectHidePseudoStyles(iDocument)

	// 使用 TreeWalker 遍历所有元素
	const treeWalker = iDocument.createTreeWalker(
		iDocument.body,
		NodeFilter.SHOW_ELEMENT,
		null
	)

	let currentNode = treeWalker.nextNode()
	while (currentNode) {
		const element = currentNode as HTMLElement

		// 检查 ::before
		const beforeBackup = processPseudoElement(element, "::before", iWindow)
		if (beforeBackup) backups.push(beforeBackup)

		const afterBackup = processPseudoElement(element, "::after", iWindow)
		if (afterBackup) backups.push(afterBackup)

		// 检查列表 marker
		const markerBackup = processListMarker(element, iWindow)
		if (markerBackup) backups.push(markerBackup)

		currentNode = treeWalker.nextNode()
	}

	log(LogLevel.L1, `Materialized ${backups.length} pseudo-elements`)
	return backups
}

/**
 * 注入隐藏伪元素的全局 CSS 规则
 */
function injectHidePseudoStyles(doc: Document) {
	const STYLE_ID = "magic-hide-pseudo-styles"
	
	if (doc.getElementById(STYLE_ID)) return

	const style = doc.createElement("style")
	style.id = STYLE_ID
	style.textContent = `
		.__magic-hide-before::before {
			content: none !important;
			display: none !important;
		}
		.__magic-hide-after::after {
			content: none !important;
			display: none !important;
		}
		.__magic-hide-marker {
			list-style-type: none !important;
			list-style-image: none !important;
		}
		.__magic-hide-marker::marker {
			content: none !important;
			display: none !important;
		}
	`
	doc.head.appendChild(style)
}

/**
 * 处理单个伪元素
 */
function processPseudoElement(
	element: HTMLElement,
	pseudoType: "::before" | "::after",
	iWindow: Window,
): IconBackup | null {
	const style = iWindow.getComputedStyle(element, pseudoType)
	
	// 1. 基础检查
	if (style.display === "none") return null
	const content = style.content
	
	// 允许 content 为空字符串，只要它是可见的 (如纯 CSS 绘制的图形)
	const isContentEmpty = !content || content === "none" || content === "normal"
	if (isContentEmpty) return null

	// 2. 解析 content
	let iconChar = ""
	if (content && content !== '""') {
		iconChar = parseContentValue(content) || ""
	}

	// 3. 获取样式
	const computed = iWindow.getComputedStyle(element)
	const fontFamily = style.fontFamily || computed.fontFamily
	const fontSize = parseFloat(style.fontSize) || parseFloat(computed.fontSize) || 16
	const color = style.color || computed.color || "#000"
	const fontWeight = style.fontWeight || computed.fontWeight || "normal"

	// 4. 逻辑分流：有内容则尝试转图片，无内容则转形状
	let finalReplacement: HTMLElement

	if (iconChar) {
		const img = renderIconToImage(iconChar, {
			fontFamily,
			fontSize,
			color,
			fontWeight,
			iWindow,
			style,
		})

		if (img) {
			finalReplacement = img
		} else {
			finalReplacement = createTextElement({
				iconChar,
				fontFamily,
				fontSize,
				color,
				fontWeight,
				iWindow,
				style,
			})
		}
	} else {
		finalReplacement = createShapeElement({
			iWindow,
			style,
		})
	}

	// 5. 应用定位和间距
	if (style.position === "absolute" || style.position === "fixed") {
		finalReplacement.style.position = style.position
		finalReplacement.style.left = style.left
		finalReplacement.style.top = style.top
		finalReplacement.style.right = style.right
		finalReplacement.style.bottom = style.bottom
		finalReplacement.style.transform = style.transform
		finalReplacement.style.zIndex = style.zIndex
	} else {
		applyInlineSpacing(finalReplacement, style)
	}

	// 6. 插入 DOM
	if (pseudoType === "::before") {
		element.insertBefore(finalReplacement, element.firstChild)
		element.classList.add("__magic-hide-before")
	} else {
		element.appendChild(finalReplacement)
		element.classList.add("__magic-hide-after")
	}
	return {
		element,
		replacement: finalReplacement,
		originalDisplay: "",
	}
}

function processListMarker(
	element: HTMLElement,
	iWindow: Window,
): IconBackup | null {
	if (element.tagName !== "LI") return null

	const liStyle = iWindow.getComputedStyle(element)
	const listStyleType = liStyle.listStyleType?.toLowerCase() || ""
	const listStyleImage = liStyle.listStyleImage || "none"
	const hasListType = !!listStyleType && listStyleType !== "none"
	const hasListImage = listStyleImage !== "none" && listStyleImage.startsWith("url(")
	if (!hasListType && !hasListImage) return null

	let marker: HTMLElement | null = null

	if (hasListImage) {
		const imageUrl = extractListStyleImageUrl(listStyleImage)
		if (imageUrl) marker = createImageMarker({ iWindow, imageUrl, fontSizePx: parseFloat(liStyle.fontSize) || 16 })
	}

	if (!marker && hasListType) {
		const markerStyle = iWindow.getComputedStyle(element, "::marker")
		const markerColor = markerStyle.color || liStyle.color || "#000"
		const fontSizePx = parseFloat(markerStyle.fontSize) || parseFloat(liStyle.fontSize) || 16
		const fontFamily = markerStyle.fontFamily || liStyle.fontFamily
		const fontWeight = markerStyle.fontWeight || liStyle.fontWeight || "normal"

		marker = createShapeMarker({
			iWindow,
			listStyleType,
			fontSizePx,
			color: markerColor,
		})

		if (!marker) {
			const markerText = resolveTextMarker({
				element,
				listStyleType,
			})
			if (markerText) {
				marker = createTextElement({
					iconChar: markerText,
					fontFamily,
					fontSize: fontSizePx,
					color: markerColor,
					fontWeight,
					iWindow,
				})
			}
		}
	}

	if (!marker) return null

	marker.classList.add("__magic-materialized-marker")
	marker.style.marginRight = "0.45em"
	marker.style.userSelect = "none"
	marker.style.flexShrink = "0"

	element.insertBefore(marker, element.firstChild)
	element.classList.add("__magic-hide-marker")

	return {
		element,
		replacement: marker,
		originalDisplay: "",
	}
}

/**
 * 恢复原始图标 DOM
 */
export function restoreIcons(backups: IconBackup[]): void {
	for (const backup of backups) {
		const { element, replacement, originalDisplay } = backup

		if (replacement.parentNode) {
			replacement.parentNode.removeChild(replacement)
		}

		if (element instanceof HTMLElement) {
			element.classList.remove("__magic-hide-before")
			element.classList.remove("__magic-hide-after")
			element.classList.remove("__magic-hide-marker")
		}

		if (element instanceof HTMLElement && originalDisplay) {
			element.style.display = originalDisplay
		}
	}

	log(LogLevel.L1, `Restored ${backups.length} icons`)
}

function extractListStyleImageUrl(listStyleImage: string): string | null {
	const match = listStyleImage.match(/^url\((['"]?)(.*?)\1\)$/i)
	if (!match) return null
	const url = match[2]?.trim()
	if (!url) return null
	return url
}

function createImageMarker(input: {
	iWindow: Window
	imageUrl: string
	fontSizePx: number
}): HTMLElement {
	const { iWindow, imageUrl, fontSizePx } = input
	const img = iWindow.document.createElement("img")
	img.src = imageUrl
	img.style.display = "inline-block"
	img.style.width = `${Math.max(8, Math.round(fontSizePx * 0.95))}px`
	img.style.height = `${Math.max(8, Math.round(fontSizePx * 0.95))}px`
	img.style.verticalAlign = "middle"
	return img
}

function createShapeMarker(input: {
	iWindow: Window
	listStyleType: string
	fontSizePx: number
	color: string
}): HTMLElement | null {
	const { iWindow, listStyleType, fontSizePx, color } = input
	const size = Math.max(4, Math.round(fontSizePx * 0.42))

	if (listStyleType === "disc") {
		const dot = iWindow.document.createElement("span")
		dot.style.display = "inline-block"
		dot.style.width = `${size}px`
		dot.style.height = `${size}px`
		dot.style.borderRadius = "50%"
		dot.style.backgroundColor = color
		dot.style.verticalAlign = "middle"
		return dot
	}

	if (listStyleType === "circle") {
		const ring = iWindow.document.createElement("span")
		ring.style.display = "inline-block"
		ring.style.width = `${size}px`
		ring.style.height = `${size}px`
		ring.style.borderRadius = "50%"
		ring.style.border = `1px solid ${color}`
		ring.style.backgroundColor = "transparent"
		ring.style.verticalAlign = "middle"
		return ring
	}

	if (listStyleType === "square") {
		const square = iWindow.document.createElement("span")
		square.style.display = "inline-block"
		square.style.width = `${size}px`
		square.style.height = `${size}px`
		square.style.backgroundColor = color
		square.style.verticalAlign = "middle"
		return square
	}

	return null
}

function resolveTextMarker(input: {
	element: HTMLElement
	listStyleType: string
}): string | null {
	const { element, listStyleType } = input
	const index = resolveListItemIndex(element)
	if (index === null) return null

	if (listStyleType === "decimal") return `${index}.`
	if (listStyleType === "decimal-leading-zero")
		return `${String(index).padStart(2, "0")}.`
	if (listStyleType === "lower-roman")
		return `${toRoman({ value: index, upper: false })}.`
	if (listStyleType === "upper-roman")
		return `${toRoman({ value: index, upper: true })}.`
	if (listStyleType === "lower-alpha" || listStyleType === "lower-latin")
		return `${toAlphabet({ value: index, upper: false })}.`
	if (listStyleType === "upper-alpha" || listStyleType === "upper-latin")
		return `${toAlphabet({ value: index, upper: true })}.`

	return `${index}.`
}

function resolveListItemIndex(liElement: HTMLElement): number | null {
	const parent = liElement.parentElement
	if (!parent) return null

	const siblings = Array.from(parent.children).filter(
		(child) => child.tagName === "LI",
	)
	const currentPos = siblings.indexOf(liElement)
	if (currentPos < 0) return null

	const start = parseInt(parent.getAttribute("start") || "1")
	const safeStart = Number.isNaN(start) ? 1 : start

	if (parent.hasAttribute("reversed")) {
		const count = siblings.length
		return safeStart + (count - 1 - currentPos)
	}

	return safeStart + currentPos
}

function toAlphabet(input: { value: number; upper: boolean }): string {
	const { value, upper } = input
	let num = Math.max(1, Math.floor(value))
	let result = ""
	while (num > 0) {
		num -= 1
		result = String.fromCharCode(97 + (num % 26)) + result
		num = Math.floor(num / 26)
	}
	return upper ? result.toUpperCase() : result
}

function toRoman(input: { value: number; upper: boolean }): string {
	const { value, upper } = input
	const romanPairs: Array<[number, string]> = [
		[1000, "M"],
		[900, "CM"],
		[500, "D"],
		[400, "CD"],
		[100, "C"],
		[90, "XC"],
		[50, "L"],
		[40, "XL"],
		[10, "X"],
		[9, "IX"],
		[5, "V"],
		[4, "IV"],
		[1, "I"],
	]

	let num = Math.max(1, Math.floor(value))
	let result = ""
	for (const [unit, label] of romanPairs) {
		while (num >= unit) {
			result += label
			num -= unit
		}
	}
	return upper ? result : result.toLowerCase()
}

interface CreateTextElementOptions {
	iconChar: string
	fontFamily: string
	fontSize: number
	color: string
	fontWeight: string
	iWindow: Window
	style?: CSSStyleDeclaration
}

function createTextElement(options: CreateTextElementOptions): HTMLElement {
	const { iconChar, fontFamily, fontSize, color, fontWeight, iWindow, style } = options
	const span = iWindow.document.createElement("span")
	span.textContent = iconChar
	span.style.fontFamily = fontFamily
	span.style.fontSize = `${fontSize}px`
	span.style.color = color
	span.style.fontWeight = fontWeight
	span.style.display = "inline-block"
	span.style.lineHeight = "1"

	if (style) {
		copyBoxModelStyles(span, style)
	}

	return span
}

interface CreateShapeElementOptions {
	iWindow: Window
	style: CSSStyleDeclaration
}

function createShapeElement(options: CreateShapeElementOptions): HTMLElement {
	const { iWindow, style } = options
	const div = iWindow.document.createElement("div")

	div.style.fontSize = "0"
	div.style.lineHeight = "0"

	copyBoxModelStyles(div, style)

	div.style.display = "inline-block"
	return div
}

function copyBoxModelStyles(target: HTMLElement, source: CSSStyleDeclaration): void {
	const srcStyle = source as unknown as Record<string, string>
	const tgtStyle = target.style as unknown as Record<string, string>
	for (const prop of BOX_MODEL_STYLES) {
		if (srcStyle[prop]) tgtStyle[prop] = srcStyle[prop]
	}
}

function applyInlineSpacing(replacement: HTMLElement, computed: CSSStyleDeclaration): void {
	replacement.style.marginLeft = computed.marginLeft
	replacement.style.marginRight = computed.marginRight
	replacement.style.marginTop = computed.marginTop
	replacement.style.marginBottom = computed.marginBottom
}

/**
 * 解析 CSS content 值
 * 处理 '"\\f015"' 或 '"\f015"' 等格式
 */
function parseContentValue(content: string): string | null {
	let value = content.trim()
	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		value = value.slice(1, -1)
	}

	if (!value) return null

	if (value.startsWith("\\")) {
		const hex = value.slice(1)
		const codePoint = parseInt(hex, 16)
		if (!isNaN(codePoint)) {
			return String.fromCodePoint(codePoint)
		}
	}

	return value
}

/**
 * 用 canvas 将图标字符渲染为图片
 * 使用高分辨率渲染以保证清晰度
 */
function renderIconToImage(iconChar: string, options: RenderIconOptions): HTMLImageElement | null {
	const { fontFamily, fontSize, color, fontWeight, iWindow, style } = options

	try {
		const canvas = iWindow.document.createElement("canvas")
		const ctx = canvas.getContext("2d")
		if (!ctx) return null

		const scale = ICON_SCALE_FACTOR
		
		let paddingTop = 0, paddingRight = 0, paddingBottom = 0, paddingLeft = 0
		let borderTop = 0, borderRight = 0, borderBottom = 0, borderLeft = 0
		let backgroundColor = "transparent"
		let borderColor = "transparent"
		
		if (style) {
			paddingTop = parseFloat(style.paddingTop) || 0
			paddingRight = parseFloat(style.paddingRight) || 0
			paddingBottom = parseFloat(style.paddingBottom) || 0
			paddingLeft = parseFloat(style.paddingLeft) || 0
			
			borderTop = parseFloat(style.borderTopWidth) || 0
			borderRight = parseFloat(style.borderRightWidth) || 0
			borderBottom = parseFloat(style.borderBottomWidth) || 0
			borderLeft = parseFloat(style.borderLeftWidth) || 0
			
			backgroundColor = style.backgroundColor || "transparent"
			borderColor = style.borderTopColor || style.borderColor || "transparent"
		}

		const scaledFontSize = fontSize * scale
		ctx.font = `${fontWeight} ${scaledFontSize}px ${fontFamily}`
		
		const metrics = ctx.measureText(iconChar)
		const textWidth = metrics.width
		const textHeight = scaledFontSize 

		const sPT = paddingTop * scale
		const sPR = paddingRight * scale
		const sPB = paddingBottom * scale
		const sPL = paddingLeft * scale
		const sBT = borderTop * scale
		const sBR = borderRight * scale
		const sBB = borderBottom * scale
		const sBL = borderLeft * scale

		let contentWidth = textWidth
		let contentHeight = textHeight
		
		if (iconChar.length === 1 && paddingTop === 0 && paddingRight === 0) {
			const size = Math.max(textWidth, textHeight)
			contentWidth = size
			contentHeight = size
		}

		const canvasWidth = Math.ceil(contentWidth + sPL + sPR + sBL + sBR)
		const canvasHeight = Math.ceil(contentHeight + sPT + sPB + sBT + sBB)

		canvas.width = canvasWidth
		canvas.height = canvasHeight

		ctx.font = `${fontWeight} ${scaledFontSize}px ${fontFamily}`
		ctx.textBaseline = "middle"
		ctx.imageSmoothingEnabled = true
		ctx.imageSmoothingQuality = "high"

		if (backgroundColor !== "transparent" && backgroundColor !== "rgba(0, 0, 0, 0)") {
			ctx.fillStyle = backgroundColor
			ctx.fillRect(0, 0, canvasWidth, canvasHeight)
		}

		if (borderColor !== "transparent" && (sBT > 0 || sBR > 0 || sBB > 0 || sBL > 0)) {
			ctx.strokeStyle = borderColor
			const avgBorderWidth = (sBT + sBR + sBB + sBL) / 4
			ctx.lineWidth = avgBorderWidth
			const offset = avgBorderWidth / 2
			ctx.strokeRect(offset, offset, canvasWidth - avgBorderWidth, canvasHeight - avgBorderWidth)
		}

		ctx.fillStyle = color
		const textX = sBL + sPL + (contentWidth - textWidth) / 2
		const textY = sBT + sPT + contentHeight / 2
		ctx.fillText(iconChar, textX, textY)

		const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight)
		const hasContent = imageData.data.some((v, i) => (i % 4 === 3 ? v > 0 : false))

		if (!hasContent) {
			log(LogLevel.L3, "Canvas is empty, font may not be loaded")
			return null
		}

		const dataUrl = canvas.toDataURL("image/png", 1.0)
		const img = iWindow.document.createElement("img")
		img.src = dataUrl

		img.style.width = `${canvasWidth / scale}px`
		img.style.height = `${canvasHeight / scale}px`
		img.style.display = "inline-block"
		img.style.verticalAlign = "middle"

		return img
	} catch (error) {
		log(LogLevel.L3, "Failed to render icon", { error: String(error) })
		return null
	}
}
