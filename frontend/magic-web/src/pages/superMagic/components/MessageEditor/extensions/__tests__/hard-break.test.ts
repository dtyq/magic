import { describe, expect, it } from "vitest"
import { Schema } from "prosemirror-model"
import { buildPasteSlice, shouldHandlePlainTextPaste } from "../hard-break"

const schema = new Schema({
	nodes: {
		doc: {
			content: "block+",
		},
		paragraph: {
			group: "block",
			content: "inline*",
		},
		text: {
			group: "inline",
		},
		hardBreak: {
			inline: true,
			group: "inline",
			selectable: false,
		},
	},
})

describe("buildPasteSlice", () => {
	it("keeps single-line paste as inline content", () => {
		const slice = buildPasteSlice({
			schema,
			text: "multi-search-engine",
			isTextBlock: true,
		})

		expect(slice.openStart).toBe(0)
		expect(slice.openEnd).toBe(0)
		expect(slice.content.childCount).toBe(1)
		expect(slice.content.firstChild?.type.name).toBe("text")
		expect(slice.content.firstChild?.textContent).toBe("multi-search-engine")
	})

	it("turns multiline paste into paragraphs without hidden fillers", () => {
		const slice = buildPasteSlice({
			schema,
			text: "multi-search-engine\nsonoscli\n\ndesktop-control",
			isTextBlock: true,
		})

		expect(slice.openStart).toBe(1)
		expect(slice.openEnd).toBe(1)
		expect(slice.content.childCount).toBe(4)
		expect(slice.content.child(0).type.name).toBe("paragraph")
		expect(slice.content.child(0).textContent).toBe("multi-search-engine")
		expect(slice.content.child(1).textContent).toBe("sonoscli")
		expect(slice.content.child(2).textContent).toBe("")
		expect(slice.content.child(2).content.size).toBe(0)
		expect(slice.content.child(3).textContent).toBe("desktop-control")
	})
})

describe("shouldHandlePlainTextPaste", () => {
	it("handles plain text when html is absent", () => {
		expect(shouldHandlePlainTextPaste("multi-search-engine", "")).toBe(true)
	})

	it("handles multiline plain text even when html exists", () => {
		expect(
			shouldHandlePlainTextPaste(
				"multi-search-engine\nsonoscli",
				"<div>multi-search-engine</div><div>sonoscli</div>",
			),
		).toBe(true)
	})

	it("keeps single-line rich html on the default paste path", () => {
		expect(
			shouldHandlePlainTextPaste("multi-search-engine", "<div>multi-search-engine</div>"),
		).toBe(false)
	})
})

// Helper function to detect if content is code (from the main file)
function isCodeContent(text: string): boolean {
	const codeIndicators = [
		/import\s+.*from\s+['"][^'"]*['"]/, // import statements
		/export\s+.*from\s+['"][^'"]*['"]/, // export statements
		/const\s+\w+\s*=\s*\(.*?\)\s*=>/, // arrow functions
		/function\s+\w+\s*\(/, // function declarations
		/<\w+[\s\S]*?>/, // JSX tags
		/\{\s*\w+\s*:\s*.*?\}/, // object literals
		/\/\*[\s\S]*?\*\//, // block comments
		/\/\/.*$/m, // line comments
		/^\s*(if|for|while|switch|try|catch)\s*\(/m, // control structures
	]

	return codeIndicators.some((pattern) => pattern.test(text))
}

describe("Code Paste Detection", () => {
	it("should detect React component code", () => {
		const reactCode = `import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
const Component = () => {
  const codeString = '(num) => num + 1';
  return (
    <SyntaxHighlighter language="javascript" style={docco}>
      {codeString}
    </SyntaxHighlighter>
  );
};`

		expect(isCodeContent(reactCode)).toBe(true)
	})

	it("should detect import statements", () => {
		const importCode = `import React from 'react'`
		expect(isCodeContent(importCode)).toBe(true)
	})

	it("should detect JSX elements", () => {
		const jsxCode = `<div>Hello World</div>`
		expect(isCodeContent(jsxCode)).toBe(true)
	})

	it("should detect arrow functions", () => {
		const arrowFunction = `const add = (a, b) => a + b`
		expect(isCodeContent(arrowFunction)).toBe(true)
	})

	it("should detect function declarations", () => {
		const functionDeclaration = `function greet(name) { return 'Hello ' + name }`
		expect(isCodeContent(functionDeclaration)).toBe(true)
	})

	it("should detect object literals", () => {
		const objectLiteral = `{ name: 'John', age: 30 }`
		expect(isCodeContent(objectLiteral)).toBe(true)
	})

	it("should not detect regular text as code", () => {
		const regularText = `This is just regular text without any code patterns.`
		expect(isCodeContent(regularText)).toBe(false)
	})

	it("should not detect simple sentences with parentheses as code", () => {
		const textWithParens = `This is a sentence (with parentheses) but not code.`
		expect(isCodeContent(textWithParens)).toBe(false)
	})

	it("should detect multi-line code with comments", () => {
		const codeWithComments = `// This is a comment
const value = 42;
/* Another comment */`
		expect(isCodeContent(codeWithComments)).toBe(true)
	})

	it("should detect control structures", () => {
		const controlStructure = `if (condition) {
  doSomething();
}`
		expect(isCodeContent(controlStructure)).toBe(true)
	})
})
