import { makeAutoObservable } from "mobx"
import { parseUsedPixelValue } from "../../components/StylePanel/utils/dimensionValue"

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
	/** 是否为图片元素 */
	isImageElement?: boolean
	/** 图片原始宽度 */
	intrinsicWidth?: number
	/** 图片原始高度 */
	intrinsicHeight?: number
	/** 图片原始宽高比 */
	intrinsicAspectRatio?: number
	/** 是否为文本元素 */
	isTextElement?: boolean
	/** 是否包含元素自身的非空文本节点（不包含后代元素文本） */
	hasDirectTextContent?: boolean
	/** 元素当前的文本内容 */
	textContent?: string
	/** 元素当前的内联 CSS 声明 */
	inlineStyles?: Record<string, string>
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
		parentSelector?: string
		parentDisplay?: string
		parentFlexDirection?: string
		parentJustifyContent?: string
		parentAlignItems?: string
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
		alignContent?: string
		flexWrap: string
		flexGrow?: string
		flexShrink?: string
		flexBasis?: string
		alignSelf?: string
		order?: string
		gap: string
		rowGap?: string
		columnGap?: string

		// Grid 布局
		gridTemplateColumns: string
		gridTemplateRows: string
		gridAutoFlow?: string
		gridAutoColumns?: string
		gridAutoRows?: string
		gridColumn?: string
		gridRow?: string
		justifyItems: string
		justifySelf?: string

		// 图片
		objectFit?: string
		objectPosition?: string

		// 阴影与效果
		opacity: string
		boxShadow: string
		textShadow: string
	}
	ancestors?: Array<{
		selector: string
		tagName: string
		textContent?: string
		rect: {
			top: number
			left: number
			width: number
			height: number
		}
	}>
	attributes?: {
		src?: string
		alt?: string
		title?: string
		href?: string
		dataMagicHref?: string
		target?: string
		rel?: string
		download?: string
		ariaLabel?: string
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

	/** Last More Styles tab per element in this edit session */
	moreStylesTabBySelector = new Map<string, string>()

	/** Shared flex/grid gap lock for More Styles and canvas handles */
	gapAxesLinked = true

	/** Overlay hover preview for ancestor crumbs and parent-impact hints. */
	previewRect: {
		top: number
		left: number
		width: number
		height: number
	} | null = null

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
			this.syncGapAxesLinked(element)
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
		this.gapAxesLinked = false
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
		this.previewRect = null
	}

	/**
	 * 清除当前选择状态，但保留选择模式。
	 * 用于 iframe 内容更新或取消选择事件，避免在 strict-mode 下直接修改 observable。
	 */
	clearSelectedElements() {
		this.selectedElement = null
		this.selectedElements = []
		this.textSelection = null
		this.previewRect = null
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

	updateComputedStyles(styles: Partial<SelectedElementInfo["computedStyles"]>) {
		if (!this.selectedElement) return
		Object.assign(this.selectedElement.computedStyles, styles)
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
	 * Remember the More Styles tab for one element.
	 */
	rememberMoreStylesTab(selector: string, tab: string) {
		if (!selector || !tab) return
		this.moreStylesTabBySelector.set(selector, tab)
	}

	/**
	 * Read the cached More Styles tab for one element.
	 */
	getMoreStylesTab(selector: string): string | undefined {
		if (!selector) return undefined
		return this.moreStylesTabBySelector.get(selector)
	}

	/**
	 * 更新历史状态
	 */
	updateHistoryState(state: HistoryStateInfo) {
		this.historyState = state
	}

	setGapAxesLinked(linked: boolean) {
		this.gapAxesLinked = linked
	}

	setPreviewRect(
		rect: {
			top: number
			left: number
			width: number
			height: number
		} | null,
	) {
		this.previewRect = rect
	}

	private syncGapAxesLinked(element: SelectedElementInfo) {
		const row = parseUsedPixelValue(element.computedStyles.rowGap ?? element.computedStyles.gap)
		const column = parseUsedPixelValue(
			element.computedStyles.columnGap ?? element.computedStyles.gap,
		)
		this.gapAxesLinked = row !== null && column !== null && row === column
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
		this.moreStylesTabBySelector.clear()
		this.gapAxesLinked = true
		this.previewRect = null
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
