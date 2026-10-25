import type { CanvasAccessContext, CanvasCapability, ElementToolType } from "../../../public/props"
export type { ElementToolType }
import type { ElementContentBase, LayerElement } from "../../document/types"
import type { ContentState } from "../../document/elementContent"

export type { ContentState } from "../../document/elementContent"

export type ElementToolSurface = "top" | "bottom"

export type ElementToolRenderKind =
	"top-action" | "top-custom" | "bottom-action" | "bottom-version-controls"

export type ElementToolIcon =
	| "pencil"
	| "square-pen"
	| "rotate-ccw"
	| "loader"
	| "chevron-left"
	| "chevron-right"
	| "crown"
	| "trash"

export type ElementToolScope = "element" | "active-content" | "version-set" | "generation"

export type ElementToolExecution = "command" | "display-only"

export type ElementToolEffect = "display" | "session" | "document" | "destructive" | "external"

/**
 * CommandBus 的执行路由。路由描述的是运行时接管方式，不承担权限语义；
 * 权限始终由 effect/requiredCapability 声明决定。
 */
export type ElementToolCommandRoute =
	| "registered"
	| "action"
	| "element"
	| "storyboard-batch"
	| "text"
	| "shape"
	| "content-interaction"
	| "media"
	| "media-original-size"
	| "generation"
	| "version"

export type ElementToolVisibility = "visible" | "hidden" | "disabled"

export type GenerationElementToolId = Extract<ElementToolType, `generation.${string}`>

export interface GenerationToolCommandRequest {
	toolId: GenerationElementToolId
	contentId: string
}

export interface ContentSnapshot extends ElementContentBase {
	readonly src?: string
	readonly status?: string
	readonly [key: string]: unknown
}

export interface GenerationAttemptState {
	readonly attemptId: string
	readonly elementId: string
	readonly contentId?: string
	readonly operation?: string
	readonly phase?: string
}

export interface ElementToolData {
	version?: {
		current: number
		total: number
		isMain: boolean
	}
	videoGenerationEstimate?: {
		resolution: string
		points: number | null
	}
	/** 样片转正片的有效期说明。截止时间由完成时间加固定有效期得出。 */
	videoDraftFinalHint?: {
		deadlineText?: string
		expired: boolean
	}
}

export interface ElementToolRuntimeState {
	readonly available: boolean
	readonly loading?: boolean
	readonly disabled?: boolean
	readonly disabledReason?: string
	readonly data?: ElementToolData
}

export interface ElementToolElementSnapshot {
	readonly id: string
	readonly type: LayerElement["type"]
	readonly locked?: boolean
	readonly visible?: boolean
	/** Parent id in the document tree; null denotes the root content layer. */
	readonly parentId?: string | null
	/** Whether the immediate parent is locked; root elements are never parent-locked. */
	readonly parentLocked?: boolean
	readonly width?: number
	readonly height?: number
}

export interface ElementToolSession {
	readonly toolId: ElementToolType
	readonly elementId: string
	readonly contentId?: string
	readonly contentRevision?: string | number
	readonly operationId?: string
}

export interface ElementToolContext {
	commandBus?: ElementToolCommandBus
	element: ElementToolElementSnapshot
	selection: {
		readonly elements: readonly ElementToolElementSnapshot[]
		readonly isSingleElement: boolean
		readonly parentId?: string | null
		readonly hasMixedParents?: boolean
		readonly isDragging: boolean
		readonly isSelecting: boolean
		readonly activeToolSession?: ElementToolSession | null
	}
	content: {
		readonly activeContentId?: string
		readonly mainContentId?: string
		readonly active?: ContentSnapshot
		readonly activeResource?: {
			readonly src?: string
			readonly width?: number
			readonly height?: number
		}
		readonly activeRevision?: string | number
		readonly byId: ReadonlyMap<string, ContentSnapshot>
		readonly states: ReadonlyMap<string, ContentState>
	}
	/** Resolved Canvas access context; tool resolution never falls back to legacy flags. */
	access: CanvasAccessContext
	generation: {
		readonly activeContentIsGenerating: boolean
		readonly siblingGeneratingContentIds: readonly string[]
		readonly generatingContentIds: readonly string[]
		readonly attemptsByContentId: ReadonlyMap<string, GenerationAttemptState>
	}
	interaction: {
		readonly isReplacing: boolean
		readonly isDragging: boolean
		readonly isSelecting: boolean
		readonly isEditing: boolean
		readonly isCropping: boolean
		readonly isExtending: boolean
		readonly isErasing: boolean
		readonly isFullscreenPreviewOpen: boolean
	}
	runtime: {
		readonly revision: number
		readonly toolsById: ReadonlyMap<ElementToolType, ElementToolRuntimeState>
	}
	capabilities: {
		readonly canSwitchVersion: boolean
		readonly canSetMainVersion: boolean
		readonly canDeleteVersion: boolean
		readonly canGenerateContent: boolean
		readonly canConcurrentGenerate: boolean
	}
	flags: {
		readonly convertHightSupported: boolean
		readonly removeBackgroundSupported: boolean
		readonly eraserSupported: boolean
		readonly expandSupported: boolean
		readonly showMediaOriginalSize: boolean
		readonly isStoryboardOutputFrame: boolean
	}
}

export interface ElementToolCommand {
	toolId: ElementToolType
	elementId: string
	contentId?: string
	contentRevision?: string | number
	generationId?: string
	operationId?: string
	payload?: unknown
}

export interface ElementToolCommandResult {
	executed: boolean
	reason?:
		| "UNKNOWN_TOOL"
		| "CAPABILITY_REQUIRED"
		| "ELEMENT_NOT_FOUND"
		| "CONTENT_NOT_FOUND"
		| "CONTENT_REVISION_MISMATCH"
		| "ACTIVE_CONTENT_MISMATCH"
		| "GENERATION_STALE"
		| "OPERATION_MISMATCH"
		| "TOOL_UNAVAILABLE"
		| "NO_HANDLER"
		| "TARGET_UNAVAILABLE"
		| "ACTION_UNAVAILABLE"
		| "INVALID_PAYLOAD"
	requiredCapability?: CanvasCapability
}

export interface ElementToolCommandBus {
	execute(
		command: ElementToolCommand,
	): Promise<void | ElementToolCommandResult> | void | ElementToolCommandResult
}

export interface ElementToolResolution {
	id: ElementToolType
	execution: ElementToolExecution
	surface: ElementToolSurface
	visibility: ElementToolVisibility
	loading?: boolean
	disabledReason?: string
	presentation: ElementToolSurfaceOptions
	data?: ElementToolData
	target: ElementToolTarget
	execute?: (payload?: unknown) => void | Promise<void>
}

export interface ElementToolTarget {
	elementId: string
	contentId?: string
	contentRevision?: string | number
	generationId?: string
	operationId?: string
}

export interface ElementToolSurfaceOptions {
	renderKind: ElementToolRenderKind
	group: string
	order: number
	icon?: ElementToolIcon
	labelKey?: string
	labelFallback?: string
	shortcut?: string
}

export interface ElementToolDefinition {
	id: ElementToolType
	scope: ElementToolScope
	execution: ElementToolExecution
	effect: ElementToolEffect
	requiredCapability: CanvasCapability
	commandRoute: ElementToolCommandRoute
	/** Optional action identity used when an action route has no mounted handler. */
	fallbackActionId?: string
	surfaces: Partial<Record<ElementToolSurface, ElementToolSurfaceOptions>>
	isApplicable: (context: ElementToolContext) => boolean
	resolve: (context: ElementToolContext) => ElementToolResolution
}
