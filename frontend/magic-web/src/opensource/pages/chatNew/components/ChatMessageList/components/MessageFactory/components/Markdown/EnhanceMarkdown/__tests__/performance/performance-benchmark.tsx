import React from "react"
import { createRoot } from "react-dom/client"
import EnhanceMarkdown from "../../index"

// Performance benchmark utilities
class PerformanceBenchmark {
	private results: Array<{
		name: string
		duration: number
		timestamp: number
	}> = []

	async measureRender(name: string, element: React.ReactElement): Promise<number> {
		return new Promise((resolve) => {
			const container = document.createElement("div")
			document.body.appendChild(container)

			const startTime = performance.now()

			const root = createRoot(container)

			// Use requestAnimationFrame to ensure rendering is complete
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					const endTime = performance.now()
					const duration = endTime - startTime

					this.results.push({
						name,
						duration,
						timestamp: Date.now(),
					})

					// Cleanup
					root.unmount()
					document.body.removeChild(container)

					resolve(duration)
				})
			})

			root.render(element)
		})
	}

	getResults() {
		return this.results
	}

	generateReport() {
		const grouped = this.results.reduce((acc, result) => {
			if (!acc[result.name]) {
				acc[result.name] = []
			}
			acc[result.name].push(result.duration)
			return acc
		}, {} as Record<string, number[]>)

		const report = Object.entries(grouped).map(([name, durations]) => {
			const avg = durations.reduce((a, b) => a + b, 0) / durations.length
			const min = Math.min(...durations)
			const max = Math.max(...durations)
			const median = durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)]

			return {
				name,
				count: durations.length,
				avg: parseFloat(avg.toFixed(2)),
				min: parseFloat(min.toFixed(2)),
				max: parseFloat(max.toFixed(2)),
				median: parseFloat(median.toFixed(2)),
			}
		})

		return report.sort((a, b) => b.avg - a.avg)
	}
}

// Test cases for performance analysis
const testCases = [
	{
		name: "Empty Content",
		content: "",
		description: "Test rendering with no content",
	},
	{
		name: "Simple Text",
		content: "Hello, this is a simple text message that should render quickly.",
		description: "Basic text rendering performance",
	},
	{
		name: "Short Code Block",
		content: '```javascript\nconst hello = "world";\nconsole.log(hello);\n```',
		description: "Code highlighting performance for small blocks",
	},
	{
		name: "Medium Text",
		content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(50),
		description: "Medium-sized text rendering",
	},
	{
		name: "Large Text",
		content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(500),
		description: "Large text block rendering performance",
	},
	{
		name: "Mixed Content",
		content: `# Performance Test Document

This document contains **various** *markdown* elements to test rendering performance.

## Code Example

\`\`\`typescript
interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  fps: number;
}

function measurePerformance(): PerformanceMetrics {
  const startTime = performance.now();
  // Rendering logic here
  const endTime = performance.now();
  
  return {
    renderTime: endTime - startTime,
    memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
    fps: 60
  };
}
\`\`\`

## Lists and Links

- Performance testing
- Memory optimization
- Render time analysis
- [Documentation](https://example.com)

> This is a blockquote to test additional rendering elements.

### Tables (if supported)

| Metric | Value | Unit |
|--------|-------|------|
| Render Time | 15.2 | ms |
| Memory | 2.5 | MB |
| FPS | 60 | fps |
`,
		description: "Complex mixed content with multiple markdown elements",
	},
	{
		name: "Large Code Block",
		content: `\`\`\`javascript
${Array.from(
	{ length: 100 },
	(_, i) => `
function generateTestData${i}() {
  const data = [];
  for (let j = 0; j < 100; j++) {
    data.push({
      id: j,
      name: \`Item \${j}\`,
      value: Math.random() * 1000,
      timestamp: Date.now()
    });
  }
  return data;
}
`,
).join("\n")}
\`\`\``,
		description: "Large code block syntax highlighting performance",
	},
	{
		name: "Very Large Document",
		content: Array.from(
			{ length: 50 },
			(_, i) => `
# Section ${i + 1}

This is section ${i + 1} with various content types.

## Subsection A

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

\`\`\`javascript
function section${i}Function() {
  return {
    id: ${i},
    title: "Section ${i + 1}",
    content: "This is the content for section ${i + 1}"
  };
}
\`\`\`

## Subsection B

- Item ${i * 3 + 1}
- Item ${i * 3 + 2}
- Item ${i * 3 + 3}

### Links and References

[Section ${i + 1} Link](https://example.com/section/${i + 1})

> Quote for section ${i + 1}: "Performance testing is crucial for user experience."
`,
		).join("\n"),
		description: "Very large document with repetitive structure",
	},
]

// Main benchmark function
async function runPerformanceBenchmark() {
	console.log("🚀 Starting EnhanceMarkdown Performance Benchmark...")

	const benchmark = new PerformanceBenchmark()
	const iterations = 5 // Run each test 5 times for accuracy

	for (const testCase of testCases) {
		console.log(`\n📊 Testing: ${testCase.name}`)
		console.log(`📝 ${testCase.description}`)

		for (let i = 0; i < iterations; i++) {
			const duration = await benchmark.measureRender(
				testCase.name,
				<EnhanceMarkdown
					content={testCase.content}
					allowHtml={true}
					enableLatex={true}
					isSelf={false}
					isStreaming={false}
				/>,
			)

			console.log(`   Iteration ${i + 1}: ${duration.toFixed(2)}ms`)

			// Small delay between iterations to prevent overwhelming
			await new Promise((resolve) => setTimeout(resolve, 100))
		}
	}

	// Test streaming performance
	console.log("\n🔄 Testing Streaming Performance...")
	const streamingContent =
		"This is a streaming message that will be rendered progressively to test streaming performance."

	for (let i = 10; i <= streamingContent.length; i += 10) {
		const partialContent = streamingContent.slice(0, i)
		const duration = await benchmark.measureRender(
			`Streaming-${i}chars`,
			<EnhanceMarkdown
				content={partialContent}
				allowHtml={true}
				enableLatex={true}
				isSelf={false}
				isStreaming={true}
			/>,
		)

		console.log(`   ${i} chars: ${duration.toFixed(2)}ms`)
	}

	// Generate and display report
	console.log("\n📋 Performance Report:")
	console.log("=====================")

	const report = benchmark.generateReport()

	report.forEach((result, index) => {
		console.log(`${index + 1}. ${result.name}`)
		console.log(`   Average: ${result.avg}ms`)
		console.log(`   Min: ${result.min}ms | Max: ${result.max}ms | Median: ${result.median}ms`)
		console.log(`   Iterations: ${result.count}`)
		console.log("")
	})

	// Performance analysis and recommendations
	console.log("🔍 Performance Analysis:")
	console.log("========================")

	const slowTests = report.filter((r) => r.avg > 50)
	const fastTests = report.filter((r) => r.avg < 10)

	if (slowTests.length > 0) {
		console.log("⚠️  Slow rendering detected:")
		slowTests.forEach((test) => {
			console.log(`   - ${test.name}: ${test.avg}ms average`)
		})
	}

	if (fastTests.length > 0) {
		console.log("✅ Fast rendering:")
		fastTests.forEach((test) => {
			console.log(`   - ${test.name}: ${test.avg}ms average`)
		})
	}

	// Memory usage analysis (if available)
	if ((performance as any).memory) {
		const memInfo = (performance as any).memory
		console.log("\n💾 Memory Usage:")
		console.log(`   Used: ${(memInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`)
		console.log(`   Total: ${(memInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`)
		console.log(`   Limit: ${(memInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`)
	}

	return report
}

// Export for use in tests or direct execution
export { runPerformanceBenchmark, PerformanceBenchmark, testCases }

// Auto-run if this file is executed directly
if (typeof window !== "undefined" && window.document) {
	// Only run in browser environment
	document.addEventListener("DOMContentLoaded", () => {
		const button = document.createElement("button")
		button.textContent = "Run Performance Benchmark"
		button.onclick = runPerformanceBenchmark
		document.body.appendChild(button)
	})
}
