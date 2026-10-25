import { EditorErrorCode } from "./errors"

/**
 * 消息协议版本
 */
export const MESSAGE_PROTOCOL_VERSION = "1.0.0"

/**
 * 消息类别
 */
export enum MessageCategory {
	/** 请求消息（需要响应） */
	REQUEST = "request",
	/** 响应消息 */
	RESPONSE = "response",
	/** 事件消息（单向通知） */
	EVENT = "event",
	/** 命令消息（可撤销操作） */
	COMMAND = "command",
}

/**
 * 消息来源
 */
export type MessageSource = "parent" | "iframe"

/**
 * 基础消息接口
 */
export interface BaseMessage {
	/** 协议版本 */
	version: string
	/** 消息类别 */
	category: MessageCategory
	/** 具体消息类型 */
	type: string
	/** 请求ID（用于匹配请求和响应） */
	requestId?: string
	/** 时间戳 */
	timestamp: number
	/** 消息来源 */
	source: MessageSource
}

/**
 * 请求消息
 */
export interface RequestMessage<T = any> extends BaseMessage {
	category: MessageCategory.REQUEST
	payload: T
	/** 超时时间（毫秒） */
	timeout?: number
}

/**
 * 响应消息
 */
export interface ResponseMessage<T = any> extends BaseMessage {
	category: MessageCategory.RESPONSE
	success: boolean
	payload?: T
	error?: {
		code: EditorErrorCode | string
		message: string
		details?: any
	}
}

/**
 * 事件消息
 */
export interface EventMessage<T = any> extends BaseMessage {
	category: MessageCategory.EVENT
	payload: T
}

/**
 * 命令元数据
 */
export interface CommandMetadata {
	/** 命令描述（用于UI显示） */
	description: string
	/** 是否可撤销 */
	canUndo: boolean
}

/**
 * 命令消息（支持撤销/重做）
 */
export interface CommandMessage<T = any> extends BaseMessage {
	category: MessageCategory.COMMAND
	/** 命令唯一ID */
	commandId: string
	/** 命令类型 */
	commandType: string
	payload: T
	metadata?: CommandMetadata
}

/**
 * 编辑操作的消息类型
 */
export enum EditorMessageType {
	// ========== 样式相关 ==========
	SET_ELEMENT_STYLE = "SET_ELEMENT_STYLE",
	SET_BACKGROUND_COLOR = "SET_BACKGROUND_COLOR",
	SET_TEXT_COLOR = "SET_TEXT_COLOR",
	SET_FONT_SIZE = "SET_FONT_SIZE",
	SET_FONT_WEIGHT = "SET_FONT_WEIGHT",
	BATCH_STYLES = "BATCH_STYLES",
	BATCH_STYLES_MULTIPLE = "BATCH_STYLES_MULTIPLE",
	ADJUST_FONT_SIZE_RECURSIVE = "ADJUST_FONT_SIZE_RECURSIVE",
	SET_ELEMENT_POSITION = "SET_ELEMENT_POSITION",
	DELETE_ELEMENT = "DELETE_ELEMENT",
	DUPLICATE_ELEMENT = "DUPLICATE_ELEMENT",
	DUPLICATE_DOM_NODE = "DUPLICATE_DOM_NODE",
	MOVE_DOM_NODE = "MOVE_DOM_NODE",
	BEGIN_DOM_MOVE_PREVIEW = "BEGIN_DOM_MOVE_PREVIEW",
	PREVIEW_DOM_MOVE = "PREVIEW_DOM_MOVE",
	COMMIT_DOM_MOVE_PREVIEW = "COMMIT_DOM_MOVE_PREVIEW",
	CANCEL_DOM_MOVE_PREVIEW = "CANCEL_DOM_MOVE_PREVIEW",
	INSERT_TEXT_NODE = "INSERT_TEXT_NODE",
	INSERT_IMAGE_NODE = "INSERT_IMAGE_NODE",
	COPY_DOM_NODE = "COPY_DOM_NODE",
	CUT_DOM_NODE = "CUT_DOM_NODE",
	PASTE_DOM_NODE = "PASTE_DOM_NODE",
	RUN_IMAGE_ACTION = "RUN_IMAGE_ACTION",

	// ========== 批量操作（用于拖动、旋转、缩放等） ==========
	BEGIN_BATCH_OPERATION = "BEGIN_BATCH_OPERATION",
	END_BATCH_OPERATION = "END_BATCH_OPERATION",
	CANCEL_BATCH_OPERATION = "CANCEL_BATCH_OPERATION",
	APPLY_STYLES_TEMPORARY = "APPLY_STYLES_TEMPORARY",

	// ========== 文本内容相关 ==========
	SET_TEXT_CONTENT = "SET_TEXT_CONTENT",
	GET_TEXT_CONTENT = "GET_TEXT_CONTENT",
	UPDATE_TEXT_CONTENT = "UPDATE_TEXT_CONTENT",
	UPDATE_ELEMENT_ATTRIBUTES = "UPDATE_ELEMENT_ATTRIBUTES",
	GET_PPT_BUILDS = "GET_PPT_BUILDS",
	UPDATE_PPT_BUILDS = "UPDATE_PPT_BUILDS",
	SET_PPT_BUILD_MARKERS = "SET_PPT_BUILD_MARKERS",
	PREVIEW_PPT_BUILD = "PREVIEW_PPT_BUILD",
	ENABLE_TEXT_EDITING = "ENABLE_TEXT_EDITING",
	DISABLE_TEXT_EDITING = "DISABLE_TEXT_EDITING",

	// ========== 文本样式相关 (选中部分文字) ==========
	APPLY_TEXT_STYLE = "APPLY_TEXT_STYLE",
	GET_TEXT_SELECTION = "GET_TEXT_SELECTION",
	GET_TEXT_SELECTION_STYLES = "GET_TEXT_SELECTION_STYLES",
	TEXT_SELECTION_CHANGED = "TEXT_SELECTION_CHANGED",

	// ========== 内容操作 ==========
	GET_CONTENT = "GET_CONTENT",
	GET_CLEAN_CONTENT = "GET_CLEAN_CONTENT",
	SET_CONTENT = "SET_CONTENT",
	INIT_CONTENT = "INIT_CONTENT",

	// ========== 编辑状态 ==========
	ENTER_EDIT_MODE = "ENTER_EDIT_MODE",
	SET_PPT_BUILD_MODE = "SET_PPT_BUILD_MODE",
	EXIT_EDIT_MODE = "EXIT_EDIT_MODE",
	SELECT_ELEMENT = "SELECT_ELEMENT",
	HOVER_ELEMENT = "HOVER_ELEMENT",
	CLEAR_HOVER_ELEMENT = "CLEAR_HOVER_ELEMENT",

	// ========== 元素选择模式 ==========
	ENTER_SELECTION_MODE = "ENTER_SELECTION_MODE",
	EXIT_SELECTION_MODE = "EXIT_SELECTION_MODE",
	CLEAR_SELECTION = "CLEAR_SELECTION",
	GET_COMPUTED_STYLES = "GET_COMPUTED_STYLES",
	GET_DOM_TREE = "GET_DOM_TREE",
	SCROLL_TO_ELEMENT = "SCROLL_TO_ELEMENT",
	REFRESH_SELECTED_ELEMENT = "REFRESH_SELECTED_ELEMENT",
	REFRESH_SELECTED_ELEMENTS = "REFRESH_SELECTED_ELEMENTS",

	// ========== 撤销/重做 ==========
	UNDO = "UNDO",
	REDO = "REDO",
	GET_HISTORY_STATE = "GET_HISTORY_STATE",
	CLEAR_HISTORY = "CLEAR_HISTORY",

	// ========== 保存 ==========
	SAVE_CONTENT = "SAVE_CONTENT",

	// ========== 验证 ==========
	VALIDATE_CONTENT = "VALIDATE_CONTENT",

	// ========== 系统事件 ==========
	IFRAME_READY = "IFRAME_READY",
	CONTENT_CHANGED = "CONTENT_CHANGED",
	HISTORY_STATE_CHANGED = "HISTORY_STATE_CHANGED",
	EDIT_MODE_CHANGED = "EDIT_MODE_CHANGED",
	ELEMENT_SELECTED = "ELEMENT_SELECTED",
	ELEMENT_DESELECTED = "ELEMENT_DESELECTED",
	ELEMENTS_SELECTED = "ELEMENTS_SELECTED",
	ELEMENTS_DESELECTED = "ELEMENTS_DESELECTED",
	ELEMENT_HOVERED = "ELEMENT_HOVERED",
	ELEMENT_HOVER_END = "ELEMENT_HOVER_END",
	DYNAMIC_ELEMENT_CLICKED = "DYNAMIC_ELEMENT_CLICKED",
	SELECTION_MODE_CHANGED = "SELECTION_MODE_CHANGED",
	IFRAME_ZOOM_REQUEST = "IFRAME_ZOOM_REQUEST",

	// ========== 命令执行 ==========
	EXECUTE_COMMAND = "EXECUTE_COMMAND",
}

/**
 * 设置元素样式的 Payload
 */
export interface SetElementStylePayload {
	/** CSS 选择器或 jsPath */
	selector: string
	/** 样式对象 */
	styles: Record<string, string>
	/** 是否合并现有样式 */
	merge?: boolean
}

/**
 * 设置颜色的 Payload
 */
export interface SetColorPayload {
	selector: string
	color: string
}

/**
 * 设置字体大小的 Payload
 */
export interface SetFontSizePayload {
	selector: string
	fontSize: string | number
	unit?: "px" | "em" | "rem"
}

/**
 * 批量设置样式的 Payload
 */
export interface BatchStylesPayload {
	selector: string
	styles: Record<string, string>
}

/**
 * 批量设置多个元素样式的 Payload
 */
export interface BatchStylesMultiplePayload {
	selectors: string[]
	styles: Record<string, string>
}

/**
 * 图片动作类型
 */
export type ImageActionType =
	| "replace-element-image"
	| "set-element-background-image"
	| "remove-element-background-image"
	| "insert-floating-image"
	| "insert-image-node"

/**
 * 执行图片动作的 Payload
 */
export interface ImageActionPayload {
	action: ImageActionType
	parentSelector?: string
	index?: number
}

export interface DomTreeNode {
	nodeId: string
	selector: string
	tagName: string
	label: string
	textContent?: string
	resource?: string
	/** Resolved image source used for the DOM-tree thumbnail. */
	thumbnailUrl?: string
	children: DomTreeNode[]
	/** Whether the canvas can select this node. Kept optional for older runtimes. */
	canSelect?: boolean
	editable: boolean
	canHaveChildren: boolean
	canDelete: boolean
	canMove: boolean
	disabledReason?: string
	dynamicWarning?: string
}

export interface DomTreeResponse {
	root: DomTreeNode
	/** Clipboard state is optional for compatibility with older iframe runtimes. */
	clipboard?: {
		hasContent: boolean
		mode?: "copy" | "cut"
	}
}

export interface MoveDomNodePayload {
	nodeId: string
	targetParentId: string
	targetIndex: number
}

export interface InsertTextNodePayload {
	parentNodeId: string
	index?: number
	textContent: string
}

export interface InsertImageNodePayload {
	parentNodeId: string
	index?: number
}

/**
 * 图片上传请求的 Payload
 */
export interface ImageUploadRequestPayload {
	requestId: string
	action: Extract<
		ImageActionType,
		| "replace-element-image"
		| "set-element-background-image"
		| "insert-floating-image"
		| "insert-image-node"
	>
	selector: string
	suggestedPath: string
}

/**
 * 图片上传结果的 Payload
 */
export interface ImageUploadResultPayload {
	requestId: string
	action: ImageUploadRequestPayload["action"]
	selector: string
	success: boolean
	cancelled?: boolean
	previewUrl?: string
	relativeFilePath?: string
	error?: string
}

/**
 * 获取内容的响应
 */
export interface GetContentResponse {
	/** 原始 HTML */
	html: string
	/** 清理后的 HTML */
	cleanHtml: string
	/** 是否有未保存的变更 */
	hasChanges: boolean
}

/**
 * 保存内容的 Payload
 */
export interface SaveContentPayload {
	html: string
	fileId: string
}

/**
 * 历史状态
 */
export interface HistoryState {
	canUndo: boolean
	canRedo: boolean
	currentIndex: number
	totalCommands: number
	undoStack: Array<{ description: string; timestamp: number }>
	redoStack: Array<{ description: string; timestamp: number }>
}

/**
 * 选择元素的 Payload
 */
export interface SelectElementPayload {
	selector: string
	rect?: DOMRect
}

/**
 * 内容变化事件的 Payload
 */
export interface ContentChangedPayload {
	hasChanges: boolean
	changeCount: number
}

/**
 * 编辑模式变化事件的 Payload
 */
export interface EditModeChangedPayload {
	isEditMode: boolean
}

/**
 * 选中元素事件的 Payload（完整信息）
 */
export interface ElementSelectedPayload {
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
		transform: string
	}
	/** 元素的矩形信息（未旋转的原始矩形） */
	rect?: {
		top: number
		left: number
		width: number
		height: number
	}
	childRects?: Array<{
		top: number
		left: number
		width: number
		height: number
		position?: string
		display?: string
	}>
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
	/** 元素旋转角度（度数） */
	rotation?: number
	/** 是否为文本元素 */
	isTextElement?: boolean
	/** 是否包含元素自身的非空文本节点（不包含后代元素文本） */
	hasDirectTextContent?: boolean
	/** 文本内容 */
	textContent?: string
	/** 元素当前的内联 CSS 声明 */
	inlineStyles?: Record<string, string>
	/** 常用 HTML 属性 */
	attributes?: {
		href?: string
		dataMagicHref?: string
		target?: string
		rel?: string
		download?: string
		title?: string
		ariaLabel?: string
	}
}

/**
 * 获取计算样式的 Payload
 */
export interface GetComputedStylesPayload {
	selector: string
}

/**
 * 获取计算样式的响应
 */
export interface GetComputedStylesResponse {
	styles: ElementSelectedPayload["computedStyles"]
}

/**
 * 选择模式变化事件的 Payload
 */
export interface SelectionModeChangedPayload {
	isSelectionMode: boolean
}

/**
 * 设置文本内容的 Payload
 */
export interface SetTextContentPayload {
	selector: string
	textContent: string
}

/**
 * 获取文本内容的 Payload
 */
export interface GetTextContentPayload {
	selector: string
}

/**
 * 获取文本内容的响应
 */
export interface GetTextContentResponse {
	textContent: string
	hasText: boolean
}

/**
 * 更新文本内容的 Payload
 */
export interface UpdateTextContentPayload {
	selector: string
	content: string
}

/** 更新元素常用 HTML 属性的 Payload */
export interface UpdateElementAttributesPayload {
	selector: string
	attributes: Record<string, string | null>
}

/**
 * 启用/禁用文本编辑的 Payload
 */
export interface TextEditingPayload {
	selector: string
}

/**
 * 设置元素位置的 Payload (基于 relative 定位)
 */
export interface SetElementPositionPayload {
	selector: string
	top: number
	left: number
}

/**
 * 刷新选中元素的 Payload
 */
export interface RefreshSelectedElementPayload {
	selector: string
}

/**
 * 初始化内容的 Payload
 */
export interface InitContentPayload {
	/** HTML 内容 */
	html: string
	/** 文件 ID */
	fileId: string
	/** 文件路径映射（用于资源加载） */
	filePathMapping?: Record<string, string>
	/** 当前 HTML 的相对路径 */
	relative_file_path?: string
	/** 所属项目信息 */
	selectedProject?: {
		id: string
		name?: string
	}
	/** 附件列表 */
	attachmentList?: Array<{
		file_id: string
		file_name: string
		relative_file_path: string
		parent_id?: string
		display_config?: any
	}>
	/** 编辑器配置 */
	editorConfig?: {
		enableUndo?: boolean
		maxHistorySize?: number
		autoSaveDelay?: number
		requestTimeout?: number
	}
}

/**
 * 应用文本样式的 Payload（对选中的部分文字）
 */
export interface ApplyTextStylePayload {
	/** 元素选择器 */
	selector: string
	/** 要应用的样式 */
	styles: {
		fontWeight?: string
		fontStyle?: string
		textDecoration?: string
		color?: string
		backgroundColor?: string
		fontSize?: string
	}
}

/**
 * 获取文本选择的响应
 */
export interface GetTextSelectionResponse {
	/** 是否有选中的文本 */
	hasSelection: boolean
	/** 选中的文本内容 */
	selectedText: string
	/** 选中文本的范围信息 */
	range?: {
		startOffset: number
		endOffset: number
		containerSelector: string
	}
}

/**
 * 文本选择变化事件的 Payload
 */
export interface TextSelectionChangedPayload {
	/** 是否有选中的文本 */
	hasSelection: boolean
	/** 选中的文本内容 */
	selectedText: string
	/** 选中文本的位置信息（用于显示工具栏） */
	boundingRect?: {
		top: number
		left: number
		width: number
		height: number
	}
	/** 容器元素的选择器 */
	containerSelector?: string
}

/**
 * 多选元素事件的 Payload
 */
export interface ElementsSelectedPayload {
	/** 所有选中元素的信息 */
	elements: Array<ElementSelectedPayload>
}

/**
 * iframe 缩放请求的 Payload (触摸板双指缩放)
 */
export interface IframeZoomRequestPayload {
	/** 缩放增量 (负值表示缩小, 正值表示放大) */
	delta: number
	/** 时间戳 */
	timestamp: number
}

// ========== 拖拽插入图片相关 ==========

/**
 * 拖拽位置查询 Payload（父 → iframe）
 * 通知 iframe 当前拖拽坐标，用于计算插入位置并显示指示器
 */
export interface DragOverPayload {
	/** iframe 内的 X 坐标（已除以 scaleRatio） */
	x: number
	/** iframe 内的 Y 坐标（已除以 scaleRatio） */
	y: number
}

/**
 * 拖拽离开 Payload（父 → iframe）
 * 通知 iframe 拖拽已离开，应隐藏指示器
 */
export interface DragLeavePayload {}

/**
 * 拖拽放置图片 Payload（父 → iframe）
 * 通知 iframe 在当前指示器位置插入图片
 */
export interface DropImagePayload {
	/** 图片相对路径（用于 src 属性） */
	relativePath: string
	/** 图片预览 URL（用于即时显示） */
	previewUrl?: string
	/** iframe 内的 X 坐标 */
	x: number
	/** iframe 内的 Y 坐标 */
	y: number
}

/**
 * 拖拽位置响应 Payload（iframe → 父）
 * 返回当前插入点的位置信息，用于父层渲染指示器
 */
export interface DragPositionResponsePayload {
	/** 是否找到有效的插入点 */
	valid: boolean
	/** 指示器线条在 iframe 中的矩形位置（未缩放坐标） */
	indicatorRect?: {
		top: number
		left: number
		width: number
	}
}
