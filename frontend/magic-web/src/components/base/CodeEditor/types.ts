export interface CodeEditorProps {
	/** 文件内容 */
	content: string
	/** 文件名（用于语言检测） */
	fileName?: string
	/** 是否为编辑模式 */
	isEditMode?: boolean
	/** 内容变化回调 */
	onChange?: (value: string) => void
	/** 自定义高度 */
	height?: string | number
	/** 是否显示行号 */
	showLineNumbers?: boolean
	/** 主题 */
	theme?: "vs-dark" | "light"
	/** 自定义样式 */
	style?: React.CSSProperties
	/** Monaco Editor 配置选项 */
	editorOptions?: any
	/** SyntaxHighlighter 自定义样式 */
	highlighterStyle?: any
	/** 行号样式 */
	lineNumberStyle?: React.CSSProperties
}
