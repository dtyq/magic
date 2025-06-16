import React, { useState } from "react"
import { createRoot } from "react-dom/client"
import EnhanceMarkdown from "../../index"
import { performance } from "perf_hooks"

// Performance metrics interface
interface PerformanceMetrics {
	name: string
	duration: number
	memory?: number
	timestamp: number
}

// Performance analysis utility
class PerformanceAnalyzer {
	private metrics: PerformanceMetrics[] = []
	private observer?: PerformanceObserver

	constructor() {
		this.setupPerformanceObserver()
	}

	private setupPerformanceObserver() {
		if (typeof PerformanceObserver !== "undefined") {
			this.observer = new PerformanceObserver((list) => {
				list.getEntries().forEach((entry) => {
					if (entry.name.includes("EnhanceMarkdown")) {
						this.metrics.push({
							name: entry.name,
							duration: entry.duration,
							timestamp: entry.startTime,
						})
					}
				})
			})
			this.observer.observe({ entryTypes: ["measure", "mark"] })
		}
	}

	startMeasurement(name: string): () => void {
		const startTime = performance.now()
		const initialMemory = this.getMemoryUsage()

		return () => {
			const endTime = performance.now()
			const finalMemory = this.getMemoryUsage()

			this.metrics.push({
				name,
				duration: endTime - startTime,
				memory: finalMemory - initialMemory,
				timestamp: startTime,
			})
		}
	}

	private getMemoryUsage(): number {
		if (typeof window !== "undefined" && (window.performance as any).memory) {
			return (window.performance as any).memory.usedJSHeapSize
		}
		return 0
	}

	getMetrics(): PerformanceMetrics[] {
		return [...this.metrics]
	}

	generateReport(): any {
		const grouped = this.metrics.reduce((acc, metric) => {
			if (!acc[metric.name]) {
				acc[metric.name] = []
			}
			acc[metric.name].push(metric)
			return acc
		}, {} as Record<string, PerformanceMetrics[]>)

		return Object.entries(grouped)
			.map(([name, metrics]) => {
				const durations = metrics.map((m) => m.duration)
				const memories = metrics.map((m) => m.memory || 0).filter((m) => m > 0)

				return {
					name,
					count: metrics.length,
					avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
					minDuration: Math.min(...durations),
					maxDuration: Math.max(...durations),
					avgMemory:
						memories.length > 0
							? memories.reduce((a, b) => a + b, 0) / memories.length
							: 0,
					totalMemory: memories.reduce((a, b) => a + b, 0),
				}
			})
			.sort((a, b) => b.avgDuration - a.avgDuration)
	}

	clear() {
		this.metrics = []
	}

	destroy() {
		this.observer?.disconnect()
	}
}

// Test cases with different complexity levels
const performanceTestCases = [
	{
		name: "Empty Content",
		content: "",
		expectedTime: 5,
	},
	{
		name: "Simple Text",
		content: "Hello, this is a simple markdown text.",
		expectedTime: 10,
	},
	{
		name: "Text with Basic Formatting",
		content: "This text has **bold**, *italic*, and `inline code` formatting.",
		expectedTime: 15,
	},
	{
		name: "Short Code Block",
		content: '```javascript\nconst hello = "world";\nconsole.log(hello);\n```',
		expectedTime: 25,
	},
	{
		name: "LaTeX Formula",
		content:
			"Here is a math formula: $E = mc^2$ and a block formula:\n\n$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$",
		expectedTime: 30,
	},
	{
		name: "Mixed Content",
		content: `# Performance Test

This document tests **various** *markdown* elements.

## Code Example
\`\`\`typescript
interface Test {
  id: number;
  name: string;
}
\`\`\`

## Lists
- Item 1
- Item 2
- Item 3

## Links and Images
[Link](https://example.com)
![Image](https://example.com/image.jpg)

> This is a blockquote with some text.

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |
`,
		expectedTime: 50,
	},
	{
		name: "Large Text Block",
		content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(200),
		expectedTime: 40,
	},
	{
		name: "Large Code Block",
		content: `\`\`\`javascript
${Array.from(
	{ length: 50 },
	(_, i) => `
function test${i}() {
  return "This is test function ${i}";
}
`,
).join("")}
\`\`\``,
		expectedTime: 80,
	},
	{
		name: "Complex Mixed Content",
		content: Array.from(
			{ length: 20 },
			(_, i) => `
# Section ${i + 1}

This is section ${i + 1} with various content.

\`\`\`javascript
function section${i}() {
  return ${i};
}
\`\`\`

- List item ${i * 2 + 1}
- List item ${i * 2 + 2}

Math: $x_${i} = ${i}^2$

> Quote for section ${i + 1}
`,
		).join("\n"),
		expectedTime: 150,
	},
]

// Main performance analysis function
export async function analyzePerformance(): Promise<any> {
	console.log("🚀 Starting EnhanceMarkdown Performance Analysis...")

	const analyzer = new PerformanceAnalyzer()
	const results: any[] = []

	// Test each case multiple times for accuracy
	const iterations = 3

	for (const testCase of performanceTestCases) {
		console.log(`\n📊 Analyzing: ${testCase.name}`)

		const testResults: number[] = []

		for (let i = 0; i < iterations; i++) {
			const endMeasurement = analyzer.startMeasurement(`${testCase.name}-${i}`)

			// Create a container for testing
			const container = document.createElement("div")
			container.style.position = "absolute"
			container.style.top = "-9999px"
			container.style.left = "-9999px"
			document.body.appendChild(container)

			try {
				const root = createRoot(container)

				// Measure component rendering
				const renderStart = performance.now()

				root.render(
					<EnhanceMarkdown
						content={testCase.content}
						allowHtml={true}
						enableLatex={true}
						isSelf={false}
						isStreaming={false}
					/>,
				)

				// Wait for rendering to complete
				await new Promise((resolve) => {
					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							const renderEnd = performance.now()
							const duration = renderEnd - renderStart
							testResults.push(duration)

							root.unmount()
							document.body.removeChild(container)

							resolve(duration)
						})
					})
				})
			} catch (error) {
				console.error(`Error testing ${testCase.name}:`, error)
				document.body.removeChild(container)
			}

			endMeasurement()

			// Small delay between iterations
			await new Promise((resolve) => setTimeout(resolve, 50))
		}

		const avgDuration = testResults.reduce((a, b) => a + b, 0) / testResults.length
		const minDuration = Math.min(...testResults)
		const maxDuration = Math.max(...testResults)

		const result = {
			name: testCase.name,
			avgDuration: parseFloat(avgDuration.toFixed(2)),
			minDuration: parseFloat(minDuration.toFixed(2)),
			maxDuration: parseFloat(maxDuration.toFixed(2)),
			expectedTime: testCase.expectedTime,
			isWithinExpected: avgDuration <= testCase.expectedTime,
			performanceRatio: parseFloat((avgDuration / testCase.expectedTime).toFixed(2)),
		}

		results.push(result)

		console.log(`   Average: ${result.avgDuration}ms`)
		console.log(`   Range: ${result.minDuration}ms - ${result.maxDuration}ms`)
		console.log(`   Expected: ${result.expectedTime}ms`)
		console.log(`   Status: ${result.isWithinExpected ? "✅ Good" : "⚠️ Slow"}`)
	}

	// Test streaming performance
	console.log("\n🔄 Testing Streaming Performance...")

	const streamingText =
		"This is a streaming message that will be updated progressively to test streaming performance and see how the component handles incremental updates."
	const streamingResults: number[] = []

	for (let length = 10; length <= streamingText.length; length += 20) {
		const partialContent = streamingText.slice(0, length)
		const endMeasurement = analyzer.startMeasurement(`Streaming-${length}chars`)

		const container = document.createElement("div")
		container.style.position = "absolute"
		container.style.top = "-9999px"
		document.body.appendChild(container)

		try {
			const root = createRoot(container)
			const start = performance.now()

			root.render(
				<EnhanceMarkdown
					content={partialContent}
					allowHtml={true}
					enableLatex={true}
					isSelf={false}
					isStreaming={true}
				/>,
			)

			await new Promise((resolve) => {
				requestAnimationFrame(() => {
					const end = performance.now()
					const duration = end - start
					streamingResults.push(duration)

					root.unmount()
					document.body.removeChild(container)
					resolve(duration)
				})
			})
		} catch (error) {
			console.error(`Error in streaming test:`, error)
			document.body.removeChild(container)
		}

		endMeasurement()
	}

	// Generate comprehensive report
	console.log("\n📋 Performance Analysis Report")
	console.log("=".repeat(50))

	// Overall performance summary
	const slowTests = results.filter((r) => !r.isWithinExpected)
	const fastTests = results.filter((r) => r.isWithinExpected)

	console.log(`\n📈 Overall Summary:`)
	console.log(`   Total Tests: ${results.length}`)
	console.log(
		`   Fast Tests: ${fastTests.length} (${((fastTests.length / results.length) * 100).toFixed(
			1,
		)}%)`,
	)
	console.log(
		`   Slow Tests: ${slowTests.length} (${((slowTests.length / results.length) * 100).toFixed(
			1,
		)}%)`,
	)

	if (slowTests.length > 0) {
		console.log(`\n⚠️  Performance Issues Detected:`)
		slowTests.forEach((test) => {
			console.log(
				`   - ${test.name}: ${test.avgDuration}ms (${test.performanceRatio}x expected)`,
			)
		})
	}

	// Streaming performance
	if (streamingResults.length > 0) {
		const avgStreamingTime =
			streamingResults.reduce((a, b) => a + b, 0) / streamingResults.length
		console.log(`\n🔄 Streaming Performance:`)
		console.log(`   Average streaming update: ${avgStreamingTime.toFixed(2)}ms`)
		console.log(
			`   Status: ${
				avgStreamingTime < 10
					? "✅ Excellent"
					: avgStreamingTime < 20
					? "✅ Good"
					: "⚠️ Needs optimization"
			}`,
		)
	}

	// Memory analysis
	const memoryReport = analyzer.generateReport()
	if (memoryReport.some((r: any) => r.totalMemory > 0)) {
		console.log(`\n💾 Memory Usage Analysis:`)
		memoryReport.forEach((report: any) => {
			if (report.totalMemory > 0) {
				console.log(
					`   ${report.name}: ${(report.avgMemory / 1024 / 1024).toFixed(2)}MB avg`,
				)
			}
		})
	}

	analyzer.destroy()

	return {
		results,
		streamingResults,
		summary: {
			totalTests: results.length,
			fastTests: fastTests.length,
			slowTests: slowTests.length,
			avgStreamingTime:
				streamingResults.length > 0
					? streamingResults.reduce((a, b) => a + b, 0) / streamingResults.length
					: 0,
		},
	}
}

// React component for browser testing
export const PerformanceTestRunner: React.FC = () => {
	const [isRunning, setIsRunning] = useState(false)
	const [results, setResults] = useState<any>(null)

	const runTest = async () => {
		setIsRunning(true)
		try {
			const testResults = await analyzePerformance()
			setResults(testResults)
		} catch (error) {
			console.error("Performance test failed:", error)
		} finally {
			setIsRunning(false)
		}
	}

	return (
		<div style={{ padding: "20px", fontFamily: "monospace" }}>
			<h2>EnhanceMarkdown Performance Analyzer</h2>

			<button
				onClick={runTest}
				disabled={isRunning}
				style={{
					padding: "10px 20px",
					fontSize: "16px",
					backgroundColor: isRunning ? "#ccc" : "#007bff",
					color: "white",
					border: "none",
					borderRadius: "4px",
					cursor: isRunning ? "not-allowed" : "pointer",
				}}
			>
				{isRunning ? "Running Tests..." : "Run Performance Tests"}
			</button>

			{results && (
				<div style={{ marginTop: "20px" }}>
					<h3>Test Results:</h3>
					<div
						style={{ backgroundColor: "#f5f5f5", padding: "10px", borderRadius: "4px" }}
					>
						<p>Total Tests: {results.summary.totalTests}</p>
						<p>Fast Tests: {results.summary.fastTests}</p>
						<p>Slow Tests: {results.summary.slowTests}</p>
						<p>Avg Streaming Time: {results.summary.avgStreamingTime.toFixed(2)}ms</p>
					</div>

					<h4>Detailed Results:</h4>
					<table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10px" }}>
						<thead>
							<tr style={{ backgroundColor: "#e9ecef" }}>
								<th style={{ padding: "8px", border: "1px solid #ddd" }}>
									Test Case
								</th>
								<th style={{ padding: "8px", border: "1px solid #ddd" }}>
									Avg Time (ms)
								</th>
								<th style={{ padding: "8px", border: "1px solid #ddd" }}>
									Expected (ms)
								</th>
								<th style={{ padding: "8px", border: "1px solid #ddd" }}>Status</th>
							</tr>
						</thead>
						<tbody>
							{results.results.map((result: any, index: number) => (
								<tr key={index}>
									<td style={{ padding: "8px", border: "1px solid #ddd" }}>
										{result.name}
									</td>
									<td style={{ padding: "8px", border: "1px solid #ddd" }}>
										{result.avgDuration}
									</td>
									<td style={{ padding: "8px", border: "1px solid #ddd" }}>
										{result.expectedTime}
									</td>
									<td style={{ padding: "8px", border: "1px solid #ddd" }}>
										{result.isWithinExpected ? "✅" : "⚠️"}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}

export default PerformanceTestRunner
