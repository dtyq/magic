import { memo, useMemo, useCallback, ClipboardEvent } from "react"
import { useTranslation } from "react-i18next"
import { Flex } from "antd"
// @ts-ignore
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
// Types
import type { McpToolContentProps } from "./types"

// Styles
import { useStyles } from "./styles"

/**
 * McpToolContent - MCP工具详情展示组件
 *
 * @param props - 组件属性
 * @returns JSX.Element
 */
const McpToolContent = memo(({ detail, className }: McpToolContentProps) => {
	const { t } = useTranslation("component")
	const { styles, cx } = useStyles()

	// 定义颜色主题
	const colorTheme = useMemo(
		() => ({
			textPrimary: "#000000",
			textSecondary: "#666666",
			bgCode: "#fafafa",
			keyColor: "#ff9500",
			valueColor: "#32c436",
		}),
		[],
	)

	// 创建自定义语法高亮主题
	const customTheme = useMemo(
		() => ({
			'code[class*="language-"]': {
				color: colorTheme.textPrimary,
				background: colorTheme.bgCode,
				fontFamily: '"JetBrains Mono", "Roboto", monospace',
				fontSize: "12px",
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
				color: colorTheme.textPrimary,
				background: colorTheme.bgCode,
				fontFamily: '"JetBrains Mono", "Roboto", monospace',
				fontSize: "12px",
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
				color: colorTheme.textPrimary,
			},
			property: {
				color: colorTheme.keyColor,
			},
			string: {
				color: colorTheme.valueColor,
			},
			number: {
				color: colorTheme.valueColor,
			},
			boolean: {
				color: colorTheme.valueColor,
			},
			null: {
				color: colorTheme.valueColor,
			},
			"attr-name": {
				color: colorTheme.keyColor,
			},
			"attr-value": {
				color: colorTheme.valueColor,
			},
			keyword: {
				color: colorTheme.keyColor,
			},
		}),
		[colorTheme],
	)

	// 格式化JSON内容
	const formatJson = (content: any) => {
		try {
			if (typeof content === "string") {
				// 尝试解析字符串为JSON
				const parsed = JSON.parse(content)
				return JSON.stringify(parsed, null, 2)
			}
			return JSON.stringify(content, null, 2)
		} catch (error) {
			// 如果解析失败，返回原始内容
			return typeof content === "string" ? content : JSON.stringify(content, null, 2)
		}
	}

	// 解析execution_result.content
	const parseExecutionResult = (content: string) => {
		try {
			// 尝试解析content字符串
			const parsed = JSON.parse(content)
			if (parsed.content && Array.isArray(parsed.content)) {
				const textContent = parsed.content.find((item: any) => item.type === "text")
				if (textContent && textContent.text) {
					// 尝试解析嵌套的JSON
					try {
						const nestedJson = JSON.parse(textContent.text)
						return JSON.stringify(nestedJson, null, 2)
					} catch {
						return textContent.text
					}
				}
			}
			return JSON.stringify(parsed, null, 2)
		} catch (error) {
			// 如果解析失败，返回原始内容
			return content
		}
	}

	// 处理复制事件，过滤掉行号
	const handleCopy = useCallback((e: ClipboardEvent<HTMLDivElement>) => {
		const selection = window.getSelection()?.toString()
		if (selection) {
			// 按行处理，过滤掉行号
			const lines = selection.split("\n")
			const cleanedLines = lines
				.map((line) => {
					// 移除行开头的数字和后面的空白字符
					return line.replace(/^\s*\d+\s*/, "")
				})
				.filter((line) => {
					// 过滤掉空行和只有数字的行
					const trimmed = line.trim()
					return trimmed !== "" && !/^\d+$/.test(trimmed)
				})

			const cleanedText = cleanedLines.join("\n").trim()

			// 设置清理后的文本到剪贴板
			if (e.clipboardData) {
				e.clipboardData.setData("text/plain", cleanedText)
				e.preventDefault()
			}
		}
	}, [])

	const formattedParameters = formatJson(detail.input_parameters)
	const formattedResult = parseExecutionResult(detail.execution_result.content)

	return (
		<Flex vertical className={cx(styles.container, className)}>
			{/* Header */}
			{/* <Flex align="center" gap={4} className={styles.header}>
				<CheckOutlined className={styles.checkIcon} />
				<Flex vertical gap={0}>
					<span className={styles.toolName}>{detail.tool_definition.original_name}</span>
					<span className={styles.serverName}>{detail.tool_definition.server_name}</span>
				</Flex>
			</Flex> */}

			{/* Content */}
			<Flex vertical gap={10} className={styles.content}>
				{/* Parameters Section */}
				<Flex vertical gap={4} className={styles.section}>
					<span className={styles.sectionTitle}>{t("mcpTool.parameters")}</span>
					<div className={styles.codeBlock} onCopy={handleCopy}>
						<SyntaxHighlighter
							language="json"
							style={customTheme}
							customStyle={{
								background: colorTheme.bgCode,
								margin: 0,
								padding: "10px",
								fontSize: "12px",
								lineHeight: "1.5",
							}}
							showLineNumbers={true}
							lineNumberStyle={{
								color: colorTheme.textSecondary,
								fontSize: "12px",
								paddingRight: "10px",
								userSelect: "none",
								textAlign: "center",
								minWidth: "12px",
							}}
						>
							{formattedParameters}
						</SyntaxHighlighter>
					</div>
				</Flex>

				{/* Result Section */}
				<Flex vertical gap={4} className={cx(styles.section, styles.resultSection)}>
					<span className={styles.sectionTitle}>{t("mcpTool.result")}</span>
					<div className={styles.codeBlock} onCopy={handleCopy}>
						<SyntaxHighlighter
							language="json"
							style={customTheme}
							customStyle={{
								background: colorTheme.bgCode,
								margin: 0,
								padding: "10px",
								fontSize: "12px",
								lineHeight: "1.5",
							}}
							showLineNumbers={true}
							lineNumberStyle={{
								color: colorTheme.textSecondary,
								fontSize: "12px",
								paddingRight: "10px",
								userSelect: "none",
								textAlign: "center",
								minWidth: "12px",
							}}
						>
							{formattedResult}
						</SyntaxHighlighter>
					</div>
				</Flex>
			</Flex>
		</Flex>
	)
})

McpToolContent.displayName = "McpToolContent"

export default McpToolContent
