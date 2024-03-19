import { useRef, useEffect } from "react"
import { MonacoEditor } from "@/opensource/lib/monacoEditor"
import type { editor } from "monaco-editor"
import { useUnmount } from "ahooks"
import { useTheme } from "@/opensource/models/config/hooks"

interface CodeSourceEditorProps {
	language: string
	isEditMode?: boolean
	content: string
	onChange?: (value: string) => void
}

// Monaco editor wrapper: layout + line-numbers override
const editorWrapperClasses =
	"h-full w-full relative [&_.line-numbers]:!w-auto [&_.line-numbers]:pl-2"

// Preview mode wrapper: hide text cursor in Monaco
const previewWrapperClasses = "h-full w-full [&_.monaco-mouse-cursor-text]:cursor-default"

// Map common language names to Monaco Editor language identifiers
const mapLanguageToMonaco = (lang: string): string => {
	const languageMap: Record<string, string> = {
		js: "javascript",
		ts: "typescript",
		jsx: "javascript",
		tsx: "typescript",
		py: "python",
		rb: "ruby",
		sh: "shell",
		bash: "shell",
		yml: "yaml",
		yaml: "yaml",
		md: "markdown",
		json: "json",
		xml: "xml",
		html: "html",
		css: "css",
		scss: "scss",
		less: "less",
		sql: "sql",
		go: "go",
		rust: "rust",
		cpp: "cpp",
		c: "c",
		java: "java",
		kt: "kotlin",
		swift: "swift",
		php: "php",
		cs: "csharp",
		vb: "vb",
		r: "r",
		dart: "dart",
		lua: "lua",
		perl: "perl",
		powershell: "powershell",
		dockerfile: "dockerfile",
	}
	return languageMap[lang.toLowerCase()] || lang.toLowerCase()
}

function CodeSourceEditor({ language, isEditMode, content, onChange }: CodeSourceEditorProps) {
	const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
	const monacoLanguage = mapLanguageToMonaco(language)
	const { prefersColorScheme } = useTheme()
	const monacoTheme = prefersColorScheme === "dark" ? "vs-dark" : "vs-light"

	const onDidFocusEditorTextFn = useRef<{ dispose: () => void } | null>(null)

	useUnmount(() => {
		if (onDidFocusEditorTextFn.current) {
			onDidFocusEditorTextFn.current.dispose()
		}
	})

	useEffect(() => {
		// Update editor content when content prop changes (only in edit mode)
		if (isEditMode && editorRef.current) {
			const currentValue = editorRef.current.getValue()
			if (currentValue !== content) {
				editorRef.current.setValue(content)
			}
		}
	}, [content, isEditMode])

	useEffect(() => {
		// Force layout update when content changes to prevent overlapping
		if (editorRef.current) {
			// Use requestAnimationFrame to ensure DOM has updated
			requestAnimationFrame(() => {
				editorRef.current?.layout()
			})
		}
	}, [content])

	// Common editor options
	const commonOptions: editor.IStandaloneEditorConstructionOptions = {
		minimap: { enabled: false },
		fontSize: 14,
		lineNumbers: "on",
		scrollBeyondLastLine: false,
		automaticLayout: true,
		tabSize: 2,
		wordWrap: "on",
		wrappingIndent: "indent",
		padding: { top: 20, bottom: 20 },
		scrollbar: {
			verticalScrollbarSize: 10,
			horizontalScrollbarSize: 10,
		},
		renderWhitespace: "selection",
		bracketPairColorization: { enabled: true },
		guides: {
			indentation: true,
			bracketPairs: true,
		},
		folding: true,
		foldingStrategy: "indentation",
		showFoldingControls: "mouseover",
		lineDecorationsWidth: 10,
		lineNumbersMinChars: 3,
		glyphMargin: false,
		matchBrackets: "always",
		colorDecorators: true,
		codeLens: false,
		links: true,
	}

	// Mode-specific options
	const editorOptions: editor.IStandaloneEditorConstructionOptions = {
		...commonOptions,
		readOnly: !isEditMode,
		domReadOnly: !isEditMode,
		contextmenu: isEditMode,
		cursorStyle: isEditMode ? "line" : "line-thin",
		cursorBlinking: isEditMode ? "blink" : "solid",
		renderLineHighlight: isEditMode ? "line" : "none",
		occurrencesHighlight: isEditMode ? "singleFile" : "off",
		selectionHighlight: isEditMode,
		quickSuggestions: isEditMode,
		suggestOnTriggerCharacters: isEditMode,
		acceptSuggestionOnCommitCharacter: isEditMode,
		snippetSuggestions: isEditMode ? "inline" : "none",
		wordBasedSuggestions: isEditMode ? "matchingDocuments" : "off",
		cursorWidth: isEditMode ? undefined : 0,
		// Disable unicode highlight in preview mode
		unicodeHighlight: isEditMode
			? {}
			: {
					nonBasicASCII: false,
					invisibleCharacters: false,
					ambiguousCharacters: false,
				},
	}

	const editorContent = (
		<MonacoEditor
			height="100%"
			language={monacoLanguage}
			value={content}
			onChange={isEditMode ? (value) => onChange?.(value || "") : undefined}
			onMount={(editor) => {
				editorRef.current = editor
				// Add custom class for preview mode styling
				if (!isEditMode) {
					const domNode = editor.getDomNode()
					if (domNode) {
						domNode.classList.add("preview-mode")
						// Force hide cursor by removing focus
						onDidFocusEditorTextFn.current = editor.onDidFocusEditorText(() => {
							const activeElement = document.activeElement
							if (activeElement && domNode.contains(activeElement)) {
								;(activeElement as HTMLElement).blur()
							}
						})
					}
				}
			}}
			className={editorWrapperClasses}
			options={editorOptions}
			theme={monacoTheme}
		/>
	)

	// Wrap preview mode with custom styles
	if (!isEditMode) {
		return <div className={previewWrapperClasses}>{editorContent}</div>
	}

	return editorContent
}

export default CodeSourceEditor
