import type Konva from "konva"
import type { Canvas } from "../../core/Canvas"
import { getDownstreamContent } from "../../document/elementContent"
import { ElementTypeEnum, type AudioElementContent } from "../../document/types"
import { collectConnectedVideoEditInputs } from "../connection/connectedInputSources"
import { VideoEditPlaybackManager } from "./VideoEditPlaybackManager"
import type { ElementControlInteractionPolicy } from "../element-control/ElementControlInteractionPolicy"

export type VideoEditControlState = "idle" | "hover" | "pressed" | "disabled"

export type VideoEditControlAction =
	| { type: "toggle-audio-playback"; disabled?: boolean }
	| { type: "merge-videos"; disabled?: boolean }

export interface VideoEditControlBindingOptions {
	elementId: string
	node: Konva.Node
	action: VideoEditControlAction
	applyState: (state: VideoEditControlState) => void
	elementInteraction?: ElementControlInteractionPolicy<VideoEditControlAction>
}

interface VideoEditControlBinding extends VideoEditControlBindingOptions {
	lastActivationAt: number
}

const ACTIVATION_DEDUPLICATION_MS = 320

function stopKonvaEvent(event: Konva.KonvaEventObject<Event>): void {
	event.cancelBubble = true
	event.evt?.stopPropagation()
	event.evt?.stopImmediatePropagation()
}

function isCompositionBusy(elementId: string, canvas: Canvas): boolean {
	const status = canvas.videoCompositionManager?.getSnapshot(elementId).status
	return status === "checking" || status === "preparing" || status === "processing"
}

/** 视频编辑节点底部操作的 Canvas 级交互协调器。 */
export class VideoEditInteractionManager {
	private readonly canvas: Canvas
	private readonly playbackManager: VideoEditPlaybackManager
	private readonly bindings = new Set<VideoEditControlBinding>()
	private eventUnsubscribers: Array<() => void> = []

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.playbackManager =
			this.canvas.videoEditPlaybackManager ??
			new VideoEditPlaybackManager({ canvas: this.canvas })
		this.bindCanvasEvents()
	}

	public bindControl(options: VideoEditControlBindingOptions): () => void {
		const binding: VideoEditControlBinding = { ...options, lastActivationAt: 0 }
		this.bindings.add(binding)

		const handleMouseEnter = () => {
			if (!this.canInteractWithElement(binding)) return
			if (this.isDisabled(binding)) {
				binding.applyState("disabled")
				this.canvas.cursorManager.setTemporary("not-allowed")
				return
			}
			binding.applyState("hover")
			this.canvas.cursorManager.setTemporary("pointer")
			binding.node.getLayer()?.batchDraw()
		}
		const handleMouseLeave = () => {
			binding.applyState(this.isDisabled(binding) ? "disabled" : "idle")
			this.canvas.cursorManager.restoreToolCursor()
			binding.node.getLayer()?.batchDraw()
		}
		const activate = (event: Konva.KonvaEventObject<Event>) => {
			stopKonvaEvent(event)
			if (!this.canInteractWithElement(binding)) {
				binding.applyState("disabled")
				return
			}
			if (this.isDisabled(binding)) {
				binding.applyState("disabled")
				return
			}
			const now = Date.now()
			if (now - binding.lastActivationAt < ACTIVATION_DEDUPLICATION_MS) return
			binding.lastActivationAt = now
			binding.applyState("hover")
			this.activate(binding)
		}
		const handlePressStart = (event: Konva.KonvaEventObject<Event>) => {
			if (!this.canInteractWithElement(binding)) {
				stopKonvaEvent(event)
				binding.applyState("disabled")
				return
			}
			stopKonvaEvent(event)
			this.ensureElementSelected(binding)
			binding.applyState(this.isDisabled(binding) ? "disabled" : "pressed")
			binding.node.getLayer()?.batchDraw()
		}

		binding.node.on("mouseenter", handleMouseEnter)
		binding.node.on("mouseleave", handleMouseLeave)
		binding.node.on("pointerdown mousedown touchstart", handlePressStart)
		binding.node.on("pointerup mouseup touchend click tap", activate)
		binding.applyState(this.isDisabled(binding) ? "disabled" : "idle")

		return () => {
			binding.node.off("mouseenter", handleMouseEnter)
			binding.node.off("mouseleave", handleMouseLeave)
			binding.node.off("pointerdown mousedown touchstart", handlePressStart)
			binding.node.off("pointerup mouseup touchend click tap", activate)
			this.bindings.delete(binding)
		}
	}

	public refreshControlStates(elementId?: string): void {
		this.bindings.forEach((binding) => {
			if (elementId && binding.elementId !== elementId) return
			binding.applyState(this.isDisabled(binding) ? "disabled" : "idle")
			binding.node.getLayer()?.batchDraw()
		})
	}

	public destroy(): void {
		this.eventUnsubscribers.forEach((unsubscribe) => unsubscribe())
		this.eventUnsubscribers = []
		this.bindings.clear()
	}

	private bindCanvasEvents(): void {
		const refresh = () => this.refreshControlStates()
		this.eventUnsubscribers.push(
			this.canvas.eventEmitter.on("element:select", refresh),
			this.canvas.eventEmitter.on("element:deselect", refresh),
			this.canvas.eventEmitter.on("permission:changed", refresh),
			this.canvas.eventEmitter.on("canvas:clear", refresh),
		)
	}

	private activate(binding: VideoEditControlBinding): void {
		if (binding.action.type === "merge-videos") {
			void this.canvas.videoCompositionManager?.start(binding.elementId)
			return
		}
		const audioElementId = collectConnectedVideoEditInputs(
			this.canvas,
			binding.elementId,
		).audioElementId
		if (!audioElementId) return
		const audio = this.canvas.elementManager.getElementData(audioElementId)
		if (!audio || audio.type !== ElementTypeEnum.Audio) return
		const path = getDownstreamContent<AudioElementContent>(audio)?.src
		if (!path) return
		void this.playbackManager.toggle(binding.elementId, { audioElementId, path })
	}

	private isSelectedBinding(binding: VideoEditControlBinding): boolean {
		return this.canvas.selectionManager.getSelectedIds().includes(binding.elementId)
	}

	private canInteractWithElement(binding: VideoEditControlBinding): boolean {
		if (binding.elementInteraction)
			return binding.elementInteraction.canInteract(binding.action)
		const element = this.canvas.elementManager.getElementData(binding.elementId)
		if (!element) return false
		if (binding.action.type === "toggle-audio-playback") return true
		if (!this.canvas.permissionManager.can("document.write") || element.locked) return false
		return this.canvas.permissionManager.canUseSelectionToolAffordance()
	}

	private ensureElementSelected(binding: VideoEditControlBinding): void {
		if (binding.elementInteraction?.prepare) {
			binding.elementInteraction.prepare(binding.action)
			return
		}
		if (
			binding.action.type === "toggle-audio-playback" &&
			!this.canvas.permissionManager.can("interaction.playback")
		)
			return
		if (this.isSelectedBinding(binding)) return
		this.canvas.selectionManager.replaceSelection?.([binding.elementId])
	}

	private isDisabled(binding: VideoEditControlBinding): boolean {
		if (binding.action.disabled || !this.canInteractWithElement(binding)) return true
		return (
			binding.action.type === "merge-videos" &&
			isCompositionBusy(binding.elementId, this.canvas)
		)
	}
}
