import { EXPRESSION_VALUE, VALUE_TYPE } from "./types"

export const JSONPATH_JOIN_CHAR = "."

export const STRING_FORMATS = [
	{ name: "date-time" },
	{ name: "date" },
	{ name: "email" },
	{ name: "hostname" },
	{ name: "ipv4" },
	{ name: "ipv6" },
	{ name: "uri" },
]

export const MOCK_SOURCE = [
	{ name: "字符串", mock: "@string" },
	{ name: "自然数", mock: "@natural" },
	{ name: "浮点数", mock: "@float" },
	{ name: "字符", mock: "@character" },
	{ name: "布尔", mock: "@boolean" },
	{ name: "url", mock: "@url" },
	{ name: "域名", mock: "@domain" },
	{ name: "ip地址", mock: "@ip" },
	{ name: "id", mock: "@id" },
	{ name: "guid", mock: "@guid" },
	{ name: "当前时间", mock: "@now" },
	{ name: "时间戳", mock: "@timestamp" },
	{ name: "日期", mock: "@date" },
	{ name: "时间", mock: "@time" },
	{ name: "日期时间", mock: "@datetime" },
	{ name: "图片连接", mock: "@image" },
	{ name: "图片data", mock: "@imageData" },
	{ name: "颜色", mock: "@color" },
	{ name: "颜色hex", mock: "@hex" },
	{ name: "颜色rgba", mock: "@rgba" },
	{ name: "颜色rgb", mock: "@rgb" },
	{ name: "颜色hsl", mock: "@hsl" },
	{ name: "整数", mock: "@integer" },
	{ name: "email", mock: "@email" },
	{ name: "大段文本", mock: "@paragraph" },
	{ name: "句子", mock: "@sentence" },
	{ name: "单词", mock: "@word" },
	{ name: "大段中文文本", mock: "@cparagraph" },
	{ name: "中文标题", mock: "@ctitle" },
	{ name: "标题", mock: "@title" },
	{ name: "姓名", mock: "@name" },
	{ name: "中文姓名", mock: "@cname" },
	{ name: "中文姓", mock: "@cfirst" },
	{ name: "中文名", mock: "@clast" },
	{ name: "英文姓", mock: "@first" },
	{ name: "英文名", mock: "@last" },
	{ name: "中文句子", mock: "@csentence" },
	{ name: "中文词组", mock: "@cword" },
	{ name: "地址", mock: "@region" },
	{ name: "省份", mock: "@province" },
	{ name: "城市", mock: "@city" },
	{ name: "地区", mock: "@county" },
	{ name: "转换为大写", mock: "@upper" },
	{ name: "转换为小写", mock: "@lower" },
	{ name: "挑选（枚举）", mock: "@pick" },
	{ name: "打乱数组", mock: "@shuffle" },
	{ name: "协议", mock: "@protocol" },
]

export const SCHEMA_TYPE = [
	"object",
	"array",
	"string",
	"number",
	"boolean",
	//   'integer', 暂时关闭
]

export const ONLY_JSON_ROOT = ["object", "array"]

// 键盘按键keyCode对照
export const KeyCodeMap = {
	ENTER: 13,
	TAB: 9,
	C: 67,
	V: 86,
	D: 68,
	F: 70,
	X: 88,
	A: 65,
	S: 83,
	UP: 38,
	Z: 90,
	Y: 89,
	RIGHT: 39,
	DOWN: 40,
	LEFT: 37,
	COMMAND: 91,
	DELETE: 46,
	BACKSPACE: 8,
	ESC: 27,
}

// 参数值类型
export const enum ValueType {
	CONST = "const",
	EXPRESSION = "expression",
}

// 参数值类型对应的字段名称
export const FieldsName = {
	[ValueType.CONST]: "const_value",
	[ValueType.EXPRESSION]: "ExpressionValue",
}

/** 表达式模式 */
export enum ExpressionMode {
	/** 普通场景 */
	Common = "common",
	/** 文本域 */
	TextArea = "textarea",
}

export const TextAreaModeTrigger = "@"
export const TextAreaModePanelHeight = 120

export const defaultExpressionValue = {
	type: VALUE_TYPE.CONST,
	const_value: [] as EXPRESSION_VALUE[],
	expression_value: [] as EXPRESSION_VALUE[]
}


export const SystemNodeSuffix = "_system"