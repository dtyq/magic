import { memo } from "react"
import { createStyles } from "antd-style"
import "katex/dist/katex.min.css"
import katex from "katex"

interface KaTeXProps {
	math: string
	inline?: boolean
}

const useStyles = createStyles(({ token, css }) => ({
	inlineKatex: css`
		display: inline;
		max-width: 100%;

		/* 完全不干预KaTeX的内部样式和定位 */
	`,
	blockKatex: css`
		display: block;
		text-align: center;
		margin: 20px 0;
		padding: 16px 8px;
		width: 100%;
		overflow-x: auto;
		border-radius: ${token.borderRadius}px;
		transition: all 0.2s ease;

		/* 移动端响应式 */
		@media (max-width: 768px) {
			margin: 16px 0;
			padding: 12px 4px;
		}

		/* 保持KaTeX原生的display样式 */
		.katex-display {
			margin: 0;
			/* 不使用flex，保持KaTeX原生布局 */
		}

		.katex {
			font-size: 1.1em;

			/* 移动端字体大小调整 */
			@media (max-width: 768px) {
				font-size: 1em;
			}
		}

		/* 鼠标悬停效果 */
		&:hover {
			background-color: ${token.colorFillAlter};
			box-shadow: 0 2px 4px ${token.colorBorderSecondary};
			transform: translateY(-1px);
		}

		/* 深色主题支持 */
		@media (prefers-color-scheme: dark) {
			&:hover {
				background-color: ${token.colorFillQuaternary};
			}
		}
	`,
	errorFallback: css`
		display: inline-block;
		color: ${token.colorError};
		background-color: ${token.colorErrorBg};
		padding: 2px 6px;
		border-radius: ${token.borderRadiusSM}px;
		font-family: monospace;
		font-size: 0.9em;
		border: 1px solid ${token.colorErrorBorder};
	`,
}))

function KaTeX({ math, inline = false }: KaTeXProps) {
	const { styles } = useStyles()

	if (!math) return null

	if (typeof math !== "string") {
		console.error("KaTeX: math prop is not a string", math)
		return <span className={styles.errorFallback}>Error: Invalid math content</span>
	}

	try {
		const html = katex.renderToString(math, {
			throwOnError: false,
			displayMode: !inline,
			strict: false,
			trust: false,
			output: "html",
			fleqn: false, // 不左对齐公式
			macros: {
				"\\RR": "\\mathbb{R}",
				"\\NN": "\\mathbb{N}",
				"\\ZZ": "\\mathbb{Z}",
				"\\QQ": "\\mathbb{Q}",
				"\\CC": "\\mathbb{C}",
				"\\epsilon": "\\varepsilon",
				"\\phi": "\\varphi",
			},
		})

		// 检查是否渲染出错
		if (html.includes("katex-error")) {
			return (
				<span className={styles.errorFallback}>{inline ? `$${math}$` : `$$${math}$$`}</span>
			)
		}

		return (
			<span
				className={inline ? styles.inlineKatex : styles.blockKatex}
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		)
	} catch (error) {
		console.error("KaTeX rendering error:", error, "Math:", math)
		return <span className={styles.errorFallback}>{inline ? `$${math}$` : `$$${math}$$`}</span>
	}
}

export default memo(KaTeX)
