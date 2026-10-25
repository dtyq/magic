import Konva from "konva"
import type { Canvas } from "../../core/Canvas"
import {
	ElementTypeEnum,
	type LayerElement,
	type StoryboardElement as StoryboardElementData,
	type StoryboardElementContent,
	type StoryboardGenerationConfig,
	type StoryboardShot,
} from "../../document/types"
import { TransformBehavior } from "../../interaction/transform/TransformManager"
import {
	isCanvasZoomWheel,
	shouldForwardWheelToCanvas,
} from "../../interaction/viewport/ViewportWheelPolicy"
import type {
	StoryboardControlAction,
	StoryboardControlState,
	StoryboardEditorPresentation,
	StoryboardSelectPresentation,
} from "../../interaction/storyboard/StoryboardInteractionManager"
import {
	canInteractWithElementControls,
	type ElementControlInteractionPolicy,
} from "../../interaction/element-control/ElementControlInteractionPolicy"
import {
	moveControlHitsToTop,
	syncControlHitRect,
} from "../../interaction/element-control/ControlHitTarget"
import { generateUUID } from "../../shared/ids"
import { ELEMENT_DESIGN_TOKENS } from "../../shared/layout/ElementDesignTokens"
import { RenderUtils } from "../../shared/render/RenderUtils"
import {
	BaseElement,
	type ElementTransformConstraints,
	type TransformContext,
} from "../core/BaseElement"
import { STORYBOARD_CONFIG } from "./StoryboardElement.config"
import { getActiveContent } from "../../document/elementContent"
import type { LoadedResource } from "../../resources/image/ImageResourceManager"
import type { CanvasConsumerVisibility } from "../../resources/visibility/CanvasVisibilityManager"
import { getPersistedSourceCrop } from "../../resources/image/imageCropUtils"
import {
	resolveStoryboardReferenceImages,
	type StoryboardReferenceImage,
} from "../../interaction/storyboard/storyboardReferenceImages"
import {
	resolveStoryboardElementLayout,
	resolveStoryboardRequiredHeight,
	type StoryboardElementLayout,
	type StoryboardParameterLayout,
	type StoryboardShotLayout,
} from "./StoryboardElement.layout"

type StoryboardControlKind =
	"parameter" | "description" | "delete" | "add" | "generate" | "reference-preview"

interface StoryboardControlMetadata {
	action: StoryboardControlAction
	kind: StoryboardControlKind
	visualNode: Konva.Group
	overlayAnchorNode?: Konva.Node
	selectPresentation?: StoryboardSelectPresentation
	editorPresentation?: StoryboardEditorPresentation
	baseBounds: { x: number; y: number; width: number; height: number }
}

interface StoryboardRectBounds {
	x?: number
	y?: number
	width: number
	height: number
}

/**
 * Konva stroke 沿路径居中；在 clip 边界上外半圈会被裁掉。
 * 描边 rect 内缩半线宽，保证四边线宽一致且完整可见。
 */
function createInsetStrokeRect(
	bounds: StoryboardRectBounds,
	strokeWidth: number,
	attrs: Konva.RectConfig,
): Konva.Rect {
	const x = bounds.x ?? 0
	const y = bounds.y ?? 0
	return new Konva.Rect({
		...attrs,
		x: x + strokeWidth / 2,
		y: y + strokeWidth / 2,
		width: Math.max(0, bounds.width - strokeWidth),
		height: Math.max(0, bounds.height - strokeWidth),
		fillEnabled: false,
		strokeWidth,
		listening: false,
		perfectDrawEnabled: false,
	})
}

type CreatedStoryboardElementData = StoryboardElementData

/** 与图片元素“再次生成”按钮使用的 Lucide `RotateCcw` 图标保持一致。 */
const LUCIDE_ROTATE_CCW_PATH_D = "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5"
const LUCIDE_ICON_VIEWBOX_SIZE = 24

function formatModelName(modelId?: string): string {
	if (!modelId) return "-"
	return modelId
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((part) => {
			const normalized = part.toLowerCase()
			if (normalized === "gpt") return "GPT"
			if (/^\d+$/.test(part)) return part
			return `${part.charAt(0).toUpperCase()}${part.slice(1)}`
		})
		.join(" ")
}

function resolveAspectRatio(config?: StoryboardGenerationConfig): string {
	const configured = config?.image_generation_config?.aspect_ratio
	if (configured) return configured
	const match = config?.size?.match(/^(\d+)x(\d+)$/i)
	if (!match) return "-"
	const width = Number(match[1])
	const height = Number(match[2])
	if (!width || !height) return "-"

	const greatestCommonDivisor = (left: number, right: number): number =>
		right === 0 ? left : greatestCommonDivisor(right, left % right)
	const divisor = greatestCommonDivisor(width, height)
	return `${width / divisor}:${height / divisor}`
}

/** 打开 / 更新时使用当前默认宽度，高度至少容纳全部镜头。 */
function normalizeStoryboardDisplayDimensions(data: StoryboardElementData): StoryboardElementData {
	const content = getActiveContent<StoryboardElementContent>(data)
	const shotCount = content?.shots?.length ?? 0
	const width = STORYBOARD_CONFIG.DEFAULT_WIDTH
	const requiredHeight = resolveStoryboardRequiredHeight(width, shotCount)
	return {
		...data,
		width,
		// 参考图来自运行时连线，构造函数拿不到参考图数量；保留外部已同步的
		// height，避免 manager 按参考图区扩高后在下一次 rerender 被归一化逻辑覆盖。
		height: Math.max(
			data.height ?? STORYBOARD_CONFIG.DEFAULT_HEIGHT,
			STORYBOARD_CONFIG.DEFAULT_HEIGHT,
			requiredHeight,
		),
	}
}

/**
 * 分镜函数节点。
 *
 * 节点只呈现持久化 DSL 状态；当前 CanvasDesignMethods 尚无分镜生成契约，
 * 因此生成按钮保持为信息性控件，避免在画布层伪造模型任务或任务状态。
 */
export class StoryboardElement extends BaseElement<StoryboardElementData> {
	private interactionCleanups: Array<() => void> = []
	private interactionEventUnsubscribers: Array<() => void> = []
	private referenceSourceEventUnsubscribers: Array<() => void> = []
	private permissionChangedUnsubscribe?: () => void
	private referenceScrollOffset = 0
	private referenceScrollMax = 0
	private referenceListHovered = false
	private referenceTrackGroup?: Konva.Group
	private referenceScrollbarTrack?: Konva.Rect
	private referenceScrollbarThumb?: Konva.Rect
	private referenceScrollbarTrackWidth = 0
	private referenceScrollbarThumbWidth = 0
	private readonly referencePreviewResources = new Map<string, LoadedResource>()
	private readonly referencePreviewControllers = new Map<string, AbortController>()
	private readonly referencePreviewTokens = new Map<string, number>()
	private readonly referencePreviewResourceCloseCleanups = new Map<string, () => void>()
	private consumerVisibility: CanvasConsumerVisibility = "far"
	private consumerVisibilityUnsubscribe?: () => void
	/** 防止 registerConsumerVisibility 同步回调里 rerender 时重复注册。 */
	private consumerVisibilityRegistering = false
	/** register 的首次 visible 通知发生在首帧 render 之后，无需再整节点重绘。 */
	private consumerVisibilityInitialNotificationHandled = false

	constructor(data: StoryboardElementData, canvas: Canvas) {
		super(normalizeStoryboardDisplayDimensions(data), canvas)
	}

	public static getDefaultConfig() {
		return {
			width: STORYBOARD_CONFIG.DEFAULT_WIDTH,
			height: STORYBOARD_CONFIG.DEFAULT_HEIGHT,
			interactionConfig: { aspectRatioLocked: false },
		}
	}

	public static createElementData(options: {
		id: string
		x: number
		y: number
		zIndex?: number
		name?: string
		width?: number
		height?: number
		generationConfig?: StoryboardGenerationConfig
		shots?: StoryboardShot[]
	}): CreatedStoryboardElementData {
		const width = options.width ?? STORYBOARD_CONFIG.DEFAULT_WIDTH
		const shots = options.shots ?? [
			{
				id: generateUUID(),
				description: "",
			},
		]
		const requiredHeight = resolveStoryboardRequiredHeight(width, shots.length)
		return {
			id: options.id,
			type: ElementTypeEnum.Storyboard,
			x: options.x,
			y: options.y,
			width,
			height: Math.max(options.height ?? STORYBOARD_CONFIG.DEFAULT_HEIGHT, requiredHeight),
			zIndex: options.zIndex ?? 0,
			name: options.name,
			activeContentId: `${options.id}-content-1`,
			mainContentId: `${options.id}-content-1`,
			contents: [
				{
					contentId: `${options.id}-content-1`,
					generationConfig: options.generationConfig,
					shots,
				},
			],
			interactionConfig: { aspectRatioLocked: false },
		}
	}

	public getRenderName(): string {
		return this.getText("storyboard.defaultName", "分镜生成")
	}

	public render(): Konva.Group {
		const content = this.getActiveContent<StoryboardElementContent>()
		const references = this.resolveReferenceImages()
		this.syncReferencePreviewResourceCloseSubscriptions(
			references.map((reference) => reference.path),
		)
		const width = Math.max(this.data.width ?? STORYBOARD_CONFIG.DEFAULT_WIDTH, 1)
		const height = Math.max(this.data.height ?? STORYBOARD_CONFIG.DEFAULT_HEIGHT, 1)
		const layout = resolveStoryboardElementLayout(
			width,
			height,
			content?.shots?.length ?? 0,
			references.length,
		)
		const group = new Konva.Group({
			width,
			height,
			// 外部 DSL 可能带入早期或异常尺寸。Transformer 会约束后续缩放，
			// 这里仍需裁剪内容，保证首次加载时子节点不会污染相邻画布区域。
			clipFunc: (context) => context.rect(0, 0, width, height),
		})
		RenderUtils.createHitNode(group, width, height)
		const frameStrokeWidth = Math.max(1, layout.scale)
		// 填充占满逻辑框；描边内缩，避免 clipFunc 裁掉外半圈导致边粗细不一。
		group.add(
			new Konva.Rect({
				width,
				height,
				fill: STORYBOARD_CONFIG.BACKGROUND,
				listening: false,
				perfectDrawEnabled: false,
				name: "storyboard-background",
			}),
			createInsetStrokeRect({ width, height }, frameStrokeWidth, {
				stroke: STORYBOARD_CONFIG.BORDER,
				name: "storyboard-background-border",
			}),
		)

		this.renderParameters(group, layout)
		this.renderReferenceSection(group, layout, references)
		this.renderShotList(group, layout)
		this.renderFooter(group, layout)

		this.finalizeNode(group)
		return group
	}

	public update(newData: StoryboardElementData): boolean {
		const previousData = this.data
		const normalizedData = normalizeStoryboardDisplayDimensions(newData)
		this.data = normalizedData
		const previousContent = getActiveContent<StoryboardElementContent>(previousData)
		const nextContent = this.getActiveContent<StoryboardElementContent>(normalizedData)
		const needsRerender =
			previousData.width !== normalizedData.width ||
			previousData.height !== normalizedData.height ||
			previousContent?.generationConfig !== nextContent?.generationConfig ||
			previousContent?.shots !== nextContent?.shots

		if (!needsRerender && this.node) {
			this.updateBaseProps(this.node, normalizedData)
		}
		return needsRerender
	}

	public override onMounted(): void {
		if (
			!this.consumerVisibilityUnsubscribe &&
			!this.consumerVisibilityRegistering &&
			this.canvas.visibilityManager?.registerConsumerVisibility
		) {
			this.consumerVisibilityRegistering = true
			try {
				this.consumerVisibilityUnsubscribe =
					this.canvas.visibilityManager.registerConsumerVisibility(
						this.data.id,
						(state) => {
							this.consumerVisibility = state
							if (state === "visible") {
								if (this.consumerVisibilityInitialNotificationHandled) {
									this.rerenderWhenTransformIdle()
								}
								return
							}
							this.abortReferencePreviewRequests()
						},
					)
			} finally {
				this.consumerVisibilityRegistering = false
				this.consumerVisibilityInitialNotificationHandled = true
			}
		}
		if (!this.permissionChangedUnsubscribe && this.canvas.eventEmitter?.on) {
			this.permissionChangedUnsubscribe = this.canvas.eventEmitter.on(
				"permission:changed",
				() => {
					this.rerenderWhenTransformIdle()
				},
			)
		}
		if (this.referenceSourceEventUnsubscribers.length === 0 && this.canvas.eventEmitter?.on) {
			const refreshFromSourceChange = () => {
				this.invalidateReferencePreviewResources()
				this.rerenderWhenTransformIdle()
			}
			this.referenceSourceEventUnsubscribers.push(
				this.canvas.eventEmitter.on("element:updated", ({ data }) => {
					if (data.elementId === this.data.id) return
					if (data.data.type === ElementTypeEnum.Image) refreshFromSourceChange()
				}),
				this.canvas.eventEmitter.on("connection:change", refreshFromSourceChange),
				this.canvas.eventEmitter.on("element:deleted", refreshFromSourceChange),
				this.canvas.eventEmitter.on("element:batchdeleted", refreshFromSourceChange),
				this.canvas.eventEmitter.on("document:loaded", refreshFromSourceChange),
				this.canvas.eventEmitter.on("document:restored", refreshFromSourceChange),
			)
		}
		this.syncInteractionHitTargets()
	}

	public override onResourceReferenceResolverChanged(): void {
		this.invalidateReferencePreviewResources()
		this.rerenderWhenTransformIdle()
	}

	public override destroy(): void {
		this.consumerVisibilityUnsubscribe?.()
		this.consumerVisibilityUnsubscribe = undefined
		this.permissionChangedUnsubscribe?.()
		this.permissionChangedUnsubscribe = undefined
		this.abortReferencePreviewRequests()
		this.referencePreviewTokens.clear()
		this.referencePreviewResources.clear()
		this.clearReferencePreviewResourceCloseSubscriptions()
		this.referenceSourceEventUnsubscribers.forEach((unsubscribe) => unsubscribe())
		this.referenceSourceEventUnsubscribers = []
		super.destroy()
	}

	protected override setupNodeListeners(node: Konva.Node): void {
		super.setupNodeListeners(node)
		if (!(node instanceof Konva.Group)) return
		moveControlHitsToTop(node, ".storyboard-control-hit")

		const manager = this.canvas.storyboardInteractionManager
		if (manager) {
			const elementInteraction = this.getElementControlInteractionPolicy(node)
			node.find(".storyboard-control-hit").forEach((candidate) => {
				if (!(candidate instanceof Konva.Rect)) return
				const metadata = candidate.getAttr("storyboardControlMetadata") as
					StoryboardControlMetadata | undefined
				if (!metadata) return
				this.interactionCleanups.push(
					manager.bindControl({
						elementId: this.data.id,
						node: candidate,
						overlayAnchorNode: metadata.overlayAnchorNode,
						selectPresentation: metadata.selectPresentation,
						editorPresentation: metadata.editorPresentation,
						action: metadata.action,
						elementInteraction,
						applyState: (state) => this.applyControlState(metadata, state),
					}),
				)
			})
		}

		const syncHitTargets = () => this.syncInteractionHitTargets()
		if (this.canvas.eventEmitter) {
			this.interactionEventUnsubscribers.push(
				this.canvas.runtimeScheduler.registerViewportScaleLayout(
					this.data.id,
					syncHitTargets,
				),
				this.canvas.eventEmitter.on("canvas:devicechange", syncHitTargets),
			)
		}
		this.syncInteractionHitTargets()
	}

	private getElementControlInteractionPolicy(
		node: Konva.Group,
	): ElementControlInteractionPolicy<StoryboardControlAction> {
		return {
			canInteract: (action) => {
				if (!this.canUseElementControls(node)) return false
				if (action.type === "preview-reference-image") return true
				return (
					this.canvas.permissionManager.can("document.write") &&
					!this.data.locked &&
					this.canvas.permissionManager.canUseSelectionToolAffordance()
				)
			},
			prepare: (action) => {
				if (action.type === "preview-reference-image") return
				if (
					this.canvas.selectionManager.getSelectionCount() !== 1 ||
					!this.canvas.selectionManager.isSelected(this.data.id)
				) {
					this.canvas.selectionManager.replaceSelection([this.data.id])
				}
			},
		}
	}

	private canUseElementControls(node: Konva.Group = this.node as Konva.Group): boolean {
		if (!(node instanceof Konva.Group)) return false
		const absoluteScale = node.getAbsoluteScale()
		return canInteractWithElementControls({
			screenWidth: node.width() * Math.abs(absoluteScale.x),
			screenHeight: node.height() * Math.abs(absoluteScale.y),
			coarsePointer: this.canvas.deviceInfo?.input?.coarsePointer ?? false,
		})
	}

	protected override cleanupNodeListeners(node: Konva.Node): void {
		this.interactionCleanups.forEach((cleanup) => cleanup())
		this.interactionCleanups = []
		this.interactionEventUnsubscribers.forEach((unsubscribe) => unsubscribe())
		this.interactionEventUnsubscribers = []
		super.cleanupNodeListeners(node)
	}

	public override getTransformBehavior(): TransformBehavior {
		return TransformBehavior.APPLY_TO_SIZE
	}

	public override getTransformConstraints(): ElementTransformConstraints {
		return {
			enabledAnchors: [],
			minWidth: STORYBOARD_CONFIG.MIN_WIDTH,
			minHeight: STORYBOARD_CONFIG.MIN_HEIGHT,
		}
	}

	public override applyTransform(
		updates: Partial<LayerElement>,
		context: TransformContext,
	): Partial<LayerElement> {
		if (context.isScaling) {
			return {
				x: updates.x,
				y: updates.y,
				width: this.data.width ?? STORYBOARD_CONFIG.DEFAULT_WIDTH,
				height: this.data.height ?? STORYBOARD_CONFIG.DEFAULT_HEIGHT,
				scaleX: 1,
				scaleY: 1,
			}
		}
		return { x: updates.x, y: updates.y }
	}

	protected override setupCustomBoundingRect(node: Konva.Group): void {
		const originalGetClientRect = node.getClientRect.bind(node)
		node.getClientRect = (config?: Parameters<Konva.Node["getClientRect"]>[0]) => {
			const background = node.findOne(".storyboard-background") as Konva.Rect | undefined
			return background?.getClientRect(config) ?? originalGetClientRect(config)
		}
	}

	private renderParameters(group: Konva.Group, layout: StoryboardElementLayout): void {
		const settingsGroup = new Konva.Group({
			name: "storyboard-settings-region",
			clipX: layout.contentRect.x,
			clipY: layout.contentRect.y,
			clipWidth: layout.contentRect.width,
			clipHeight: layout.settingsRect.height,
		})
		group.add(settingsGroup)
		const config = this.getActiveContent<StoryboardElementContent>()?.generationConfig

		this.renderParameterRow(settingsGroup, layout.parameterRows.model, {
			label: this.getText("storyboard.imageModel", "图片模型"),
			value: formatModelName(config?.model_id),
			iconUrl: this.canvas.storyboardInteractionManager?.getModelIcon(config?.model_id),
			action: { type: "select-model" },
		})
		this.renderParameterRow(settingsGroup, layout.parameterRows.aspectRatio, {
			label: this.getText("storyboard.aspectRatio", "画面比例"),
			value: resolveAspectRatio(config),
			action: { type: "select-aspect-ratio" },
		})
		this.renderParameterRow(settingsGroup, layout.parameterRows.resolution, {
			label: this.getText("storyboard.resolution", "分辨率"),
			value: config?.resolution || "-",
			action: { type: "select-resolution" },
		})

		if (!layout.showShotListTitle) return
		settingsGroup.add(
			new Konva.Text({
				...layout.titleRect,
				text: this.getText("storyboard.shotList", "分镜列表"),
				fontFamily: layout.fontFamily,
				fontSize: layout.titleFontSize,
				fontStyle: "500",
				fill: STORYBOARD_CONFIG.PRIMARY_TEXT,
				listening: false,
				perfectDrawEnabled: false,
				name: "storyboard-list-title",
			}),
		)
	}

	private renderParameterRow(
		group: Konva.Group,
		row: StoryboardParameterLayout,
		options: {
			label: string
			value: string
			iconUrl?: string
			action: StoryboardControlAction
		},
	): void {
		const { label, value, iconUrl, action } = options
		const visual = new Konva.Group({ listening: false })
		const background = new Konva.Rect({
			...row.backgroundRect,
			fill: "rgba(255, 255, 255, 0)",
			cornerRadius: row.cornerRadius,
			listening: false,
			perfectDrawEnabled: false,
			name: "storyboard-control-background",
		})
		visual.add(background)
		if (row.showLabel) {
			visual.add(
				new Konva.Text({
					...row.labelRect,
					text: `${label}：`,
					verticalAlign: "middle",
					fontFamily: STORYBOARD_CONFIG.FONT_FAMILY,
					fontSize: row.labelFontSize,
					fill: STORYBOARD_CONFIG.SECONDARY_TEXT,
					wrap: "none",
					ellipsis: true,
					listening: false,
					perfectDrawEnabled: false,
					name: "storyboard-control-label",
				}),
			)
		}
		visual.add(
			new Konva.Text({
				...row.valueTextRect,
				text: value,
				align: "left",
				fontFamily: STORYBOARD_CONFIG.FONT_FAMILY,
				fontSize: row.fontSize,
				fill: STORYBOARD_CONFIG.PRIMARY_TEXT,
				listening: false,
				perfectDrawEnabled: false,
				ellipsis: true,
				wrap: "none",
				name: "storyboard-control-text",
			}),
			...(this.canvas.permissionManager.can("document.write")
				? [this.createSelectSuffix(row)]
				: []),
		)
		const overlayAnchor = !this.canvas.permissionManager.can("document.write")
			? undefined
			: new Konva.Rect({
					...row.triggerRect,
					listening: false,
				})
		if (overlayAnchor) visual.add(overlayAnchor)
		group.add(visual)
		if (iconUrl && row.modelIconRect && typeof Image !== "undefined") {
			const iconImage = new Image()
			iconImage.crossOrigin = "anonymous"
			iconImage.onload = () => {
				if (!visual.getParent() || visual.findOne(".storyboard-model-icon")) return
				visual.add(
					new Konva.Image({
						image: iconImage,
						...row.modelIconRect,
						listening: false,
						perfectDrawEnabled: false,
						name: "storyboard-model-icon",
					}),
				)
				visual.getLayer()?.batchDraw()
			}
			iconImage.src = iconUrl
		}
		if (this.canvas.permissionManager.can("document.write")) {
			this.addControlHit(group, {
				action,
				kind: "parameter",
				visualNode: visual,
				overlayAnchorNode: overlayAnchor,
				selectPresentation: {
					fontSize: row.fontSize,
					horizontalPadding: row.horizontalPadding,
					suffixGap: row.suffixGap,
					suffixIconSize: row.suffixIconSize,
					modelIconUrl: iconUrl,
					modelIconSize: row.modelIconRect?.width,
					modelIconGap: row.modelIconGap,
				},
				baseBounds: row.rect,
			})
		}
	}

	private createSelectSuffix(row: StoryboardParameterLayout): Konva.Line {
		const strokeWidth = Math.max(1.5, row.suffixIconSize * 0.14)
		const inset = row.suffixIconSize * 0.22
		const centerX = row.suffixRect.x + row.suffixRect.width / 2
		const centerY = row.suffixRect.y + row.suffixRect.height / 2
		const halfWidth = Math.max(1, row.suffixRect.width / 2 - inset)
		const halfHeight = Math.max(1, row.suffixRect.height * 0.18)

		return new Konva.Line({
			points: [
				centerX - halfWidth,
				centerY - halfHeight,
				centerX,
				centerY + halfHeight,
				centerX + halfWidth,
				centerY - halfHeight,
			],
			stroke: STORYBOARD_CONFIG.PRIMARY_TEXT,
			strokeWidth,
			lineCap: "round",
			lineJoin: "round",
			listening: false,
			perfectDrawEnabled: false,
			name: "storyboard-control-suffix",
		})
	}

	private resolveReferenceImages(): StoryboardReferenceImage[] {
		return resolveStoryboardReferenceImages(this.canvas, this.data.id)
	}

	private renderReferenceSection(
		group: Konva.Group,
		layout: StoryboardElementLayout,
		references: StoryboardReferenceImage[],
	): void {
		const referenceLayout = layout.reference
		if (!referenceLayout || references.length === 0) {
			this.referenceScrollOffset = 0
			this.referenceScrollMax = 0
			this.referenceListHovered = false
			this.referenceTrackGroup = undefined
			this.clearReferenceScrollbarNodes()
			return
		}

		const title = new Konva.Text({
			...referenceLayout.titleRect,
			text: this.getText("storyboard.referenceImages", "参考图"),
			fontFamily: layout.fontFamily,
			fontSize: layout.titleFontSize,
			fontStyle: "500",
			fill: STORYBOARD_CONFIG.PRIMARY_TEXT,
			verticalAlign: "middle",
			listening: false,
			perfectDrawEnabled: false,
			name: "storyboard-reference-title",
		})
		const countX = title.x() + title.getTextWidth() + referenceLayout.titleCountGap
		const count = new Konva.Text({
			...referenceLayout.countRect,
			x: countX,
			width: Math.max(
				0,
				referenceLayout.countRect.x + referenceLayout.countRect.width - countX,
			),
			text: this.getText("storyboard.referenceImageCount", "{{count}}张").replace(
				"{{count}}",
				String(references.length),
			),
			fontFamily: layout.fontFamily,
			fontSize: layout.shotSmallFontSize,
			fill: STORYBOARD_CONFIG.SECONDARY_TEXT,
			verticalAlign: "middle",
			listening: false,
			perfectDrawEnabled: false,
			name: "storyboard-reference-count",
		})
		group.add(title, count)

		const { viewport: viewportRect, thumbnail } = referenceLayout
		const cardPitch = thumbnail.width + thumbnail.gap
		const contentWidth =
			references.length * thumbnail.width + Math.max(0, references.length - 1) * thumbnail.gap
		this.referenceScrollMax = Math.max(0, contentWidth - viewportRect.width)
		this.referenceScrollOffset = Math.max(
			0,
			Math.min(this.referenceScrollOffset, this.referenceScrollMax),
		)
		const viewport = new Konva.Group({
			x: viewportRect.x,
			y: viewportRect.y,
			width: viewportRect.width,
			height: viewportRect.height,
			clip: { x: 0, y: 0, width: viewportRect.width, height: viewportRect.height },
			name: "storyboard-reference-viewport",
		})
		viewport.add(
			new Konva.Rect({
				width: viewportRect.width,
				height: viewportRect.height,
				fill: "rgba(255, 255, 255, 0.001)",
				listening: true,
				perfectDrawEnabled: false,
			}),
		)
		const track = new Konva.Group({
			x: -this.referenceScrollOffset,
			width: contentWidth,
			height: thumbnail.height,
			name: "storyboard-reference-track",
		})
		this.referenceTrackGroup = track
		references.forEach((reference, index) => {
			this.renderReferenceThumbnail(track, referenceLayout, reference, index * cardPitch)
		})
		viewport.add(track)
		viewport.on("wheel", (event: Konva.KonvaEventObject<WheelEvent>) => {
			if (shouldForwardWheelToCanvas(event.evt, this.referenceScrollMax > 0)) {
				if (!isCanvasZoomWheel(event.evt)) return
				event.cancelBubble = true
				this.canvas.viewportController.handleWheelFromFloating(event.evt)
				return
			}
			event.cancelBubble = true
			event.evt.preventDefault()
			const delta =
				Math.abs(event.evt.deltaX) > Math.abs(event.evt.deltaY)
					? event.evt.deltaX
					: event.evt.deltaY
			this.setReferenceScrollOffset(this.referenceScrollOffset + delta)
		})
		viewport.on("mouseenter", () => {
			this.referenceListHovered = true
			this.syncReferenceScrollbarVisibility()
		})
		viewport.on("mouseleave", () => {
			this.referenceListHovered = false
			this.syncReferenceScrollbarVisibility()
		})
		group.add(viewport)

		if (this.referenceScrollMax <= 0) {
			this.clearReferenceScrollbarNodes()
			return
		}

		const scrollbarRadius = referenceLayout.scrollbar.height / 2
		const scrollbarTrack = new Konva.Rect({
			...referenceLayout.scrollbar,
			fill: "#EEF0F4",
			cornerRadius: scrollbarRadius,
			visible: this.referenceListHovered,
			listening: false,
			perfectDrawEnabled: false,
			name: "storyboard-reference-scrollbar-track",
		})
		this.referenceScrollbarTrack = scrollbarTrack
		group.add(scrollbarTrack)
		const visibleRatio = Math.min(1, viewportRect.width / contentWidth)
		this.referenceScrollbarTrackWidth = referenceLayout.scrollbar.width
		this.referenceScrollbarThumbWidth = Math.max(
			44 * layout.scale,
			referenceLayout.scrollbar.width * visibleRatio,
		)
		const scrollbarThumb = new Konva.Rect({
			x: this.resolveReferenceScrollbarThumbX(referenceLayout),
			y: referenceLayout.scrollbar.y,
			width: this.referenceScrollbarThumbWidth,
			height: referenceLayout.scrollbar.height,
			fill: "#BFC5D1",
			cornerRadius: scrollbarRadius,
			visible: this.referenceListHovered,
			listening: false,
			perfectDrawEnabled: false,
			name: "storyboard-reference-scrollbar-thumb",
		})
		scrollbarThumb.setAttr("trackStartX", referenceLayout.scrollbar.x)
		this.referenceScrollbarThumb = scrollbarThumb
		group.add(scrollbarThumb)
	}

	private renderReferenceThumbnail(
		track: Konva.Group,
		layout: NonNullable<StoryboardElementLayout["reference"]>,
		reference: StoryboardReferenceImage,
		x: number,
	): void {
		const { thumbnail } = layout
		const card = new Konva.Group({
			x,
			width: thumbnail.width,
			height: thumbnail.height,
			// clip rect 本身没有圆角，只会让边框看起来圆、图片仍泄露到直角。
			// 使用同一半径裁剪内容，确保 cover 图像也严格贴合缩略图卡片。
			clipFunc: (context) => {
				context.beginPath()
				context.roundRect(0, 0, thumbnail.width, thumbnail.height, thumbnail.cornerRadius)
			},
			name: "storyboard-reference-thumbnail",
		})
		card.add(
			new Konva.Rect({
				width: thumbnail.width,
				height: thumbnail.height,
				fill: STORYBOARD_CONFIG.SURFACE,
				cornerRadius: thumbnail.cornerRadius,
				listening: false,
				perfectDrawEnabled: false,
				name: "storyboard-reference-thumbnail-surface",
			}),
		)
		const resource = this.getReferencePreviewResource(reference.path)
		if (resource) {
			const naturalWidth = resource.imageInfo.naturalWidth || resource.sourceWidth
			const naturalHeight = resource.imageInfo.naturalHeight || resource.sourceHeight
			const persistedCrop = getPersistedSourceCrop(reference.crop, {
				width: naturalWidth,
				height: naturalHeight,
			})
			const sourceScaleX = resource.sourceWidth / Math.max(1, naturalWidth)
			const sourceScaleY = resource.sourceHeight / Math.max(1, naturalHeight)
			const sourceCrop = {
				x: persistedCrop.x * sourceScaleX,
				y: persistedCrop.y * sourceScaleY,
				width: persistedCrop.width * sourceScaleX,
				height: persistedCrop.height * sourceScaleY,
			}
			const sourceWidth = Math.max(1, sourceCrop.width)
			const sourceHeight = Math.max(1, sourceCrop.height)
			const scale = Math.max(thumbnail.width / sourceWidth, thumbnail.height / sourceHeight)
			const imageWidth = sourceWidth * scale
			const imageHeight = sourceHeight * scale
			card.add(
				new Konva.Image({
					image: resource.image,
					x: (thumbnail.width - imageWidth) / 2,
					y: (thumbnail.height - imageHeight) / 2,
					width: imageWidth,
					height: imageHeight,
					crop: {
						x: sourceCrop.x,
						y: sourceCrop.y,
						width: sourceWidth,
						height: sourceHeight,
					},
					listening: false,
					perfectDrawEnabled: false,
					name: "storyboard-reference-image",
				}),
			)
		} else {
			this.loadReferencePreview(reference.path)
		}
		card.add(
			// 交互遮罩必须在图片之上；底色位于图片之下时 hover/pressed 不可见。
			new Konva.Rect({
				width: thumbnail.width,
				height: thumbnail.height,
				fill: "rgba(255, 255, 255, 0)",
				cornerRadius: thumbnail.cornerRadius,
				listening: false,
				perfectDrawEnabled: false,
				name: "storyboard-control-background",
			}),
			createInsetStrokeRect(
				{ width: thumbnail.width, height: thumbnail.height },
				Math.max(1, layout.thumbnail.width * 0.008),
				{
					stroke: STORYBOARD_CONFIG.BORDER_SUBTLE,
					cornerRadius: thumbnail.cornerRadius,
					name: "storyboard-control-border",
				},
			),
		)
		track.add(card)
		this.addControlHit(track, {
			action: { type: "preview-reference-image", path: reference.path, crop: reference.crop },
			kind: "reference-preview",
			visualNode: card,
			baseBounds: { x, y: 0, width: thumbnail.width, height: thumbnail.height },
		})
	}

	private loadReferencePreview(path: string): void {
		if (!this.canLoadReferencePreviews()) return
		if (
			!path ||
			this.referencePreviewResources.has(path) ||
			this.referencePreviewControllers.has(path)
		)
			return
		const manager = this.canvas.imageResourceManager
		if (!manager) return
		this.ensureReferencePreviewResourceCloseSubscription(path)
		const controller = new AbortController()
		this.referencePreviewControllers.set(path, controller)
		const token = (this.referencePreviewTokens.get(path) ?? 0) + 1
		this.referencePreviewTokens.set(path, token)
		void manager
			.getResource(path, { variant: "low", priority: "visible", signal: controller.signal })
			.then((resource) => {
				if (
					controller.signal.aborted ||
					this.referencePreviewTokens.get(path) !== token ||
					!resource
				)
					return
				if (!this.resolveReferenceImages().some((reference) => reference.path === path))
					return
				this.referencePreviewResources.set(path, resource)
				if (this.node) this.rerenderWhenTransformIdle()
			})
			.catch(() => undefined)
			.finally(() => {
				if (this.referencePreviewControllers.get(path) === controller) {
					this.referencePreviewControllers.delete(path)
				}
			})
	}

	private getReferencePreviewResource(path: string): LoadedResource | null {
		const cached = this.referencePreviewResources.get(path)
		const current = this.canvas.imageResourceManager?.peekResource(path, { variant: "low" })
		if (current) {
			this.ensureReferencePreviewResourceCloseSubscription(path)
			if (!cached || cached.image !== current.image || cached.ossSrc !== current.ossSrc) {
				this.referencePreviewResources.set(path, current)
			}
			return current
		}
		if (cached) this.referencePreviewResources.delete(path)
		return null
	}

	private ensureReferencePreviewResourceCloseSubscription(path: string): void {
		if (!path || this.referencePreviewResourceCloseCleanups.has(path)) return
		const manager = this.canvas.imageResourceManager
		if (typeof manager?.onImageResourceWillClose !== "function") return

		const cleanup = manager.onImageResourceWillClose(path, ({ data }) => {
			const cached = this.referencePreviewResources.get(path)
			if (cached?.image === data.image) {
				this.referencePreviewResources.delete(path)
			}

			let detachedNode = false
			this.node?.find?.(".storyboard-reference-image").forEach((candidate) => {
				if (!(candidate instanceof Konva.Image) || candidate.image() !== data.image) return
				candidate.image(undefined)
				detachedNode = true
			})

			if (!detachedNode) return
			this.canvas.runtimeScheduler?.requestLayerDraw?.("content", {
				source: "StoryboardElement",
				reason: "resource-will-close",
				priority: "normal",
			})
			if (this.node) this.rerenderWhenTransformIdle()
		})
		this.referencePreviewResourceCloseCleanups.set(path, cleanup)
	}

	private clearReferencePreviewResourceCloseSubscriptions(): void {
		this.referencePreviewResourceCloseCleanups.forEach((cleanup) => cleanup())
		this.referencePreviewResourceCloseCleanups.clear()
	}

	private syncReferencePreviewResourceCloseSubscriptions(paths: Iterable<string>): void {
		const activePaths = new Set(paths)
		this.referencePreviewResourceCloseCleanups.forEach((cleanup, path) => {
			if (activePaths.has(path)) return
			cleanup()
			this.referencePreviewResourceCloseCleanups.delete(path)
		})
		activePaths.forEach((path) => this.ensureReferencePreviewResourceCloseSubscription(path))
	}

	private invalidateReferencePreviewResources(): void {
		this.referencePreviewControllers.forEach((controller) => controller.abort())
		this.referencePreviewControllers.clear()
		this.referencePreviewResources.clear()
		this.referencePreviewTokens.clear()
	}

	private setReferenceScrollOffset(offset: number): void {
		const next = Math.max(0, Math.min(offset, this.referenceScrollMax))
		if (Math.abs(next - this.referenceScrollOffset) < 0.01) return
		this.referenceScrollOffset = next
		this.referenceTrackGroup?.x(-next)
		if (this.referenceScrollbarThumb) {
			const available = Math.max(
				0,
				this.referenceScrollbarTrackWidth - this.referenceScrollbarThumbWidth,
			)
			const progress = this.referenceScrollMax > 0 ? next / this.referenceScrollMax : 0
			this.referenceScrollbarThumb.x(
				((this.referenceScrollbarThumb.getAttr("trackStartX") as number | undefined) ?? 0) +
					available * progress,
			)
		}
		this.referenceTrackGroup?.getLayer()?.batchDraw()
	}

	private resolveReferenceScrollbarThumbX(
		layout: NonNullable<StoryboardElementLayout["reference"]>,
	): number {
		const available = Math.max(0, layout.scrollbar.width - this.referenceScrollbarThumbWidth)
		const progress =
			this.referenceScrollMax > 0 ? this.referenceScrollOffset / this.referenceScrollMax : 0
		return layout.scrollbar.x + available * progress
	}

	private clearReferenceScrollbarNodes(): void {
		this.referenceScrollbarTrack = undefined
		this.referenceScrollbarThumb = undefined
		this.referenceScrollbarTrackWidth = 0
		this.referenceScrollbarThumbWidth = 0
	}

	private syncReferenceScrollbarVisibility(): void {
		const visible = this.referenceListHovered && this.referenceScrollMax > 0
		this.referenceScrollbarTrack?.visible(visible)
		this.referenceScrollbarThumb?.visible(visible)
		this.referenceScrollbarTrack?.getLayer()?.batchDraw()
	}

	private renderShotList(group: Konva.Group, layout: StoryboardElementLayout): void {
		const shotListGroup = new Konva.Group({
			name: "storyboard-shot-list-region",
			clipX: layout.shotListRect.x,
			clipY: layout.shotListRect.y,
			clipWidth: layout.shotListRect.width,
			clipHeight: layout.shotListRect.height,
		})
		group.add(shotListGroup)
		const shots = this.getActiveContent<StoryboardElementContent>()?.shots ?? []
		if (shots.length === 0) {
			const emptyStrokeWidth = Math.max(1, layout.scale)
			shotListGroup.add(
				new Konva.Rect({
					...layout.shotListRect,
					fill: STORYBOARD_CONFIG.SURFACE,
					listening: false,
					perfectDrawEnabled: false,
				}),
				createInsetStrokeRect(layout.shotListRect, emptyStrokeWidth, {
					stroke: STORYBOARD_CONFIG.BORDER_SUBTLE,
					dash: [8 * layout.scale, 8 * layout.scale],
					cornerRadius: STORYBOARD_CONFIG.SHOT_RADIUS * layout.scale,
				}),
				new Konva.Text({
					...layout.shotListRect,
					text: this.getText("storyboard.empty", "暂无分镜"),
					align: "center",
					verticalAlign: "middle",
					fontFamily: layout.fontFamily,
					fontSize: layout.shotFontSize,
					fill: STORYBOARD_CONFIG.SECONDARY_TEXT,
					listening: false,
					perfectDrawEnabled: false,
				}),
			)
			return
		}

		shots.slice(0, layout.visibleShotCount).forEach((shot, index) => {
			const shotLayout = layout.shotLayouts[index]
			if (!shotLayout) return
			this.renderShot(shotListGroup, shotLayout, shot, index)
		})
	}

	private abortReferencePreviewRequests(): void {
		this.referencePreviewControllers.forEach((controller) => controller.abort())
		this.referencePreviewControllers.clear()
	}

	private canLoadReferencePreviews(): boolean {
		return (
			!this.canvas.visibilityManager?.registerConsumerVisibility ||
			this.consumerVisibility === "visible"
		)
	}

	private hasConnectedOutputImage(shot: StoryboardShot): boolean {
		if (!shot.outputImageElementId) return false
		const outputElement =
			this.canvas.elementManager?.getElementData(shot.outputImageElementId)?.type ===
			ElementTypeEnum.Image
		if (!outputElement) return false

		return (
			this.canvas.connectionManager?.hasConnection(
				this.data.id,
				shot.outputImageElementId,
			) === true
		)
	}

	private renderShot(
		group: Konva.Group,
		layout: StoryboardShotLayout,
		shot: StoryboardShot,
		index: number,
	): void {
		const { rect, titleRect, statusRect, descriptionRect, descriptionTextRect } = layout
		const controls = layout.controls
		group.add(
			new Konva.Rect({
				...rect,
				fill: STORYBOARD_CONFIG.SURFACE,
				cornerRadius: layout.cornerRadius,
				listening: false,
				perfectDrawEnabled: false,
				name: "storyboard-shot-background",
			}),
			createInsetStrokeRect(rect, layout.strokeWidth, {
				stroke: STORYBOARD_CONFIG.BORDER,
				cornerRadius: layout.cornerRadius,
				name: `storyboard-shot-${shot.id}`,
			}),
		)

		const shotLabel = this.getText("storyboard.shotWithIndex", "分镜 {{index}}").replace(
			"{{index}}",
			String(index + 1),
		)
		const titleTextWidth = Math.min(
			titleRect.width,
			Math.ceil(
				new Konva.Text({
					text: shotLabel,
					fontFamily: STORYBOARD_CONFIG.FONT_FAMILY,
					fontSize: Math.min(titleRect.height, layout.fontSize),
					fontStyle: "500",
				}).width(),
			),
		)
		group.add(
			new Konva.Text({
				...titleRect,
				width: titleTextWidth,
				text: shotLabel,
				fontFamily: STORYBOARD_CONFIG.FONT_FAMILY,
				fontSize: Math.min(layout.titleRect.height, layout.fontSize),
				fontStyle: "500",
				fill: STORYBOARD_CONFIG.PRIMARY_TEXT,
				listening: false,
				perfectDrawEnabled: false,
			}),
		)

		const generated = this.hasConnectedOutputImage(shot)
		if (statusRect.width > 0) {
			const statusRight = statusRect.x + statusRect.width
			const statusX = titleRect.x + titleTextWidth + layout.headingGap
			group.add(
				new Konva.Text({
					...statusRect,
					x: statusX,
					width: Math.max(0, statusRight - statusX),
					text: generated
						? this.getText("storyboard.generated", "已生成")
						: this.getText("storyboard.notGenerated", "未生成"),
					fontFamily: STORYBOARD_CONFIG.FONT_FAMILY,
					fontSize: Math.min(statusRect.height, layout.smallFontSize),
					fill: generated ? STORYBOARD_CONFIG.SUCCESS : STORYBOARD_CONFIG.SECONDARY_TEXT,
					listening: false,
					perfectDrawEnabled: false,
				}),
			)
		}

		if (this.canvas.permissionManager.can("sideEffect.generate")) {
			const generateVisual = new Konva.Group({ listening: false })
			const generateText = generated
				? this.getText("storyboard.regenerate", "再次生成")
				: this.getText("storyboard.generate", "生成")
			const generateFontSize = Math.min(layout.smallFontSize, controls.generateRect.height)
			const generateTextNode = new Konva.Text({
				x: controls.generateRect.x,
				y: controls.generateRect.y,
				text: generateText,
				align: "center",
				verticalAlign: "middle",
				fontFamily: STORYBOARD_CONFIG.FONT_FAMILY,
				fontSize: generateFontSize,
				fontStyle: "bold",
				fill: "#FFFFFF",
				listening: false,
				perfectDrawEnabled: false,
				name: "storyboard-control-text",
			})
			generateVisual.add(
				new Konva.Rect({
					...controls.generateRect,
					fill: STORYBOARD_CONFIG.ACCENT,
					cornerRadius: 8 * controls.scale,
					listening: false,
					perfectDrawEnabled: false,
					name: "storyboard-control-background",
				}),
			)
			if (generated) {
				const iconSize = generateFontSize
				const iconGap = ELEMENT_DESIGN_TOKENS.gap.control * controls.scale
				const contentWidth = iconSize + iconGap + generateTextNode.width()
				const contentX =
					controls.generateRect.x + (controls.generateRect.width - contentWidth) / 2
				generateTextNode.setAttrs({
					x: contentX + iconSize + iconGap,
					width: generateTextNode.width(),
					height: controls.generateRect.height,
				})
				generateVisual.add(
					new Konva.Path({
						x: contentX,
						y: controls.generateRect.y + (controls.generateRect.height - iconSize) / 2,
						data: LUCIDE_ROTATE_CCW_PATH_D,
						scaleX: iconSize / LUCIDE_ICON_VIEWBOX_SIZE,
						scaleY: iconSize / LUCIDE_ICON_VIEWBOX_SIZE,
						stroke: "#FFFFFF",
						strokeWidth: 2,
						lineCap: "round",
						lineJoin: "round",
						fillEnabled: false,
						listening: false,
						perfectDrawEnabled: false,
						name: "storyboard-generate-again-icon",
					}),
				)
			} else {
				generateTextNode.setAttrs({
					width: controls.generateRect.width,
					height: controls.generateRect.height,
				})
			}
			generateVisual.add(generateTextNode)
			group.add(generateVisual)
			this.addControlHit(group, {
				action: { type: "generate-shot", shotId: shot.id },
				kind: "generate",
				visualNode: generateVisual,
				baseBounds: controls.generateRect,
			})

			const deleteVisual = new Konva.Group({ listening: false })
			const deleteCenterX = controls.deleteRect.x + controls.deleteRect.width / 2
			const deleteCenterY = controls.deleteRect.y + controls.deleteRect.height / 2
			const closeHalfSize = 5 * controls.scale
			deleteVisual.add(
				new Konva.Rect({
					...controls.deleteRect,
					fill: "rgba(255, 255, 255, 0)",
					cornerRadius: 8 * controls.scale,
					listening: false,
					perfectDrawEnabled: false,
					name: "storyboard-control-background",
				}),
				new Konva.Line({
					points: [
						deleteCenterX - closeHalfSize,
						deleteCenterY - closeHalfSize,
						deleteCenterX + closeHalfSize,
						deleteCenterY + closeHalfSize,
					],
					stroke: STORYBOARD_CONFIG.SECONDARY_TEXT,
					strokeWidth: Math.max(1.5, 1.8 * controls.scale),
					lineCap: "round",
					listening: false,
					perfectDrawEnabled: false,
					name: "storyboard-control-icon",
				}),
				new Konva.Line({
					points: [
						deleteCenterX + closeHalfSize,
						deleteCenterY - closeHalfSize,
						deleteCenterX - closeHalfSize,
						deleteCenterY + closeHalfSize,
					],
					stroke: STORYBOARD_CONFIG.SECONDARY_TEXT,
					strokeWidth: Math.max(1.5, 1.8 * controls.scale),
					lineCap: "round",
					listening: false,
					perfectDrawEnabled: false,
					name: "storyboard-control-icon",
				}),
			)
			group.add(deleteVisual)
			this.addControlHit(group, {
				action: { type: "delete-shot", shotId: shot.id },
				kind: "delete",
				visualNode: deleteVisual,
				baseBounds: controls.deleteRect,
			})
		}

		const descriptionVisual = new Konva.Group({ listening: false })
		const descriptionCornerRadius = 9 * controls.scale
		const descriptionBackground = new Konva.Rect({
			...descriptionRect,
			fill: STORYBOARD_CONFIG.BACKGROUND,
			cornerRadius: descriptionCornerRadius,
			listening: false,
			perfectDrawEnabled: false,
			name: "storyboard-control-background",
		})
		const descriptionBorder = createInsetStrokeRect(descriptionRect, layout.strokeWidth, {
			// 常态保留细圆角描边，聚焦时切到 accent，与 overlay textarea 一致。
			stroke: STORYBOARD_CONFIG.BORDER_SUBTLE,
			cornerRadius: descriptionCornerRadius,
			name: "storyboard-control-border",
		})
		descriptionVisual.add(
			descriptionBackground,
			descriptionBorder,
			new Konva.Text({
				...descriptionTextRect,
				text:
					shot.description ||
					(!this.canvas.permissionManager.can("document.write")
						? this.getText("storyboard.noDescription", "暂无描述")
						: this.getText("storyboard.descriptionPlaceholder", "请输入分镜画面描述")),
				fontFamily: STORYBOARD_CONFIG.FONT_FAMILY,
				fontSize: layout.smallFontSize,
				lineHeight: 1.45,
				fill: shot.description
					? STORYBOARD_CONFIG.PRIMARY_TEXT
					: STORYBOARD_CONFIG.SECONDARY_TEXT,
				listening: false,
				perfectDrawEnabled: false,
				ellipsis: true,
				wrap: "word",
				name: "storyboard-control-text",
			}),
		)
		group.add(descriptionVisual)
		if (this.canvas.permissionManager.can("document.write")) {
			this.addControlHit(group, {
				action: { type: "edit-description", shotId: shot.id },
				kind: "description",
				visualNode: descriptionVisual,
				overlayAnchorNode: descriptionBackground,
				editorPresentation: {
					fontSize: layout.smallFontSize,
					paddingX: Math.max(0, descriptionTextRect.x - descriptionRect.x),
					paddingY: Math.max(0, descriptionTextRect.y - descriptionRect.y),
				},
				baseBounds: descriptionRect,
			})
		}
	}

	private renderFooter(group: Konva.Group, layout: StoryboardElementLayout): void {
		const footer = layout.footer
		const footerGroup = new Konva.Group({
			name: "storyboard-footer-region",
			clipX: footer.rect.x,
			clipY: footer.rect.y,
			clipWidth: footer.rect.width,
			clipHeight: footer.rect.height,
		})
		group.add(footerGroup)
		if (this.canvas.permissionManager.can("document.write")) {
			const addVisual = new Konva.Group({ listening: false })
			addVisual.add(
				new Konva.Rect({
					...footer.addShotRect,
					fill: STORYBOARD_CONFIG.BACKGROUND,
					listening: false,
					perfectDrawEnabled: false,
					name: "storyboard-control-background",
				}),
				createInsetStrokeRect(footer.addShotRect, footer.strokeWidth, {
					stroke: STORYBOARD_CONFIG.BORDER,
					dash: [7 * layout.scale, 7 * layout.scale],
					cornerRadius: 10 * layout.scale,
					name: "storyboard-control-border",
				}),
				new Konva.Text({
					...footer.addShotRect,
					text: `＋ ${this.getText("storyboard.addShot", "添加分镜")}`,
					align: "center",
					verticalAlign: "middle",
					fontFamily: STORYBOARD_CONFIG.FONT_FAMILY,
					fontSize: layout.valueFontSize,
					fontStyle: "bold",
					fill: STORYBOARD_CONFIG.SECONDARY_TEXT,
					listening: false,
					perfectDrawEnabled: false,
					name: "storyboard-control-text",
				}),
			)
			footerGroup.add(addVisual)
			this.addControlHit(footerGroup, {
				action: { type: "add-shot" },
				kind: "add",
				visualNode: addVisual,
				baseBounds: footer.addShotRect,
			})
		}

		// TODO: 接入图片生成积分计算接口后，在这里注入批量生成的实际 points。
		// 当前没有可靠的计费接口，不能用分镜数量或其他字段伪造积分，因此暂不渲染。
		const pointsCost: number | null = null
		if (pointsCost !== null) {
			footerGroup.add(
				new Konva.Text({
					x: footer.actionsRect.x,
					y: footer.actionsRect.y,
					width: Math.max(
						0,
						footer.generateAllRect.x - footer.actionsRect.x - 20 * layout.scale,
					),
					height: footer.actionsRect.height,
					text: this.getText("storyboard.pointsCost", "消耗 {{count}} 点").replace(
						"{{count}}",
						String(pointsCost),
					),
					align: "right",
					verticalAlign: "middle",
					fontFamily: STORYBOARD_CONFIG.FONT_FAMILY,
					fontSize: layout.shotSmallFontSize,
					fill: STORYBOARD_CONFIG.SECONDARY_TEXT,
					listening: false,
					perfectDrawEnabled: false,
					name: "storyboard-points-cost",
				}),
			)
		}
		if (!this.canvas.permissionManager.can("sideEffect.generate")) return
		const generateAllVisual = new Konva.Group({ listening: false })
		generateAllVisual.add(
			new Konva.Rect({
				...footer.generateAllRect,
				fill: STORYBOARD_CONFIG.ACCENT,
				cornerRadius: footer.cornerRadius,
				listening: false,
				perfectDrawEnabled: false,
				name: "storyboard-generate-all storyboard-control-background",
			}),
			new Konva.Text({
				...footer.generateAllRect,
				text: this.getText("storyboard.generateAll", "全部生成"),
				align: "center",
				verticalAlign: "middle",
				fontFamily: STORYBOARD_CONFIG.FONT_FAMILY,
				fontSize: layout.shotSmallFontSize * footer.generateAllScale,
				fontStyle: "bold",
				fill: "#FFFFFF",
				listening: false,
				perfectDrawEnabled: false,
				name: "storyboard-control-text",
			}),
		)
		footerGroup.add(generateAllVisual)
		this.addControlHit(footerGroup, {
			action: { type: "generate-all" },
			kind: "generate",
			visualNode: generateAllVisual,
			baseBounds: footer.generateAllRect,
		})
	}

	private addControlHit(group: Konva.Group, metadata: StoryboardControlMetadata): void {
		const hit = new Konva.Rect({
			...metadata.baseBounds,
			fill: "rgba(0, 0, 0, 0.001)",
			listening: true,
			perfectDrawEnabled: false,
			name: "storyboard-control-hit",
		})
		hit.setAttr("storyboardControlMetadata", metadata)
		hit.setAttr("storyboardBaseHitBounds", metadata.baseBounds)
		group.add(hit)
	}

	private syncInteractionHitTargets(): void {
		if (!(this.node instanceof Konva.Group)) return
		const coarsePointer = this.canvas.deviceInfo?.input?.coarsePointer ?? false
		const minimumScreenSize = coarsePointer
			? STORYBOARD_CONFIG.COARSE_POINTER_MIN_HIT_SIZE
			: STORYBOARD_CONFIG.DESKTOP_MIN_HIT_SIZE

		moveControlHitsToTop(this.node, ".storyboard-control-hit")
		this.node.find(".storyboard-control-hit").forEach((candidate) => {
			if (!(candidate instanceof Konva.Rect)) return
			const baseBounds = candidate.getAttr("storyboardBaseHitBounds") as
				{ x: number; y: number; width: number; height: number } | undefined
			if (!baseBounds) return
			syncControlHitRect(candidate, baseBounds, minimumScreenSize)
		})
		const controlsEnabled = this.canUseElementControls(this.node)
		this.node.find(".storyboard-control-hit").forEach((candidate) => {
			candidate.listening(controlsEnabled)
		})
	}

	private applyControlState(
		metadata: StoryboardControlMetadata,
		state: StoryboardControlState,
	): void {
		const background = metadata.visualNode.findOne(".storyboard-control-background") as
			Konva.Shape | undefined
		const border = metadata.visualNode.findOne(".storyboard-control-border") as
			Konva.Shape | undefined
		const text = metadata.visualNode.findOne(".storyboard-control-text") as
			Konva.Text | undefined
		const suffix = metadata.visualNode.findOne(".storyboard-control-suffix") as
			Konva.Shape | undefined
		const icons = metadata.visualNode.find(".storyboard-control-icon")
		const generateAgainIcon = metadata.visualNode.findOne(".storyboard-generate-again-icon") as
			Konva.Path | undefined
		if (!background) return

		switch (metadata.kind) {
			case "parameter": {
				if (state === "disabled") {
					background.fill(STORYBOARD_CONFIG.DISABLED_BACKGROUND)
					text?.fill(STORYBOARD_CONFIG.DISABLED_TEXT)
					if (suffix instanceof Konva.Line) suffix.stroke(STORYBOARD_CONFIG.DISABLED_TEXT)
					else suffix?.fill(STORYBOARD_CONFIG.DISABLED_TEXT)
					break
				}

				background.fill(
					state === "pressed"
						? STORYBOARD_CONFIG.SURFACE_PRESSED
						: state === "hover" || state === "editing"
							? STORYBOARD_CONFIG.SURFACE_STRONG
							: "rgba(255, 255, 255, 0)",
				)
				const foreground =
					state === "hover" || state === "pressed" || state === "editing"
						? STORYBOARD_CONFIG.ACCENT
						: STORYBOARD_CONFIG.PRIMARY_TEXT
				text?.fill(foreground)
				if (suffix instanceof Konva.Line) suffix.stroke(foreground)
				else suffix?.fill(foreground)
				break
			}
			case "description":
				background.fill(
					state === "pressed"
						? STORYBOARD_CONFIG.SURFACE_PRESSED
						: state === "hover" || state === "editing"
							? STORYBOARD_CONFIG.SURFACE_STRONG
							: STORYBOARD_CONFIG.BACKGROUND,
				)
				border?.stroke(
					state === "hover" || state === "pressed" || state === "editing"
						? STORYBOARD_CONFIG.ACCENT
						: STORYBOARD_CONFIG.BORDER_SUBTLE,
				)
				break
			case "delete":
				background.fill(
					state === "pressed"
						? STORYBOARD_CONFIG.DANGER_PRESSED
						: state === "hover"
							? STORYBOARD_CONFIG.DANGER_HOVER
							: "rgba(255, 255, 255, 0)",
				)
				icons.forEach((icon) => {
					if (icon instanceof Konva.Line) {
						icon.stroke(
							state === "hover" || state === "pressed"
								? STORYBOARD_CONFIG.DANGER
								: STORYBOARD_CONFIG.SECONDARY_TEXT,
						)
					}
				})
				break
			case "add":
				background.fill(
					state === "pressed"
						? STORYBOARD_CONFIG.ACCENT_SOFT
						: state === "hover"
							? STORYBOARD_CONFIG.SURFACE_STRONG
							: STORYBOARD_CONFIG.BACKGROUND,
				)
				border?.stroke(
					state === "hover" || state === "pressed"
						? STORYBOARD_CONFIG.ACCENT
						: STORYBOARD_CONFIG.BORDER,
				)
				text?.fill(
					state === "hover" || state === "pressed"
						? STORYBOARD_CONFIG.ACCENT
						: STORYBOARD_CONFIG.SECONDARY_TEXT,
				)
				break
			case "generate":
				if (
					state === "disabled" ||
					("disabled" in metadata.action && metadata.action.disabled)
				) {
					background.fill(STORYBOARD_CONFIG.DISABLED_BACKGROUND)
					text?.fill(STORYBOARD_CONFIG.DISABLED_TEXT)
					generateAgainIcon?.stroke(STORYBOARD_CONFIG.DISABLED_TEXT)
					break
				}
				background.fill(
					state === "pressed"
						? STORYBOARD_CONFIG.ACCENT_PRESSED
						: state === "hover"
							? STORYBOARD_CONFIG.ACCENT
							: STORYBOARD_CONFIG.ACCENT,
				)
				text?.fill("#FFFFFF")
				generateAgainIcon?.stroke("#FFFFFF")
				break
			case "reference-preview":
				background.fill(
					state === "pressed"
						? "rgba(91, 110, 245, 0.24)"
						: state === "hover"
							? "rgba(91, 110, 245, 0.12)"
							: "rgba(255, 255, 255, 0)",
				)
				border?.stroke(
					state === "pressed"
						? STORYBOARD_CONFIG.ACCENT_PRESSED
						: state === "hover"
							? STORYBOARD_CONFIG.ACCENT
							: STORYBOARD_CONFIG.BORDER_SUBTLE,
				)
				break
		}
	}
}
