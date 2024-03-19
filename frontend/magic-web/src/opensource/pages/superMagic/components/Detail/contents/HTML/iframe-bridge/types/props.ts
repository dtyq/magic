import { HistoryState } from "./messages"
import { EditorError } from "./errors"

/**
 * 缩放配置
 */
export interface ScaleConfig {
	/** 是否启用缩放 */
	enabled: boolean
	/** 缩放比例 */
	ratio?: number
	/** 垂直偏移 */
	verticalOffset?: number
	/** 水平偏移 */
	horizontalOffset?: number
	/** 缩放配置变化回调 */
	onScaleChange?: (config: ScaleConfig) => void
}

/**
 * 编辑器回调函数集合
 */
export interface EditorCallbacks {
	/** 保存回调 */
	onSave?: (content: string, fileId: string) => Promise<void> | void

	/** 内容变化回调 */
	onContentChange?: (hasChanges: boolean) => void

	/** 历史状态变化回调 */
	onHistoryChange?: (historyState: HistoryState) => void

	/** 错误回调 */
	onError?: (error: EditorError) => void

	/** 链接点击回调 */
	onLinkClick?: (fileId: string, path: string, options?: { autoEdit?: boolean }) => void

	/** iframe 准备就绪回调 */
	onReady?: () => void

	/** 元素选中回调 */
	onElementSelected?: (payload: {
		selector: string
		tagName: string
		computedStyles: Record<string, string>
	}) => void

	/** 选择模式变化回调 */
	onSelectionModeChange?: (isSelectionMode: boolean) => void
}

/**
 * 编辑器配置
 */
export interface EditorConfig {
	/** 启用撤销/重做功能 */
	enableUndo?: boolean

	/** 历史记录上限 */
	maxHistorySize?: number

	/** 自动保存延迟（毫秒），0 表示禁用自动保存 */
	autoSaveDelay?: number

	/** 请求超时时间（毫秒） */
	requestTimeout?: number
}

/**
 * 项目信息
 */
export interface ProjectInfo {
	id: string
	name?: string
}

/**
 * 附件信息
 */
export interface AttachmentInfo {
	file_id: string
	file_name: string
	relative_file_path: string
	parent_id?: string
	metadata?: any
}

/**
 * 渲染模式
 */
export type RenderMode = "normal" | "presentation" | "playback"

/**
 * 沙箱类型
 */
export type SandboxType = "iframe" | "shadow-dom"

/**
 * HTMLEditorV2 组件 Props
 */
export interface HTMLEditorV2Props {
	// ========== 核心内容 ==========
	/** HTML 内容 */
	content: string

	/** 文件 ID */
	fileId: string

	// ========== 渲染配置 ==========
	/** 自定义样式类名 */
	className?: string

	/** 沙箱类型 */
	sandboxType?: SandboxType

	/** 渲染模式 */
	mode?: RenderMode

	/** 缩放配置（用于演示模式） */
	scale?: ScaleConfig

	// ========== 编辑配置 ==========
	/** 是否启用编辑模式 */
	isEditMode?: boolean

	/** 编辑器配置 */
	editorConfig?: EditorConfig

	/** 回调函数集合 */
	callbacks?: EditorCallbacks

	// ========== 样式面板配置 ==========
	/** 是否显示样式配置面板 */
	showStylePanel?: boolean

	/** 样式面板位置 */
	stylePanelPosition?: "top" | "bottom"

	// ========== 文件和资源 ==========
	/** 文件路径映射（用于资源加载） */
	filePathMapping: Map<string, string>

	/** 当前 HTML 的相对路径 */
	relative_file_path?: string

	/** 所属项目信息 */
	selectedProject?: ProjectInfo

	/** 附件列表 */
	attachmentList?: AttachmentInfo[]
}

/**
 * 保存结果
 */
export interface SaveResult {
	/** 清理后的 HTML 内容 */
	cleanContent: string
	/** 原始 HTML 内容（带编辑器标记） */
	rawContent: string
	/** 文件 ID */
	fileId?: string
	/** 保存是否成功 */
	success: boolean
}

/**
 * HTMLEditorV2 Ref（暴露给父组件的方法）
 */
export interface HTMLEditorV2Ref {
	/** 获取 iframe 元素 */
	getIframeElement: () => HTMLIFrameElement | null

	/** 保存内容，返回保存结果 */
	save: () => Promise<SaveResult>

	/** 撤销 */
	undo: () => Promise<void>

	/** 重做 */
	redo: () => Promise<void>

	/** 获取当前内容（不清理） */
	getContent: () => Promise<string>

	/** 获取清理后的内容 */
	getCleanContent: () => Promise<string>

	/** 获取历史状态 */
	getHistoryState: () => Promise<HistoryState>

	/** 设置背景颜色 */
	setBackgroundColor: (selector: string, color: string) => Promise<void>

	/** 设置文字颜色 */
	setTextColor: (selector: string, color: string) => Promise<void>

	/** 设置字体大小 */
	setFontSize: (
		selector: string,
		fontSize: string | number,
		unit?: "px" | "em" | "rem",
	) => Promise<void>

	/** 递归调整字体大小（包括所有子元素） */
	adjustFontSizeRecursive: (
		selector: string,
		scaleFactor: number,
		minFontSize?: number,
	) => Promise<void>

	/** 批量设置样式 */
	setBatchStyles: (selector: string, styles: Record<string, string>) => Promise<void>

	/** 批量设置多个元素样式 */
	setBatchStylesMultiple: (selectors: string[], styles: Record<string, string>) => Promise<void>

	// ========== 批量操作（用于拖动、旋转、缩放） ==========
	/** 开始批量操作（拖动开始时调用） */
	beginBatchOperation: (selector: string, styles: Record<string, string>) => Promise<void>

	/** 结束批量操作（拖动结束时调用） */
	endBatchOperation: (selector: string, styles: Record<string, string>) => Promise<void>

	/** 取消批量操作（拖动取消时调用） */
	cancelBatchOperation: () => Promise<void>

	/** 临时应用样式（拖动过程中调用，不记录历史） */
	applyStylesTemporary: (selector: string, styles: Record<string, string>) => Promise<void>

	/** 进入编辑模式 */
	enterEditMode: () => Promise<void>

	/** 退出编辑模式 */
	exitEditMode: () => Promise<void>

	/** 清除历史记录 */
	clearHistory: () => Promise<void>

	// ========== 元素选择相关 ==========
	/** 启用元素选择模式 */
	enableSelectionMode: () => Promise<void>

	/** 禁用元素选择模式 */
	disableSelectionMode: () => Promise<void>

	/** 重置编辑器状态（清除选择、退出选择模式等） */
	resetEditorState: () => Promise<void>

	/** 选择指定元素 */
	selectElement: (selector: string) => Promise<void>

	/** 获取元素的计算样式 */
	getElementComputedStyles: (selector: string) => Promise<Record<string, string>>

	// ========== 文本内容编辑 ==========
	/** 启用元素的文本编辑模式（设置为 contenteditable） */
	enableTextEditing: (selector: string) => Promise<void>

	/** 禁用元素的文本编辑模式 */
	disableTextEditing: (selector: string) => Promise<void>

	/** 更新元素的文本内容 */
	updateTextContent: (selector: string, content: string) => Promise<void>

	/** 获取元素的文本内容 */
	getTextContent: (selector: string) => Promise<string>

	// ========== 元素位置调整 ==========
	/** 设置元素位置 (基于 relative 定位) */
	setElementPosition: (selector: string, top: number, left: number) => Promise<void>

	/** 刷新选中元素信息（重新获取 rect 和样式） */
	refreshSelectedElement: (selector: string) => Promise<void>

	/** 刷新选中元素信息（多选） */
	refreshSelectedElements: (selectors: string[]) => Promise<void>

	// ========== 元素删除 ==========
	/** 删除指定元素 */
	deleteElement: (selector: string) => Promise<void>

	// ========== 元素复制 ==========
	/** 复制指定元素并插入到其后作为兄弟元素 */
	duplicateElement: (selector: string) => Promise<void>

	// ========== 文本样式编辑（选中部分文字） ==========
	/** 对选中的文本应用样式（将选中部分拆分为新节点并应用样式） */
	applyTextStyle: (
		selector: string,
		styles: {
			fontWeight?: string
			fontStyle?: string
			textDecoration?: string
			color?: string
			backgroundColor?: string
			fontSize?: string
		},
	) => Promise<void>

	/** 获取当前文本选择信息 */
	getTextSelection: () => Promise<{
		hasSelection: boolean
		selectedText: string
		range?: {
			startOffset: number
			endOffset: number
			containerSelector: string
		}
	}>

	/** 获取当前文本选择的计算样式 */
	getTextSelectionStyles: () => Promise<Record<string, string>>
}
