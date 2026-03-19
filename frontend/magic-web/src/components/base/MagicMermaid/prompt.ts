export const fixPrompt = (code: string, error: string) => {
	return `
以下是 mermaid 代码：

\`\`\`text
${code}
\`\`\`

报错信息：${error}

请帮我解决报错问题。
  `
}
