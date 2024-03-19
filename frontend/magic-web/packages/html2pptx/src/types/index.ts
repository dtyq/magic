import type PptxGenJS from "pptxgenjs"
import type { ExternalLogger, LogLevelLabel } from "../logger"

// ============================================================================
// 基础类型
// ============================================================================

export type PPTXGenCore = typeof PptxGenJS
export type Pptx = InstanceType<PPTXGenCore>
export type Slide = ReturnType<Pptx["addSlide"]>

/** 幻灯片配置 */
export interface SlideConfig {
	/** 设计稿宽度 (px) */
	htmlWidth: number
	/** 设计稿高度 (px) */
	htmlHeight: number
	/** PPT 宽度 (英寸) */
	slideWidth: number
	/** PPT 高度 (英寸) */
	slideHeight: number
}

/** 导出选项 */
export interface ExportOptions {
	/** 文件名 */
	fileName?: string
	/** 幻灯片配置 */
	config?: Partial<SlideConfig>
	/** 导出模式 */
	exportMode?: "single"
	/** 页面失败时是否跳过并继续导出后续页面 */
	skipFailedPages?: boolean
	/** 每页渲染开始时的进度回调 */
	onSlideProgress?: (context: ExportPageContext) => void
	/** 最低输出级别，低于此级别的日志会被忽略，默认 "info" */
	logLevel?: LogLevelLabel
	/** 传入外部 logger，直接传 console 即可；方法均为可选 */
	logger?: ExternalLogger
}

/** exportPPTX 的返回句柄，用于等待完成或主动取消 */
export interface ExportHandle {
	/** 等待导出完成（成功 resolve，失败/取消 reject） */
	promise: Promise<void>
	/** 取消本次导出 */
	cancel: () => void
}

/** 逐页导出上下文 */
export interface ExportPageContext {
	/** 当前页索引（从 0 开始） */
	index: number
	/** 总页数 */
	total: number
	/** 当前页 HTML */
	html: string
	/** 当前页导出文件名 */
	fileName: string
	/** 幻灯片配置 */
	config: SlideConfig
}

// ============================================================================
// 元素收集层类型
// ============================================================================

/** 计算样式信息 (精简版) */
export interface ComputedStyleInfo {
	// 背景
	backgroundColor: string
	backgroundImage: string
	backgroundSize: string
	backgroundPosition: string
	backgroundRepeat: string
	backgroundClip: string
	objectFit: string
	objectPosition: string

	// 边框
	borderRadius: string
	borderWidth: string
	borderColor: string
	borderStyle: string
	// 单边边框
	borderTopWidth: string
	borderRightWidth: string
	borderBottomWidth: string
	borderLeftWidth: string
	borderTopColor: string
	borderRightColor: string
	borderBottomColor: string
	borderLeftColor: string
	borderTopStyle: string
	borderRightStyle: string
	borderBottomStyle: string
	borderLeftStyle: string

	// 文字
	color: string
	fontSize: number
	fontFamily: string
	fontWeight: string
	fontStyle: string
	textAlign: string
	textDecoration: string
	whiteSpace: string
	lineHeight: string
	letterSpacing: string
	verticalAlign: string
	paddingTop: string
	paddingRight: string
	paddingBottom: string
	paddingLeft: string
	marginTop: string
	marginRight: string
	marginBottom: string
	marginLeft: string

	// 布局
	display: string
	position: string
	opacity: string
	visibility: string
	overflow: string
	zIndex: string

	// Flex/Grid 对齐
	alignItems: string
	justifyContent: string
	alignContent: string
	alignSelf: string
	flexDirection: string

	// 阴影
	boxShadow: string
	textShadow: string

	// 变换
	transform: string

	// 滤镜
	filter: string

	// 裁剪
	clipPath: string

	// 文本转换
	textTransform: string
	
	// WebKit 专属 (text-stroke，与 lib.dom.d.ts 一致)
	webkitTextStroke?: string
	webkitTextStrokeWidth?: string
	webkitTextStrokeColor?: string
}

/** DOM 元素节点 */
export interface ElementNode {
	/** 唯一标识 */
	id: string
	/** 元素类型 */
	tagName: string
	/** 原始 DOM 引用 */
	element: Element
	/** 位置和尺寸 (像素) */
	rect: {
		x: number
		y: number
		w: number
		h: number
	}
	/** 布局尺寸 (无变换的原始尺寸) */
	layout: {
		offsetWidth: number
		offsetHeight: number
	}
	/** 计算后的样式 */
	style: ComputedStyleInfo
	/** 直接文本内容 */
	textContent: string | null
	/** 子元素 */
	children: ElementNode[]
	/** 父元素引用 */
	parent: ElementNode | null
	/** DOM 深度 */
	depth: number
	/** z-index 数值 */
	zIndex: number
	/** DOM 遍历顺序（用于同级元素排序，后来居上） */
	domOrder: number
	/** 绘制顺序（由 sortByZOrder 计算后挂载） */
	paintOrder?: number
}

// ============================================================================
// 中间表示层类型 (PPTNode)
// ============================================================================

/** PPT 节点基础属性 */
export interface PPTNodeBase {
	/** 节点类型 */
	type: string
	/** X 坐标 (英寸) */
	x: number
	/** Y 坐标 (英寸) */
	y: number
	/** 宽度 (英寸) */
	w: number
	/** 高度 (英寸) */
	h: number
	/** 绘制顺序 */
	zOrder: number
	/** 旋转角度 (度) */
	rotate?: number
}

/** custGeom 路径点 */
export interface CustGeomPoint {
	x?: number
	y?: number
	moveTo?: boolean
	close?: boolean
}

/** 形状节点 */
export interface PPTShapeNode extends PPTNodeBase {
	type: "shape"
	/** 形状类型 */
	shapeType: "rect" | "roundRect" | "ellipse" | "custGeom"
	/** 填充 */
	fill: PPTFill | null
	/** 边框线 */
	line: PPTLine | null
	/** 阴影 */
	shadow: PPTShadow | null
	/** 圆角半径 (英寸) */
	radius?: number
	/** custGeom 路径点 (shapeType === "custGeom" 时使用) */
	points?: CustGeomPoint[]
	/** 柔化边缘半径 (磅) */
	softEdge?: number
	/** 旋转角度 (度) */
	rotate?: number
}

/** 图片节点 */
export interface PPTImageNode extends PPTNodeBase {
	type: "image"
	/** 图片源 (URL 或 base64) */
	src: string
	/** 截图来源 */
	capture?: "snapdom"
	/** 截图目标元素 */
	captureElement?: Element
	/** 仅截取元素背景（不含子元素），用于多值渐变背景的降级处理 */
	captureBackgroundOnly?: boolean
	/** 缩放模式 */
	sizing: "cover" | "contain" | "crop" | "stretch"
	/** 裁剪区域 */
	cropRect?: { x: number; y: number; w: number; h: number }
	/** 圆角半径 */
	radius?: number
	/** 透明度 (0-100) */
	transparency?: number
}

/** 文本渐变 */
export type PPTTextGradient = PPTLinearGradientFill | PPTRadialGradientFill

/** 文本节点（每个 DOM Text Node 对应一个独立文本框） */
export interface PPTTextNode extends PPTNodeBase {
	type: "text"
	/** 纯文本内容 */
	text: string
	/** 字号 (pt) */
	fontSize: number
	/** 字体 */
	fontFace: string
	/** 颜色 (HEX 或 渐变对象) */
	color: string | PPTTextGradient
	/** 粗体 */
	bold: boolean
	/** 斜体 */
	italic: boolean
	/** 下划线 */
	underline: boolean
	/** 删除线 */
	strike?: boolean
	/** 水平对齐 */
	align?: "left" | "center" | "right" | "justify"
	/** 垂直对齐 */
	valign?: "top" | "middle" | "bottom"
	/** 行距 */
	lineSpacing?: number
	/** 是否换行 */
	wrap?: boolean
	/** 透明度 (0-100) */
	transparency?: number
	/** 字间距 (pt) */
	charSpacing?: number
	/** 阴影 */
	shadow?: PPTShadow | null
	/** 外边距 (pt) */
	margin?: [number, number, number, number]
	/** 旋转角度 (度) */
	rotate?: number
	/** 文本描边 (模拟 text-stroke) */
	outline?: {
		color: string
		size: number
		transparency?: number
	}
}

/** 表格节点 */
export interface PPTTableNode extends PPTNodeBase {
	type: "table"
	/** 表格行 */
	rows: PPTTableRow[]
	/** 列宽 (英寸) */
	colWidths: number[]
	/** 行高 (英寸) */
	rowHeights?: number[]
}

/** 单边边框线节点 */
export interface PPTBorderLineNode extends PPTNodeBase {
	type: "borderLine"
	/** 边框位置 */
	side: "top" | "right" | "bottom" | "left"
	/** 线条样式 */
	line: PPTLine
}

/** 媒体节点 */
export interface PPTMediaNode extends PPTNodeBase {
	type: "media"
	/** 媒体类型 */
	mediaType: "video" | "audio" | "online"
	/** 媒体路径 (URL) */
	path?: string
	/** 媒体数据 (base64) */
	data?: string
	/** 在线视频链接 (YouTube 等) */
	link?: string
	/** 封面图 (base64) */
	cover?: string
	/** 文件扩展名 */
	extn?: string
}

/** PPT 节点联合类型 */
export type PPTNode = PPTShapeNode | PPTImageNode | PPTTextNode | PPTTableNode | PPTBorderLineNode | PPTMediaNode

// ============================================================================
// 样式相关类型
// ============================================================================

/** 纯色填充 */
export interface PPTSolidFill {
	type: "solid"
	color: string
	transparency?: number
}

/** 线性渐变填充 */
export interface PPTLinearGradientFill {
	type: "gradient"
	gradientType: "linear"
	/** 渐变节点，position 是 0-1 的比例 */
	stops: Array<{ position: number; color: string; transparency?: number }>
	/** 渐变角度（0-360），0=从左到右，90=从上到下 */
	angle?: number
	/** 是否随形状缩放 */
	scaled?: boolean
	/** 是否随形状旋转 */
	rotWithShape?: boolean
	/** 翻转模式 */
	flip?: "none" | "x" | "xy" | "y"
	/** 平铺矩形设置 */
	tileRect?: { t?: number; r?: number; b?: number; l?: number }
}

/** 径向渐变填充 */
export interface PPTRadialGradientFill {
	type: "gradient"
	gradientType: "radial"
	/** 渐变节点，position 是 0-1 的比例 */
	stops: Array<{ position: number; color: string; transparency?: number }>
	/** 渐变样式: 'circle' (默认) | 'ellipse' */
	style?: "circle" | "ellipse"
	/** 是否随形状旋转 */
	rotWithShape?: boolean
	/** 翻转模式 */
	flip?: "none" | "x" | "xy" | "y"
	/** 平铺矩形设置 */
	tileRect?: { t?: number; r?: number; b?: number; l?: number }
}

/** 填充类型 */
export type PPTFill = PPTSolidFill | PPTLinearGradientFill | PPTRadialGradientFill

/** 兼容旧代码的联合类型别名 (如果需要) */
export type PPTGradientFill = PPTLinearGradientFill | PPTRadialGradientFill

/** 边框线 */
export interface PPTLine {
	color: string
	width: number
	style: "solid" | "dashed" | "dotted"
	transparency?: number
}

/** 阴影 (使用极坐标，匹配 pptxgenjs API) */
export interface PPTShadow {
	/** 阴影类型 */
	type: "outer" | "inner"
	/** 阴影颜色 (HEX) */
	color: string
	/** 模糊半径 (磅) */
	blur: number
	/** 偏移距离 (磅) */
	offset: number
	/** 角度 (度数, 0-360) */
	angle: number
	/** 透明度 (0-1) */
	opacity: number
	
}

/** 表格行 */
export interface PPTTableRow {
	cells: PPTTableCell[]
}

/** 表格单元格边框 */
export interface PPTTableCellBorder {
	color?: string
	/** 边框透明度 (0-100, 0=不透明, 100=完全透明) */
	transparency?: number
	pt?: number
	type?: "solid" | "dash" | "dot" | "none"
}

/** 表格单元格 */
export interface PPTTableCell {
	text: string
	options?: {
		fill?: string
		/** 填充透明度 (0-100, 0=不透明, 100=完全透明) */
		fillTransparency?: number
		color?: string
		fontSize?: number
		bold?: boolean
		align?: "left" | "center" | "right"
		valign?: "top" | "middle" | "bottom"
		colspan?: number
		rowspan?: number
		/** 边距 (英寸) [top, right, bottom, left] 或 number */
		margin?: number | [number, number, number, number]
		border?: PPTTableCellBorder | [PPTTableCellBorder, PPTTableCellBorder, PPTTableCellBorder, PPTTableCellBorder]
	}
}

// ============================================================================
// 解析器上下文
// ============================================================================

/** 解析器上下文 */
export interface ParserContext {
	/** 当前 PPTX 实例 */
	pptx: Pptx
	/** 当前幻灯片 */
	slide: Slide
	/** 当前元素节点 */
	node: ElementNode
	/** iframe window 对象 */
	iWindow: Window
	/** iframe document 对象 */
	iDocument: Document
	/** 幻灯片配置 */
	config: SlideConfig
}
