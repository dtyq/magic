import { useRef, useEffect } from "react"
import { MonacoEditor } from "@/infrastructure/editors/monaco"
import type { editor } from "monaco-editor"
import { useUnmount } from "ahooks"
import { useTheme } from "@/models/config/hooks"
import { formatLongCurlDataRawForPreview } from "./preview-content"
import { isLargeMarkdownContent } from "../../largeMarkdown"

interface CodeSourceEditorProps {
	language: string
	isEditMode?: boolean
	isLargeFile?: boolean
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

function CodeSourceEditor({
	language,
	isEditMode,
	isLargeFile: isLargeFileProp,
	content,
	onChange,
}: CodeSourceEditorProps) {
	const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
	const monacoLanguage = mapLanguageToMonaco(language)
	const { prefersColorScheme } = useTheme()
	const monacoTheme = prefersColorScheme === "dark" ? "vs-dark" : "vs-light"
	const isLargeFile = isLargeFileProp ?? isLargeMarkdownContent(content)

	const onDidFocusEditorTextFn = useRef<{ dispose: () => void } | null>(null)
	const onDidPasteListener = useRef<{ dispose: () => void } | null>(null)
	const removePasteListener = useRef<(() => void) | null>(null)

	useUnmount(() => {
		if (onDidFocusEditorTextFn.current) {
			onDidFocusEditorTextFn.current.dispose()
		}
		onDidPasteListener.current?.dispose()
		removePasteListener.current?.()
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
		largeFileOptimizations: true,
		fontSize: 14,
		lineNumbers: "on",
		scrollBeyondLastLine: false,
		automaticLayout: true,
		tabSize: 2,
		// The read-only preview pre-formats long curl JSON payloads into physical
		// lines. Keep Monaco wrapping for editing, but avoid re-creating the
		// pathological virtual line in preview mode.
		wordWrap: isEditMode ? "on" : "off",
		wrappingIndent: isEditMode ? "indent" : "none",
		wrappingStrategy: "simple",
		// Markdown source files can contain a complete request body on one line
		// (for example, curl --data-raw). Raise Monaco's 10,000-character safety
		// limit without allowing pathological lines to exhaust the rendering budget.
		stopRenderingLineAfter: 50_000,
		padding: { top: 20, bottom: 20 },
		scrollbar: {
			verticalScrollbarSize: 10,
			horizontalScrollbarSize: 10,
		},
		renderWhitespace: "selection",
		bracketPairColorization: { enabled: !isLargeFile },
		guides: {
			indentation: !isLargeFile,
			bracketPairs: !isLargeFile,
		},
		folding: !isLargeFile,
		foldingStrategy: "indentation",
		showFoldingControls: "mouseover",
		lineDecorationsWidth: 10,
		lineNumbersMinChars: 3,
		glyphMargin: false,
		matchBrackets: isLargeFile ? "never" : "always",
		colorDecorators: !isLargeFile,
		codeLens: false,
		links: !isLargeFile,
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
				const domNode = editor.getDomNode()
				const normalizeLongCurlPayload = (source: string) => {
					const model = editor.getModel()
					const currentValue = editor.getValue()
					const formattedValue = formatLongCurlDataRawForPreview(currentValue)

					if (!model || formattedValue === currentValue) return

					editor.executeEdits(source, [
						{
							range: model.getFullModelRange(),
							text: formattedValue,
							forceMoveMarkers: true,
						},
					])
				}

				if (isEditMode) {
					// Normalize existing source once when entering edit mode. Do not subscribe
					// to model changes here, because that would scan the whole document per key.
					normalizeLongCurlPayload("format-long-curl-data-raw-on-mount")

					// Monaco owns the actual input element, so the native DOM listener below is not
					// guaranteed to observe every paste route. This callback provides one fallback
					// normalization pass per paste without affecting ordinary typing.
					onDidPasteListener.current = editor.onDidPaste(() => {
						normalizeLongCurlPayload("format-long-curl-data-raw-after-paste")
					})
				}

				if (isEditMode && domNode) {
					const handlePaste = (event: ClipboardEvent) => {
						const pastedText = event.clipboardData?.getData("text/plain")
						if (!pastedText) return

						const formattedText = formatLongCurlDataRawForPreview(pastedText)
						if (formattedText === pastedText) return

						const selection = editor.getSelection()
						if (!selection) return

						// Format before Monaco receives the text, so a single oversized
						// model line never reaches its wrapped-line virtualizer.
						event.preventDefault()
						event.stopPropagation()
						editor.executeEdits("format-long-curl-data-raw-paste", [
							{
								range: selection,
								text: formattedText,
								forceMoveMarkers: true,
							},
						])
					}

					domNode.addEventListener("paste", handlePaste, true)
					removePasteListener.current = () => {
						domNode.removeEventListener("paste", handlePaste, true)
					}
				}

				// Add custom class for preview mode styling
				if (!isEditMode && domNode) {
					domNode.classList.add("preview-mode")
					// Force hide cursor by removing focus
					onDidFocusEditorTextFn.current = editor.onDidFocusEditorText(() => {
						const activeElement = document.activeElement
						if (activeElement && domNode.contains(activeElement)) {
							;(activeElement as HTMLElement).blur()
						}
					})
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
