import type { MarkedExtension } from "marked"
import { parseMarkdownFileLinkSyntaxAt } from "./markdownFileLinkSyntax"

// 只扩展完整的裸空格文件目标；标准链接、代码和未完成的流式内容仍由 Marked 处理。
export const spacedFileLinkConfig: MarkedExtension = {
	tokenizer: {
		link(source) {
			const match = parseMarkdownFileLinkSyntaxAt(source, 0)
			if (!match?.compatible) return false
			return match.image
				? {
						type: "image",
						raw: match.fullMatch,
						href: match.href,
						title: null,
						text: match.label,
						tokens: this.lexer.inlineTokens(match.rawLabel),
					}
				: {
						type: "link",
						raw: match.fullMatch,
						href: match.href,
						title: null,
						text: match.label,
						tokens: this.lexer.inlineTokens(match.rawLabel),
					}
		},
	},
}
