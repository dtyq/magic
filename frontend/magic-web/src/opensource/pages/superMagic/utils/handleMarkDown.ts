// 常见的 HTML 标签白名单
const HTML_TAGS = new Set([
	"a",
	"abbr",
	"address",
	"area",
	"article",
	"aside",
	"audio",
	"b",
	"base",
	"bdi",
	"bdo",
	"blockquote",
	"body",
	"br",
	"button",
	"canvas",
	"caption",
	"cite",
	"code",
	"col",
	"colgroup",
	"data",
	"datalist",
	"dd",
	"del",
	"details",
	"dfn",
	"dialog",
	"div",
	"dl",
	"dt",
	"em",
	"embed",
	"fieldset",
	"figcaption",
	"figure",
	"footer",
	"form",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"head",
	"header",
	"hgroup",
	"hr",
	"html",
	"i",
	"iframe",
	"img",
	"input",
	"ins",
	"kbd",
	"label",
	"legend",
	"li",
	"link",
	"main",
	"map",
	"mark",
	"meta",
	"meter",
	"nav",
	"noscript",
	"object",
	"ol",
	"optgroup",
	"option",
	"output",
	"p",
	"param",
	"picture",
	"pre",
	"progress",
	"q",
	"rp",
	"rt",
	"ruby",
	"s",
	"samp",
	"script",
	"section",
	"select",
	"small",
	"source",
	"span",
	"strong",
	"style",
	"sub",
	"summary",
	"sup",
	"table",
	"tbody",
	"td",
	"template",
	"textarea",
	"tfoot",
	"th",
	"thead",
	"time",
	"title",
	"tr",
	"track",
	"u",
	"ul",
	"var",
	"video",
	"wbr",
	// 自定义标签
	"cursor",
	"file-path",
])

// 预处理 Markdown 内容，只转义 _text_ 而保留 *text*
export const preprocessMarkdown = (content: string) => {
	if (!content) return content

	let processedContent = content

	// 处理 [@file_path:路径] 语法，转换为自定义标签
	processedContent = processedContent.replace(/\[@file_path:(.*?)\]/g, (_, path) => {
		// 对路径进行 HTML 转义，避免属性值中的特殊字符问题
		const escapedPath = path
			.replace(/&/g, "&amp;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;")
		return `<file-path path="${escapedPath}"></file-path>`
	})

	// 重要：必须先处理标签转义，再处理下划线转义
	// 因为标签名可能包含下划线，如 <text_explanation>
	// 如果先转义下划线，会导致标签名被破坏

	// 转义自定义 HTML 标签，防止被当作原生标签渲染
	// 使用一个统一的正则来处理所有情况，避免重复匹配
	// 匹配标签名可以包含字母、数字、下划线、连字符

	processedContent = processedContent.replace(
		new RegExp("</?([a-z][a-z0-9_-]*)((?:\\s+[^>/]*)?)\\s*/?>", "gi"),
		(match, tagName) => {
			// 如果是标准 HTML 标签，不转义
			if (HTML_TAGS.has(tagName.toLowerCase())) {
				return match
			}
			// 自定义标签转义为代码块格式
			return `\`${match}\``
		},
	)

	// 只转义 _text_ 模式，保留 *text* 模式
	// 注意：这个必须在标签转义之后执行
	// 需要排除反引号内的内容，避免转义已经被转义的标签内的下划线
	processedContent = processedContent.replace(/_([^_`]+)_/g, (match, content) => {
		// 检查是否在反引号内
		if (match.includes("<") || match.includes(">")) {
			return match
		}
		return `\\_${content}\\_`
	})

	return processedContent
}
