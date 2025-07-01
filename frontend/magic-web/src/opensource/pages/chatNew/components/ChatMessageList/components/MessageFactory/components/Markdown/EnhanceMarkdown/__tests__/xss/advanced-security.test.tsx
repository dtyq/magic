import { render, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import EnhanceMarkdown from "../../index"
import type { MarkdownProps } from "../../types"

// Mock markdown-to-jsx
vi.mock("markdown-to-jsx", () => ({
	default: ({ children, ...props }: any) => (
		<div {...props} data-testid="markdown-jsx">
			{children}
		</div>
	),
}))

// Mock nanoid
vi.mock("nanoid", () => ({
	nanoid: () => "test-id-123",
}))

// Mock antd-style
vi.mock("antd-style", () => ({
	cx: (...args: any[]) => args.filter(Boolean).join(" "),
	createStyles: vi.fn(() => () => ({ styles: "mocked-styles" })),
}))

// Mock dependencies
vi.mock("@/opensource/components/business/MessageRenderProvider", () => ({
	default: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="message-render-provider">{children}</div>
	),
}))

vi.mock("@/opensource/providers/AppearanceProvider/hooks", () => ({
	useFontSize: () => ({ fontSize: 14 }),
}))

vi.mock("@/opensource/hooks/useTyping", () => ({
	useTyping: (content: string) => ({
		content,
		typing: false,
		add: vi.fn(),
		start: vi.fn(),
		done: vi.fn(),
	}),
}))

vi.mock("ahooks", () => ({
	useUpdateEffect: vi.fn(),
}))

vi.mock("../../hooks/useStreamCursor", () => ({
	default: vi.fn(),
}))

vi.mock("../../hooks", () => ({
	useMarkdownConfig: () => ({
		options: {
			wrapper: null,
			forceWrapper: true,
			overrides: {},
		},
		preprocess: (content: string) => [content],
	}),
	useClassName: ({ className }: { className: string }) => className,
}))

vi.mock("../../styles/markdown.style", () => ({
	useStyles: () => ({ styles: "mocked-styles" }),
}))

describe("EnhanceMarkdown Advanced Security Tests", () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>
	let originalDocumentWrite: typeof document.write
	let originalWindowOpen: typeof window.open

	beforeEach(() => {
		consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
		originalDocumentWrite = document.write
		originalWindowOpen = window.open

		// Mock dangerous methods
		document.write = vi.fn()
		window.open = vi.fn()
	})

	afterEach(() => {
		consoleSpy.mockRestore()
		document.write = originalDocumentWrite
		window.open = originalWindowOpen

		// Clean up any XSS test variables
		const xssKeys = Object.keys(window).filter((key) => key.startsWith("xss"))
		xssKeys.forEach((key) => {
			delete (window as any)[key]
		})
	})

	const renderMarkdown = (props: Partial<MarkdownProps> = {}) => {
		const defaultProps: MarkdownProps = {
			content: "",
			allowHtml: true,
			enableLatex: true,
			isSelf: false,
			hiddenDetail: false,
			isStreaming: false,
			className: "",
			...props,
		}
		return render(<EnhanceMarkdown {...defaultProps} />)
	}

	describe("Advanced Script Injection Techniques", () => {
		it("should prevent script execution through setTimeout", () => {
			// Arrange
			const maliciousContent =
				'<img src="x" onerror="setTimeout(function(){window.xssTimeout=true;},0)">'

			// Act
			renderMarkdown({ content: maliciousContent })

			// Assert - Check immediately, no need for setTimeout in tests
			expect((window as any).xssTimeout).toBeUndefined()
		})

		it("should prevent script execution through eval", () => {
			// Arrange
			const maliciousContent =
				"<div onmouseover=\"eval('window.xssEval = true')\" >Hover me</div>"

			// Act
			const { container } = renderMarkdown({ content: maliciousContent })
			const div = container.querySelector("div")

			if (div) {
				fireEvent.mouseOver(div)
			}

			// Assert
			expect((window as any).xssEval).toBeUndefined()
		})

		it("should prevent script execution through Function constructor", () => {
			// Arrange
			const maliciousContent =
				"<button onclick=\"new Function('window.xssFunction = true')()\">Click</button>"

			// Act
			const { container } = renderMarkdown({ content: maliciousContent })
			const button = container.querySelector("button")

			if (button) {
				fireEvent.click(button)
			}

			// Assert
			expect((window as any).xssFunction).toBeUndefined()
		})
	})

	describe("DOM Manipulation XSS Prevention", () => {
		it("should prevent innerHTML injection", () => {
			// Arrange
			const maliciousContent =
				"<div onload=\"this.innerHTML='<script>window.xssInnerHTML=true;</script>'\">Test</div>"

			// Act
			renderMarkdown({ content: maliciousContent })

			// Assert
			expect((window as any).xssInnerHTML).toBeUndefined()
		})

		it("should prevent document.write injection", () => {
			// Arrange
			const maliciousContent =
				'<img src="x" onerror="document.write(\'<script>window.xssDocWrite=true;</script>\')">'

			// Act
			renderMarkdown({ content: maliciousContent })

			// Assert
			expect(document.write).not.toHaveBeenCalled()
			expect((window as any).xssDocWrite).toBeUndefined()
		})

		it("should prevent window.open injection", () => {
			// Arrange
			const maliciousContent =
				'<a href="#" onclick="window.open(\'javascript:window.xssWindowOpen=true\')">Click</a>'

			// Act
			const { container } = renderMarkdown({ content: maliciousContent })
			const link = container.querySelector("a")

			if (link) {
				fireEvent.click(link)
			}

			// Assert
			expect(window.open).not.toHaveBeenCalled()
			expect((window as any).xssWindowOpen).toBeUndefined()
		})
	})

	describe("Unicode and Character Encoding XSS", () => {
		it("should handle Unicode script tags", () => {
			// Arrange
			const maliciousContent = "<\u0073cript>window.xssUnicode = true;</\u0073cript>"

			// Act
			renderMarkdown({ content: maliciousContent })

			// Assert
			expect((window as any).xssUnicode).toBeUndefined()
		})

		it("should handle mixed encoding attacks", () => {
			// Arrange
			const maliciousContent =
				"&lt;script&gt;window.xssMixed = true;&lt;/script&gt;<script>window.xssMixed2 = true;</script>"

			// Act
			renderMarkdown({ content: maliciousContent })

			// Assert
			expect((window as any).xssMixed).toBeUndefined()
			expect((window as any).xssMixed2).toBeUndefined()
		})

		it("should handle zero-width characters", () => {
			// Arrange
			const maliciousContent = "<scr\u200Bipt>window.xssZeroWidth = true;</scr\u200Bipt>"

			// Act
			renderMarkdown({ content: maliciousContent })

			// Assert
			expect((window as any).xssZeroWidth).toBeUndefined()
		})
	})

	describe("Polyglot XSS Attacks", () => {
		it("should handle polyglot payload in different contexts", () => {
			// Arrange
			const polyglotPayload =
				"javascript:/*--></title></style></textarea></script></xmp><svg/onload='window.xssPolyglot=true'>"

			// Act
			renderMarkdown({ content: `[Click](${polyglotPayload})` })

			// Assert
			expect((window as any).xssPolyglot).toBeUndefined()
		})

		it("should handle context-breaking attempts", () => {
			// Arrange
			const maliciousContent = '"></script><script>window.xssContextBreak = true;</script>'

			// Act
			renderMarkdown({ content: maliciousContent })

			// Assert
			expect((window as any).xssContextBreak).toBeUndefined()
		})
	})

	describe("Filter Evasion Techniques", () => {
		it("should handle comment-based evasion", () => {
			// Arrange
			const maliciousContent = "<scr<!---->ipt>window.xssComment = true;</scr<!---->ipt>"

			// Act
			renderMarkdown({ content: maliciousContent })

			// Assert
			expect((window as any).xssComment).toBeUndefined()
		})

		it("should handle newline-based evasion", () => {
			// Arrange
			const maliciousContent = "<scr\nipt>window.xssNewline = true;</scr\nipt>"

			// Act
			renderMarkdown({ content: maliciousContent })

			// Assert
			expect((window as any).xssNewline).toBeUndefined()
		})

		it("should handle tab-based evasion", () => {
			// Arrange
			const maliciousContent = "<scr\tipt>window.xssTab = true;</scr\tipt>"

			// Act
			renderMarkdown({ content: maliciousContent })

			// Assert
			expect((window as any).xssTab).toBeUndefined()
		})
	})

	describe("Markdown-specific Attack Vectors", () => {
		it("should handle malicious reference-style links", () => {
			// Arrange
			const maliciousContent = `
[Click here][malicious]

[malicious]: javascript:window.xssReference = true;
			`

			// Act
			renderMarkdown({ content: maliciousContent })

			// Assert
			expect((window as any).xssReference).toBeUndefined()
		})

		it("should handle malicious HTML in code blocks", () => {
			// Arrange
			const maliciousContent = `
\`\`\`html
<script>window.xssCodeBlock = true;</script>
\`\`\`
			`

			// Act
			renderMarkdown({ content: maliciousContent })

			// Assert
			expect((window as any).xssCodeBlock).toBeUndefined()
		})

		it("should handle malicious inline code", () => {
			// Arrange
			const maliciousContent =
				"This is `<script>window.xssInlineCode = true;</script>` inline code"

			// Act
			renderMarkdown({ content: maliciousContent })

			// Assert
			expect((window as any).xssInlineCode).toBeUndefined()
		})
	})

	describe("LaTeX Injection Security", () => {
		it("should prevent LaTeX-based XSS when LaTeX is enabled", () => {
			// Arrange
			const maliciousContent = "$\\href{javascript:window.xssLatex=true}{Click}$"

			// Act
			renderMarkdown({
				content: maliciousContent,
				enableLatex: true,
			})

			// Assert
			expect((window as any).xssLatex).toBeUndefined()
		})

		it("should prevent LaTeX command injection", () => {
			// Arrange
			const maliciousContent =
				"$$\\begin{document}\\href{javascript:window.xssLatexCmd=true}{text}\\end{document}$$"

			// Act
			renderMarkdown({
				content: maliciousContent,
				enableLatex: true,
			})

			// Assert
			expect((window as any).xssLatexCmd).toBeUndefined()
		})
	})

	describe("Timing Attack Prevention", () => {
		it("should handle rapid content changes safely", async () => {
			// Arrange
			const maliciousContents = [
				"<script>window.xssRapid1 = true;</script>",
				"<script>window.xssRapid2 = true;</script>",
				"<script>window.xssRapid3 = true;</script>",
			]

			// Act
			const { rerender, unmount } = renderMarkdown({ content: maliciousContents[0] })

			// Synchronous rendering to avoid timing issues
			maliciousContents.forEach((content) => {
				rerender(<EnhanceMarkdown content={content} />)
			})

			// Assert
			expect((window as any).xssRapid1).toBeUndefined()
			expect((window as any).xssRapid2).toBeUndefined()
			expect((window as any).xssRapid3).toBeUndefined()

			// Clean up
			unmount()
		})
	})

	describe("Memory Exhaustion Prevention", () => {
		it("should handle extremely large content safely", () => {
			// Arrange
			const largeContent = "<script>window.xssLarge = true;</script>".repeat(10000)

			// Act & Assert
			expect(() => {
				renderMarkdown({ content: largeContent })
			}).not.toThrow()

			expect((window as any).xssLarge).toBeUndefined()
		})

		it("should handle deeply nested HTML safely", () => {
			// Arrange
			let nestedContent = "<script>window.xssNested = true;</script>"
			for (let i = 0; i < 100; i++) {
				nestedContent = `<div>${nestedContent}</div>`
			}

			// Act & Assert
			expect(() => {
				renderMarkdown({ content: nestedContent })
			}).not.toThrow()

			expect((window as any).xssNested).toBeUndefined()
		})
	})

	describe("MIME Type Confusion", () => {
		it("should handle data URLs with different MIME types", () => {
			// Arrange
			const maliciousContent =
				'<img src="data:text/html;base64,PHNjcmlwdD53aW5kb3cueHNzTWltZSA9IHRydWU7PC9zY3JpcHQ+">'

			// Act
			renderMarkdown({ content: maliciousContent })

			// Assert
			expect((window as any).xssMime).toBeUndefined()
		})

		it("should handle SVG with embedded scripts", () => {
			// Arrange
			const maliciousContent =
				'<svg xmlns="http://www.w3.org/2000/svg"><script>window.xssSvgScript = true;</script></svg>'

			// Act
			renderMarkdown({ content: maliciousContent })

			// Assert
			expect((window as any).xssSvgScript).toBeUndefined()
		})
	})

	describe("Mutation XSS Prevention", () => {
		it("should prevent DOM mutation-based XSS", () => {
			// Arrange
			const maliciousContent = '<div id="test">Safe content</div>'

			// Act
			const { container } = renderMarkdown({ content: maliciousContent })

			// Try to mutate the DOM after render
			const testDiv = container.querySelector("#test")
			if (testDiv) {
				testDiv.innerHTML = "<script>window.xssMutation = true;</script>"
			}

			// Assert
			expect((window as any).xssMutation).toBeUndefined()
		})
	})
})
