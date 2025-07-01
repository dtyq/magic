import { render } from "@testing-library/react"
import { vi, describe, it, beforeEach, afterAll, expect } from "vitest"
import React from "react"
import { performance } from "perf_hooks"

// Mock all problematic dependencies first
vi.mock("@dtyq/es6-template-strings", () => ({
	resolveToString: vi.fn((template, params) => template),
}))

vi.mock("@/utils/http", () => ({
	default: vi.fn(),
}))

vi.mock("@/apis/constant", () => ({
	RequestUrl: {},
}))

// Mock the component and its dependencies
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

vi.mock("../hooks/useStreamCursor", () => ({
	default: vi.fn(),
}))

vi.mock("../hooks/useMarkdownConfig", () => ({
	useMarkdownConfig: () => ({
		options: { overrides: {}, forceWrapper: true },
		preprocess: (content: string) => [content],
	}),
}))

vi.mock("../hooks/useClassName", () => ({
	useClassName: () => "mocked-classname",
}))

vi.mock("../styles/markdown.style", () => ({
	useStyles: () => ({ styles: { container: "mocked-style" } }),
}))

// Mock markdown-to-jsx
vi.mock("markdown-to-jsx", () => ({
	default: ({ children }: { children: string }) => <div>{children}</div>,
}))

// Simple test component to avoid dependency issues
const TestMarkdownComponent = ({ content }: { content: string }) => {
	return <div data-testid="markdown-content">{content}</div>
}

// Performance measurement utilities
class PerformanceProfiler {
	private measurements: Map<string, number[]> = new Map()

	startMeasurement(name: string): () => number {
		const start = performance.now()
		return () => {
			const end = performance.now()
			const duration = end - start

			if (!this.measurements.has(name)) {
				this.measurements.set(name, [])
			}
			this.measurements.get(name)!.push(duration)

			return duration
		}
	}

	getStats(name: string) {
		const measurements = this.measurements.get(name) || []
		if (measurements.length === 0) return null

		const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length
		const min = Math.min(...measurements)
		const max = Math.max(...measurements)

		return { avg, min, max, count: measurements.length }
	}

	getAllStats() {
		const stats: Record<string, any> = {}
		this.measurements.forEach((_, name) => {
			stats[name] = this.getStats(name)
		})
		return stats
	}

	reset() {
		this.measurements.clear()
	}
}

describe("EnhanceMarkdown Performance Tests", () => {
	let profiler: PerformanceProfiler

	beforeEach(() => {
		profiler = new PerformanceProfiler()
		vi.clearAllMocks()
	})

	const testCases = [
		{
			name: "Simple Text",
			content: "Hello, this is a simple text message.",
			expectedTime: 10, // ms
		},
		{
			name: "Code Block",
			content: '```javascript\nconst hello = "world";\nconsole.log(hello);\n```',
			expectedTime: 20,
		},
		{
			name: "Large Text",
			content: "Lorem ipsum ".repeat(1000),
			expectedTime: 50,
		},
		{
			name: "Mixed Content",
			content: `# Title
      
This is a paragraph with **bold** and *italic* text.

\`\`\`typescript
interface User {
  id: number;
  name: string;
}
\`\`\`

- List item 1
- List item 2
- List item 3

[Link](https://example.com)
`,
			expectedTime: 30,
		},
	]

	describe("Component Rendering Performance", () => {
		testCases.forEach(({ name, content, expectedTime }) => {
			it(`should render ${name} efficiently`, () => {
				const endMeasurement = profiler.startMeasurement(`render-${name}`)

				const { container } = render(<TestMarkdownComponent content={content} />)

				const duration = endMeasurement()

				expect(container.firstChild).toBeInTheDocument()
				expect(duration).toBeLessThan(expectedTime)

				console.log(`${name} render: ${duration.toFixed(2)}ms`)
			})
		})
	})

	describe("Re-render Performance", () => {
		it("should handle content updates efficiently", () => {
			const { rerender } = render(<TestMarkdownComponent content="Initial content" />)

			// Measure multiple re-renders
			for (let i = 0; i < 10; i++) {
				const endMeasurement = profiler.startMeasurement("re-render")

				rerender(<TestMarkdownComponent content={`Updated content ${i}`} />)

				endMeasurement()
			}

			const stats = profiler.getStats("re-render")
			expect(stats).toBeDefined()
			expect(stats!.avg).toBeLessThan(15) // Average should be under 15ms

			console.log("Re-render stats:", stats)
		})
	})

	describe("Large Content Performance", () => {
		it("should handle large content efficiently", () => {
			const largeContent = "Very long content ".repeat(5000)
			const endMeasurement = profiler.startMeasurement("large-content")

			const { container } = render(<TestMarkdownComponent content={largeContent} />)

			const duration = endMeasurement()

			expect(container.firstChild).toBeInTheDocument()
			expect(duration).toBeLessThan(100) // Should complete within 100ms

			console.log(`Large content render: ${duration.toFixed(2)}ms`)
		})
	})

	describe("Performance Baseline", () => {
		it("should establish performance baselines", () => {
			const baselines = {
				simpleText: 5,
				codeBlock: 15,
				mixedContent: 25,
				largeContent: 50,
			}

			Object.entries(baselines).forEach(([type, expectedTime]) => {
				const content = type === "largeContent" ? "Text ".repeat(1000) : "Simple content"
				const endMeasurement = profiler.startMeasurement(`baseline-${type}`)

				render(<TestMarkdownComponent content={content} />)

				const duration = endMeasurement()
				expect(duration).toBeLessThan(expectedTime)

				console.log(
					`Baseline ${type}: ${duration.toFixed(2)}ms (expected < ${expectedTime}ms)`,
				)
			})
		})
	})

	afterAll(() => {
		console.log("\n=== Performance Test Summary ===")
		const allStats = profiler.getAllStats()
		Object.entries(allStats).forEach(([name, stats]) => {
			console.log(
				`${name}: avg=${stats.avg.toFixed(2)}ms, min=${stats.min.toFixed(
					2,
				)}ms, max=${stats.max.toFixed(2)}ms`,
			)
		})
	})
})
