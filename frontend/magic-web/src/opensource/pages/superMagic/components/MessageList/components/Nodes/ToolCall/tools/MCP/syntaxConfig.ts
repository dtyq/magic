// SyntaxHighlighter 共享配置

// 自定义语法高亮主题
export const customTheme = {
	'code[class*="language-"]': {
		color: "#FFFFFF",
		background: "#000000",
		fontFamily: '"JetBrains Mono", "Roboto", monospace',
		fontSize: "12px",
		fontWeight: 500,
		textAlign: "left" as const,
		whiteSpace: "pre" as const,
		wordSpacing: "normal",
		wordBreak: "normal" as const,
		wordWrap: "normal" as const,
		lineHeight: 1.5,
		tabSize: 4,
		hyphens: "none" as const,
	},
	'pre[class*="language-"]': {
		color: "#FFFFFF",
		background: "#000000",
		fontFamily: '"JetBrains Mono", "Roboto", monospace',
		fontSize: "12px",
		fontWeight: 500,
		textAlign: "left" as const,
		whiteSpace: "pre" as const,
		wordSpacing: "normal",
		wordBreak: "normal" as const,
		wordWrap: "normal" as const,
		lineHeight: 1.5,
		tabSize: 4,
		hyphens: "none" as const,
		padding: "10px",
		margin: 0,
		overflow: "auto" as const,
	},
	punctuation: {
		color: "#FFFFFF",
	},
	property: {
		color: "#ff9500",
	},
	string: {
		color: "#32c436",
	},
	number: {
		color: "#32c436",
	},
	boolean: {
		color: "#32c436",
	},
	null: {
		color: "#32c436",
	},
	"attr-name": {
		color: "#ff9500",
	},
	"attr-value": {
		color: "#32c436",
	},
	keyword: {
		color: "#ff9500",
	},
	textSecondary: {
		color: "#6B7280",
	},
}

// SyntaxHighlighter customStyle 配置
export const syntaxCustomStyle = {
	background: "#000000",
	margin: 0,
	padding: "12px",
	fontSize: "12px",
	lineHeight: "1.5",
}

// SyntaxHighlighter lineNumberStyle 配置
export const syntaxLineNumberStyle = {
	color: customTheme.textSecondary.color,
	fontSize: "12px",
	marginRight: "12px",
	paddingRight: 0,
	userSelect: "none" as const,
	textAlign: "center" as const,
	minWidth: "24px",
}
