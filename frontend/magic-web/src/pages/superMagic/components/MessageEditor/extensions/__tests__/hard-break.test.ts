import { describe, expect, it } from "vitest"
import { Fragment, Node as ProseMirrorNode, Schema, Slice } from "prosemirror-model"
import { EditorState, TextSelection, Transaction } from "prosemirror-state"
import {
	buildPasteSlice,
	CodeAwarePasteExtension,
	getClipboardPasteMode,
	shouldHandlePlainTextPaste,
} from "../hard-break"

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
		mention: {
			inline: true,
			group: "inline",
			atom: true,
			attrs: {
				label: {
					default: "",
				},
			},
		},
	},
})

function paragraph(
	content: Fragment | ProseMirrorNode | readonly ProseMirrorNode[] | null = Fragment.empty,
) {
	return schema.nodes.paragraph.create(null, content)
}

function text(value: string) {
	return schema.text(value)
}

function mention(label: string) {
	return schema.nodes.mention.create({ label })
}

function getCodeAwarePasteHandle() {
	const handlePaste = CodeAwarePasteExtension.config.addProseMirrorPlugins?.()[0].props.handlePaste
	if (!handlePaste) throw new Error("CodeAwarePasteExtension handlePaste is unavailable")
	return handlePaste as (
		view: {
			state: EditorState
			dispatch: (transaction: Transaction) => void
		},
		event: ClipboardEvent,
		slice: Slice,
	) => boolean
}

function createClipboardEvent(textPlain: string, textHtml: string) {
	return {
		clipboardData: {
			getData: (type: string) => {
				if (type === "text/plain") return textPlain
				if (type === "text/html") return textHtml
				return ""
			},
		},
		preventDefault: () => undefined,
	} as ClipboardEvent
}

function createEditorState() {
	const doc = schema.nodes.doc.create(null, [paragraph()])
	const state = EditorState.create({ schema, doc })
	return state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1)))
}

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

	it("uses ProseMirror block separators without adding blank paragraphs", () => {
		const slice = buildPasteSlice({
			schema,
			text: "multi-search-engine\n\nsonoscli",
			isTextBlock: true,
			preserveProseMirrorBlocks: true,
		})

		expect(slice.openStart).toBe(1)
		expect(slice.openEnd).toBe(1)
		expect(slice.content.childCount).toBe(2)
		expect(slice.content.child(0).textContent).toBe("multi-search-engine")
		expect(slice.content.child(1).textContent).toBe("sonoscli")
	})

	it("preserves blank paragraphs from ProseMirror clipboard text", () => {
		const slice = buildPasteSlice({
			schema,
			text: "multi-search-engine\n\n\n\nsonoscli",
			isTextBlock: true,
			preserveProseMirrorBlocks: true,
		})

		expect(slice.content.childCount).toBe(3)
		expect(slice.content.child(0).textContent).toBe("multi-search-engine")
		expect(slice.content.child(1).textContent).toBe("")
		expect(slice.content.child(1).content.size).toBe(0)
		expect(slice.content.child(2).textContent).toBe("sonoscli")
	})

	it("keeps single hard breaks inside ProseMirror clipboard paragraphs", () => {
		const slice = buildPasteSlice({
			schema,
			text: "multi-search-engine\nsonoscli",
			isTextBlock: true,
			preserveProseMirrorBlocks: true,
		})

		expect(slice.content.childCount).toBe(1)
		expect(slice.content.child(0).childCount).toBe(3)
		expect(slice.content.child(0).child(1).type.name).toBe("hardBreak")
		expect(slice.content.child(0).textContent).toBe("multi-search-enginesonoscli")
	})
})

describe("shouldHandlePlainTextPaste", () => {
	it("handles plain text when html is absent", () => {
		expect(shouldHandlePlainTextPaste("multi-search-engine", "")).toBe(true)
		expect(getClipboardPasteMode("multi-search-engine", "")).toBe("externalText")
	})

	it("handles multiline plain text even when html exists", () => {
		expect(
			shouldHandlePlainTextPaste(
				"multi-search-engine\nsonoscli",
				"<div>multi-search-engine</div><div>sonoscli</div>",
			),
		).toBe(true)
	})

	it("handles plain ProseMirror clipboard html with ProseMirror text semantics", () => {
		expect(
			shouldHandlePlainTextPaste(
				"multi-search-engine\n\nsonoscli",
				'<p data-pm-slice="1 1 []">multi-search-engine</p><p>sonoscli</p>',
			),
		).toBe(true)
		expect(
			getClipboardPasteMode(
				"multi-search-engine\n\nsonoscli",
				'<p data-pm-slice="1 1 []">multi-search-engine</p><p>sonoscli</p>',
			),
		).toBe("proseMirrorText")
	})

	it("handles rich ProseMirror clipboard html as a parsed slice", () => {
		expect(
			shouldHandlePlainTextPaste(
				"@report\n\nsonoscli",
				'<p data-pm-slice="1 1 []"><span class="magic-mention" data-type="project_file">@report</span></p><p>sonoscli</p>',
			),
		).toBe(false)
		expect(
			getClipboardPasteMode(
				"@report\n\nsonoscli",
				'<p data-pm-slice="1 1 []"><span class="magic-mention" data-type="project_file">@report</span></p><p>sonoscli</p>',
			),
		).toBe("proseMirrorSlice")
	})

	it("detects mention and blank-line clipboard content as rich ProseMirror content", () => {
		const text =
			"承诺书可能开始才能\n\n@测试一下.md\n\n此时此刻\n\n\n\n\n\n测试你看你看测试你看你看超能失控\n\n\n\n@测试一下.md"
		const html =
			'<p data-pm-slice="0 0 []">承诺书可能开始才能</p>' +
			'<p><span class="magic-mention" data-type="project_file">@测试一下.md</span></p>' +
			"<p>此时此刻</p><p></p><p></p><p>测试你看你看测试你看你看超能失控</p><p></p>" +
			'<p><span class="magic-mention" data-type="project_file">@测试一下.md</span></p>'

		expect(getClipboardPasteMode(text, html)).toBe("proseMirrorSlice")
	})

	it("handles empty ProseMirror html through the parsed slice path", () => {
		expect(getClipboardPasteMode("", '<p data-pm-slice="0 0 []"></p>')).toBe(
			"proseMirrorSlice",
		)
	})

	it("keeps single-line rich html on the default paste path", () => {
		expect(
			shouldHandlePlainTextPaste("multi-search-engine", "<div>multi-search-engine</div>"),
		).toBe(false)
	})
})

describe("CodeAwarePasteExtension handlePaste", () => {
	it("inserts rich ProseMirror mention content without dropping blank paragraphs", () => {
		const handlePaste = getCodeAwarePasteHandle()
		let state = createEditorState()
		const parsedSlice = new Slice(
			Fragment.fromArray([
				paragraph(text("承诺书可能开始才能")),
				paragraph(mention("测试一下.md")),
				paragraph(text("此时此刻")),
				paragraph(),
				paragraph(),
				paragraph(text("测试你看你看测试你看你看超能失控")),
				paragraph(),
				paragraph(mention("测试一下.md")),
			]),
			0,
			0,
		)
		const textPlain =
			"承诺书可能开始才能\n\n@测试一下.md\n\n此时此刻\n\n\n\n\n\n测试你看你看测试你看你看超能失控\n\n\n\n@测试一下.md"
		const textHtml =
			'<p data-pm-slice="0 0 []">承诺书可能开始才能</p>' +
			'<p><span class="magic-mention" data-type="project_file">@测试一下.md</span></p>' +
			"<p>此时此刻</p><p></p><p></p><p>测试你看你看测试你看你看超能失控</p><p></p>" +
			'<p><span class="magic-mention" data-type="project_file">@测试一下.md</span></p>'

		const handled = handlePaste(
			{
				get state() {
					return state
				},
				dispatch(transaction) {
					state = state.apply(transaction)
				},
			},
			createClipboardEvent(textPlain, textHtml),
			parsedSlice,
		)

		expect(handled).toBe(true)
		expect(state.doc.toJSON()).toEqual({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: "承诺书可能开始才能" }],
				},
				{
					type: "paragraph",
					content: [{ type: "mention", attrs: { label: "测试一下.md" } }],
				},
				{
					type: "paragraph",
					content: [{ type: "text", text: "此时此刻" }],
				},
				{ type: "paragraph" },
				{ type: "paragraph" },
				{
					type: "paragraph",
					content: [{ type: "text", text: "测试你看你看测试你看你看超能失控" }],
				},
				{ type: "paragraph" },
				{
					type: "paragraph",
					content: [{ type: "mention", attrs: { label: "测试一下.md" } }],
				},
			],
		})
	})

	it("handles rich ProseMirror content even when text/plain is empty", () => {
		const handlePaste = getCodeAwarePasteHandle()
		let state = createEditorState()
		const parsedSlice = new Slice(Fragment.from(paragraph(mention("测试一下.md"))), 0, 0)
		const textHtml =
			'<p data-pm-slice="0 0 []"><span class="magic-mention" data-type="project_file">@测试一下.md</span></p>'

		const handled = handlePaste(
			{
				get state() {
					return state
				},
				dispatch(transaction) {
					state = state.apply(transaction)
				},
			},
			createClipboardEvent("", textHtml),
			parsedSlice,
		)

		expect(handled).toBe(true)
		expect(state.doc.toJSON()).toEqual({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "mention", attrs: { label: "测试一下.md" } }],
				},
			],
		})
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
