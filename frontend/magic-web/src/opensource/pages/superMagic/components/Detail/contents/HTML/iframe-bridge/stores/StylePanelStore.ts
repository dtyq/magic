import { makeAutoObservable } from "mobx"

/**
 * 文本选择信息（选中部分文字）
 */
export interface TextSelectionInfo {
	/** 是否有文本选择 */
	hasSelection: boolean
	/** 选中的文本 */
	selectedText: string
	/** 容器元素的 CSS 选择器 */
	containerSelector: string
}

/**
 * 选中的元素信息
 */
export interface SelectedElementInfo {
	/** CSS 选择器 */
	selector: string
	/** 元素标签名 */
	tagName: string
	/** 是否为文本元素 */
	isTextElement?: boolean
	/** 计算后的样式 */
	computedStyles: {
		// 文字样式
		color: string
		fontSize: string
		fontWeight: string
		fontFamily: string
		fontStyle: string
		lineHeight: string
		textAlign: string
		textDecoration: string

		// 背景样式
		backgroundColor: string
		backgroundImage: string

		// 布局样式
		width: string
		height: string
		display: string
		position: string

		// 边距
		margin: string
		marginTop: string
		marginRight: string
		marginBottom: string
		marginLeft: string
		padding: string
		paddingTop: string
		paddingRight: string
		paddingBottom: string
		paddingLeft: string

		// 边框
		border: string
		borderWidth: string
		borderStyle: string
		borderColor: string
		borderRadius: string

		// Flex 布局
		flexDirection: string
		justifyContent: string
		alignItems: string
		flexWrap: string
		gap: string

		// Grid 布局
		gridTemplateColumns: string
		gridTemplateRows: string
		justifyItems: string

		// 阴影与效果
		opacity: string
		boxShadow: string
		textShadow: string
	}
}

/**
 * 历史状态信息
 */
export interface HistoryStateInfo {
	canUndo: boolean
	canRedo: boolean
	currentIndex: number
	totalCommands: number
}

/**
 * 样式面板状态管理 Store（框架无关）
 * 使用 MobX 实现响应式状态管理
 */
export class StylePanelStore {
	/** 选中的元素信息（单选时使用） */
	selectedElement: SelectedElementInfo | null = null

	/** 选中的多个元素信息（多选时使用） */
	selectedElements: SelectedElementInfo[] = []

	/** 文本选择信息（选中部分文字） */
	textSelection: TextSelectionInfo | null = null

	/** 是否处于选择模式 */
	isSelectionMode = false

	/** 面板是否展开 */
	isPanelExpanded = true

	/** 当前激活的样式区域 */
	activeSection: "typography" | "layout" | "background" | "border" | null = null

	/** 历史状态 */
	historyState: HistoryStateInfo = {
		canUndo: false,
		canRedo: false,
		currentIndex: 0,
		totalCommands: 0,
	}

	constructor() {
		makeAutoObservable(this)
	}

	/**
	 * 选择单个元素
	 */
	selectElement(element: SelectedElementInfo) {
		// Clear text selection only when switching to a different element
		// Keep text selection when re-selecting the same element (e.g., after style refresh)
		if (this.selectedElement?.selector !== element.selector) {
			this.textSelection = null
		}

		this.selectedElement = element
		this.selectedElements = [] // Clear multi-selection when single selecting
	}

	/**
	 * 选择多个元素
	 */
	selectElements(elements: SelectedElementInfo[]) {
		this.selectedElements = elements
		this.selectedElement = null // Clear single selection when multi-selecting
		this.textSelection = null // Clear text selection in multi-select mode
	}

	/**
	 * 获取所有选中元素的选择器列表
	 */
	getSelectedSelectors(): string[] {
		if (this.selectedElements.length > 0) {
			return this.selectedElements.map((el) => el.selector)
		} else if (this.selectedElement) {
			return [this.selectedElement.selector]
		}
		return []
	}

	/**
	 * 检查是否是多选模式
	 */
	isMultiSelect(): boolean {
		return this.selectedElements.length > 1
	}

	/**
	 * 设置文本选择（选中部分文字）
	 */
	setTextSelection(selection: TextSelectionInfo | null) {
		this.textSelection = selection
	}

	/**
	 * 清除选择
	 */
	clearSelection() {
		this.selectedElement = null
		this.selectedElements = []
		this.textSelection = null
		this.isSelectionMode = false
	}

	/**
	 * 切换选择模式
	 */
	toggleSelectionMode() {
		this.isSelectionMode = !this.isSelectionMode
		if (!this.isSelectionMode) {
			// 退出选择模式时不清除已选中的元素
		}
	}

	/**
	 * 设置选择模式
	 */
	setSelectionMode(enabled: boolean) {
		this.isSelectionMode = enabled
	}

	/**
	 * 更新元素的计算样式（用于实时预览）
	 */
	updateComputedStyle(property: string, value: string) {
		if (this.selectedElement) {
			this.selectedElement.computedStyles[
				property as keyof SelectedElementInfo["computedStyles"]
			] = value
		}
	}

	/**
	 * 切换面板展开状态
	 */
	togglePanelExpanded() {
		this.isPanelExpanded = !this.isPanelExpanded
	}

	/**
	 * 设置激活的样式区域
	 */
	setActiveSection(section: typeof this.activeSection) {
		this.activeSection = section
	}

	/**
	 * 更新历史状态
	 */
	updateHistoryState(state: HistoryStateInfo) {
		this.historyState = state
	}

	/**
	 * 重置 Store
	 */
	reset() {
		this.selectedElement = null
		this.selectedElements = []
		this.textSelection = null
		this.isSelectionMode = false
		this.isPanelExpanded = true
		this.activeSection = null
		this.historyState = {
			canUndo: false,
			canRedo: false,
			currentIndex: 0,
			totalCommands: 0,
		}
	}
}

// 导出单例实例
export const stylePanelStore = new StylePanelStore()
