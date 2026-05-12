import { memo, useState, useEffect } from "react"
import { useThemeMode } from "antd-style"
import { MonacoEditor } from "@/lib/monacoEditor"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { CodeEditorProps } from "./types"
import { getMonacoLanguageByFileName } from "./utils"

function CodeEditor(props: CodeEditorProps) {
	const {
		content,
		fileName = "file.html",
		isEditMode = false,
		onChange,
		height = "100%",
		showLineNumbers = true,
		theme,
		editorOptions,
	} = props

	const { appearance } = useThemeMode()
	const monacoTheme = theme ?? (appearance === "dark" ? "vs-dark" : "light")

	const [editingContent, setEditingContent] = useState<string>(content)

	// 更新编辑内容
	useEffect(() => {
		setEditingContent(content)
	}, [content])

	const monacoLanguage = getMonacoLanguageByFileName(fileName)

	// 处理内容变化
	const handleContentChange = (value: string | undefined) => {
		const newValue = value || ""
		setEditingContent(newValue)
		onChange?.(newValue)
	}

	// 默认Monaco Editor配置
	const defaultEditorOptions = {
		selectOnLineNumbers: true,
		automaticLayout: true,
		minimap: { enabled: false },
		scrollBeyondLastLine: false,
		wordWrap: "on" as const,
		lineNumbers: showLineNumbers ? ("on" as const) : ("off" as const),
		folding: true,
		fontSize: 14,
		lineHeight: 22,
		fontFamily: "Consolas, Monaco, 'Courier New', monospace",
		tabSize: 2,
		insertSpaces: false,
		detectIndentation: true,
		renderWhitespace: "selection" as const,
		scrollbar: {
			vertical: "auto" as const,
			horizontal: "auto" as const,
		},
		readOnly: isEditMode ? false : true,
		...editorOptions,
	}
	const loadingPlaceholder = (
		<div className="flex h-full w-full items-center justify-center bg-white dark:bg-[#1e1e1e]">
			<Spinner size={20} className="animate-spin text-muted-foreground" />
		</div>
	)

	if (isEditMode) {
		return (
			<MonacoEditor
				height={height}
				language={monacoLanguage}
				value={editingContent}
				onChange={handleContentChange}
				theme={monacoTheme}
				options={defaultEditorOptions}
				loading={loadingPlaceholder}
			/>
		)
	}

	return (
		<MonacoEditor
			height={height}
			language={monacoLanguage}
			value={content}
			theme={monacoTheme}
			options={{
				...defaultEditorOptions,
				readOnly: true,
				contextmenu: false,
				cursorStyle: "line-thin",
			}}
			loading={loadingPlaceholder}
		/>
	)
}

export default memo(CodeEditor)
