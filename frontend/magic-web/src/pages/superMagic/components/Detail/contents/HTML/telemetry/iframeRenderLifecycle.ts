import type { HtmlSandboxTelemetryPayload } from "@dtyq/html-sandbox"

export const HTML_IFRAME_RENDER_LIFECYCLE_EVENT = "html_iframe_render_lifecycle"
export const IFRAME_RENDER_TIMEOUT_MS = 30_000

export type IframeRenderLifecycleStage =
	| "session_start"
	| "shell_loaded"
	| "shell_load_failed"
	| "iframe_ready"
	| "page_loaded"
	| "set_content_sent"
	| "set_content_failed"
	| "content_injected"
	| "content_inject_failed"
	| "content_loaded"
	| "dom_ready"
	| "render_complete"
	| "page_fully_loaded"
	| "content_metrics_initial"
	| "content_metrics_settled"
	| "scale_ready"
	| "render_ready"
	| "render_success"
	| "iframe_failure"
	| "timeout"

export type IframeRenderFailureType =
	"runtime_error" | "resource_load_failed" | "nested_iframe_failed"

export interface IframeRenderLifecycleSource {
	depth: number
	fileId?: string
	path?: string
	requesterFileId?: string
	chainFileIds?: string[]
}

export interface IframeRenderLifecycleContext {
	sessionId?: string
	elapsedMs?: number
	sandboxType?: string
	renderMode: "cross-origin" | "same-origin"
	shellUrl: string
	shellOrigin?: string
	targetOrigin?: string
	postMessageTargetStrategy?: string
	source: IframeRenderLifecycleSource
	fileId?: string
	relativeFilePath?: string
	isPptRender?: boolean
	isFullscreen?: boolean
	isEditMode?: boolean
	isPlaybackMode?: boolean
	isVisible?: boolean
	shouldApplyScaling?: boolean
	isScaleReady?: boolean
	iframeLoaded?: boolean
	contentInjected?: boolean
	contentLength?: number
}

type IframeRenderNonFailureStage = Exclude<IframeRenderLifecycleStage, "iframe_failure">

interface IframeRenderLifecycleCommonExtra {
	reason?: string
	requestId?: string
	errorMessage?: unknown
	errorStack?: unknown
	origin?: string
	isExpectedSource?: boolean
	fullContentLength?: number
	markerId?: string
	dynamicInterceptionEnabled?: boolean
	contentWidth?: number
	contentHeight?: number
	hasHorizontalOverflow?: boolean
	hasVerticalOverflow?: boolean
	verticalScrollbarWidth?: number
	timeoutMs?: number
}

interface IframeRenderSandboxTelemetryExtra {
	origin: string
	sandboxTelemetryEventId: string
	sandboxTelemetryTimestamp: number
	sandboxTelemetryPageHref: string
	sandboxTelemetryPageReadyState: DocumentReadyState
	sandboxTelemetryDedupeKey?: string
	sandboxTelemetryDedupeCount?: number
}

type IframeRenderNonFailurePayload = IframeRenderLifecycleContext &
	IframeRenderLifecycleCommonExtra & {
		stage: IframeRenderNonFailureStage
		failureType?: never
	}

type IframeRenderRuntimeErrorFailurePayload = IframeRenderLifecycleContext &
	IframeRenderSandboxTelemetryExtra & {
		stage: "iframe_failure"
		failureType: "runtime_error"
		reason: Extract<
			HtmlSandboxTelemetryPayload["event"],
			{ type: "runtime_error" }
		>["errorType"]
		errorType: Extract<
			HtmlSandboxTelemetryPayload["event"],
			{ type: "runtime_error" }
		>["errorType"]
		errorMessage: string
		errorStack?: string
		errorSource?: string
		errorLineno?: number
		errorColno?: number
		tagName?: never
		url?: never
		resourceType?: never
	}

type IframeRenderResourceLoadFailurePayload = IframeRenderLifecycleContext &
	IframeRenderSandboxTelemetryExtra & {
		stage: "iframe_failure"
		failureType: "resource_load_failed"
		tagName: string
		url: string
		resourceType: Extract<
			HtmlSandboxTelemetryPayload["event"],
			{ type: "resource_load_failed" }
		>["resourceType"]
		reason?: never
		errorType?: never
		errorMessage?: never
		errorStack?: never
		errorSource?: never
		errorLineno?: never
		errorColno?: never
	}

type IframeRenderNestedIframeFailurePayload = IframeRenderLifecycleContext & {
	stage: "iframe_failure"
	failureType: "nested_iframe_failed"
	reason: "not_found" | "cycle" | "fetch_failed" | "processing_error" | string
	requestId: string
	errorMessage: string
	errorStack?: string
	errorType?: never
	tagName?: never
	url?: never
	resourceType?: never
}

export type IframeRenderLifecyclePayload =
	| IframeRenderNonFailurePayload
	| IframeRenderRuntimeErrorFailurePayload
	| IframeRenderResourceLoadFailurePayload
	| IframeRenderNestedIframeFailurePayload

export interface IframeRenderLifecycleState {
	sessionId: string
	startedAt: number
	reportedStages: Set<IframeRenderLifecycleStage>
	timeoutTimer: ReturnType<typeof setTimeout> | null
}

interface IframeRenderLifecycleLogger {
	report: (event: string, data: IframeRenderLifecyclePayload) => void
}

interface MutableRef<T> {
	current: T
}

interface ReportIframeRenderLifecycleStageParams {
	logger: IframeRenderLifecycleLogger
	lifecycle: IframeRenderLifecycleState
	getContext: () => IframeRenderLifecycleContext
	stage: IframeRenderLifecycleStage
	extra?: Record<string, unknown>
	options?: {
		once?: boolean
	}
}

interface StartIframeRenderLifecycleSessionParams {
	logger: IframeRenderLifecycleLogger
	lifecycleRef: MutableRef<IframeRenderLifecycleState>
	getContext: () => IframeRenderLifecycleContext
	reason: string
	timeoutMs?: number
}

export function createIframeRenderLifecycleState(): IframeRenderLifecycleState {
	return {
		sessionId: `html_iframe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
		startedAt: Date.now(),
		reportedStages: new Set<IframeRenderLifecycleStage>(),
		timeoutTimer: null,
	}
}

export function clearIframeRenderLifecycleTimeout(lifecycle: IframeRenderLifecycleState): void {
	if (!lifecycle.timeoutTimer) return

	clearTimeout(lifecycle.timeoutTimer)
	lifecycle.timeoutTimer = null
}

export function reportIframeRenderLifecycleStage({
	logger,
	lifecycle,
	getContext,
	stage,
	extra = {},
	options = { once: true },
}: ReportIframeRenderLifecycleStageParams): void {
	if (options.once !== false && lifecycle.reportedStages.has(stage)) return

	lifecycle.reportedStages.add(stage)
	const payload = {
		...getContext(),
		stage,
		...extra,
	} as IframeRenderLifecyclePayload
	logger.report(HTML_IFRAME_RENDER_LIFECYCLE_EVENT, payload)
}

export function startIframeRenderLifecycleSession({
	logger,
	lifecycleRef,
	getContext,
	reason,
	timeoutMs = IFRAME_RENDER_TIMEOUT_MS,
}: StartIframeRenderLifecycleSessionParams): void {
	clearIframeRenderLifecycleTimeout(lifecycleRef.current)

	lifecycleRef.current = createIframeRenderLifecycleState()
	reportIframeRenderLifecycleStage({
		logger,
		lifecycle: lifecycleRef.current,
		getContext,
		stage: "session_start",
		extra: { reason },
	})

	lifecycleRef.current.timeoutTimer = setTimeout(() => {
		reportIframeRenderLifecycleStage({
			logger,
			lifecycle: lifecycleRef.current,
			getContext,
			stage: "timeout",
			extra: {
				reason: "render_ready_not_received",
				timeoutMs,
			},
		})
	}, timeoutMs)
}

export function mapSandboxTelemetryToLifecycleReport(
	payload: HtmlSandboxTelemetryPayload,
	origin: string,
): { stage: "iframe_failure"; extra: Record<string, unknown> } | null {
	const commonExtra = {
		source: payload.source,
		origin,
		sandboxTelemetryEventId: payload.eventId,
		sandboxTelemetryTimestamp: payload.timestamp,
		sandboxTelemetryPageHref: payload.page.href,
		sandboxTelemetryPageReadyState: payload.page.readyState,
		sandboxTelemetryDedupeKey: payload.dedupeKey,
		sandboxTelemetryDedupeCount: payload.dedupeCount,
	} satisfies Partial<IframeRenderLifecyclePayload>

	if (payload.event.type === "runtime_error") {
		return {
			stage: "iframe_failure",
			extra: {
				...commonExtra,
				failureType: payload.event.type,
				reason: payload.event.errorType,
				errorType: payload.event.errorType,
				errorMessage: payload.event.message,
				errorStack: payload.event.stack,
				errorSource: payload.event.source,
				errorLineno: payload.event.lineno,
				errorColno: payload.event.colno,
			},
		}
	}

	if (payload.event.type === "resource_load_failed") {
		return {
			stage: "iframe_failure",
			extra: {
				...commonExtra,
				failureType: payload.event.type,
				tagName: payload.event.tagName,
				url: payload.event.url,
				resourceType: payload.event.resourceType,
			},
		}
	}

	return null
}
