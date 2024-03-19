import type { ElementNode, ComputedStyleInfo } from "../types/index"

let idCounter = 0

/**
 * 收集 DOM 元素信息
 * 遍历所有 DOM 元素，测量位置、尺寸，收集计算样式
 */
export function collectElements(doc: Document, win: Window): ElementNode[] {
	idCounter = 0
	const allNodes: ElementNode[] = []

	// 获取根元素的位置作为偏移基准
	const rootRect = doc.body.getBoundingClientRect()	

	// 递归遍历 DOM 树
	function traverse(
		element: Element,
		parent: ElementNode | null,
		depth: number,
	): ElementNode {
		const rect = element.getBoundingClientRect()
		const computedStyle = win.getComputedStyle(element)
		
		// 构建节点
		const node: ElementNode = {
			id: `el-${idCounter++}`,
			tagName: element.tagName,
			element,
			rect: {
				x: rect.left - rootRect.left,
				y: rect.top - rootRect.top,
				w: rect.width,
				h: rect.height,
			},
			layout: {
				offsetWidth: (element as HTMLElement).offsetWidth,
				offsetHeight: (element as HTMLElement).offsetHeight,
			},
			style: extractStyles(computedStyle),
			textContent: getDirectTextContent(element),
			children: [],
			parent,
			depth,
			zIndex: parseZIndex(computedStyle.zIndex),
			domOrder: idCounter, // DOM 遍历顺序，后来居上
		}

		// 递归处理子元素
		Array.from(element.children).forEach((child) => {
			const childNode = traverse(child, node, depth + 1)
			node.children.push(childNode)
		})

		allNodes.push(node)
		return node
	}

	// 从 body 元素开始遍历（包含 body 本身，以获取背景色/背景图等）
	traverse(doc.body, null, 0)

	return allNodes
}

/**
 * 提取计算样式的关键属性
 */
function extractStyles(style: CSSStyleDeclaration): ComputedStyleInfo {
	return {
		// 背景
		backgroundColor: style.backgroundColor,
		// 合并 background 和 backgroundImage，优先取 backgroundImage
		backgroundImage: style.backgroundImage !== "none" ? style.backgroundImage : style.background,
		backgroundSize: style.backgroundSize,
		backgroundPosition: style.backgroundPosition,
		backgroundRepeat: style.backgroundRepeat,
		backgroundClip: style.backgroundClip,
		objectFit: style.objectFit,
		objectPosition: style.objectPosition,

		// 边框
		borderRadius: style.borderRadius,
		borderWidth: style.borderWidth,
		borderColor: style.borderColor,
		borderStyle: style.borderStyle,
		// 单边边框（使用 getPropertyValue 确保兼容性）
		borderTopWidth: style.borderTopWidth,
		borderRightWidth: style.borderRightWidth,
		borderBottomWidth: style.borderBottomWidth,
		borderLeftWidth: style.borderLeftWidth,
		borderTopColor: style.borderTopColor,
		borderRightColor: style.borderRightColor,
		borderBottomColor: style.borderBottomColor,
		borderLeftColor: style.borderLeftColor,
		borderTopStyle: style.borderTopStyle,
		borderRightStyle: style.borderRightStyle,
		borderBottomStyle: style.borderBottomStyle,
		borderLeftStyle: style.borderLeftStyle,

		// 文字
		color: style.color,
		fontSize: parseFloat(style.fontSize) || 16,
		fontFamily: normalizeFontFamily(style.fontFamily),
		fontWeight: style.fontWeight,
		fontStyle: style.fontStyle,
		textAlign: style.textAlign,
		textDecoration: style.textDecoration,
		whiteSpace: style.whiteSpace,
		lineHeight: style.lineHeight,
		letterSpacing: style.letterSpacing,
		verticalAlign: style.verticalAlign,
		paddingTop: style.paddingTop,
		paddingRight: style.paddingRight,
		paddingBottom: style.paddingBottom,
		paddingLeft: style.paddingLeft,
		marginTop: style.marginTop,
		marginRight: style.marginRight,
		marginBottom: style.marginBottom,
		marginLeft: style.marginLeft,

		// 布局
		display: style.display,
		position: style.position,
		opacity: style.opacity,
		visibility: style.visibility,
		overflow: style.overflow,
		zIndex: style.zIndex,

		// Flex/Grid 对齐
		alignItems: style.alignItems,
		justifyContent: style.justifyContent,
		alignContent: style.alignContent,
		alignSelf: style.alignSelf,
		flexDirection: style.flexDirection,

		// 阴影
		boxShadow: style.boxShadow,
		textShadow: style.textShadow,

		// 变换
		transform: style.transform,

		// 滤镜
		filter: style.filter,

		// 裁剪
		clipPath: style.clipPath || "none",

		// 文本转换
		textTransform: style.textTransform,

		// WebKit 专属 (text-stroke，lib.dom.d.ts 已声明)
		webkitTextStroke: style.webkitTextStroke,
		webkitTextStrokeWidth: style.webkitTextStrokeWidth || undefined,
		webkitTextStrokeColor: style.webkitTextStrokeColor || undefined,
	}
}

/**
 * 获取元素的直接文本内容（不包含子元素的文本）
 * 将换行和多余空格折叠成单个空格（模拟浏览器的渲染行为）
 */
function getDirectTextContent(element: Element): string | null {
	let text = ""
	Array.from(element.childNodes).forEach((node) => {
		if (node.nodeType === Node.TEXT_NODE) {
			text += node.textContent || ""
		}
	})
	// 将换行和多余空格折叠成单个空格（模拟 CSS white-space: normal 的行为）
	const normalized = text.replace(/\s+/g, " ").trim()
	return normalized || null
}

/**
 * 解析 z-index 值
 */
function parseZIndex(value: string): number {
	if (value === "auto") return 0
	return parseInt(value) || 0
}

/**
 * 规范化字体名称
 */
function normalizeFontFamily(fontFamily: string): string {
	if (!fontFamily) return "Arial"

	// 取第一个字体，移除引号
	const first = fontFamily.split(",")[0].trim()
	return first.replace(/['"]/g, "") || "Arial"
}
