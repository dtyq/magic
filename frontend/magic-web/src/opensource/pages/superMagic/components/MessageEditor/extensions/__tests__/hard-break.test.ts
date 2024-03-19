import { describe, it, expect } from "vitest"

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
