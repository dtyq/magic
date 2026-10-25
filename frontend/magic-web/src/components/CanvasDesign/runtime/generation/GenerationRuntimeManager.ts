import type {
	GenerateImageRequest,
	GenerateVideoRequest,
	ImageGenerationTaskMeta,
} from "../../public/magic-types"
import type { Canvas } from "../core/Canvas"
import { generateUUID } from "../shared/ids"

export type GenerationOperation =
	| "image-generate"
	| "image-batch"
	| "image-high"
	| "image-remove-background"
	| "image-eraser"
	| "image-extend"
	| "video-generate"

export type GenerationAttemptPhase = "preparing" | "submitting"

export type GenerationFailurePolicy = "restore-existing" | "promote-empty" | "remove-placeholder"

export interface GenerationAttemptTarget {
	elementId: string
	contentId?: string
	/** 提交时的 active，用于结果完成后判断用户是否在生成期间手动切版 */
	activeContentIdAtSubmission?: string
	outputIndex?: number
	generateImageRequest?: GenerateImageRequest
	generateVideoRequest?: GenerateVideoRequest
	imageGenerationTaskMeta?: ImageGenerationTaskMeta
}

export interface GenerationAttempt {
	startedAt: number
	attemptId: string
	operation: GenerationOperation
	originElementId?: string
	targets: GenerationAttemptTarget[]
	phase: GenerationAttemptPhase
	failurePolicy: GenerationFailurePolicy
}

export interface GenerationRuntimeTargetState extends GenerationAttemptTarget {
	startedAt: number
	attemptId: string
	operation: GenerationOperation
	originElementId?: string
	phase: GenerationAttemptPhase
	failurePolicy: GenerationFailurePolicy
}

export type GenerationSubmissionPhase = "preparing" | "validating" | "submitting"

export interface GenerationSubmissionRuntimeState {
	elementId: string
	contentId?: string
	submissionId: string
	phase: GenerationSubmissionPhase
	startedAt: number
}

export interface BeginGenerationAttemptOptions {
	attemptId?: string
	operation: GenerationOperation
	originElementId?: string
	targets: GenerationAttemptTarget[]
	phase?: GenerationAttemptPhase
	failurePolicy: GenerationFailurePolicy
}

/**
 * Canvas 级生成任务运行时状态。
 *
 * 这里保存后端尚未确认的生成尝试和编辑器提交阶段，绝不修改 Element data，也不会进入
 * DSL、历史或剪贴板。
 * 未绑定 Content 的历史/批量操作仍按元素聚合；绑定 Content 的图片、视频任务则按
 * elementId + contentId 隔离，允许同一元素的多个 Content 同时提交，并由各自的
 * contentId 防止异步结果串写。
 */
export class GenerationRuntimeManager {
	private attempts = new Map<string, GenerationAttempt>()
	private targetStates = new Map<string, GenerationRuntimeTargetState>()
	private latestTargetKeyByElementId = new Map<string, string>()
	private submissionStates = new Map<string, GenerationSubmissionRuntimeState>()
	private latestSubmissionKeyByElementId = new Map<string, string>()
	private revisionsByElementId = new Map<string, number>()
	private listeners = new Map<string, Set<() => void>>()
	private unsubscribers: Array<() => void> = []

	constructor(options?: { canvas?: Canvas }) {
		const canvas = options?.canvas
		if (!canvas) return

		this.unsubscribers.push(
			canvas.eventEmitter.on("element:deleted", ({ data }) => {
				this.clearElement(data.elementId)
			}),
			canvas.eventEmitter.on("document:loaded", () => {
				this.clear()
			}),
			canvas.eventEmitter.on("document:restored", () => {
				this.clear()
			}),
			canvas.eventEmitter.on("canvas:clear", () => {
				this.clear()
			}),
		)
	}

	public beginAttempt(options: BeginGenerationAttemptOptions): string {
		if (options.targets.length === 0) {
			throw new Error("Generation attempt must contain at least one target")
		}

		const targetKeys = new Set<string>()
		for (const target of options.targets) {
			const targetKey = this.getTargetKey(target.elementId, target.contentId)
			if (targetKeys.has(targetKey)) {
				throw new Error(`Duplicate generation target ${targetKey}`)
			}
			if (target.contentId !== undefined && this.targetStates.has(targetKey)) {
				throw new Error(`Generation target ${targetKey} already has an active attempt`)
			}
			targetKeys.add(targetKey)
		}

		const attemptId = options.attemptId ?? generateUUID()
		if (this.attempts.has(attemptId)) {
			throw new Error(`Generation attempt ${attemptId} already exists`)
		}

		const attempt: GenerationAttempt = {
			startedAt: Date.now(),
			attemptId,
			operation: options.operation,
			originElementId: options.originElementId,
			targets: options.targets.map((target) => ({ ...target })),
			phase: options.phase ?? "submitting",
			failurePolicy: options.failurePolicy,
		}

		for (const target of attempt.targets) {
			this.detachTargetFromCurrentAttempt(target)
		}

		this.attempts.set(attemptId, attempt)
		for (const target of attempt.targets) {
			const targetKey = this.getTargetKey(target.elementId, target.contentId)
			this.targetStates.set(targetKey, this.createTargetState(attempt, target))
			this.latestTargetKeyByElementId.set(target.elementId, targetKey)
			this.notifyElement(target.elementId)
		}

		return attemptId
	}

	public updateAttemptPhase(attemptId: string, phase: GenerationAttemptPhase): boolean {
		const attempt = this.attempts.get(attemptId)
		if (!attempt || attempt.phase === phase) return Boolean(attempt)

		attempt.phase = phase
		for (const target of attempt.targets) {
			const targetKey = this.getTargetKey(target.elementId, target.contentId)
			const current = this.targetStates.get(targetKey)
			if (current?.attemptId !== attemptId) continue
			this.targetStates.set(targetKey, this.createTargetState(attempt, target))
			this.notifyElement(target.elementId)
		}
		return true
	}

	public getAttempt(attemptId: string): GenerationAttempt | null {
		return this.attempts.get(attemptId) ?? null
	}

	public getTargetState(
		elementId: string,
		contentId?: string,
	): GenerationRuntimeTargetState | null {
		if (contentId !== undefined) {
			return this.targetStates.get(this.getTargetKey(elementId, contentId)) ?? null
		}
		const targetKey = this.latestTargetKeyByElementId.get(elementId)
		return targetKey ? (this.targetStates.get(targetKey) ?? null) : null
	}

	/** 判断指定 Element/Content 是否存在尚未收口的生成任务。 */
	public hasActiveGeneration(elementId: string, contentId?: string): boolean {
		if (contentId !== undefined) {
			return this.targetStates.has(this.getTargetKey(elementId, contentId))
		}
		return Array.from(this.targetStates.values()).some((state) => state.elementId === elementId)
	}

	/** 返回元素当前所有 Content 目标，避免多版本并发时只读取最后一个 attempt。 */
	public getTargetStates(elementId: string): GenerationRuntimeTargetState[] {
		return Array.from(this.targetStates.values()).filter(
			(state) => state.elementId === elementId,
		)
	}

	/**
	 * Track the UI submission lifecycle before a backend generation task takes
	 * ownership. This state is runtime-only and never enters the Canvas DSL.
	 */
	public beginSubmission(options: {
		elementId: string
		contentId?: string
		phase: GenerationSubmissionPhase
		submissionId?: string
	}): string {
		const targetKey = this.getTargetKey(options.elementId, options.contentId)
		const submissionId = options.submissionId ?? generateUUID()
		// Reinsert a superseded target so element-level reads keep pointing at
		// the newest Content submission instead of the old Map insertion order.
		this.submissionStates.delete(targetKey)
		const state: GenerationSubmissionRuntimeState = {
			elementId: options.elementId,
			...(options.contentId !== undefined ? { contentId: options.contentId } : {}),
			submissionId,
			phase: options.phase,
			startedAt: Date.now(),
		}
		this.submissionStates.set(targetKey, state)
		this.latestSubmissionKeyByElementId.set(options.elementId, targetKey)
		this.notifyElement(options.elementId)
		return submissionId
	}

	public updateSubmissionPhase(submissionId: string, phase: GenerationSubmissionPhase): boolean {
		for (const [targetKey, state] of this.submissionStates) {
			if (state.submissionId !== submissionId || state.phase === phase) continue
			const next = { ...state, phase }
			this.submissionStates.set(targetKey, next)
			this.notifyElement(state.elementId)
			return true
		}
		return false
	}

	public getSubmissionState(
		elementId: string,
		contentId?: string,
	): GenerationSubmissionRuntimeState | null {
		if (contentId !== undefined) {
			return this.submissionStates.get(this.getTargetKey(elementId, contentId)) ?? null
		}
		const targetKey = this.latestSubmissionKeyByElementId.get(elementId)
		return targetKey ? (this.submissionStates.get(targetKey) ?? null) : null
	}

	/** Clear only the submission identified by its token, preserving a newer one. */
	public clearSubmission(submissionId: string): boolean {
		for (const [targetKey, state] of this.submissionStates) {
			if (state.submissionId !== submissionId) continue
			this.submissionStates.delete(targetKey)
			this.refreshLatestSubmissionKey(state.elementId)
			this.notifyElement(state.elementId)
			return true
		}
		return false
	}

	public getComplianceState(
		elementId: string,
		contentId?: string,
	): GenerationSubmissionRuntimeState | null {
		const state = this.getSubmissionState(elementId, contentId)
		return state?.phase === "validating" ? state : null
	}

	public isCurrent(attemptId: string, elementId?: string, contentId?: string): boolean {
		if (elementId) {
			const targetKey = this.getTargetKey(elementId, contentId)
			const current = this.targetStates.get(targetKey)
			return (
				current?.attemptId === attemptId &&
				(contentId === undefined || current.contentId === contentId)
			)
		}
		return this.attempts.has(attemptId)
	}

	public subscribeElement(elementId: string, listener: () => void): () => void {
		let listeners = this.listeners.get(elementId)
		if (!listeners) {
			listeners = new Set()
			this.listeners.set(elementId, listeners)
		}
		listeners.add(listener)

		return () => {
			const current = this.listeners.get(elementId)
			current?.delete(listener)
			if (current?.size === 0) {
				this.listeners.delete(elementId)
			}
		}
	}

	public getRevision(elementId: string): number {
		return this.revisionsByElementId.get(elementId) ?? 0
	}

	public completeAttempt(attemptId: string): GenerationAttempt | null {
		return this.clearAttempt(attemptId)
	}

	public failAttempt(attemptId: string): GenerationAttempt | null {
		return this.clearAttempt(attemptId)
	}

	/**
	 * 清理单个 Content 的生成目标。
	 *
	 * 版本被用户删除时，不能只依赖轮询管理器从 DSL 中发现目标消失；
	 * ElementToolContext 还会读取这里的运行时 target 状态决定删除按钮是否可见。
	 */
	public clearTarget(elementId: string, contentId?: string): void {
		const targetKey = this.getTargetKey(elementId, contentId)
		const current = this.targetStates.get(targetKey)
		const submissionState = this.submissionStates.get(targetKey)
		if (!current && !submissionState) return

		if (current) {
			this.targetStates.delete(targetKey)
			const attempt = this.attempts.get(current.attemptId)
			if (attempt) {
				attempt.targets = attempt.targets.filter(
					(target) => this.getTargetKey(target.elementId, target.contentId) !== targetKey,
				)
				if (attempt.targets.length === 0) this.attempts.delete(current.attemptId)
			}
		}
		if (submissionState) this.submissionStates.delete(targetKey)
		this.refreshLatestTargetKey(elementId)
		this.refreshLatestSubmissionKey(elementId)
		this.notifyElement(elementId)
	}

	public clearElement(elementId: string): void {
		const targetEntries = Array.from(this.targetStates.entries()).filter(
			([, state]) => state.elementId === elementId,
		)
		const submissionEntries = Array.from(this.submissionStates.entries()).filter(
			([, state]) => state.elementId === elementId,
		)
		if (targetEntries.length === 0 && submissionEntries.length === 0) return

		const attemptIds = new Set(targetEntries.map(([, state]) => state.attemptId))
		targetEntries.forEach(([targetKey]) => this.targetStates.delete(targetKey))
		this.latestTargetKeyByElementId.delete(elementId)
		this.revisionsByElementId.delete(elementId)
		attemptIds.forEach((attemptId) => {
			const attempt = this.attempts.get(attemptId)
			if (!attempt) return
			attempt.targets = attempt.targets.filter((target) => target.elementId !== elementId)
			if (attempt.targets.length === 0) {
				this.attempts.delete(attemptId)
			}
		})
		submissionEntries.forEach(([targetKey]) => this.submissionStates.delete(targetKey))
		this.latestSubmissionKeyByElementId.delete(elementId)
		this.notifyElement(elementId)
	}

	public clear(): void {
		const elementIds = Array.from(
			new Set([
				...Array.from(this.targetStates.values()).map((state) => state.elementId),
				...Array.from(this.submissionStates.values()).map((state) => state.elementId),
			]),
		)
		this.attempts.clear()
		this.targetStates.clear()
		this.latestTargetKeyByElementId.clear()
		this.submissionStates.clear()
		this.latestSubmissionKeyByElementId.clear()
		this.revisionsByElementId.clear()
		elementIds.forEach((elementId) => this.notifyElement(elementId))
	}

	public destroy(): void {
		this.unsubscribers.forEach((unsubscribe) => unsubscribe())
		this.unsubscribers = []
		this.attempts.clear()
		this.targetStates.clear()
		this.latestTargetKeyByElementId.clear()
		this.submissionStates.clear()
		this.latestSubmissionKeyByElementId.clear()
		this.revisionsByElementId.clear()
		this.listeners.clear()
	}

	private createTargetState(
		attempt: GenerationAttempt,
		target: GenerationAttemptTarget,
	): GenerationRuntimeTargetState {
		return {
			startedAt: attempt.startedAt,
			...target,
			attemptId: attempt.attemptId,
			operation: attempt.operation,
			originElementId: attempt.originElementId,
			phase: attempt.phase,
			failurePolicy: attempt.failurePolicy,
		}
	}

	private detachTargetFromCurrentAttempt(target: GenerationAttemptTarget): void {
		const targetKey = this.getTargetKey(target.elementId, target.contentId)
		const current = this.targetStates.get(targetKey)
		if (!current) return

		const previousAttempt = this.attempts.get(current.attemptId)
		if (previousAttempt) {
			previousAttempt.targets = previousAttempt.targets.filter(
				(candidate) =>
					this.getTargetKey(candidate.elementId, candidate.contentId) !== targetKey,
			)
			if (previousAttempt.targets.length === 0) {
				this.attempts.delete(previousAttempt.attemptId)
			}
		}
		this.targetStates.delete(targetKey)
		this.refreshLatestTargetKey(target.elementId)
	}

	private clearAttempt(attemptId: string): GenerationAttempt | null {
		const attempt = this.attempts.get(attemptId)
		if (!attempt) return null

		this.attempts.delete(attemptId)
		for (const target of attempt.targets) {
			const targetKey = this.getTargetKey(target.elementId, target.contentId)
			const current = this.targetStates.get(targetKey)
			if (current?.attemptId !== attemptId) continue
			this.targetStates.delete(targetKey)
			this.refreshLatestTargetKey(target.elementId)
			this.notifyElement(target.elementId)
		}
		return attempt
	}

	private notifyElement(elementId: string): void {
		this.revisionsByElementId.set(elementId, this.getRevision(elementId) + 1)
		this.listeners.get(elementId)?.forEach((listener) => listener())
	}

	private getTargetKey(elementId: string, contentId?: string): string {
		return `${elementId}\u0000${contentId ?? ""}`
	}

	private refreshLatestTargetKey(elementId: string): void {
		const latest = Array.from(this.targetStates.entries()).reduce<
			[string, GenerationRuntimeTargetState] | null
		>((current, entry) => {
			if (entry[1].elementId !== elementId) return current
			return entry
		}, null)
		if (latest) {
			this.latestTargetKeyByElementId.set(elementId, latest[0])
		} else {
			this.latestTargetKeyByElementId.delete(elementId)
		}
	}

	private refreshLatestSubmissionKey(elementId: string): void {
		const latest = Array.from(this.submissionStates.entries()).reduce<
			[string, GenerationSubmissionRuntimeState] | null
		>((current, entry) => {
			if (entry[1].elementId !== elementId) return current
			return entry
		}, null)
		if (latest) {
			this.latestSubmissionKeyByElementId.set(elementId, latest[0])
		} else {
			this.latestSubmissionKeyByElementId.delete(elementId)
		}
	}
}
