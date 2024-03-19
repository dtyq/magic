/** 像素转点数的比例 (1px = 0.75pt) */
export const PX_TO_PT_RATIO = 0.75
/** 默认 DPI */
export const DEFAULT_DPI = 96
/** 文本框水平安全边距 (px) */
export const TEXT_SAFETY_MARGIN_X = 4
/** 文本框垂直安全边距 (px) */
export const TEXT_SAFETY_MARGIN_Y = 2

/** 判断单行文本的行高阈值 (倍数) */
export const LINE_HEIGHT_THRESHOLD = 1.5

/** 判断是否需要换行的阈值 (倍数) */
export const WRAP_THRESHOLD = 1.15

/** 字体映射表 (Web 字体 -> 系统字体) */
export const FONT_MAPPING: Record<string, string> = {
	// 中文字体
	"PingFang SC": "Microsoft YaHei",
	"Hiragino Sans GB": "Microsoft YaHei",
	"Noto Sans SC": "Microsoft YaHei",
	"Source Han Sans SC": "Microsoft YaHei",
	"思源黑体": "Microsoft YaHei",
	"微软雅黑": "Microsoft YaHei",
	"苹方": "Microsoft YaHei",

	// 英文字体
	Roboto: "Arial",
	"Open Sans": "Arial",
	Lato: "Arial",
	Montserrat: "Arial",
	"Helvetica Neue": "Arial",
	Helvetica: "Arial",
	"SF Pro": "Arial",

	// 等宽字体
	"Fira Code": "Consolas",
	"Source Code Pro": "Consolas",
	"JetBrains Mono": "Consolas",
	Monaco: "Consolas",
}
