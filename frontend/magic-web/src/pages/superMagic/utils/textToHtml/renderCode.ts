import { highlight, languages } from "@/infrastructure/vendors/prismjs"
import { wrapInHtmlTemplate, type TemplateOptions } from "./baseTemplate"

export interface RenderCodeOptions extends Partial<TemplateOptions> {
	language?: string
	showLineNumbers?: boolean
}

/** prismjs light theme (类 VS Code Light+) */
const PRISM_LIGHT_CSS = `
.token.comment, .token.prolog, .token.doctype, .token.cdata { color: #6a9955; }
.token.punctuation { color: #393a34; }
.token.property, .token.tag, .token.boolean, .token.number, .token.constant, .token.symbol, .token.deleted { color: #0451a5; }
.token.selector, .token.attr-name, .token.string, .token.char, .token.builtin, .token.inserted { color: #a31515; }
.token.operator, .token.entity, .token.url { color: #393a34; }
.token.atrule, .token.attr-value, .token.keyword { color: #0000ff; }
.token.function, .token.class-name { color: #795e26; }
.token.regex, .token.important, .token.variable { color: #ee9900; }
`

/** prismjs dark theme (类 One Dark) */
const PRISM_DARK_CSS = `
.token.comment, .token.prolog, .token.doctype, .token.cdata { color: #6a9955; }
.token.punctuation { color: #abb2bf; }
.token.property, .token.tag, .token.boolean, .token.number, .token.constant, .token.symbol, .token.deleted { color: #d19a66; }
.token.selector, .token.attr-name, .token.string, .token.char, .token.builtin, .token.inserted { color: #98c379; }
.token.operator, .token.entity, .token.url { color: #56b6c2; }
.token.atrule, .token.attr-value, .token.keyword { color: #c678dd; }
.token.function, .token.class-name { color: #61afef; }
.token.regex, .token.important, .token.variable { color: #e06c75; }
`

const LINE_NUMBER_CSS = `
.line-numbers .line-num {
	display: inline-block;
	width: 3em;
	margin-right: 1em;
	text-align: right;
	color: #6b7280;
	user-select: none;
}
`

export function renderCode(content: string, options: RenderCodeOptions = {}): string {
	const { language = "plaintext", showLineNumbers = true, ...templateOpts } = options
	const isDark = templateOpts.theme === "dark"

	const grammar = languages[language]
	let highlighted: string
	if (grammar) {
		highlighted = highlight(content, grammar, language)
	} else {
		// 不支持的语言，fallback 到纯文本转义
		highlighted = escapeHtml(content)
	}

	// 按行包裹，支持行号显示
	const lines = highlighted.split("\n")
	const wrappedLines = showLineNumbers
		? lines
				.map(
					(line, i) =>
						`<span class="line"><span class="line-num">${i + 1}</span>${line || " "}</span>`,
				)
				.join("\n")
		: lines.map((line) => `<span class="line">${line || " "}</span>`).join("\n")

	const lineNumClass = showLineNumbers ? " line-numbers" : ""
	const body = `<pre class="code-block${lineNumClass}"><code class="language-${language}">${wrappedLines}</code></pre>`

	const themeCss = isDark ? PRISM_DARK_CSS : PRISM_LIGHT_CSS
	const extraCss = `
pre.code-block {
	margin: 0;
	padding: 20px;
	overflow-x: auto;
	border-radius: 8px;
	background: ${isDark ? "#282c34" : "#f8f9fa"};
}
pre.code-block code {
	display: block;
	white-space: pre;
	font-family: ${templateOpts.fontFamily ?? "'SF Mono', 'Fira Code', Menlo, Consolas, monospace"};
	font-size: ${templateOpts.fontSize ?? 13}px;
	line-height: 1.6;
}
${themeCss}
${showLineNumbers ? LINE_NUMBER_CSS : ""}
`

	return wrapInHtmlTemplate(body, { ...templateOpts, padding: 24 }).replace(
		"</style>",
		`${extraCss}\n</style>`,
	)
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
}
