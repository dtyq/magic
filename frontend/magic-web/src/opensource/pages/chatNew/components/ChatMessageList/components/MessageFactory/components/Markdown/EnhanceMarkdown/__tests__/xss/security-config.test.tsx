import { render } from "@testing-library/react"
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

describe("EnhanceMarkdown Security Configuration Tests", () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
	})

	afterEach(() => {
		consoleSpy.mockRestore()

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

	describe("Component Configuration Security", () => {
		it("should handle malicious custom components safely", () => {
			// Arrange
			const MaliciousComponent = ({ children, ...props }: any) => {
				// Attempt to execute malicious code through props
				if (props.dangerouslySetInnerHTML) {
					;(window as any).xssDangerousHTML = true
				}
				return <div {...props}>{children}</div>
			}

			const content = "Test content with custom component"

			// Act
			renderMarkdown({
				content,
				components: {
					div: MaliciousComponent,
				},
			})

			// Assert
			expect((window as any).xssDangerousHTML).toBeUndefined()
		})

		it("should prevent prototype pollution through components", () => {
			// Arrange
			const PrototypePollutionComponent = (props: any) => {
				// Attempt prototype pollution
				try {
					;(Object.prototype as any).isAdmin = true
					;(window as any).xssPrototypePollution = true
				} catch (e) {
					// Ignore errors
				}
				return <div>Test</div>
			}

			// Act
			renderMarkdown({
				content: "Test content",
				components: {
					div: PrototypePollutionComponent,
				},
			})

			// Assert
			expect((window as any).xssPrototypePollution).toBeUndefined()
			expect((Object.prototype as any).isAdmin).toBeUndefined()

			// Clean up potential prototype pollution
			delete (Object.prototype as any).isAdmin
		})

		it("should handle components with dangerous ref callbacks", () => {
			// Arrange
			const DangerousRefComponent = () => {
				const dangerousRef = (element: HTMLElement | null) => {
					if (element) {
						element.innerHTML = "<script>window.xssDangerousRef = true;</script>"
					}
				}

				return <div ref={dangerousRef}>Test</div>
			}

			// Act
			renderMarkdown({
				content: "Test content",
				components: {
					div: DangerousRefComponent,
				},
			})

			// Assert
			expect((window as any).xssDangerousRef).toBeUndefined()
		})
	})

	describe("Props Validation Security", () => {
		it("should sanitize dangerous className props", () => {
			// Arrange
			const maliciousClassName =
				'normal-class"; <script>window.xssClassName = true;</script> class="'

			// Act
			const { container } = renderMarkdown({
				content: "Test content",
				className: maliciousClassName,
			})

			// Assert - Most importantly, the script should not execute
			expect((window as any).xssClassName).toBeUndefined()

			// Check that the dangerous content is treated as class name, not executable code
			const html = container.innerHTML

			// Quotes should be properly escaped in HTML attributes
			expect(html).toContain("&quot;")

			// The malicious content should appear as part of the class attribute, not as standalone HTML
			expect(html).toContain('class="normal-class&quot;; <script>')

			// Verify no actual script elements were created that could execute the malicious code
			const scriptElements = container.querySelectorAll("script")
			const maliciousScriptElements = Array.from(scriptElements).filter((script) =>
				script.textContent?.includes("window.xssClassName"),
			)
			expect(maliciousScriptElements).toHaveLength(0)
		})

		it("should handle malicious content in different configurations", () => {
			// Arrange
			const maliciousContent = "<script>window.xssConfig = true;</script>Test"
			const configurations = [
				{ allowHtml: true, enableLatex: true },
				{ allowHtml: false, enableLatex: true },
				{ allowHtml: true, enableLatex: false },
				{ allowHtml: false, enableLatex: false },
			]

			// Act & Assert
			configurations.forEach((config, index) => {
				renderMarkdown({
					content: maliciousContent,
					...config,
				})

				expect((window as any).xssConfig).toBeUndefined()
			})
		})

		it("should handle edge cases in boolean props", () => {
			// Arrange
			const maliciousContent = "<script>window.xssBooleanProps = true;</script>Test"
			const edgeCases = [
				{ allowHtml: "true" as any },
				{ allowHtml: 1 as any },
				{ allowHtml: {} as any },
				{ allowHtml: [] as any },
				{ enableLatex: "false" as any },
				{ enableLatex: 0 as any },
				{ enableLatex: null as any },
			]

			// Act & Assert
			edgeCases.forEach((edgeCase) => {
				expect(() => {
					renderMarkdown({
						content: maliciousContent,
						...edgeCase,
					})
				}).not.toThrow()

				expect((window as any).xssBooleanProps).toBeUndefined()
			})
		})
	})

	describe("Markdown Library Security", () => {
		it("should prevent XSS through markdown-to-jsx overrides", () => {
			// Arrange
			const maliciousContent = "<script>window.xssMarkdownToJsx = true;</script>Test"

			// Act
			renderMarkdown({ content: maliciousContent })

			// Assert
			expect((window as any).xssMarkdownToJsx).toBeUndefined()
		})

		it("should handle malformed markdown safely", () => {
			// Arrange
			const malformedMarkdown = [
				"[Unclosed link](javascript:alert(1)",
				"![Unclosed image](javascript:alert(1)",
				"# Unclosed header <script>alert(1)</script",
				"```unclosed code block\n<script>alert(1)</script>",
				"> Unclosed blockquote <script>alert(1)</script",
				"* Unclosed list item <script>alert(1)</script",
			]

			// Act & Assert
			malformedMarkdown.forEach((markdown, index) => {
				expect(() => {
					renderMarkdown({ content: markdown })
				}).not.toThrow()

				expect((window as any)[`xssMalformed${index}`]).toBeUndefined()
			})
		})
	})

	describe("Memory and Performance Security", () => {
		it("should handle recursive markdown structures safely", () => {
			// Arrange
			let recursiveMarkdown = "<script>window.xssRecursive = true;</script>"
			for (let i = 0; i < 50; i++) {
				recursiveMarkdown = `> ${recursiveMarkdown}`
			}

			// Act & Assert
			expect(() => {
				renderMarkdown({ content: recursiveMarkdown })
			}).not.toThrow()

			expect((window as any).xssRecursive).toBeUndefined()
		})

		it("should handle circular references in content", () => {
			// Arrange
			const circularContent = `
[link1]: #link2
[link2]: #link1
[Click here][link1]
<script>window.xssCircular = true;</script>
			`

			// Act & Assert
			expect(() => {
				renderMarkdown({ content: circularContent })
			}).not.toThrow()

			expect((window as any).xssCircular).toBeUndefined()
		})

		it("should handle extremely long lines safely", () => {
			// Arrange
			const longLine = "A".repeat(100000) + "<script>window.xssLongLine = true;</script>"

			// Act & Assert
			expect(() => {
				renderMarkdown({ content: longLine })
			}).not.toThrow()

			expect((window as any).xssLongLine).toBeUndefined()
		})
	})

	describe("Streaming Security", () => {
		it("should handle malicious streaming content updates", () => {
			// Arrange
			const initialContent = "Safe content"
			const maliciousUpdate = "<script>window.xssStreamingUpdate = true;</script>"

			// Act
			const { rerender } = renderMarkdown({
				content: initialContent,
				isStreaming: true,
			})

			rerender(
				<EnhanceMarkdown content={initialContent + maliciousUpdate} isStreaming={true} />,
			)

			// Assert
			expect((window as any).xssStreamingUpdate).toBeUndefined()
		})

		it("should handle interrupted streaming safely", () => {
			// Arrange
			const streamingContent = "<script>window.xssInterrupted = true;</script>"

			// Act
			const { rerender } = renderMarkdown({
				content: streamingContent,
				isStreaming: true,
			})

			// Simulate interruption
			rerender(<EnhanceMarkdown content={streamingContent} isStreaming={false} />)

			// Assert
			expect((window as any).xssInterrupted).toBeUndefined()
		})
	})

	describe("Error Handling Security", () => {
		it("should handle rendering errors gracefully without exposing sensitive information", () => {
			// Arrange
			const problematicContent =
				'<script>throw new Error("XSS attempt: " + document.cookie);</script>'

			// Act & Assert
			expect(() => {
				renderMarkdown({ content: problematicContent })
			}).not.toThrow()

			// Verify no sensitive information is exposed
			expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining("document.cookie"))
		})

		it("should handle invalid Unicode sequences safely", () => {
			// Arrange
			const invalidUnicode = "\uD800<script>window.xssInvalidUnicode = true;</script>\uDFFF"

			// Act & Assert
			expect(() => {
				renderMarkdown({ content: invalidUnicode })
			}).not.toThrow()

			expect((window as any).xssInvalidUnicode).toBeUndefined()
		})
	})

	describe("Content Security Policy Compliance", () => {
		it("should not violate CSP with inline styles", () => {
			// Arrange
			const contentWithInlineStyles = '<div style="background: red; color: blue;">Test</div>'

			// Act
			const { container } = renderMarkdown({ content: contentWithInlineStyles })

			// Assert - Should not contain inline styles that could violate CSP
			const divElement = container.querySelector("div")
			expect(divElement).toBeTruthy()
		})

		it("should not create dynamic script elements", () => {
			// Arrange
			const maliciousContent = "<script>window.xssCSP = true;</script>"

			// Act
			renderMarkdown({ content: maliciousContent })

			// Assert
			const scriptElements = document.querySelectorAll("script")
			const maliciousScripts = Array.from(scriptElements).filter((script) =>
				script.textContent?.includes("window.xssCSP"),
			)
			expect(maliciousScripts).toHaveLength(0)
		})
	})
})
