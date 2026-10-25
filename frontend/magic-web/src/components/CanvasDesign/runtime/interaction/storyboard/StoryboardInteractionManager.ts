import type Konva from "konva"
import type { ImageModelItem } from "../../../public/magic-types"
import type { Canvas } from "../../core/Canvas"
import {
	ElementTypeEnum,
	type CropConfig,
	type LayerElement,
	type StoryboardElement,
	type StoryboardElementContent,
	type StoryboardGenerationConfig,
	type StoryboardShot,
} from "../../document/types"
import { getActiveContent, hasProcessingImageContent } from "../../document/elementContent"
import { STORYBOARD_CONFIG } from "../../elements/storyboard/StoryboardElement.config"
import { generateUUID } from "../../shared/ids"
import {
	buildDefaultImageGenerationConfig,
	buildImageSelectValue,
	buildSupportedAspectRatioOptions,
	buildSupportedResolutionOptions,
	findBestSizeForResolution,
	getDefaultResolutionForModel,
	getImageGenerationSettings,
	parseImageSelectValue,
	type ImageSizeOption,
} from "../../shared/imageGenerationConfig"
import {
	StoryboardFieldOverlayHost,
	type StoryboardSelectGroup,
	type StoryboardSelectOption,
} from "./StoryboardFieldOverlayHost"
import { StoryboardGenerationController } from "./StoryboardGenerationController"
import { resolveStoryboardRequiredHeight } from "../../elements/storyboard/StoryboardElement.layout"
import { ImageElement } from "../../elements/image/ImageElement"
import { resolveStoryboardReferenceImages } from "./storyboardReferenceImages"
import type { ElementControlInteractionPolicy } from "../element-control/ElementControlInteractionPolicy"

export type StoryboardControlState = "idle" | "hover" | "pressed" | "disabled" | "editing"

export type StoryboardControlAction =
	| { type: "select-model" }
	| { type: "select-aspect-ratio" }
	| { type: "select-resolution" }
	| { type: "edit-description"; shotId: string }
	| { type: "add-shot" }
	| { type: "delete-shot"; shotId: string }
	| { type: "generate-shot"; shotId: string; disabled?: boolean }
	| { type: "generate-all"; disabled?: boolean }
	| { type: "preview-reference-image"; path: string; crop?: CropConfig }

export interface StoryboardSelectPresentation {
	fontSize: number
	horizontalPadding: number
	suffixGap: number
	suffixIconSize: number
	modelIconUrl?: string
	modelIconSize?: number
	modelIconGap?: number
}

/** 描述等文本字段的 DOM overlay 排版，需与 Konva 常态渲染一致。 */
export interface StoryboardEditorPresentation {
	fontSize: number
	paddingX: number
	paddingY: number
}

export interface StoryboardControlBindingOptions {
	elementId: string
	node: Konva.Rect
	overlayAnchorNode?: Konva.Node
	selectPresentation?: StoryboardSelectPresentation
	editorPresentation?: StoryboardEditorPresentation
	action: StoryboardControlAction
	applyState: (state: StoryboardControlState) => void
	elementInteraction?: ElementControlInteractionPolicy<StoryboardControlAction>
}

interface StoryboardControlBinding extends StoryboardControlBindingOptions {
	hovered: boolean
	activationPending: boolean
	lastActivationAt: number
}

interface StoryboardDescriptionDraft {
	elementId: string
	shotId: string
	value: string
}

const ACTIVATION_DEDUPLICATION_MS = 320

function stopKonvaEvent(event: Konva.KonvaEventObject<Event>): void {
	event.cancelBubble = true
	event.evt?.stopPropagation()
	event.evt?.stopImmediatePropagation()
}

function decodeSizeOption(value: string): ImageSizeOption | null {
	try {
		const parsed = parseImageSelectValue(value)
		if (!parsed.label || !parsed.value) return null
		return {
			label: parsed.label,
			value: parsed.value,
			scale: parsed.scale,
		}
	} catch {
		return null
	}
}

/**
 * Canvas 级分镜交互协调器。
 *
 * 负责选择态/权限/设备仲裁、临时字段 Overlay、模型配置缓存以及一次性 DSL 提交。
 * StoryboardElement 只维护永久 Konva 视觉和透明命中节点。
 */
export class StoryboardInteractionManager {
	private readonly canvas: Canvas
	private readonly overlayHost: StoryboardFieldOverlayHost
	private readonly generationController: StoryboardGenerationController
	private readonly bindings = new Set<StoryboardControlBinding>()
	private activeBinding: StoryboardControlBinding | null = null
	private editingBinding: StoryboardControlBinding | null = null
	private descriptionDraft: StoryboardDescriptionDraft | null = null
	private imageModels: ImageModelItem[] | null = null
	private imageModelsPromise: Promise<ImageModelItem[]> | null = null
	private eventUnsubscribers: Array<() => void> = []
	private destroyed = false

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.overlayHost = new StoryboardFieldOverlayHost({ canvas: this.canvas })
		this.generationController = new StoryboardGenerationController(this.canvas, () =>
			this.getImageModels(),
		)
		this.bindCanvasEvents()
		this.syncStoryboardHeights()
		void this.getImageModels()
	}

	public bindControl(options: StoryboardControlBindingOptions): () => void {
		const binding: StoryboardControlBinding = {
			...options,
			hovered: false,
			activationPending: false,
			lastActivationAt: 0,
		}
		this.bindings.add(binding)

		const handleMouseEnter = () => {
			binding.hovered = true
			if (!this.canvas.deviceInfo.input.hover || !this.canInteractWithElement(binding)) return
			if (this.isDisabled(binding)) {
				binding.applyState("disabled")
				this.canvas.cursorManager.setTemporary("not-allowed")
				return
			}
			if (!this.canActivate(binding)) return
			binding.applyState(this.editingBinding === binding ? "editing" : "hover")
			this.canvas.cursorManager.setTemporary(this.getCursor(binding))
			binding.node.getLayer()?.batchDraw()
		}

		const handleMouseLeave = () => {
			binding.hovered = false
			binding.activationPending = false
			if (this.activeBinding === binding) this.activeBinding = null
			if (this.editingBinding !== binding) {
				binding.applyState(this.isDisabled(binding) ? "disabled" : "idle")
				binding.node.getLayer()?.batchDraw()
			}
			this.restoreCursorIfIdle()
		}

		const tryActivateFromGesture = (): boolean => {
			if (this.isDisabled(binding)) return false
			if (!binding.activationPending || !this.canActivate(binding)) return false
			binding.activationPending = false
			const now = Date.now()
			if (now - binding.lastActivationAt < ACTIVATION_DEDUPLICATION_MS) return false
			binding.lastActivationAt = now
			this.activate(binding)
			return true
		}

		const handlePressStart = (event: Konva.KonvaEventObject<Event>) => {
			if (!this.canInteractWithElement(binding)) {
				stopKonvaEvent(event)
				binding.applyState("disabled")
				return
			}
			if (this.isDisabled(binding)) {
				stopKonvaEvent(event)
				binding.applyState("disabled")
				this.canvas.cursorManager.setTemporary("not-allowed")
				binding.node.getLayer()?.batchDraw()
				return
			}
			if (!this.canActivate(binding) || this.isMultiTouchEvent(event)) {
				binding.activationPending = false
				return
			}
			stopKonvaEvent(event)
			this.ensureElementSelected(binding)
			if (this.editingBinding && this.isGenerationAction(binding.action)) {
				const nativeEvent = event.evt as Event & { pointerType?: string }
				const isTouch = event.type.includes("touch") || nativeEvent.pointerType === "touch"
				if (!isTouch) nativeEvent.preventDefault()
			}

			// 同一控件已在编辑：保持打开，只拦截拖拽。
			if (this.editingBinding === binding) {
				binding.activationPending = false
				binding.applyState("editing")
				this.canvas.cursorManager.setTemporary(this.getCursor(binding))
				binding.node.getLayer()?.batchDraw()
				return
			}

			// 切换到另一控件：
			// - 普通字段：mousedown 立即 commit 旧 overlay 并打开新的。
			// - 生成按钮：延后到 mouseup/click，避免按下时抢先提交描述草稿。
			if (this.editingBinding && this.editingBinding !== binding) {
				if (this.isGenerationAction(binding.action)) {
					binding.activationPending = true
					this.activeBinding = binding
					binding.applyState("pressed")
					this.canvas.cursorManager.setTemporary(this.getCursor(binding))
					binding.node.getLayer()?.batchDraw()
					return
				}
				binding.activationPending = false
				const now = Date.now()
				if (now - binding.lastActivationAt < ACTIVATION_DEDUPLICATION_MS) return
				binding.lastActivationAt = now
				this.activate(binding)
				return
			}

			binding.activationPending = true
			this.activeBinding = binding
			binding.applyState("pressed")
			this.canvas.cursorManager.setTemporary(this.getCursor(binding))
			binding.node.getLayer()?.batchDraw()
		}

		const handlePressEnd = (event: Konva.KonvaEventObject<Event>) => {
			if (this.activeBinding !== binding) return
			stopKonvaEvent(event)
			const cancelled = event.type.includes("cancel") || this.isMultiTouchEvent(event)
			if (cancelled) binding.activationPending = false
			this.activeBinding = null
			binding.applyState(
				this.editingBinding === binding
					? "editing"
					: binding.hovered && this.canvas.deviceInfo.input.hover
						? "hover"
						: "idle",
			)
			binding.node.getLayer()?.batchDraw()
			this.restoreCursorIfIdle()
			// Radix outside dismiss 常会吞掉后续 click；在 pointerup 补一次激活以支持切换。
			if (!cancelled) tryActivateFromGesture()
		}

		const handleActivate = (event: Konva.KonvaEventObject<Event>) => {
			if (!this.canInteractWithElement(binding)) {
				stopKonvaEvent(event)
				return
			}
			if (this.isDisabled(binding)) {
				stopKonvaEvent(event)
				return
			}
			if (!binding.activationPending || !this.canActivate(binding)) return
			stopKonvaEvent(event)
			tryActivateFromGesture()
		}

		binding.node.on("mouseenter", handleMouseEnter)
		binding.node.on("mouseleave", handleMouseLeave)
		binding.node.on("pointerdown mousedown touchstart", handlePressStart)
		binding.node.on("pointerup pointercancel mouseup touchend touchcancel", handlePressEnd)
		binding.node.on("click tap", handleActivate)

		binding.applyState(this.isDisabled(binding) ? "disabled" : "idle")

		return () => {
			binding.node.off("mouseenter", handleMouseEnter)
			binding.node.off("mouseleave", handleMouseLeave)
			binding.node.off("pointerdown mousedown touchstart", handlePressStart)
			binding.node.off("pointerup pointercancel mouseup touchend touchcancel", handlePressEnd)
			binding.node.off("click tap", handleActivate)
			this.bindings.delete(binding)
			if (this.activeBinding === binding) this.activeBinding = null
			if (this.editingBinding === binding) {
				this.editingBinding = null
				this.overlayHost.cancel()
			}
		}
	}

	public destroy(): void {
		this.destroyed = true
		this.resetTransientState({ cancelEditor: true })
		this.eventUnsubscribers.forEach((unsubscribe) => unsubscribe())
		this.eventUnsubscribers = []
		this.bindings.clear()
		this.overlayHost.destroy()
		this.generationController.destroy()
	}

	private bindCanvasEvents(): void {
		const reconcileSelection = () => {
			if (this.editingBinding && !this.isSelectedBinding(this.editingBinding)) {
				this.overlayHost.commit()
			}
			this.resetPressedStates()
		}
		const commitEditor = () => this.overlayHost.commit()
		const cancelEditor = () => this.resetTransientState({ cancelEditor: true })
		const normalizeDocument = () => {
			cancelEditor()
			this.syncStoryboardHeights()
			// Smart restore may emit before Canvas reloads connections; defer until the
			// whole restore transaction has synchronously completed.
			queueMicrotask(() => {
				if (!this.destroyed) this.rerenderStoryboardElements()
			})
		}
		const normalizeUpdatedStoryboard = ({
			data,
		}: {
			data: { elementId: string; data: LayerElement }
		}) => {
			if (data.data.type !== ElementTypeEnum.Storyboard) return
			const element = this.getStoryboardElement(data.elementId)
			if (!element) return
			const requiredHeight = this.getStoryboardRequiredHeight(element)
			if (element.height === requiredHeight) return
			this.canvas.elementManager.update(
				element.id,
				{ height: requiredHeight },
				{ silent: true },
			)
		}
		const handleElementUpdated = (payload: {
			data: { elementId: string; data: LayerElement }
		}) => {
			normalizeUpdatedStoryboard(payload)
			// 参考图解析会展开 Frame/Group 并读取隐藏状态；任一上游元素更新
			// 都可能改变参考图计数或顺序，因此不能只监听 Image 更新。
			if (payload.data.data.type !== ElementTypeEnum.Storyboard) {
				this.syncStoryboardHeights()
				this.rerenderStoryboardElements()
			}
		}
		const handleElementDeleted = ({ data }: { data: { elementId: string } }) => {
			if (this.editingBinding?.elementId === data.elementId) cancelEditor()
			this.syncStoryboardHeights()
			this.rerenderStoryboardElements()
		}
		const handleConnectionChanged = () => {
			this.syncStoryboardHeights()
			this.rerenderStoryboardElements()
		}

		this.eventUnsubscribers.push(
			this.canvas.eventEmitter.on("element:select", reconcileSelection),
			this.canvas.eventEmitter.on("element:deselect", reconcileSelection),
			this.canvas.eventEmitter.on("permission:changed", commitEditor),
			this.canvas.eventEmitter.on("tool:change", commitEditor),
			this.canvas.eventEmitter.on("canvas:devicechange", commitEditor),
			this.canvas.eventEmitter.on("elements:transform:dragstart", commitEditor),
			this.canvas.eventEmitter.on("elements:transform:anchorDragStart", commitEditor),
			this.canvas.eventEmitter.on("viewport:gesture", ({ data }) => {
				if (data.active) cancelEditor()
			}),
			this.canvas.eventEmitter.on("element:deleted", handleElementDeleted),
			this.canvas.eventEmitter.on("element:updated", handleElementUpdated),
			this.canvas.eventEmitter.on("connection:change", handleConnectionChanged),
			this.canvas.eventEmitter.on("element:image:generate-submit-started", () => {
				this.rerenderStoryboardElements()
			}),
			this.canvas.eventEmitter.on("element:image:generate-submit-failed", () => {
				this.rerenderStoryboardElements()
			}),
			this.canvas.eventEmitter.on("element:batchdeleted", cancelEditor),
			this.canvas.eventEmitter.on("canvas:clear", cancelEditor),
			this.canvas.eventEmitter.on("document:loaded", normalizeDocument),
			this.canvas.eventEmitter.on("document:restored", normalizeDocument),
		)
	}

	private activate(binding: StoryboardControlBinding): void {
		// 添加/删除分镜会基于当前 DSL 重建 shots 列表。描述输入在失焦前仍停留
		// 在临时 overlay/draft 中，必须先提交，否则列表更新会读取旧描述并将其覆盖。
		if (this.shouldCommitEditorBeforeActivate(binding.action)) this.overlayHost.commit()
		switch (binding.action.type) {
			case "select-model":
				this.openModelSelect(binding)
				break
			case "select-aspect-ratio":
				this.openAspectRatioSelect(binding)
				break
			case "select-resolution":
				this.openResolutionSelect(binding)
				break
			case "edit-description":
				this.openDescriptionEditor(binding, binding.action.shotId)
				break
			case "add-shot":
				this.addShot(binding.elementId)
				break
			case "delete-shot":
				this.deleteShot(binding.elementId, binding.action.shotId)
				break
			case "generate-shot":
				{
					const generation = this.generationController.generateShot(
						binding.elementId,
						binding.action.shotId,
					)
					this.rerenderStoryboardElements()
					void generation.finally(() => this.rerenderStoryboardElements())
				}
				break
			case "generate-all":
				{
					const generation = this.generationController.generateAll(binding.elementId)
					this.rerenderStoryboardElements()
					void generation.finally(() => this.rerenderStoryboardElements())
				}
				break
			case "preview-reference-image":
				this.canvas.eventEmitter.emit({
					type: "storyboard:reference-image:preview",
					data: {
						path: binding.action.path,
						crop: binding.action.crop,
					},
				})
				break
		}
	}

	private openModelSelect(binding: StoryboardControlBinding): void {
		this.withImageModels(binding, (models, element) => {
			const currentModelId =
				getActiveContent<StoryboardElementContent>(element)?.generationConfig?.model_id
			const options = models.map((model) => ({
				label: model.model_name || model.model_id,
				value: model.model_id,
				icon: model.model_icon || undefined,
			}))
			this.ensureCurrentOption(options, currentModelId)
			const groups = this.buildModelOptionGroups(models)
			const currentExistsInGroups =
				!currentModelId ||
				groups.some((group) =>
					group.options.some((option) => option.value === currentModelId),
				)
			this.mountSelect(binding, {
				ariaLabel: this.getText("storyboard.imageModel", "图片模型"),
				value: currentModelId ?? options[0]?.value ?? "",
				options,
				groups: groups.length > 1 && currentExistsInGroups ? groups : undefined,
				onCommit: (value) => this.updateModel(element.id, value, models),
			})
		})
	}

	private openAspectRatioSelect(binding: StoryboardControlBinding): void {
		this.withImageModels(binding, (models, element) => {
			const model = this.findSelectedModel(models, element)
			const config = getActiveContent<StoryboardElementContent>(element)?.generationConfig
			const sizes = buildSupportedAspectRatioOptions(
				model,
				buildImageSelectValue,
				config?.resolution,
			)
			const options = sizes.map((size) => ({
				label: size.label,
				value: size.value,
				secondaryLabel: `${size.width}x${size.height}`,
				preview: {
					iconWidth: size.iconWidth,
					iconHeight: size.iconHeight,
				},
			}))
			const current =
				sizes.find(
					(size) =>
						size.originalValue === config?.size &&
						(!config.resolution ||
							!size.originalScale ||
							size.originalScale === config.resolution),
				) ??
				sizes.find(
					(size) => size.originalLabel === config?.image_generation_config?.aspect_ratio,
				) ??
				sizes[0]
			if (current) this.ensureCurrentOption(options, current.value, current.label)
			this.mountSelect(binding, {
				ariaLabel: this.getText("storyboard.aspectRatio", "画面比例"),
				value: current?.value ?? options[0]?.value ?? "",
				options,
				onCommit: (value) => {
					const selected = decodeSizeOption(value)
					if (selected) this.updateSize(element.id, selected)
				},
			})
		})
	}

	private openResolutionSelect(binding: StoryboardControlBinding): void {
		this.withImageModels(binding, (models, element) => {
			const model = this.findSelectedModel(models, element)
			const options = buildSupportedResolutionOptions(model).map((option) => ({
				label: option.label,
				value: option.value,
			}))
			const resolution = getDefaultResolutionForModel(
				model,
				getActiveContent<StoryboardElementContent>(element)?.generationConfig?.resolution,
			)
			this.ensureCurrentOption(options, resolution)
			this.mountSelect(binding, {
				ariaLabel: this.getText("storyboard.resolution", "分辨率"),
				value: resolution ?? options[0]?.value ?? "",
				options,
				onCommit: (value) => this.updateResolution(element.id, value, model),
			})
		})
	}

	private openDescriptionEditor(binding: StoryboardControlBinding, shotId: string): void {
		const element = this.getStoryboardElement(binding.elementId)
		const shot = element
			? getActiveContent<StoryboardElementContent>(element)?.shots?.find(
					(item) => item.id === shotId,
				)
			: undefined
		const anchorNode = binding.overlayAnchorNode
		if (!element || !shot || !anchorNode) return

		this.beginEditing(binding)
		const cornerRadiusGetter = (
			anchorNode as Konva.Node & { cornerRadius?: () => number | number[] }
		).cornerRadius
		const rawCornerRadius =
			typeof cornerRadiusGetter === "function"
				? cornerRadiusGetter.call(anchorNode)
				: Number.NaN
		const anchorCornerRadius = Array.isArray(rawCornerRadius)
			? Number(rawCornerRadius[0])
			: Number(rawCornerRadius)
		this.overlayHost.mount({
			kind: "textarea",
			anchorNode,
			ariaLabel: this.getText("storyboard.description", "分镜画面描述"),
			value: shot.description,
			placeholder: this.getText("storyboard.descriptionPlaceholder", "请输入分镜画面描述"),
			fontSize: binding.editorPresentation?.fontSize ?? 28,
			paddingX: binding.editorPresentation?.paddingX,
			paddingY: binding.editorPresentation?.paddingY,
			borderRadius: Number.isFinite(anchorCornerRadius) ? anchorCornerRadius : 9,
			onInput: (value) => this.updateDescriptionDraft(element.id, shotId, value),
			onCommit: (value) => {
				this.finishEditing(binding)
				this.updateShot(element.id, shotId, (current) => ({
					...current,
					description: value,
				}))
				this.clearDescriptionDraft(element.id, shotId)
			},
			onCancel: () => {
				this.clearDescriptionDraft(element.id, shotId)
				this.finishEditing(binding)
			},
		})
		this.descriptionDraft = { elementId: element.id, shotId, value: shot.description }
		this.refreshGenerationControlStates(element.id)
	}

	private mountSelect(
		binding: StoryboardControlBinding,
		options: {
			ariaLabel: string
			value: string
			options: StoryboardSelectOption[]
			groups?: StoryboardSelectGroup[]
			onCommit: (value: string) => void
		},
	): void {
		const anchorNode = binding.overlayAnchorNode
		if (!anchorNode || options.options.length === 0) return
		this.beginEditing(binding)
		this.overlayHost.mount({
			kind: "select",
			anchorNode,
			ariaLabel: options.ariaLabel,
			value: options.value,
			options: options.options,
			groups: options.groups,
			fontSize: binding.selectPresentation?.fontSize ?? 16,
			horizontalPadding: binding.selectPresentation?.horizontalPadding ?? 16,
			suffixGap: binding.selectPresentation?.suffixGap ?? 8,
			suffixIconSize: binding.selectPresentation?.suffixIconSize ?? 12,
			modelIconUrl: binding.selectPresentation?.modelIconUrl,
			modelIconSize: binding.selectPresentation?.modelIconSize,
			modelIconGap: binding.selectPresentation?.modelIconGap,
			borderRadius: 8,
			onCommit: (value) => {
				this.finishEditing(binding)
				options.onCommit(value)
			},
			onCancel: () => this.finishEditing(binding),
			onCanvasOutsidePointer: (point) => this.handleSelectCanvasOutsidePointer(point),
		})
	}

	private handleSelectCanvasOutsidePointer(point: {
		clientX: number
		clientY: number
		target: EventTarget | null
	}): void {
		// 点在当前字段 overlay（含 invisible trigger）上：保持打开。
		if (
			point.target instanceof Element &&
			point.target.closest('[data-canvas-ui="storyboard-field-overlay"]')
		) {
			return
		}
		const nextBinding = this.findBindingAtClientPoint(point.clientX, point.clientY)
		if (nextBinding && nextBinding === this.editingBinding) return

		this.overlayHost.dismissForSwitch()
		if (!nextBinding || !this.canActivate(nextBinding)) return
		const now = Date.now()
		if (now - nextBinding.lastActivationAt < ACTIVATION_DEDUPLICATION_MS) return
		nextBinding.lastActivationAt = now
		this.activate(nextBinding)
	}

	private findBindingAtClientPoint(
		clientX: number,
		clientY: number,
	): StoryboardControlBinding | null {
		const rect = this.canvas.stage.container().getBoundingClientRect()
		const stagePoint = { x: clientX - rect.left, y: clientY - rect.top }
		const shape = this.canvas.stage.getIntersection(stagePoint)
		if (!shape) return null
		for (const binding of this.bindings) {
			let node: Konva.Node | null = shape
			while (node) {
				if (node === binding.node) return binding
				node = node.getParent()
			}
		}
		return null
	}

	private beginEditing(binding: StoryboardControlBinding): void {
		if (this.editingBinding && this.editingBinding !== binding) {
			this.overlayHost.dismissForSwitch()
		}
		this.editingBinding = binding
		binding.applyState("editing")
		binding.node.getLayer()?.batchDraw()
	}

	private finishEditing(binding: StoryboardControlBinding): void {
		if (this.editingBinding === binding) this.editingBinding = null
		if (!binding.node.getStage()) return
		binding.applyState(binding.hovered && this.canvas.deviceInfo.input.hover ? "hover" : "idle")
		binding.node.getLayer()?.batchDraw()
	}

	private addShot(elementId: string): void {
		const element = this.getStoryboardElement(elementId)
		if (!element) return
		const shots = getActiveContent<StoryboardElementContent>(element)?.shots ?? []
		const nextShots = [
			...shots,
			{
				id: generateUUID(),
				description: "",
			},
		]
		const requiredHeight = this.getStoryboardRequiredHeight(element, nextShots.length)
		const history = this.canvas.historyManager
		history?.disable()
		try {
			this.canvas.elementManager.update(elementId, {
				shots: nextShots,
				height: requiredHeight,
			})
		} finally {
			history?.enable()
			history?.recordHistoryImmediate()
		}
	}

	private deleteShot(elementId: string, shotId: string): void {
		const element = this.getStoryboardElement(elementId)
		const content = element ? getActiveContent<StoryboardElementContent>(element) : undefined
		const shot = content?.shots?.find((item) => item.id === shotId)
		if (!element || !shot) return

		const history = this.canvas.historyManager
		history?.disable()
		try {
			if (shot.outputImageElementId) {
				const outputConnection = this.canvas.connectionManager
					.getDownstreamConnections(elementId)
					.find((connection) => connection.targetElementId === shot.outputImageElementId)
				if (outputConnection) {
					this.canvas.connectionManager.removeConnections([outputConnection.id])
				}
			}
			const nextShots = (content?.shots ?? []).filter((item) => item.id !== shotId)
			this.canvas.elementManager.update(elementId, {
				shots: nextShots,
				height: this.getStoryboardRequiredHeight(element, nextShots.length),
			})
		} finally {
			history?.enable()
			history?.recordHistoryImmediate()
		}
	}

	private updateShot(
		elementId: string,
		shotId: string,
		updater: (shot: StoryboardShot) => StoryboardShot,
	): void {
		const element = this.getStoryboardElement(elementId)
		const content = element ? getActiveContent<StoryboardElementContent>(element) : undefined
		if (!content?.shots) return
		let changed = false
		const shots = content.shots.map((shot) => {
			if (shot.id !== shotId) return shot
			const next = updater(shot)
			changed = next.description !== shot.description
			return changed ? next : shot
		})
		if (changed) this.canvas.elementManager.update(elementId, { shots })
	}

	private updateModel(elementId: string, modelId: string, models: ImageModelItem[]): void {
		const element = this.getStoryboardElement(elementId)
		const model = models.find((item) => item.model_id === modelId)
		const content = element ? getActiveContent<StoryboardElementContent>(element) : undefined
		if (!element || !model || content?.generationConfig?.model_id === modelId) return

		const current = content?.generationConfig
		const sizes = model.image_size_config?.sizes ?? []
		const preferredScale = getDefaultResolutionForModel(model)
		const currentAspect = current?.image_generation_config?.aspect_ratio
		const selectedSize = findBestSizeForResolution(sizes, preferredScale, currentAspect)
		const defaults = buildDefaultImageGenerationConfig(getImageGenerationSettings(model))
		const imageGenerationConfig = {
			...defaults,
			...(selectedSize?.label ? { aspect_ratio: selectedSize.label } : {}),
		}
		this.updateGenerationConfig(elementId, {
			model_id: model.model_id,
			size: selectedSize?.value,
			resolution: selectedSize?.scale ?? preferredScale,
			image_generation_config:
				Object.keys(imageGenerationConfig).length > 0 ? imageGenerationConfig : undefined,
		})
	}

	private updateSize(elementId: string, size: ImageSizeOption): void {
		const element = this.getStoryboardElement(elementId)
		if (!element) return
		const current = getActiveContent<StoryboardElementContent>(element)?.generationConfig ?? {}
		this.updateGenerationConfig(elementId, {
			...current,
			size: size.value,
			resolution: size.scale ?? current.resolution,
			image_generation_config: {
				...current.image_generation_config,
				aspect_ratio: size.label,
			},
		})
	}

	private updateResolution(
		elementId: string,
		resolution: string,
		model: ImageModelItem | undefined,
	): void {
		const element = this.getStoryboardElement(elementId)
		const content = element ? getActiveContent<StoryboardElementContent>(element) : undefined
		if (!element || content?.generationConfig?.resolution === resolution) return
		const current = content?.generationConfig ?? {}
		const currentAspect = current.image_generation_config?.aspect_ratio
		const sizes = (model?.image_size_config?.sizes ?? []).filter(
			(size) => size.scale === resolution,
		)
		const selectedSize = findBestSizeForResolution(sizes, resolution, currentAspect)
		this.updateGenerationConfig(elementId, {
			...current,
			resolution,
			size: selectedSize?.value ?? current.size,
			image_generation_config: selectedSize?.label
				? { ...current.image_generation_config, aspect_ratio: selectedSize.label }
				: current.image_generation_config,
		})
	}

	private updateGenerationConfig(
		elementId: string,
		generationConfig: StoryboardGenerationConfig,
	): void {
		const element = this.getStoryboardElement(elementId)
		const current = element
			? getActiveContent<StoryboardElementContent>(element)?.generationConfig
			: undefined
		if (JSON.stringify(current ?? {}) === JSON.stringify(generationConfig)) return
		this.canvas.elementManager.update(elementId, { generationConfig })
	}

	private withImageModels(
		binding: StoryboardControlBinding,
		callback: (models: ImageModelItem[], element: StoryboardElement) => void,
	): void {
		const run = (models: ImageModelItem[]) => {
			if (this.destroyed || !binding.node.getStage() || !this.canActivate(binding)) return
			const element = this.getStoryboardElement(binding.elementId)
			if (element) callback(models, element)
		}
		if (this.imageModels) {
			run(this.imageModels)
			return
		}
		void this.getImageModels().then(run)
	}

	private getImageModels(): Promise<ImageModelItem[]> {
		if (this.imageModels) return Promise.resolve(this.imageModels)
		if (this.imageModelsPromise) return this.imageModelsPromise
		const getImageModelList = this.canvas.magicConfigManager.config?.methods?.getImageModelList
		if (!getImageModelList) {
			this.imageModels = []
			return Promise.resolve([])
		}

		this.imageModelsPromise = Promise.resolve()
			.then(() => getImageModelList())
			.then((models) => {
				const unique = new Map<string, ImageModelItem>()
				models.forEach((model) => {
					if (model.model_status !== "normal" || !model.model_id) return
					const existing = unique.get(model.model_id)
					if (
						!existing ||
						(!existing.image_size_config?.sizes?.length &&
							Boolean(model.image_size_config?.sizes?.length))
					) {
						unique.set(model.model_id, model)
					}
				})
				this.imageModels = Array.from(unique.values())
				this.rerenderStoryboardElements()
				return this.imageModels
			})
			.catch(() => {
				this.imageModelsPromise = null
				return []
			})
		return this.imageModelsPromise
	}

	/**
	 * 获取模型图标地址。图标属于运行时模型元数据，不写入分镜 DSL。
	 */
	public getModelIcon(modelId?: string): string | undefined {
		if (!modelId) return undefined
		return (
			this.imageModels?.find((model) => model.model_id === modelId)?.model_icon || undefined
		)
	}

	private rerenderStoryboardElements(): void {
		if (this.destroyed) return
		const elementManager = this.canvas.elementManager
		if (
			typeof elementManager.getAllElementIds !== "function" ||
			typeof elementManager.getElementInstance !== "function"
		) {
			return
		}

		elementManager.getAllElementIds().forEach((elementId) => {
			if (this.destroyed) return
			const element = elementManager.getElementData(elementId)
			if (element?.type !== ElementTypeEnum.Storyboard) return
			elementManager.getElementInstance(elementId)?.rerender()
		})
		this.canvas.contentLayer.batchDraw()
	}

	private findSelectedModel(
		models: ImageModelItem[],
		element: StoryboardElement,
	): ImageModelItem | undefined {
		return (
			models.find(
				(model) =>
					model.model_id ===
					getActiveContent<StoryboardElementContent>(element)?.generationConfig?.model_id,
			) ?? models[0]
		)
	}

	private buildModelOptionGroups(models: ImageModelItem[]): StoryboardSelectGroup[] {
		const groupMap = new Map<
			string,
			StoryboardSelectGroup & { sort: number; source: "official" | "custom" }
		>()

		models.forEach((model) => {
			const groupId = model.model_group?.id || model.group_id || model.model_id
			const groupLabel = model.model_group?.name || this.getText("imageEditor.model", "模型")
			const groupSource = model.model_group?.source || model.model_source || "official"
			let group = groupMap.get(groupId)
			if (!group) {
				group = {
					id: groupId,
					label: groupLabel,
					icon: model.model_group?.icon,
					sort: model.model_group?.sort ?? Number.MAX_SAFE_INTEGER,
					source: groupSource,
					options: [],
				}
				groupMap.set(groupId, group)
			}
			group.options.push({
				label: model.model_name || model.model_id,
				value: model.model_id,
			})
		})

		return Array.from(groupMap.values())
			.sort((groupA, groupB) => {
				if (groupA.source !== groupB.source) {
					return groupA.source === "custom" ? -1 : 1
				}
				if (groupA.sort !== groupB.sort) return groupA.sort - groupB.sort
				return groupA.label.localeCompare(groupB.label)
			})
			.map((group) => ({
				id: group.id,
				label: group.label,
				icon: group.icon,
				options: group.options,
			}))
	}

	private ensureCurrentOption(
		options: StoryboardSelectOption[],
		value: string | undefined,
		label = value,
	): void {
		if (!value || options.some((option) => option.value === value)) return
		options.unshift({ value, label: label || value })
	}

	private getStoryboardElement(elementId: string): StoryboardElement | null {
		const element = this.canvas.elementManager.getElementData(elementId)
		return element?.type === ElementTypeEnum.Storyboard ? element : null
	}

	private getStoryboardRequiredHeight(element: StoryboardElement, shotCount?: number): number {
		return resolveStoryboardRequiredHeight(
			element.width ?? STORYBOARD_CONFIG.DEFAULT_WIDTH,
			shotCount ?? getActiveContent<StoryboardElementContent>(element)?.shots?.length ?? 0,
			resolveStoryboardReferenceImages(this.canvas, element.id).length,
		)
	}

	private syncStoryboardHeights(): void {
		if (this.destroyed) return
		const elementManager = this.canvas.elementManager
		if (typeof elementManager.getAllElementIds !== "function") return

		elementManager.getAllElementIds().forEach((elementId) => {
			const element = this.getStoryboardElement(elementId)
			if (!element) return
			const requiredHeight = this.getStoryboardRequiredHeight(element)
			if (element.height === requiredHeight) return
			this.canvas.elementManager.update(
				element.id,
				{ height: requiredHeight },
				{ silent: true },
			)
		})
	}

	private canActivate(binding: StoryboardControlBinding): boolean {
		if (this.destroyed || this.isDisabled(binding) || !this.canInteractWithElement(binding))
			return false
		return true
	}

	private canInteractWithElement(binding: StoryboardControlBinding): boolean {
		if (this.destroyed) return false
		if (binding.elementInteraction)
			return binding.elementInteraction.canInteract(binding.action)
		const element = this.getStoryboardElement(binding.elementId)
		if (!element) return false
		if (binding.action.type !== "preview-reference-image") {
			if (!this.canvas.permissionManager.can("document.write") || element.locked) return false
			if (!this.canvas.permissionManager.canUseSelectionToolAffordance()) return false
		}
		return true
	}

	private ensureElementSelected(binding: StoryboardControlBinding): void {
		if (binding.elementInteraction?.prepare) {
			binding.elementInteraction.prepare(binding.action)
			return
		}
		if (binding.action.type === "preview-reference-image") return
		if (this.isSelectedBinding(binding)) return
		this.canvas.selectionManager.replaceSelection?.([binding.elementId])
	}

	private isSelectedBinding(binding: StoryboardControlBinding): boolean {
		return (
			this.canvas.selectionManager.getSelectionCount() === 1 &&
			this.canvas.selectionManager.isSelected(binding.elementId)
		)
	}

	private isDisabled(binding: StoryboardControlBinding): boolean {
		if ("disabled" in binding.action && binding.action.disabled === true) return true
		if (binding.action.type === "generate-shot") {
			return this.isShotGenerationDisabled(binding.elementId, binding.action.shotId)
		}
		if (binding.action.type === "generate-all") {
			return this.isAllGenerationDisabled(binding.elementId)
		}

		if (
			binding.action.type !== "select-aspect-ratio" &&
			binding.action.type !== "select-resolution"
		) {
			return false
		}

		return this.isImageParameterUnavailable(binding.elementId, binding.action.type)
	}

	private isShotGenerationDisabled(elementId: string, shotId: string): boolean {
		const element = this.getStoryboardElement(elementId)
		const content = element ? getActiveContent<StoryboardElementContent>(element) : undefined
		const shot = content?.shots?.find((item) => item.id === shotId)
		if (!element || !shot || !this.getShotDescription(elementId, shot).trim()) return true
		if (!this.canvas.magicConfigManager.config?.methods?.generateImage) return true
		if (!this.imageModels || this.imageModels.length === 0) return true
		if (!this.findSelectedModel(this.imageModels, element)?.model_id) return true
		if (this.generationController.isShotGenerating(elementId, shotId)) return true

		if (shot.outputImageElementId) {
			const outputElement = this.canvas.elementManager.getElementData(
				shot.outputImageElementId,
			)
			if (outputElement?.type === ElementTypeEnum.Image) {
				if (hasProcessingImageContent(outputElement)) return true
				const outputInstance = this.canvas.elementManager.getElementInstance(
					shot.outputImageElementId,
				)
				if (outputInstance instanceof ImageElement && outputInstance.isImageGenerating()) {
					return true
				}
			}
		}

		return false
	}

	private isAllGenerationDisabled(elementId: string): boolean {
		const element = this.getStoryboardElement(elementId)
		const shots = element
			? (getActiveContent<StoryboardElementContent>(element)?.shots ?? [])
			: []
		if (shots.length === 0 || this.generationController.isAnyGenerating(elementId)) return true
		return shots.some((shot) => this.isShotGenerationDisabled(elementId, shot.id))
	}

	private getShotDescription(elementId: string, shot: StoryboardShot): string {
		if (
			this.descriptionDraft?.elementId === elementId &&
			this.descriptionDraft.shotId === shot.id
		) {
			return this.descriptionDraft.value
		}
		return shot.description
	}

	private updateDescriptionDraft(elementId: string, shotId: string, value: string): void {
		this.descriptionDraft = { elementId, shotId, value }
		this.refreshGenerationControlStates(elementId)
	}

	private clearDescriptionDraft(elementId: string, shotId: string): void {
		if (
			this.descriptionDraft?.elementId !== elementId ||
			this.descriptionDraft.shotId !== shotId
		) {
			return
		}
		this.descriptionDraft = null
		this.refreshGenerationControlStates(elementId)
	}

	private refreshGenerationControlStates(elementId: string): void {
		this.bindings.forEach((binding) => {
			if (binding.elementId !== elementId || this.editingBinding === binding) return
			if (binding.action.type !== "generate-shot" && binding.action.type !== "generate-all") {
				return
			}
			binding.applyState(
				this.isDisabled(binding)
					? "disabled"
					: binding.hovered && this.canvas.deviceInfo.input.hover
						? "hover"
						: "idle",
			)
		})
		this.canvas.contentLayer.batchDraw()
	}

	private isGenerationAction(action: StoryboardControlAction): boolean {
		return action.type === "generate-shot" || action.type === "generate-all"
	}

	private shouldCommitEditorBeforeActivate(action: StoryboardControlAction): boolean {
		return (
			this.isGenerationAction(action) ||
			action.type === "add-shot" ||
			action.type === "delete-shot"
		)
	}

	/**
	 * 比例/分辨率是否有可编辑选项由当前模型运行时能力决定。
	 *
	 * 模型列表尚未加载完成时先按 disabled 处理，避免用户看到可 hover 的
	 * 假交互；列表加载完成后会触发 Storyboard 重绘并重新绑定控制器。
	 */
	private isImageParameterUnavailable(
		elementId: string,
		parameter: "select-aspect-ratio" | "select-resolution",
	): boolean {
		if (!this.imageModels) return true

		const element = this.getStoryboardElement(elementId)
		if (!element) return true
		const configuredModelId =
			getActiveContent<StoryboardElementContent>(element)?.generationConfig?.model_id
		const model = configuredModelId
			? this.imageModels.find((item) => item.model_id === configuredModelId)
			: undefined
		if (!model) return true

		if (parameter === "select-resolution") {
			return buildSupportedResolutionOptions(model).length === 0
		}

		// 能力判断使用模型的完整尺寸集合，而不是当前配置中的 resolution。
		// 这样历史配置失效时仍不会错误地把一个实际支持比例的模型禁用。
		return buildSupportedAspectRatioOptions(model, buildImageSelectValue).length === 0
	}

	private getCursor(binding: StoryboardControlBinding): "text" | "pointer" {
		return binding.action.type === "edit-description" ? "text" : "pointer"
	}

	private isMultiTouchEvent(event: Konva.KonvaEventObject<Event>): boolean {
		const nativeEvent = event.evt as Event & { touches?: ArrayLike<unknown> }
		return (nativeEvent.touches?.length ?? 0) > 1
	}

	private resetPressedStates(): void {
		this.activeBinding = null
		this.bindings.forEach((binding) => {
			binding.activationPending = false
			if (!binding.node.getStage() || this.editingBinding === binding) return
			binding.applyState(this.isDisabled(binding) ? "disabled" : "idle")
		})
		this.canvas.contentLayer.batchDraw()
		this.restoreCursorIfIdle()
	}

	private resetTransientState(options: { cancelEditor: boolean }): void {
		if (options.cancelEditor) this.overlayHost.cancel()
		this.editingBinding = null
		this.resetPressedStates()
	}

	private restoreCursorIfIdle(): void {
		if (this.activeBinding || Array.from(this.bindings).some((binding) => binding.hovered))
			return
		this.canvas.cursorManager.restoreToolCursor()
	}

	private getText(key: string, fallback: string): string {
		return this.canvas.t ? this.canvas.t(key, fallback) : fallback
	}
}
