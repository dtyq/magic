import { PreprocessRule } from "./types"
import { parseTable } from "./utils"

// 匹配 LaTeX 块级公式的正则表达式 - 将移动到条件处理中
export const BLOCK_MATH_REGEX = /\$\$([\s\S]*?)\$\$/g
// 改进的 LaTeX 内联公式正则表达式 - 更精确地匹配数学公式
// 匹配包含数学符号、LaTeX命令或数学运算符的内容
export const INLINE_MATH_REGEX = /\$([^$\n]*(?:[\\+\-*/=^_{}<>]|\\[a-zA-Z]+|[α-ωΑ-Ω])[^$\n]*)\$/g
// 引用格式正则表达式

export const CITATION_REGEX_1 = /\[\[citation:(\d+)\]\]/g
export const CITATION_REGEX_2 = /\[\[citation(\d+)\]\]/g
export const CITATION_REGEX_3 = /\[citation:(\d+)\]/g
export const CITATION_REGEX_4 = /\[citation(\d+)\]/g
// GFM 相关正则

export const STRIKETHROUGH_REGEX = /~~(.+?)~~/g
export const TASK_LIST_REGEX = /^(\s*)-\s+\[(x| )\]\s+(.+)$/gm
// GFM 表格正则表达式 - 修复版本，能正确匹配markdown表格
// 第一组：表头行，第二组：分隔符行（主要包含横线），第三组：数据行
export const TABLE_REGEX =
	/^\s*(\|[^\n]*\|)\s*\n\s*(\|[\s\-:|\s]*\|)\s*\n((?:\s*\|[^\n]*\|\s*(?:\n|$))*)/gm
// 链接图片正则表达式 - 匹配 [![alt](img_url)](link_url) 格式
export const LINKED_IMAGE_REGEX = /\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/g
// GFM 分割线正则表达式 - 匹配 ---, ***, ___ 格式
export const HORIZONTAL_RULE_REGEX = /^(?:---+|\*\*\*+|___+)$/gm
// 脚注引用正则表达式 - 匹配 [^1] 格式
export const FOOTNOTE_REF_REGEX = /\[\^([^\]]+)\]/g
// 脚注定义正则表达式 - 匹配 [^1]: 内容 格式
export const FOOTNOTE_DEF_REGEX = /^\[\^([^\]]+)\]:\s*(.+?)(?=\n\n|\n$|$)/gms
// 缩写定义正则表达式 - 匹配 *[HTML]: HyperText Markup Language 格式
export const ABBREVIATION_DEF_REGEX = /^\*\[([^\]]+)\]:\s*(.+)$/gm
// 多级任务列表正则表达式 - 支持嵌套的任务列表
export const NESTED_TASK_LIST_REGEX = /^(\s*)-\s+\[(x| )\]\s+(.+)$/gm

// 上标和下标正则表达式
export const SUPERSCRIPT_REGEX = /\^([^^\s]+)\^/g
export const SUBSCRIPT_REGEX = /~([^~\s]+)~/g

// Reference links support - 参考链接支持
// 匹配参考链接定义: [1]: https://example.com "title"
export const REFERENCE_LINK_DEF_REGEX = /^\s*\[([^\]]+)\]:\s*([^\s]+)(?:\s+"([^"]*)")?\s*$/gm
// 匹配参考链接使用: [text][1] or [text]
export const REFERENCE_LINK_USE_REGEX = /\[([^\]]+)\](?:\[([^\]]*)\])?/g

export const defaultPreprocessRules: PreprocessRule[] = [
	// 移除块级公式处理 - 将在条件处理中添加
	{
		regex: CITATION_REGEX_1,
		replace: (_, index) => `<MagicCitation index="${index}" />`,
	},
	{
		regex: CITATION_REGEX_2,
		replace: (_, index) => `<MagicCitation index="${index}" />`,
	},
	{
		regex: CITATION_REGEX_3,
		replace: (_, index) => `<MagicCitation index="${index}" />`,
	},
	{
		regex: CITATION_REGEX_4,
		replace: (_, index) => `<MagicCitation index="${index}" />`,
	},
	{
		regex: LINKED_IMAGE_REGEX,
		replace: (_, altText, imgUrl, linkUrl) =>
			`<a href="${linkUrl}"><img src="${imgUrl}" alt="${altText}" /></a>`,
	},
	{
		regex: HORIZONTAL_RULE_REGEX,
		replace: () => `<hr />`,
	},
	{
		regex: STRIKETHROUGH_REGEX,
		replace: (_, content) => `<span class="strikethrough">${content}</span>`,
	},
	{
		regex: TASK_LIST_REGEX,
		replace: (_, indent, checked, content) => {
			const level = Math.floor(indent.length / 2) // 每2个空格为一级
			const marginLeft = level * 20 // 每级缩进20px
			return `<li class="task-list-item" data-checked="${checked}" style="margin-left: ${marginLeft}px;">${content}</li>`
		},
	},
	{
		regex: FOOTNOTE_DEF_REGEX,
		replace: (_, id, content) =>
			`<div class="footnote" id="fn-${id}"><p>${content} <a href="#fnref-${id}" class="footnote-backref">↩</a></p></div>`,
	},
	{
		regex: FOOTNOTE_REF_REGEX,
		replace: (_, id) =>
			`<sup class="footnote-ref"><a href="#fn-${id}" id="fnref-${id}">${id}</a></sup>`,
	},
	{
		regex: ABBREVIATION_DEF_REGEX,
		replace: () => "", // 缩写定义不显示，只用于后续替换
	},
	{
		regex: TABLE_REGEX,
		replace: (_, header, separator, rows) => parseTable(header, separator, rows),
	},
	{
		regex: SUPERSCRIPT_REGEX,
		replace: (_, content) => `<sup>${content}</sup>`,
	},
	{
		regex: SUBSCRIPT_REGEX,
		replace: (_, content) => `<sub>${content}</sub>`,
	},
]
