import type { Canvas } from "../../core/Canvas"
import {
	getCanvasHostResourceReferenceIdentity,
	type CanvasResourceReferenceResolverChangeOptions,
} from "../../shared/path/canvasResourcePath"
import { getImageResourceMaxEdge } from "../visibility/CanvasMediaViewingPolicy"
import type {
	ImageResourceLoadPriority,
	ImageResourceVariant,
	LoadedResource,
} from "./ImageResourceManager"

export type ImagePresentationPhase = "moving" | "idle"

export interface ImagePresentationTarget {
	elementId: string
	path: string
	variant: ImageResourceVariant
	priority: ImageResourceLoadPriority
	distanceToViewportCenter: number
}

export interface ImagePresentationSnapshot {
	targetCount: number
	pendingCount: number
	targetReplaceCount: number
	enqueuedCount: number
	pendingReplaceCount: number
	staleDropCount: number
	movingUpgradeDeferredCount: number
	appliedLowCount: number
	appliedPreviewCount: number
	appliedFullCount: number
	movingAppliedLowCount: number
	movingAppliedPreviewCount: number
	movingAppliedFullCount: number
	idleAppliedLowCount: number
	idleAppliedPreviewCount: number
	idleAppliedFullCount: number
	flushCount: number
	peakPendingCount: number
	drawRequestCount: number
}

interface InternalPresentationTarget extends ImagePresentationTarget {
	canonicalPath: string
	generation: number
}

interface PendingPresentationTask {
	elementId: string
	canonicalPath: string
	targetGeneration: number
	consumer: ImagePresentationConsumer
	resource: LoadedResource
	priority: ImageResourceLoadPriority
	distanceToViewportCenter: number
	sequence: number
}

interface ImagePresentationConsumer {
	getDisplayResourceVariant(): ImageResourceVariant | undefined
	isImageLoaded(): boolean
	applyPresentedResource(resource: LoadedResource, targetVariant: ImageResourceVariant): boolean
}

type FrameHandle = number | ReturnType<typeof globalThis.setTimeout>

const PRIORITY_RANK: Record<ImageResourceLoadPriority, number> = {
	critical: 0,
	visible: 1,
	near: 2,
	background: 3,
}

function getVariantRank(variant: ImageResourceVariant | undefined): number {
	if (variant === "full") return 2
	if (variant === "preview") return 1
	if (variant === "low") return 0
	return -1
}

function getPresentationPixelBudget(phase: ImagePresentationPhase): number {
	const variant = phase === "moving" ? "low" : "preview"
	const maxEdge = getImageResourceMaxEdge(variant) ?? 1
	return maxEdge * maxEdge
}

function getFrameScheduler(): {
	request: (callback: FrameRequestCallback) => FrameHandle
	cancel: (handle: FrameHandle) => void
} {
	if (typeof requestAnimationFrame === "function") {
		return {
			request: (callback) => requestAnimationFrame(callback),
			cancel: (handle) => {
				if (typeof handle === "number") cancelAnimationFrame(handle)
			},
		}
	}

	return {
		request: (callback) => globalThis.setTimeout(() => callback(Date.now()), 16),
		cancel: (handle) => globalThis.clearTimeout(handle),
	}
}

function createSnapshot(): ImagePresentationSnapshot {
	return {
		targetCount: 0,
		pendingCount: 0,
		targetReplaceCount: 0,
		enqueuedCount: 0,
		pendingReplaceCount: 0,
		staleDropCount: 0,
		movingUpgradeDeferredCount: 0,
		appliedLowCount: 0,
		appliedPreviewCount: 0,
		appliedFullCount: 0,
		movingAppliedLowCount: 0,
		movingAppliedPreviewCount: 0,
		movingAppliedFullCount: 0,
		idleAppliedLowCount: 0,
		idleAppliedPreviewCount: 0,
		idleAppliedFullCount: 0,
		flushCount: 0,
		peakPendingCount: 0,
		drawRequestCount: 0,
	}
}

export class CanvasImagePresentationScheduler {
	private readonly canvas: Canvas
	private readonly targets = new Map<string, InternalPresentationTarget>()
	private readonly targetElementIdsByPath = new Map<string, Set<string>>()
	private readonly pendingTasks = new Map<string, PendingPresentationTask>()
	private readonly subscriptionCleanups: Array<() => void> = []
	private readonly closedImages = new WeakSet<object>()
	private phase: ImagePresentationPhase = "idle"
	private frameHandle: FrameHandle | null = null
	private generation = 0
	private sequence = 0
	private destroyed = false
	private readonly stats = createSnapshot()

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.subscriptionCleanups = [
			this.canvas.eventEmitter.on("resource:image:loaded", ({ data }) => {
				this.enqueueForPath(data.path, data.resource)
			}),
			this.canvas.eventEmitter.on("resource:image:display-loaded", ({ data }) => {
				this.enqueueForElement(data.elementId, data.path, data.resource)
			}),
			this.canvas.eventEmitter.on("resource:image:will-close", ({ data }) => {
				this.closedImages.add(data.image)
				this.pendingTasks.forEach((task, elementId) => {
					if (task.resource.image === data.image) this.dropPendingTask(elementId)
				})
				this.updateCurrentCounts()
			}),
		]
	}

	public replaceTargets(targets: ImagePresentationTarget[], phase: ImagePresentationPhase): void {
		if (this.destroyed) return
		const phaseChanged = this.phase !== phase
		this.phase = phase
		const presentationChangedElementIds = new Set<string>()
		const nextTargetElementIds = new Set<string>()

		// Generation follows presentation semantics, while priority/distance only reorder a
		// still-valid task. This avoids invalidating every pending item on each pan tick.
		targets.forEach((target) => {
			nextTargetElementIds.add(target.elementId)
			const canonicalPath = this.canonicalPath(target.path)
			const current = this.targets.get(target.elementId)
			const presentationChanged =
				phaseChanged ||
				!current ||
				current.canonicalPath !== canonicalPath ||
				current.variant !== target.variant
			const targetChanged =
				presentationChanged ||
				current?.priority !== target.priority ||
				current?.distanceToViewportCenter !== target.distanceToViewportCenter
			const generation = presentationChanged ? ++this.generation : (current?.generation ?? 0)
			if (targetChanged && current) this.stats.targetReplaceCount += 1
			if (presentationChanged) presentationChangedElementIds.add(target.elementId)

			if (current && !presentationChanged) {
				// Pan/scale usually changes only priority and distance. Keep the target object
				// stable so high-frequency viewport refreshes do not create avoidable garbage.
				current.path = target.path
				current.priority = target.priority
				current.distanceToViewportCenter = target.distanceToViewportCenter
			} else {
				const nextTarget = {
					...target,
					canonicalPath,
					generation,
				}
				if (!current || current.canonicalPath !== canonicalPath) {
					if (current) this.removeTargetFromPathIndex(current)
					this.addTargetToPathIndex(nextTarget)
				}
				this.targets.set(target.elementId, nextTarget)
			}
			if (!presentationChanged) {
				const pendingTask = this.pendingTasks.get(target.elementId)
				if (pendingTask) {
					pendingTask.priority = target.priority
					pendingTask.distanceToViewportCenter = target.distanceToViewportCenter
				}
			}
		})

		this.targets.forEach((target, elementId) => {
			if (nextTargetElementIds.has(elementId)) return
			this.dropPendingTask(elementId)
			this.targets.delete(elementId)
			this.removeTargetFromPathIndex(target)
		})
		presentationChangedElementIds.forEach((elementId) => {
			const target = this.targets.get(elementId)
			if (target) this.enqueueBestCachedResource(target)
		})
		this.updateCurrentCounts()
	}

	public removeTarget(elementId: string): void {
		if (this.destroyed) return
		const target = this.targets.get(elementId)
		if (!target) return
		this.targets.delete(elementId)
		this.dropPendingTask(elementId)
		this.removeTargetFromPathIndex(target)
		this.updateCurrentCounts()
	}

	public handleResourceReferenceResolverChanged(
		options?: CanvasResourceReferenceResolverChangeOptions,
	): void {
		if (this.destroyed) return

		const changedResourceIdentities = options?.changedResourceIdentities
		if (!changedResourceIdentities) this.targetElementIdsByPath.clear()
		this.targets.forEach((target, elementId) => {
			const canonicalPath = this.canonicalPath(target.path)
			if (
				changedResourceIdentities &&
				!changedResourceIdentities.has(target.canonicalPath) &&
				!changedResourceIdentities.has(canonicalPath)
			) {
				return
			}
			if (target.canonicalPath !== canonicalPath) {
				this.removeTargetFromPathIndex(target)
				target.canonicalPath = canonicalPath
				target.generation = ++this.generation
				this.dropPendingTask(elementId)
			}
			this.addTargetToPathIndex(target)
			this.enqueueBestCachedResource(target)
		})
		this.updateCurrentCounts()
	}

	public getSnapshot(): ImagePresentationSnapshot {
		this.updateCurrentCounts()
		return { ...this.stats }
	}

	public destroy(): void {
		if (this.destroyed) return
		this.destroyed = true
		if (this.frameHandle !== null) {
			getFrameScheduler().cancel(this.frameHandle)
			this.frameHandle = null
		}
		this.subscriptionCleanups.forEach((cleanup) => cleanup())
		this.subscriptionCleanups.length = 0
		this.targets.clear()
		this.targetElementIdsByPath.clear()
		this.pendingTasks.clear()
		this.updateCurrentCounts()
	}

	private canonicalPath(path: string): string {
		return getCanvasHostResourceReferenceIdentity(this.canvas, path)
	}

	private addTargetToPathIndex(target: InternalPresentationTarget): void {
		let elementIds = this.targetElementIdsByPath.get(target.canonicalPath)
		if (!elementIds) {
			elementIds = new Set<string>()
			this.targetElementIdsByPath.set(target.canonicalPath, elementIds)
		}
		elementIds.add(target.elementId)
	}

	private removeTargetFromPathIndex(target: InternalPresentationTarget): void {
		const elementIds = this.targetElementIdsByPath.get(target.canonicalPath)
		if (!elementIds) return
		elementIds.delete(target.elementId)
		if (elementIds.size === 0) {
			this.targetElementIdsByPath.delete(target.canonicalPath)
		}
	}

	private enqueueBestCachedResource(target: InternalPresentationTarget): void {
		const variants = this.getFallbackVariants(target.variant)
		for (const variant of variants) {
			const resource = this.canvas.imageResourceManager.peekResource(target.path, { variant })
			if (!resource || resource.variant !== variant) continue
			if (this.enqueueTask(target, resource)) return
		}
	}

	private getFallbackVariants(targetVariant: ImageResourceVariant): ImageResourceVariant[] {
		if (targetVariant === "full") return ["full", "preview", "low"]
		if (targetVariant === "preview") return ["preview", "low"]
		return ["low"]
	}

	private enqueueForPath(path: string, resource: LoadedResource): void {
		if (this.destroyed) return
		const elementIds = this.targetElementIdsByPath.get(this.canonicalPath(path))
		if (!elementIds) return
		elementIds.forEach((elementId) => {
			const target = this.targets.get(elementId)
			if (target) this.enqueueTask(target, resource)
		})
	}

	private enqueueForElement(elementId: string, path: string, resource: LoadedResource): void {
		if (this.destroyed) return
		const target = this.targets.get(elementId)
		if (!target || target.canonicalPath !== this.canonicalPath(path)) return
		this.enqueueTask(target, resource)
	}

	private releaseSupersededLowIfUnused(path: string): void {
		const canonicalPath = this.canonicalPath(path)
		for (const target of this.targets.values()) {
			if (target.canonicalPath !== canonicalPath) continue
			const consumer = this.getConsumer(target.elementId)
			if (target.variant === "low") return
			if (consumer?.getDisplayResourceVariant() === "low") return
		}

		const imageResourceManager = this.canvas.imageResourceManager as {
			releaseSupersededLowIfUnused?: (resourcePath: string) => void
		}
		imageResourceManager.releaseSupersededLowIfUnused?.(path)
	}

	private enqueueTask(target: InternalPresentationTarget, resource: LoadedResource): boolean {
		if (this.closedImages.has(resource.image)) return false
		if (!this.isResourceEligible(target, resource)) return false
		const consumer = this.getConsumer(target.elementId)
		if (!consumer) return false
		const existing = this.pendingTasks.get(target.elementId)
		if (
			existing &&
			existing.targetGeneration === target.generation &&
			(existing.resource.image === resource.image ||
				getVariantRank(existing.resource.variant) > getVariantRank(resource.variant))
		) {
			return false
		}
		if (existing) {
			if (existing.targetGeneration === target.generation) {
				this.stats.pendingReplaceCount += 1
			} else {
				this.stats.staleDropCount += 1
			}
		}
		this.pendingTasks.set(target.elementId, {
			elementId: target.elementId,
			canonicalPath: target.canonicalPath,
			targetGeneration: target.generation,
			consumer,
			resource,
			priority: target.priority,
			distanceToViewportCenter: target.distanceToViewportCenter,
			sequence: ++this.sequence,
		})
		this.stats.enqueuedCount += 1
		this.stats.peakPendingCount = Math.max(this.stats.peakPendingCount, this.pendingTasks.size)
		this.updateCurrentCounts()
		this.scheduleFlush()
		return true
	}

	private isResourceEligible(
		target: InternalPresentationTarget,
		resource: LoadedResource,
	): boolean {
		if (this.closedImages.has(resource.image)) return false
		if (getVariantRank(resource.variant) > getVariantRank(target.variant)) {
			if (this.phase === "moving") this.stats.movingUpgradeDeferredCount += 1
			return false
		}
		const consumer = this.getConsumer(target.elementId)
		if (!consumer) return false
		const displayedVariant = consumer.getDisplayResourceVariant()
		if (this.phase === "moving") {
			// Image-node mutation is the expensive boundary. Keep mounted images untouched while
			// moving; only blank elements may receive a low surface so the viewport is not empty.
			if (!consumer.isImageLoaded()) {
				if (resource.variant === "low") return true
				this.stats.movingUpgradeDeferredCount += 1
				return false
			}
			this.stats.movingUpgradeDeferredCount += 1
			return false
		}
		if (
			displayedVariant &&
			getVariantRank(displayedVariant) > getVariantRank(resource.variant)
		) {
			return false
		}
		return true
	}

	private getConsumer(elementId: string): ImagePresentationConsumer | null {
		const element = this.canvas.elementManager.getElementInstance(elementId) as
			Partial<ImagePresentationConsumer> | undefined
		if (
			!element ||
			typeof element.getDisplayResourceVariant !== "function" ||
			typeof element.isImageLoaded !== "function" ||
			typeof element.applyPresentedResource !== "function"
		) {
			return null
		}
		return element as ImagePresentationConsumer
	}

	private dropPendingTask(elementId: string): void {
		if (!this.pendingTasks.delete(elementId)) return
		this.stats.staleDropCount += 1
	}

	private scheduleFlush(): void {
		if (this.destroyed || this.frameHandle !== null || this.pendingTasks.size === 0) return
		this.frameHandle = getFrameScheduler().request(() => {
			this.frameHandle = null
			this.flush()
		})
	}

	private flush(): void {
		if (this.destroyed || this.pendingTasks.size === 0) return
		this.stats.flushCount += 1
		const pixelBudget = getPresentationPixelBudget(this.phase)
		let consumedPixels = 0
		let attemptedCount = 0
		let appliedCount = 0
		const tasks = Array.from(this.pendingTasks.values()).sort((left, right) => {
			const priorityDiff = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority]
			if (priorityDiff !== 0) return priorityDiff
			const distanceDiff = left.distanceToViewportCenter - right.distanceToViewportCenter
			if (distanceDiff !== 0) return distanceDiff
			return left.sequence - right.sequence
		})

		// A resource larger than the frame budget is still admitted alone, guaranteeing
		// progress without combining multiple expensive Konva image swaps in one frame.
		for (const task of tasks) {
			if (this.closedImages.has(task.resource.image)) {
				this.pendingTasks.delete(task.elementId)
				this.stats.staleDropCount += 1
				continue
			}
			const resourcePixels = Math.max(
				1,
				task.resource.sourceWidth * task.resource.sourceHeight,
			)
			if (attemptedCount > 0 && consumedPixels + resourcePixels > pixelBudget) break
			attemptedCount += 1
			consumedPixels += resourcePixels
			this.pendingTasks.delete(task.elementId)
			const target = this.targets.get(task.elementId)
			if (
				!target ||
				target.generation !== task.targetGeneration ||
				target.canonicalPath !== task.canonicalPath ||
				this.getConsumer(task.elementId) !== task.consumer ||
				!this.isResourceEligible(target, task.resource)
			) {
				this.stats.staleDropCount += 1
				continue
			}
			const consumer = this.getConsumer(task.elementId)
			if (!consumer) {
				this.stats.staleDropCount += 1
				continue
			}
			if (!consumer.applyPresentedResource(task.resource, target.variant)) continue
			if (task.resource.variant !== "low") {
				this.releaseSupersededLowIfUnused(target.path)
			}
			appliedCount += 1
			if (task.resource.variant === "low") this.stats.appliedLowCount += 1
			if (task.resource.variant === "preview") this.stats.appliedPreviewCount += 1
			if (task.resource.variant === "full") this.stats.appliedFullCount += 1
			if (this.phase === "moving") {
				if (task.resource.variant === "low") this.stats.movingAppliedLowCount += 1
				if (task.resource.variant === "preview") this.stats.movingAppliedPreviewCount += 1
				if (task.resource.variant === "full") this.stats.movingAppliedFullCount += 1
			} else {
				if (task.resource.variant === "low") this.stats.idleAppliedLowCount += 1
				if (task.resource.variant === "preview") this.stats.idleAppliedPreviewCount += 1
				if (task.resource.variant === "full") this.stats.idleAppliedFullCount += 1
			}
		}

		if (appliedCount > 0) {
			this.stats.drawRequestCount += 1
			this.canvas.runtimeScheduler.requestLayerDraw("content", {
				source: "CanvasImagePresentationScheduler",
				reason: `present-${this.phase}`,
				priority: this.phase === "moving" ? "input" : "normal",
			})
		}
		this.updateCurrentCounts()
		this.scheduleFlush()
	}

	private updateCurrentCounts(): void {
		this.stats.targetCount = this.targets.size
		this.stats.pendingCount = this.pendingTasks.size
	}
}
