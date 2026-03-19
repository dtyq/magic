export const FALLBACK_LANG = "txt"

/**
 * 生成代码块
 * @param lang 语言
 * @param code 代码
 * @returns
 */
export const genCodeSection = (lang: string | undefined, code: string) => {
	return `
\`\`\`${lang ?? FALLBACK_LANG}
${code}
\`\`\`
`
}
