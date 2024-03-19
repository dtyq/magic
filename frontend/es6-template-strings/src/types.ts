/** 解析器配置 */
export interface CompileOptions {
	/** 字符串模版语法的前缀 */
	notation?: string
	/** 字符串模版语法的开始标记 */
	notationStart?: string
	/** 字符串模版语法的结束标记 */
	notationEnd?: string
}

export interface ResolveOptions {
	/** 解析失败是否跳过解析，不跳过则解析失败为 undefined */
	partial?: boolean
}

/** 字符串模版解析配置 */
export interface TemplateOptions extends CompileOptions, ResolveOptions {}
