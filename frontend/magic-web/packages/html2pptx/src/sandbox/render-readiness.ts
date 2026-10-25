import type { ResourceLoadError } from "../api/options"
import { ExportFidelityError } from "../errors"
import { createAbortError, throwIfAborted, waitForTimeout } from "./abort"
import {
	getEChartsExportTracker,
	refreshEChartsExportInterceptor,
	resizeTrackedEChartsForExport,
	type EChartsExportTracker,
	type ExportTrackedEChartsInstance,
	type ExportTrackedEChartsInstanceLike,
} from "./echarts-export-interceptor"

const DEFAULT_ECHARTS_READY_TIMEOUT_MS = 15_000
const DEFAULT_EXPLICIT_READY_TIMEOUT_MS = 15_000
const DEFAULT_ECHARTS_STABLE_MS = 500
const DEFAULT_ECHARTS_SOURCE_DISCOVERY_MS = 1_000
const READINESS_POLL_MS = 50
const FRAME_FALLBACK_MS = 250
const EXPORT_READY_ATTRIBUTE = "data-magic-export-ready"
const LEGACY_READY_ATTRIBUTE = "data-render-ready"

interface EChartsAnimationLike {
	isFinished?: () => boolean
}

interface ZRenderLike {
	animation?: EChartsAnimationLike
	flush?: () => void
}

interface EChartsInstanceLike {
	isDisposed?: () => boolean
	getZr?: () => ZRenderLike
	on?: (eventName: string, listener: () => void) => void
	off?: (eventName: string, listener: () => void) => void
	/** ECharts 5.x internals used by its own `finished` event guard. */
	__pendingUpdate?: unknown
	_scheduler?: { unfinished?: boolean }
	_pendingActions?: unknown[]
}

interface EChartsNamespaceLike {
	getInstanceByDom?: (element: HTMLElement) => EChartsInstanceLike | undefined
}

interface EChartsWindow extends Window {
	echarts?: EChartsNamespaceLike
}

export interface RenderReadinessCapabilities {
	/** Static source hint only; runtime tracker activity decides whether a chart really exists. */
	echartsSourceHint: boolean
	expectsExplicitRenderReady: boolean
}

export interface WaitForPageRenderReadinessInput extends Pick<
	RenderReadinessCapabilities,
	"echartsSourceHint" | "expectsExplicitRenderReady"
> {
	iframeWindow: Window
	iframeDocument: Document
	signal?: AbortSignal
	onResourceError?: (error: ResourceLoadError) => void
	echartsTimeoutMs?: number
	echartsStableMs?: number
	echartsSourceDiscoveryMs?: number
	explicitReadyTimeoutMs?: number
}

interface TrackedEChartsInstance {
	element: HTMLElement
	instance: EChartsInstanceLike
	finishedEventObserved: boolean
	onRendered: () => void
	onFinished: () => void
}

interface InterceptedEChartsSnapshot {
	tracker: EChartsExportTracker
	instances: ExportTrackedEChartsInstance[]
	instanceSet: Set<ExportTrackedEChartsInstanceLike>
	initCalls: number
	mutationVersion: number
}

type InterceptedEChartsEvaluation =
	| { status: "fallback" | "pending" }
	| { status: "ready"; snapshot: InterceptedEChartsSnapshot }

type InterceptedEChartsReadinessResult =
	| { status: "handled" | "no-chart" }
	| { status: "fallback"; observedECharts: true }

/** Detect opt-in readiness protocols before document.write executes page scripts. */
export function detectRenderReadinessCapabilities(html: string): RenderReadinessCapabilities {
	const inlineScripts = Array.from(
		html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi),
		(match) => stripJavaScriptComments(match[1] ?? ""),
	).join("\n")
	const echartsSourceHint = hasDirectEChartsInitSourceHint(inlineScripts)
	const expectsExplicitRenderReady =
		/<(?:html|body)\b[^>]*\bdata-(?:render-ready|magic-export-ready)\s*=/i.test(html) ||
		/(?:setAttribute\s*\(\s*["'](?:data-render-ready|data-magic-export-ready)["']|dataset\s*\.\s*(?:renderReady|magicExportReady)\s*=)/i.test(
			inlineScripts,
		)
	return {
		echartsSourceHint,
		expectsExplicitRenderReady,
	}
}

/**
 * Wait for page-owned readiness signals and ECharts' real finished state. A fixed delay is not
 * reliable for large exports because CPU pressure and background-frame throttling stretch chart
 * animations well beyond wall-clock assumptions.
 */
export async function waitForPageRenderReadiness({
	iframeWindow,
	iframeDocument,
	echartsSourceHint,
	expectsExplicitRenderReady,
	signal,
	onResourceError,
	echartsTimeoutMs = DEFAULT_ECHARTS_READY_TIMEOUT_MS,
	echartsStableMs = DEFAULT_ECHARTS_STABLE_MS,
	echartsSourceDiscoveryMs = DEFAULT_ECHARTS_SOURCE_DISCOVERY_MS,
	explicitReadyTimeoutMs = DEFAULT_EXPLICIT_READY_TIMEOUT_MS,
}: WaitForPageRenderReadinessInput): Promise<{ handledCanvas: boolean }> {
	throwIfAborted(signal)
	// A real intercepted chart may bypass a generated fixed-delay marker. The static source hint only
	// grants a short discovery window and never makes an ECharts instance mandatory by itself.
	const initialIntercepted = await waitForInterceptedEChartsReadiness({
		iframeWindow,
		iframeDocument,
		echartsSourceHint,
		signal,
		timeoutMs: echartsTimeoutMs,
		discoveryMs: echartsSourceDiscoveryMs,
		stableMs: 0,
		onResourceError,
	})
	if (initialIntercepted.status === "handled") return { handledCanvas: true }

	if (expectsExplicitRenderReady) {
		await waitForExplicitRenderReady({
			iframeWindow,
			iframeDocument,
			signal,
			timeoutMs: explicitReadyTimeoutMs,
			onResourceError,
		})
		await waitForAnimationFrames(iframeWindow, 2, signal)
		const afterMarkerIntercepted = await waitForInterceptedEChartsReadiness({
			iframeWindow,
			iframeDocument,
			echartsSourceHint: false,
			signal,
			timeoutMs: echartsTimeoutMs,
			discoveryMs: 0,
			stableMs: 0,
			onResourceError,
		})
		if (afterMarkerIntercepted.status === "handled") return { handledCanvas: true }
		const shouldProbeECharts =
			initialIntercepted.status === "fallback" ||
			afterMarkerIntercepted.status === "fallback" ||
			hasObservedECharts(getEChartsExportTracker(iframeWindow), iframeDocument)
		let echartsHandled = false
		if (shouldProbeECharts) {
			// Interception could not prove lifecycle completeness, so the page marker must not
			// authorize an animation-in-progress snapshot. Wait for real legacy finished state.
			echartsHandled = await waitForEChartsFinished({
				iframeWindow,
				iframeDocument,
				tracker: getEChartsExportTracker(iframeWindow),
				signal,
				timeoutMs: echartsTimeoutMs,
				// Two final animation frames below provide the settle window for the explicit
				// snapshot. Avoid adding the normal 500ms stability tax to every page in a
				// 200-page export.
				stableMs: 0,
				instanceRequired: true,
				discoveryGraceMs: 0,
				onResourceError,
			})
		}
		return {
			handledCanvas: echartsHandled || Boolean(iframeDocument.querySelector("canvas")),
		}
	}

	if (initialIntercepted.status === "fallback") {
		const handledCanvas = await waitForEChartsFinished({
			iframeWindow,
			iframeDocument,
			tracker: getEChartsExportTracker(iframeWindow),
			signal,
			timeoutMs: echartsTimeoutMs,
			stableMs: echartsStableMs,
			instanceRequired: true,
			discoveryGraceMs: 0,
			onResourceError,
		})
		return { handledCanvas }
	}

	await waitForAnimationFrames(iframeWindow, 2, signal)
	const afterFramesIntercepted = await waitForInterceptedEChartsReadiness({
		iframeWindow,
		iframeDocument,
		echartsSourceHint: false,
		signal,
		timeoutMs: echartsTimeoutMs,
		discoveryMs: 0,
		stableMs: 0,
		onResourceError,
	})
	if (afterFramesIntercepted.status === "handled") return { handledCanvas: true }
	if (afterFramesIntercepted.status === "fallback") {
		const handledCanvas = await waitForEChartsFinished({
			iframeWindow,
			iframeDocument,
			tracker: getEChartsExportTracker(iframeWindow),
			signal,
			timeoutMs: echartsTimeoutMs,
			stableMs: echartsStableMs,
			instanceRequired: true,
			discoveryGraceMs: 0,
			onResourceError,
		})
		return { handledCanvas }
	}
	return { handledCanvas: false }
}

/**
 * Prefer the exporter-owned ECharts protocol when every live chart was intercepted before init.
 * Animation is disabled at setOption, and readiness is proven by rendered/pending state plus two
 * settle-frame verification passes.
 */
async function waitForInterceptedEChartsReadiness({
	iframeWindow,
	iframeDocument,
	echartsSourceHint,
	signal,
	timeoutMs,
	discoveryMs,
	stableMs,
	onResourceError,
}: {
	iframeWindow: Window
	iframeDocument: Document
	echartsSourceHint: boolean
	signal?: AbortSignal
	timeoutMs: number
	discoveryMs: number
	stableMs: number
	onResourceError?: (error: ResourceLoadError) => void
}): Promise<InterceptedEChartsReadinessResult> {
	const tracker = getEChartsExportTracker(iframeWindow)
	const startedAt = Date.now()
	const deadline = startedAt + Math.max(0, timeoutMs)
	const discoveryDeadline = Math.min(deadline, startedAt + Math.max(0, discoveryMs))

	while (!hasObservedECharts(tracker, iframeDocument)) {
		throwIfAborted(signal)
		throwIfExplicitRenderReadyFailed(iframeDocument)
		refreshEChartsExportInterceptor(iframeWindow)
		if (hasObservedECharts(tracker, iframeDocument)) break
		if (!echartsSourceHint || Date.now() >= discoveryDeadline) {
			return { status: "no-chart" }
		}
		await waitForTimeout({
			ms: Math.min(READINESS_POLL_MS, Math.max(0, discoveryDeadline - Date.now())),
			signal,
		})
	}
	if (!tracker) return { status: "fallback", observedECharts: true }

	while (true) {
		throwIfAborted(signal)
		throwIfExplicitRenderReadyFailed(iframeDocument)
		refreshEChartsExportInterceptor(iframeWindow)
		const evaluation = evaluateInterceptedECharts({
			iframeDocument,
			tracker,
		})
		if (evaluation.status === "fallback") {
			return { status: "fallback", observedECharts: true }
		}

		if (evaluation.status === "ready") {
			const candidate = evaluation.snapshot
			let stableWindowSatisfied = true
			if (stableMs > 0) {
				const remainingMs = Math.max(0, deadline - Date.now())
				if (remainingMs < stableMs) {
					await waitForTimeout({ ms: remainingMs, signal })
					stableWindowSatisfied = false
				} else {
					await waitForTimeout({ ms: stableMs, signal })
					throwIfExplicitRenderReadyFailed(iframeDocument)
					refreshEChartsExportInterceptor(iframeWindow)
					const stable = evaluateInterceptedECharts({
						iframeDocument,
						tracker,
					})
					if (stable.status === "fallback") {
						return { status: "fallback", observedECharts: true }
					}
					if (
						stable.status !== "ready" ||
						!isSameInterceptedSnapshot(candidate, stable.snapshot)
					) {
						continue
					}
				}
			}
			if (stableWindowSatisfied) {
				await waitForAnimationFrames(iframeWindow, 2, signal)
				throwIfExplicitRenderReadyFailed(iframeDocument)
				refreshEChartsExportInterceptor(iframeWindow)
				const beforeResize = evaluateInterceptedECharts({
					iframeDocument,
					tracker,
				})
				if (beforeResize.status === "fallback") {
					return { status: "fallback", observedECharts: true }
				}
				if (
					beforeResize.status === "ready" &&
					isSameInterceptedSnapshot(candidate, beforeResize.snapshot)
				) {
					for (const state of beforeResize.snapshot.instances) {
						resizeTrackedEChartsForExport(state)
					}
					await waitForAnimationFrames(iframeWindow, 2, signal)
					throwIfExplicitRenderReadyFailed(iframeDocument)
					refreshEChartsExportInterceptor(iframeWindow)
					const settled = evaluateInterceptedECharts({
						iframeDocument,
						tracker,
					})
					if (settled.status === "fallback") {
						return { status: "fallback", observedECharts: true }
					}
					if (
						settled.status === "ready" &&
						isSameInterceptedSnapshot(beforeResize.snapshot, settled.snapshot)
					) {
						return { status: "handled" }
					}
				}
			}
		}

		if (Date.now() >= deadline) {
			reportResourceError(onResourceError, {
				url: "document://echarts",
				kind: "chart",
				reason: "timeout",
			})
			throw createInterceptedEChartsTimeoutError(tracker, timeoutMs)
		}
		await waitForTimeout({
			ms: Math.min(READINESS_POLL_MS, Math.max(0, deadline - Date.now())),
			signal,
		})
	}
}

function evaluateInterceptedECharts({
	iframeDocument,
	tracker,
}: {
	iframeDocument: Document
	tracker: EChartsExportTracker
}): InterceptedEChartsEvaluation {
	if (tracker.interceptionFailed) return { status: "fallback" }

	const namespace = tracker.currentNamespace
	const domElements = Array.from(
		iframeDocument.querySelectorAll<HTMLElement>("[_echarts_instance_]"),
	)
	if (!tracker.namespaceObserved || !namespace || !tracker.namespaceIntercepted) {
		return { status: "fallback" }
	}

	try {
		if (typeof namespace.getInstanceByDom === "function") {
			for (const element of domElements) {
				const instance = namespace.getInstanceByDom(element)
				if (instance && !tracker.instances.has(instance)) return { status: "fallback" }
			}
		}

		const instances: ExportTrackedEChartsInstance[] = []
		for (const state of tracker.instances.values()) {
			if (state.instance.isDisposed?.()) continue
			if (!state.element) return { status: "fallback" }
			if (!state.element.isConnected) continue
			if (
				typeof namespace.getInstanceByDom === "function" &&
				namespace.getInstanceByDom(state.element) !== state.instance
			) {
				return { status: "fallback" }
			}
			if (
				!state.setOptionWrapped ||
				!state.resizeWrapped ||
				!state.eventsTracked ||
				!state.originalResize
			) {
				return { status: "fallback" }
			}
			instances.push(state)
		}

		if (instances.length === 0) return { status: "pending" }
		if (!instances.every(isInterceptedEChartsInstanceReady)) {
			return { status: "pending" }
		}

		return {
			status: "ready",
			snapshot: {
				tracker,
				instances,
				instanceSet: new Set(instances.map((state) => state.instance)),
				initCalls: tracker.initCalls,
				mutationVersion: tracker.mutationVersion,
			},
		}
	} catch {
		// An unusual or partially compatible ECharts build should retain the legacy readiness path.
		return { status: "fallback" }
	}
}

function isInterceptedEChartsInstanceReady(state: ExportTrackedEChartsInstance): boolean {
	if (state.setOptionCalls === 0) return false
	if (state.setOptionInFlight) return false
	if (state.renderedCount === 0) return false
	if (state.renderedSetOptionVersion < state.setOptionVersion) return false
	if (state.instance.__pendingUpdate) return false
	if (state.instance._scheduler?.unfinished) return false
	if ((state.instance._pendingActions?.length ?? 0) > 0) return false
	return true
}

function isSameInterceptedSnapshot(
	left: InterceptedEChartsSnapshot,
	right: InterceptedEChartsSnapshot,
): boolean {
	if (left.tracker !== right.tracker) return false
	if (left.initCalls !== right.initCalls) return false
	if (left.mutationVersion !== right.mutationVersion) return false
	if (left.instanceSet.size !== right.instanceSet.size) return false
	for (const instance of left.instanceSet) {
		if (!right.instanceSet.has(instance)) return false
	}
	return true
}

function createInterceptedEChartsTimeoutError(
	tracker: EChartsExportTracker,
	timeoutMs: number,
): ExportFidelityError {
	const states = Array.from(tracker.instances.values())
	let detail = "rendering did not reach a stable rendered frame"
	if (tracker.failedInitCalls > 0 || tracker.initCalls === 0 || states.length === 0) {
		detail = "instance was not created"
	} else if (states.some((state) => state.setOptionWrapped && state.setOptionCalls === 0)) {
		detail = "setOption was not called"
	} else if (
		states.some(
			(state) =>
				state.eventsTracked &&
				state.setOptionCalls > 0 &&
				state.renderedSetOptionVersion < state.setOptionVersion,
		)
	) {
		detail = "rendered was not observed after setOption"
	}
	return new ExportFidelityError(
		`[Sandbox] ECharts ${detail} within ${timeoutMs}ms`,
		"render-timeout",
	)
}

async function waitForEChartsFinished({
	iframeWindow,
	iframeDocument,
	tracker,
	signal,
	timeoutMs,
	stableMs,
	instanceRequired,
	discoveryGraceMs,
	onResourceError,
}: {
	iframeWindow: Window
	iframeDocument: Document
	tracker?: EChartsExportTracker
	signal?: AbortSignal
	timeoutMs: number
	stableMs: number
	instanceRequired: boolean
	discoveryGraceMs: number
	onResourceError?: (error: ResourceLoadError) => void
}): Promise<boolean> {
	throwIfAborted(signal)
	const foundInstance = await new Promise<boolean>((resolve, reject) => {
		let settled = false
		let everFoundInstance = false
		let stableSince: number | null = null
		const discoveryStartedAt = Date.now()
		let pollId: ReturnType<typeof setInterval> | null = null
		let timeoutId: ReturnType<typeof setTimeout> | null = null
		const tracked = new Map<EChartsInstanceLike, TrackedEChartsInstance>()

		const cleanup = () => {
			if (pollId) clearInterval(pollId)
			if (timeoutId) clearTimeout(timeoutId)
			for (const state of tracked.values()) untrackEChartsInstance(state)
			tracked.clear()
			signal?.removeEventListener("abort", onAbort)
		}
		const finish = (found: boolean) => {
			if (settled) return
			settled = true
			cleanup()
			resolve(found)
		}
		const fail = (error: Error) => {
			if (settled) return
			settled = true
			cleanup()
			reject(error)
		}
		const onAbort = () => fail(createAbortError())
		const resetStability = () => {
			stableSince = null
		}
		const track = (element: HTMLElement, instance: EChartsInstanceLike) => {
			if (tracked.has(instance)) return
			const state: TrackedEChartsInstance = {
				element,
				instance,
				finishedEventObserved: false,
				onRendered: () => {
					state.finishedEventObserved = false
					resetStability()
				},
				onFinished: () => {
					state.finishedEventObserved = true
					resetStability()
				},
			}
			tracked.set(instance, state)
			instance.on?.("rendered", state.onRendered)
			instance.on?.("finished", state.onFinished)
			instance.getZr?.().flush?.()
			resetStability()
		}
		const discoverInstances = () => {
			const echarts = (iframeWindow as EChartsWindow).echarts
			if (typeof echarts?.getInstanceByDom !== "function") return
			for (const element of Array.from(
				iframeDocument.querySelectorAll<HTMLElement>("[_echarts_instance_]"),
			)) {
				const instance = echarts.getInstanceByDom(element)
				if (!instance) continue
				everFoundInstance = true
				track(element, instance)
			}
		}
		const pruneDisposedInstances = () => {
			const echarts = (iframeWindow as EChartsWindow).echarts
			for (const [instance, state] of tracked) {
				const activeInstance = echarts?.getInstanceByDom?.(state.element)
				if (
					state.element.isConnected &&
					!instance.isDisposed?.() &&
					activeInstance === instance
				) {
					continue
				}
				untrackEChartsInstance(state)
				tracked.delete(instance)
				resetStability()
			}
		}
		const checkFinished = () => {
			try {
				discoverInstances()
				pruneDisposedInstances()
				if (!isFallbackTrackerEvidenceReady(tracker)) {
					resetStability()
					return
				}
				if (tracked.size === 0) {
					resetStability()
					if (
						!instanceRequired &&
						!everFoundInstance &&
						Date.now() - discoveryStartedAt >= discoveryGraceMs
					) {
						finish(false)
					}
					return
				}
				const allFinished = Array.from(tracked.values()).every(isEChartsInstanceIdle)
				if (!allFinished) {
					resetStability()
					return
				}
				const now = Date.now()
				if (stableSince === null) stableSince = now
				if (now - stableSince >= Math.max(0, stableMs)) finish(true)
			} catch (error) {
				fail(toEChartsFidelityError(error))
			}
		}

		pollId = setInterval(checkFinished, READINESS_POLL_MS)
		timeoutId = setTimeout(() => {
			if (!instanceRequired && !everFoundInstance) {
				finish(false)
				return
			}
			reportResourceError(onResourceError, {
				url: "document://echarts",
				kind: "chart",
				reason: "timeout",
			})
			if (tracker && !isFallbackTrackerEvidenceReady(tracker)) {
				fail(createInterceptedEChartsTimeoutError(tracker, timeoutMs))
				return
			}
			fail(
				new ExportFidelityError(
					everFoundInstance
						? `[Sandbox] ECharts rendering did not finish within ${timeoutMs}ms`
						: `[Sandbox] ECharts instance was not created within ${timeoutMs}ms`,
					"render-timeout",
				),
			)
		}, timeoutMs)
		signal?.addEventListener("abort", onAbort, { once: true })
		checkFinished()
	})

	if (foundInstance) await waitForAnimationFrames(iframeWindow, 2, signal)
	return foundInstance
}

/** Preserve any lifecycle evidence captured before interception fell back to legacy polling. */
function isFallbackTrackerEvidenceReady(tracker?: EChartsExportTracker): boolean {
	if (!tracker) return true
	if (tracker.failedInitCalls > 0) return false

	for (const state of tracker.instances.values()) {
		if (state.instance.isDisposed?.()) continue
		if (state.setOptionWrapped && state.setOptionCalls === 0) return false
		if (
			state.eventsTracked &&
			state.setOptionCalls > 0 &&
			state.renderedSetOptionVersion < state.setOptionVersion
		) {
			return false
		}
	}
	return true
}

function isEChartsInstanceIdle(state: TrackedEChartsInstance): boolean {
	if (state.instance.isDisposed?.()) return false
	if (state.instance.__pendingUpdate) return false
	if (state.instance._scheduler?.unfinished) return false
	if ((state.instance._pendingActions?.length ?? 0) > 0) return false
	if (state.finishedEventObserved) return true
	const animationFinished = state.instance.getZr?.().animation?.isFinished?.()
	if (animationFinished !== true) return false
	return true
}

function untrackEChartsInstance(state: TrackedEChartsInstance): void {
	state.instance.off?.("rendered", state.onRendered)
	state.instance.off?.("finished", state.onFinished)
}

function hasObservedECharts(
	tracker: EChartsExportTracker | undefined,
	iframeDocument: Document,
): boolean {
	return Boolean(
		(tracker && (tracker.initCalls > 0 || tracker.instances.size > 0)) ||
		iframeDocument.querySelector("[_echarts_instance_]"),
	)
}

function hasDirectEChartsInitSourceHint(source: string): boolean {
	return (
		/\becharts\s*(?:\?\.\s*|\.\s*)init\s*(?:\?\.\s*)?\(/i.test(source) ||
		/\becharts\s*\[\s*["']init["']\s*\]\s*(?:\?\.\s*)?\(/i.test(source) ||
		/\bwindow\s*\[\s*["']echarts["']\s*\]\s*(?:(?:\?\.\s*|\.\s*)init|\[\s*["']init["']\s*\])\s*(?:\?\.\s*)?\(/i.test(
			source,
		)
	)
}

function stripJavaScriptComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")
}

function toEChartsFidelityError(error: unknown): Error {
	if (error instanceof ExportFidelityError) return error
	if (error instanceof DOMException && error.name === "AbortError") return error
	const source = toError(error)
	return new ExportFidelityError(
		`[Sandbox] ECharts readiness failed: ${source.message}`,
		"script",
		error,
	)
}

function throwIfExplicitRenderReadyFailed(iframeDocument: Document): void {
	for (const element of getExplicitRenderReadyElements(iframeDocument)) {
		for (const attribute of [EXPORT_READY_ATTRIBUTE, LEGACY_READY_ATTRIBUTE]) {
			const value = element.getAttribute(attribute)?.trim().toLowerCase()
			if (value === "error" || value === "failed") {
				throw new ExportFidelityError(`[Sandbox] page reported ${attribute}=${value}`, "script")
			}
		}
	}
}

function getExplicitRenderReadyElements(iframeDocument: Document): HTMLElement[] {
	// Pages may own either root element; keep HTML precedence so a root marker cannot be
	// accidentally overridden by a stale body marker while still supporting body-only pages.
	const elements: HTMLElement[] = []
	if (iframeDocument.documentElement) elements.push(iframeDocument.documentElement)
	if (iframeDocument.body && iframeDocument.body !== iframeDocument.documentElement) {
		elements.push(iframeDocument.body)
	}
	return elements
}

function readExplicitRenderReadyMarker(
	iframeDocument: Document,
): { attribute: string; value: string } | undefined {
	for (const element of getExplicitRenderReadyElements(iframeDocument)) {
		for (const attribute of [EXPORT_READY_ATTRIBUTE, LEGACY_READY_ATTRIBUTE]) {
			const value = element.getAttribute(attribute)?.trim().toLowerCase()
			if (value) return { attribute, value }
		}
	}
	return undefined
}

async function waitForExplicitRenderReady({
	iframeWindow,
	iframeDocument,
	signal,
	timeoutMs,
	onResourceError,
}: {
	iframeWindow: Window
	iframeDocument: Document
	signal?: AbortSignal
	timeoutMs: number
	onResourceError?: (error: ResourceLoadError) => void
}): Promise<void> {
	await waitForValue({
		iframeWindow,
		iframeDocument,
		signal,
		timeoutMs,
		read: () => {
			const value = readExplicitRenderReadyMarker(iframeDocument)?.value
			throwIfExplicitRenderReadyFailed(iframeDocument)
			if (value === "true" || value === "ready" || value === "complete" || value === "1") {
				return true
			}
			return undefined
		},
		onTimeout: () => {
			const attribute =
				readExplicitRenderReadyMarker(iframeDocument)?.attribute ?? LEGACY_READY_ATTRIBUTE
			reportResourceError(onResourceError, {
				url: `document://${attribute}`,
				kind: "render",
				reason: "timeout",
			})
			return new ExportFidelityError(
				`[Sandbox] ${attribute} was not reached within ${timeoutMs}ms`,
				"render-timeout",
			)
		},
	})
}

async function waitForValue<T>({
	iframeWindow,
	iframeDocument,
	read,
	onTimeout,
	timeoutMs,
	signal,
}: {
	iframeWindow: Window
	iframeDocument: Document
	read: () => T | undefined
	onTimeout: () => Error
	timeoutMs: number
	signal?: AbortSignal
}): Promise<T> {
	throwIfAborted(signal)
	return new Promise<T>((resolve, reject) => {
		let settled = false
		let observer: MutationObserver | null = null
		let pollId: ReturnType<typeof setInterval> | null = null
		let timeoutId: ReturnType<typeof setTimeout> | null = null

		const cleanup = () => {
			observer?.disconnect()
			if (pollId) clearInterval(pollId)
			if (timeoutId) clearTimeout(timeoutId)
			signal?.removeEventListener("abort", onAbort)
		}
		const finish = (value: T) => {
			if (settled) return
			settled = true
			cleanup()
			resolve(value)
		}
		const fail = (error: unknown) => {
			if (settled) return
			settled = true
			cleanup()
			reject(error)
		}
		const check = () => {
			try {
				const value = read()
				if (value !== undefined) finish(value)
			} catch (error) {
				fail(error)
			}
		}
		const onAbort = () => fail(createAbortError())

		try {
			const MutationObserverConstructor = (
				iframeWindow as Window & { MutationObserver?: typeof MutationObserver }
			).MutationObserver
			if (MutationObserverConstructor && iframeDocument.documentElement) {
				const activeObserver = new MutationObserverConstructor(check)
				observer = activeObserver
				activeObserver.observe(iframeDocument.documentElement, {
					attributes: true,
					childList: true,
					subtree: true,
				})
			}
		} catch {
			observer = null
		}

		pollId = setInterval(check, READINESS_POLL_MS)
		timeoutId = setTimeout(() => fail(onTimeout()), timeoutMs)
		signal?.addEventListener("abort", onAbort, { once: true })
		check()
	})
}

async function waitForAnimationFrames(
	iframeWindow: Window,
	count: number,
	signal?: AbortSignal,
): Promise<void> {
	for (let index = 0; index < count; index++) {
		throwIfAborted(signal)
		await new Promise<void>((resolve, reject) => {
			let settled = false
			let frameId: number | null = null
			let timeoutId: ReturnType<typeof setTimeout> | null = null
			const cleanup = () => {
				if (frameId !== null) iframeWindow.cancelAnimationFrame?.(frameId)
				if (timeoutId) clearTimeout(timeoutId)
				signal?.removeEventListener("abort", onAbort)
			}
			const finish = () => {
				if (settled) return
				settled = true
				cleanup()
				resolve()
			}
			const onAbort = () => {
				if (settled) return
				settled = true
				cleanup()
				reject(createAbortError())
			}

			signal?.addEventListener("abort", onAbort, { once: true })
			timeoutId = setTimeout(finish, FRAME_FALLBACK_MS)
			try {
				frameId = iframeWindow.requestAnimationFrame(() => finish())
			} catch {
				// The timeout fallback still gives the renderer a bounded settle window.
			}
		})
	}
}

function reportResourceError(
	reporter: ((error: ResourceLoadError) => void) | undefined,
	error: ResourceLoadError,
): void {
	try {
		reporter?.(error)
	} catch {
		// Resource reporting must not mask the fidelity error that follows.
	}
}

function toError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error))
}
