import type { EmbedFontInput, UsedFont } from "../api/font"
import { preflightPptxExport } from "../api/preflight"
import type {
	ExportFailurePhase,
	ExportIssue,
	ExportProgress,
	ExportSummary,
	MediaPolicy,
	PptxDestination,
	ResourceLoadError,
	SlideConfig,
	StagingPolicy,
	StreamingHtmlPage,
} from "../api/options"
import { resolveStreamingMediaPolicyMode } from "../api/strategy"
import type { StreamingExportTaskInput } from "../index"
import type { PPTNode } from "../ir/node"
import { serializePptNodes, type SerializablePPTNode } from "../ir/serialize"
import { withMediaSourceKey, type MediaSourceDescriptor } from "../media/source-descriptor"
import { detectFontsFromNodes } from "../font/detectFontsFromNodes"
import {
	createStreamingPresentationPackager,
	createInMemoryStreamingStagingStore,
	type StreamingPresentationPackager,
	type StreamingPresentationPlan,
	type StreamingWorkerDestination,
} from "../packaging"
import { createPresentation, ensureFileName } from "../packaging/pptx-document"
import {
	ExportFidelityError,
	createOpfsUnavailableError,
	isExportFidelityError,
	isOpfsUnavailableError,
	isPptxExportError,
	PptxExportError,
	normalizePptxExportError,
	type PptxExportErrorContext,
} from "../errors"
import {
	preflightPptImage,
	imagePolicyRequiresReplay,
	type ImagePreflightDecision,
	type ImageTransformDescriptorResult,
} from "../media/image-preflight"
import {
	createAbortError,
	throwIfAborted as throwIfSandboxAborted,
	withAbort,
} from "../sandbox/abort"
import { log, LogLevel } from "../logger"
import { DEFAULT_DPI } from "../shared/constants"
import { MAX_PPT_PAGE_PX } from "../shared/unit"
import { prepareSlideNodes } from "./render-slide"
import { sliceByPageHeight } from "./slice-nodes"
import { DEFAULT_TEXT_MERGE_MODE } from "./text-merge-mode"
import type { StreamingStagingStore } from "../runtime"

interface StagedSlideRecord {
	key: string
	nodes: SerializablePPTNode[]
	background: string | null
}

interface StreamingPptxWithStaging {
	createOpfsStagingStore?: (options?: { sessionId?: string }) => StreamingStagingStore
}

interface CreatedStagingStore {
	store: StreamingStagingStore
	usesDefaultOpfs: boolean
	allowsOpfsDescriptors: boolean
}

type StagedPageMetadata = Pick<StreamingHtmlPage, "key" | "pageName" | "pagePath" | "pageFileId">

interface ExportDiagnosticState {
	phase: ExportFailurePhase
	pageIndex?: number
	pageCount?: number
	bytesWritten?: number
}

/**
 * A page failure must not be confused with a packaging failure.  Rendering,
 * page scripts and media preparation can be represented by a placeholder
 * slide and reported to the host.  Worker, sink and finalization failures
 * invalidate the output stream and must still abort the export.
 */
function isRecoverablePageError(error: unknown): boolean {
	if (error instanceof DOMException && error.name === "AbortError") return false
	if (
		error &&
		typeof error === "object" &&
		"name" in error &&
		(error as { name?: unknown }).name === "AbortError"
	)
		return false

	// Fidelity failures are still page-local when they are raised while preparing the current
	// page. With skipFailedPages enabled, preserve the rest of the deck by replacing that page
	// with a diagnostic placeholder and forwarding the original issue to the host/AI repair flow.
	// Destination, Worker, ZIP, and finalization failures are not raised through this helper and
	// therefore remain terminal for the whole export.
	if (isExportFidelityError(error)) return true
	if (!isPptxExportError(error)) return true

	const diagnostic = error.diagnostic
	if (isExportFidelityError(error.sourceError)) return true
	if (
		[
			"worker-failed",
			"sink-write-failed",
			"finalize-failed",
			"cleanup-failed",
			"cancelled",
		].includes(diagnostic.code)
	)
		return false

	// Image preflight/transform errors are page-local when they carry an asset
	// identity. A preflight rejection without one may be a global capability
	// failure and should remain fatal.
	if (diagnostic.phase === "preflight") {
		return Boolean(diagnostic.details && "assetKey" in diagnostic.details)
	}

	return (
		[
			"prepare-page",
			"render-page",
			"stage-media",
			"media-fetch",
			"transform-media",
			"media-fetch-failed",
			"media-transform-failed",
			"prepare-page-failed",
			"render-page-failed",
		].includes(diagnostic.phase) ||
		[
			"prepare-page-failed",
			"render-page-failed",
			"media-fetch-failed",
			"media-transform-failed",
		].includes(diagnostic.code)
	)
}

/** Create a valid slide when the source HTML cannot be rendered. */
function createFailedPagePlaceholder(
	config: SlideConfig,
	page: Pick<StreamingHtmlPage, "index" | "pageName" | "pagePath">,
	error: unknown,
): SerializablePPTNode[] {
	const pageLabel = page.pageName || page.pagePath || `Page ${page.index + 1}`
	const message = error instanceof Error ? error.message : String(error ?? "Unknown error")
	const safeMessage = message.length > 360 ? `${message.slice(0, 357)}...` : message
	return [
		{
			type: "shape",
			x: 0,
			y: 0,
			w: config.slideWidth,
			h: config.slideHeight,
			zOrder: 0,
			shapeType: "rect",
			fill: { type: "solid", color: "FFF7ED" },
			line: null,
			shadow: null,
		},
		{
			type: "text",
			x: 0.6,
			y: 0.7,
			w: Math.max(config.slideWidth - 1.2, 1),
			h: Math.max(config.slideHeight - 1.4, 1),
			zOrder: 1,
			text: `PPTX export issue\n${pageLabel}\n\n${safeMessage}`,
			fontSize: 18,
			fontFace: "Arial",
			fontWeight: 400,
			color: "9A3412",
			bold: false,
			italic: false,
			underline: false,
			align: "left",
			valign: "top",
			wrap: true,
			margin: [0, 0, 0, 0],
		},
	]
}

/** Default Phase 4 HTML -> IR -> Packaging Worker streaming runner. */
export async function runStreamingExport(input: StreamingExportTaskInput): Promise<ExportSummary> {
	const startedAt = now()
	const requiresReplay =
		input.autoSize ||
		Boolean(input.fontResolver) ||
		input.stagingPolicy?.mode === "opfs" ||
		imagePolicyRequiresReplay(input.imagePolicy)
	const mediaPolicyMode = resolveStreamingMediaPolicyMode(input.mediaPolicy, {
		requiresReplay,
	})
	const canUseInMemoryStaging =
		isSinkProxyDestination(input.destination) && input.stagingPolicy?.mode !== "opfs"
	const requiresStaging =
		requiresReplay || mediaPolicyMode === "rolling-stage" || mediaPolicyMode === "full-stage"
	const diagnostic: ExportDiagnosticState = {
		phase: "preflight",
		pageCount: input.pageCount,
	}
	const trackedInput = createTrackedStreamingInput(input, diagnostic, mediaPolicyMode)
	const createPackager =
		input.pipeline?.createStreamingPresentationPackager ?? createStreamingPresentationPackager
	let errorContext: PptxExportErrorContext = {
		phase: "preflight",
		fileName: input.fileName,
		pageCount: input.pageCount,
		mediaPolicyMode,
		zipMode: "classic",
	}
	try {
		const preflight = preflightPptxExport({
			destination: input.destination,
			outputPolicy: input.outputPolicy,
			pageCount: input.pageCount,
			requiresOpfs: requiresStaging,
			requiresSlidePlan: requiresStaging,
			mediaPolicy: trackedInput.mediaPolicy,
			stagingPolicy: input.stagingPolicy,
			hasInjectedPackager: Boolean(input.pipeline?.createStreamingPresentationPackager),
			hasInjectedStagingStore: Boolean(input.pipeline?.createStreamingStagingStore),
			hasInMemoryStagingStore: canUseInMemoryStaging,
		})
		errorContext = {
			...errorContext,
			outputPolicy: preflight.outputPolicy,
			zipMode: preflight.zipMode,
		}
		if (!preflight.accepted) {
			const cause = new Error(
				`[exportPPTXStreaming] Preflight failed: ${preflight.errors.map((issue) => issue.message).join("; ")}`,
			)
			const hasOpfsUnavailable = preflight.errors.some(
				(issue) => issue.code === "opfs-unavailable",
			)
			const error = normalizePptxExportError(cause, {
				...errorContext,
				code: hasOpfsUnavailable ? "opfs-unavailable" : "preflight-rejected",
				details: {
					issues: preflight.errors.map((issue) => ({
						code: issue.code,
						severity: issue.severity,
						details: issue.details,
					})),
				},
			})
			await abortDestination(input.destination, error)
			throw error
		}
		if (!input.destination) throw new Error("[exportPPTXStreaming] A destination is required")

		diagnostic.phase = "worker"
		const summary = requiresStaging
			? await runStagedStreamingExport(trackedInput, createPackager, startedAt)
			: await runDirectStreamingExport(trackedInput, createPackager, startedAt)
		return {
			...summary,
			execution: {
				outputPolicy: preflight.outputPolicy,
				mediaPolicyMode,
				zipMode: preflight.zipMode,
				pipeline: requiresStaging ? "staged" : "direct",
			},
		}
	} catch (error) {
		throw normalizePptxExportError(error, {
			...errorContext,
			phase: diagnostic.phase,
			pageIndex: diagnostic.pageIndex,
			pageCount: diagnostic.pageCount,
			bytesWritten: diagnostic.bytesWritten,
			code: isExportFidelityError(error)
				? "fidelity-failed"
				: isOpfsUnavailableError(error)
					? "opfs-unavailable"
					: undefined,
		})
	}
}

function createTrackedStreamingInput(
	input: StreamingExportTaskInput,
	diagnostic: ExportDiagnosticState,
	mediaPolicyMode: Exclude<NonNullable<MediaPolicy["mode"]>, "auto">,
): StreamingExportTaskInput {
	return {
		...input,
		pages: trackPageSource(input.pages, diagnostic),
		mediaPolicy: { ...input.mediaPolicy, mode: mediaPolicyMode },
		onProgress: (progress) => {
			trackExportProgress(diagnostic, progress)
			input.onProgress?.(progress)
		},
	}
}

async function* trackPageSource(
	pages: AsyncIterable<StreamingHtmlPage>,
	diagnostic: ExportDiagnosticState,
): AsyncIterable<StreamingHtmlPage> {
	const iterator = pages[Symbol.asyncIterator]()
	try {
		while (true) {
			diagnostic.phase = "source"
			const next = await iterator.next()
			if (next.done) return
			yield next.value
		}
	} finally {
		await iterator.return?.()
	}
}

function trackExportProgress(diagnostic: ExportDiagnosticState, progress: ExportProgress): void {
	diagnostic.phase = progress.phase
	if (progress.pageIndex !== undefined) diagnostic.pageIndex = progress.pageIndex
	if (progress.pageCount !== undefined) diagnostic.pageCount = progress.pageCount
	if (progress.bytesWritten !== undefined) diagnostic.bytesWritten = progress.bytesWritten
}

async function runDirectStreamingExport(
	input: StreamingExportTaskInput,
	createPackager: NonNullable<
		StreamingExportTaskInput["pipeline"]
	>["createStreamingPresentationPackager"],
	startedAt: number,
) {
	let packager: StreamingPresentationPackager | undefined
	let successCount = 0
	let outputSlideCount = 0
	let currentPageIndex: number | undefined
	let currentPageKey: string | undefined
	let currentPageName: string | undefined
	let currentPagePath: string | undefined
	let currentPageFileId: string | undefined

	try {
		packager = createPackagerOrThrow(createPackager, {
			config: input.config,
			plan: createCapacityOnlyPlan(input.pageCount),
			fileName: input.fileName,
			destination: normalizeWorkerDestination(input.destination as PptxDestination),
			compression: input.compression,
			signal: input.signal,
			workerUrl: input.workerUrl,
			onProgress: input.onProgress,
			onResourceError: (error) =>
				reportExportResourceError(input, error, currentPageIndex, {
					pageKey: currentPageKey,
					pageName: currentPageName,
					pagePath: currentPagePath,
					pageFileId: currentPageFileId,
				}),
			// Packaging errors arrive after the Worker commit, so retain only the
			// primitive page index needed to label that diagnostic.
			onExportIssue: (issue) =>
				input.onExportIssue?.({
					...issue,
					pageIndex: issue.pageIndex ?? currentPageIndex,
					pageKey: issue.pageKey ?? currentPageKey,
					pageName: issue.pageName ?? currentPageName,
					pagePath: issue.pagePath ?? currentPagePath,
					pageFileId: issue.pageFileId ?? currentPageFileId,
				}),
		})
		await packager.ready
		for await (const page of input.pages) {
			throwIfAborted(input.signal)
			currentPageIndex = page.index
			currentPageKey = page.key
			currentPageName = page.pageName
			currentPagePath = page.pagePath
			currentPageFileId = page.pageFileId
			input.onProgress?.({
				phase: "prepare-page",
				pageIndex: page.index,
				pageCount: input.pageCount,
			})
			let packagingStarted = false
			try {
				const result = await prepareStreamingPage(input, page)
				const nodes = serializePptNodes(result.pptNodes)
				await normalizeNodeMediaSources(nodes)
				await applyImagePreflight(nodes, input)
				input.onProgress?.({
					phase: "render-page",
					pageIndex: page.index,
					pageCount: input.pageCount,
				})
				const outputPages = [nodes]
				for (let pageOffset = 0; pageOffset < outputPages.length; pageOffset += 1) {
					currentPageIndex = page.index
					const outputNodes = outputPages[pageOffset]
					packagingStarted = true
					await packager.commitSlide({
						nodes: outputNodes,
						background: result.bodyBackground,
						options: { slideKey: createSlideKey(page.key, page.index, pageOffset) },
					})
					outputNodes.length = 0
					outputSlideCount += 1
					input.onProgress?.({
						phase: "package-page",
						pageIndex: page.index,
						pageCount: input.pageCount,
					})
				}
				successCount += 1
			} catch (error) {
				if (input.signal.aborted) throw createAbortError()
				if (packagingStarted || !input.skipFailedPages || !isRecoverablePageError(error))
					throw error
				reportPageExportError(input, page, error)
				await packager.commitSlide({
					nodes: createFailedPagePlaceholder(input.config, page, error),
					background: null,
					options: { slideKey: createSlideKey(page.key, page.index, 0) },
				})
				outputSlideCount += 1
			}
		}

		// A page placeholder is a valid output slide. Only a destination/packaging
		// failure can reach this point now; page rendering failures are reported
		// through onExportIssue and do not reject the export.
		if (successCount === 0 && outputSlideCount === 0) {
			throw new Error("[exportPPTXStreaming] No pages were produced")
		}
		input.onProgress?.({ phase: "finalize", pageCount: outputSlideCount })
		const summary = await packager.finalize()
		return {
			fileName: ensureFileName(input.fileName),
			pageCount: summary.slideCount,
			mediaPartCount: summary.mediaPartCount,
			bytesWritten: summary.bytesWritten,
			durationMs: now() - startedAt,
		}
	} catch (error) {
		if (packager) await packager.abort(error).catch(() => undefined)
		else await abortDestination(input.destination, error)
		throw error
	} finally {
		packager?.dispose()
	}
}

async function runStagedStreamingExport(
	input: StreamingExportTaskInput,
	createPackager: NonNullable<
		StreamingExportTaskInput["pipeline"]
	>["createStreamingPresentationPackager"],
	startedAt: number,
) {
	const sessionId = createSessionId()
	let store: StreamingStagingStore | undefined
	const usedFonts = new Map<string, Set<string>>()
	const stagedKeys: string[] = []
	const stagedMedia = new Map<string, MediaSourceDescriptor>()
	let usesDefaultOpfsStore = !input.pipeline?.createStreamingStagingStore
	let allowsOpfsDescriptors = usesDefaultOpfsStore
	const canUseInMemoryStaging =
		isSinkProxyDestination(input.destination) && input.stagingPolicy?.mode !== "opfs"
	let measuredMaxWidth = input.config.htmlWidth
	let successfulSourcePages = 0
	let exportSucceeded = false
	let packager: StreamingPresentationPackager | undefined
	let currentPageIndex: number | undefined
	let currentPageKey: string | undefined
	let currentPageName: string | undefined
	let currentPagePath: string | undefined
	let currentPageFileId: string | undefined
	const stagedPageMetadata = new Map<number, StagedPageMetadata>()

	try {
		const createdStore = await runStagingOperation(input.signal, () =>
			createStagingStore(input, sessionId, canUseInMemoryStaging),
		)
		let activeStore = createdStore.store
		usesDefaultOpfsStore = createdStore.usesDefaultOpfs
		allowsOpfsDescriptors = createdStore.allowsOpfsDescriptors
		store = activeStore
		try {
			await runStagingOperation(
				input.signal,
				() => activeStore.createSession(sessionId, { signal: input.signal }),
				usesDefaultOpfsStore
					? { operation: "createSession", classifyAll: true }
					: undefined,
			)
		} catch (error) {
			if (
				!usesDefaultOpfsStore ||
				!canUseInMemoryStaging ||
				!isSafeInMemoryFallbackError(error)
			) {
				throw error
			}
			// A browser may expose navigator.storage.getDirectory but reject the
			// actual access (private mode, embedded WebView, or a denied origin).
			// Switch only the replay boundary to memory; packaging still uses the
			// same Worker and destination.
			// A rejected OPFS lookup may have created part of the session directory.
			// Cleanup is intentionally silent here because failure is the expected
			// capability signal that triggers the memory fallback.
			await cleanupStagingSession(activeStore, sessionId)
			activeStore = createInMemoryStreamingStagingStore()
			store = activeStore
			usesDefaultOpfsStore = false
			allowsOpfsDescriptors = false
			await runStagingOperation(input.signal, () =>
				activeStore.createSession(sessionId, { signal: input.signal }),
			)
		}
		for await (const page of input.pages) {
			throwIfAborted(input.signal)
			currentPageIndex = page.index
			currentPageKey = page.key
			currentPageName = page.pageName
			currentPagePath = page.pagePath
			currentPageFileId = page.pageFileId
			input.onProgress?.({
				phase: "prepare-page",
				pageIndex: page.index,
				pageCount: input.pageCount,
			})
			const pageStageStart = stagedKeys.length
			let stagingWriteInFlight = false
			try {
				const result = await prepareStreamingPage(input, page)
				if (input.autoSize && result.totalWidth > MAX_PPT_PAGE_PX) {
					throw new ExportFidelityError(
						`[exportPPTXStreaming] Page ${page.index + 1} width ${result.totalWidth}px exceeds PowerPoint's ${MAX_PPT_PAGE_PX}px limit.`,
						"page-size",
					)
				}
				measuredMaxWidth = Math.max(measuredMaxWidth, result.totalWidth)
				const serialized = serializePptNodes(result.pptNodes)
				await normalizeNodeMediaSources(serialized)
				await applyImagePreflight(serialized, input)
				const outputPages = input.autoSize
					? sliceByPageHeight({
							nodes: serialized,
							pageHeightInch: input.config.slideHeight,
							totalHeightInch: result.totalHeight / DEFAULT_DPI,
						})
					: [serialized]
				for (let pageOffset = 0; pageOffset < outputPages.length; pageOffset += 1) {
					const outputNodes = outputPages[pageOffset]
					input.onProgress?.({
						phase: "stage-media",
						pageIndex: page.index,
						pageCount: input.pageCount,
					})
					await stageNodeMediaSources(
						outputNodes,
						activeStore,
						input.signal,
						stagedMedia,
						input.mediaPolicy?.mode,
						allowsOpfsDescriptors,
						usesDefaultOpfsStore ? "stage" : undefined,
					)
					mergeUsedFonts(usedFonts, detectFontsFromNodes([outputNodes]))
					const key = createSlideKey(page.key, page.index, pageOffset)
					const stageIndex = stagedKeys.length + 1
					stagedPageMetadata.set(stageIndex, {
						key: page.key,
						pageName: page.pageName,
						pagePath: page.pagePath,
						pageFileId: page.pageFileId,
					})
					stagingWriteInFlight = true
					await runStagingOperation(
						input.signal,
						() =>
							activeStore.putSlideIr(
								stageIndex,
								{
									key,
									nodes: outputNodes,
									background: result.bodyBackground,
								} satisfies StagedSlideRecord,
								{ signal: input.signal },
							),
						usesDefaultOpfsStore ? { operation: "putSlideIr" } : undefined,
					)
					stagingWriteInFlight = false
					outputNodes.length = 0
					stagedKeys.push(key)
				}
				successfulSourcePages += 1
				input.onProgress?.({
					phase: "render-page",
					pageIndex: page.index,
					pageCount: input.pageCount,
				})
			} catch (error) {
				if (input.signal.aborted) throw createAbortError()
				if (stagingWriteInFlight || !input.skipFailedPages || !isRecoverablePageError(error))
					throw error
				await discardStagedPageRecords(
					activeStore,
					stagedKeys,
					stagedPageMetadata,
					pageStageStart,
					input.signal,
					usesDefaultOpfsStore,
				)
				reportPageExportError(input, page, error)
				const placeholderIndex = stagedKeys.length + 1
				const placeholderKey = createSlideKey(page.key, page.index, 0)
				stagedPageMetadata.set(placeholderIndex, {
					key: page.key,
					pageName: page.pageName,
					pagePath: page.pagePath,
					pageFileId: page.pageFileId,
				})
				await runStagingOperation(
					input.signal,
					() =>
						activeStore.putSlideIr(
							placeholderIndex,
							{
								key: placeholderKey,
								nodes: createFailedPagePlaceholder(input.config, page, error),
								background: null,
							} satisfies StagedSlideRecord,
							{ signal: input.signal },
						),
					usesDefaultOpfsStore ? { operation: "putSlideIr" } : undefined,
				)
				stagedKeys.push(placeholderKey)
				successfulSourcePages += 1
			}
		}

		if (successfulSourcePages === 0 || stagedKeys.length === 0) {
			throw new Error("[exportPPTXStreaming] No pages were produced")
		}
		const finalConfig = input.autoSize
			? buildFinalAutoSizeConfig(input.config, measuredMaxWidth)
			: input.config
		const embedFonts = await resolveFonts(input, usedFonts)
		const plan = createFrozenPlan(stagedKeys, stagedMedia)
		packager = createPackagerOrThrow(createPackager, {
			config: finalConfig,
			plan,
			fileName: input.fileName,
			embedFonts,
			destination: normalizeWorkerDestination(input.destination as PptxDestination),
			compression: input.compression,
			signal: input.signal,
			workerUrl: input.workerUrl,
			onProgress: input.onProgress,
			onResourceError: (error) =>
				reportExportResourceError(input, error, currentPageIndex, {
					pageKey: currentPageKey,
					pageName: currentPageName,
					pagePath: currentPagePath,
					pageFileId: currentPageFileId,
				}),
			onExportIssue: (issue) =>
				input.onExportIssue?.({
					...issue,
					pageIndex: issue.pageIndex ?? currentPageIndex,
					pageKey: issue.pageKey ?? currentPageKey,
					pageName: issue.pageName ?? currentPageName,
					pagePath: issue.pagePath ?? currentPagePath,
					pageFileId: issue.pageFileId ?? currentPageFileId,
				}),
		})
		await packager.ready

		for (let index = 1; index <= stagedKeys.length; index += 1) {
			throwIfAborted(input.signal)
			currentPageIndex = index - 1
			const pageMetadata = stagedPageMetadata.get(index)
			currentPageKey = pageMetadata?.key
			currentPageName = pageMetadata?.pageName
			currentPagePath = pageMetadata?.pagePath
			currentPageFileId = pageMetadata?.pageFileId
			const record = await runStagingOperation(
				input.signal,
				() => activeStore.getSlideIr<StagedSlideRecord>(index, { signal: input.signal }),
				usesDefaultOpfsStore ? { operation: "getSlideIr" } : undefined,
			)
			await packager.commitSlide({
				nodes: record.nodes,
				background: record.background,
				options: { slideKey: record.key },
			})
			record.nodes.length = 0
			const deleteSlideIr = activeStore.deleteSlideIr
			if (deleteSlideIr) {
				await runStagingOperation(
					input.signal,
					() => deleteSlideIr.call(activeStore, index, { signal: input.signal }),
					usesDefaultOpfsStore ? { operation: "deleteSlideIr" } : undefined,
				)
			}
			input.onProgress?.({
				phase: "package-page",
				pageIndex: index - 1,
				pageCount: stagedKeys.length,
			})
		}

		input.onProgress?.({ phase: "finalize", pageCount: stagedKeys.length })
		const summary = await packager.finalize()
		const result = {
			fileName: ensureFileName(input.fileName),
			pageCount: summary.slideCount,
			mediaPartCount: summary.mediaPartCount,
			bytesWritten: summary.bytesWritten,
			durationMs: now() - startedAt,
		}
		exportSucceeded = true
		return result
	} catch (error) {
		if (packager) await packager.abort(error).catch(() => undefined)
		else await abortDestination(input.destination, error)
		throw error
	} finally {
		packager?.dispose()
		if (store && shouldCleanupStaging(input.stagingPolicy?.cleanup, exportSucceeded)) {
			await cleanupStagingSession(store, sessionId)
		}
	}
}

/**
 * Remove SlideIR records already staged for the current page before replacing that page with a
 * diagnostic placeholder. Staged records are appended in order, so only the tail can belong to
 * the page currently being prepared.
 */
async function discardStagedPageRecords(
	store: StreamingStagingStore,
	stagedKeys: string[],
	stagedPageMetadata: Map<number, StagedPageMetadata>,
	pageStageStart: number,
	signal: AbortSignal,
	usesDefaultOpfsStore: boolean,
): Promise<void> {
	const deleteSlideIr = store.deleteSlideIr
	while (stagedKeys.length > pageStageStart) {
		const index = stagedKeys.length
		if (deleteSlideIr) {
			await runStagingOperation(
				signal,
				() => deleteSlideIr.call(store, index, { signal }),
				usesDefaultOpfsStore ? { operation: "deleteSlideIr" } : undefined,
			)
		}
		stagedPageMetadata.delete(index)
		stagedKeys.pop()
	}
}

function reportExportResourceError(
	input: StreamingExportTaskInput,
	error: ResourceLoadError,
	pageIndex?: number,
	pageIdentity?: Pick<ExportIssue, "pageKey" | "pageName" | "pagePath" | "pageFileId">,
): void {
	try {
		input.onResourceError?.(error)
	} catch {
		// Diagnostics must never turn a recoverable resource failure into an export failure.
	}
	try {
		input.onExportIssue?.({
			pageIndex,
			...pageIdentity,
			code: "resource-error",
			message: error.message || `${error.kind} ${error.reason}`,
			severity: "warning",
			details: {
				kind: error.kind,
				reason: error.reason,
				...(error.status === undefined ? {} : { status: error.status }),
				...(error.contentType ? { contentType: error.contentType } : {}),
			},
		} satisfies ExportIssue)
	} catch {
		// Issue listeners are observational and must not affect packaging.
	}
}

/** Report a recoverable page failure before the page is skipped. */
function reportPageExportError(
	input: StreamingExportTaskInput,
	page: StreamingHtmlPage,
	error: unknown,
): void {
	const diagnostic = isPptxExportError(error) ? error.diagnostic : undefined
	const sourceError = isExportFidelityError(error) ? error.sourceError : undefined
	const message = error instanceof Error ? error.message : String(error)
	try {
		input.onExportIssue?.({
			pageIndex: page.index,
			pageKey: page.key,
			pageName: page.pageName,
			pagePath: page.pagePath,
			pageFileId: page.pageFileId,
			code: "render-error",
			message,
			severity: "error",
			details: {
				phase: diagnostic?.phase ?? "render-page",
				recoverable: true,
				errorName: error instanceof Error ? error.name : typeof error,
				...(diagnostic?.code ? { failureCode: diagnostic.code } : {}),
				...(diagnostic?.details ? { diagnostic: diagnostic.details } : {}),
				...(error instanceof Error && error.stack
					? { stack: error.stack.slice(0, 4000) }
					: sourceError instanceof Error && sourceError.stack
						? { stack: sourceError.stack.slice(0, 4000) }
						: {}),
			},
		})
	} catch {
		// Diagnostics must never turn a recoverable page failure into an export failure.
	}
}

async function prepareStreamingPage(input: StreamingExportTaskInput, page: StreamingHtmlPage) {
	const activePrepare = input.pipeline?.prepareSlideNodes ?? prepareSlideNodes
	return activePrepare({
		config: input.config,
		html: page.html,
		sandbox: input.sandbox,
		signal: input.signal,
		pageIndex: page.index,
		pageKey: page.key,
		pageName: page.pageName,
		pagePath: page.pagePath,
		pageFileId: page.pageFileId,
		onResourceError: input.onResourceError,
		textMergeMode: DEFAULT_TEXT_MERGE_MODE,
		onExportIssue: input.onExportIssue,
		runtime: input.pipeline,
	})
}

/**
 * Decide whether an explicit image policy may require a second pass.
 *
 * A policy that only explicitly forwards every class of image remains on the direct path. Any
 * configured budget or action that can transform/reject an image is staged first, so a missing
 * transform hook or an error policy is reported before the packaging writer is created.
 */
/**
 * Apply the image policy after source normalization and before any media is staged or committed.
 * This path only inspects descriptor metadata and intrinsic DOM dimensions. In particular,
 * `passthrough` never calls Blob.arrayBuffer(), fetch(), or an image decoder.
 */
async function applyImagePreflight(
	nodes: SerializablePPTNode[],
	input: StreamingExportTaskInput,
): Promise<void> {
	const policy = input.imagePolicy
	if (!policy) return

	const transformImageDescriptor = input.pipeline?.transformImageDescriptor
	const kept: SerializablePPTNode[] = []
	for (const node of nodes) {
		if (node.type !== "image") {
			kept.push(node)
			continue
		}
		if (!node.source) throw new TypeError("Image node must provide a source descriptor")

		const decision = preflightPptImage(node, policy)
		if (decision.action === "passthrough") {
			kept.push(node)
			continue
		}

		if (decision.action === "reject") {
			if ((policy.rejectAction ?? "error") === "omit") continue
			throw createImagePreflightError(
				"preflight",
				"preflight-rejected",
				"Image rejected by imagePolicy",
				node,
				decision,
			)
		}

		if (!transformImageDescriptor) {
			throw createImagePreflightError(
				"transform-media",
				"media-transform-failed",
				"Image policy requires a transformImageDescriptor runtime hook",
				node,
				decision,
			)
		}

		let transformed: ImageTransformDescriptorResult
		try {
			transformed = await transformImageDescriptor({
				source: node.source,
				intrinsicSize: node.intrinsicSize,
				decision,
				assetKey: node.assetKey,
				sizing: node.sizing,
				signal: input.signal,
			})
		} catch (error) {
			throw normalizePptxExportError(error, {
				phase: "transform-media",
				code: "media-transform-failed",
				details: imageDecisionDetails(node.assetKey, decision),
			})
		}

		const result = unpackImageTransformResult(transformed)
		if (!result) {
			throw createImagePreflightError(
				"transform-media",
				"media-transform-failed",
				"transformImageDescriptor returned an invalid media descriptor",
				node,
				decision,
			)
		}
		node.source = withMediaSourceKey(result.source, node.assetKey)
		if (result.intrinsicSize) node.intrinsicSize = result.intrinsicSize
		kept.push(node)
	}

	if (kept.length !== nodes.length) {
		nodes.splice(0, nodes.length, ...kept)
	}
}

function unpackImageTransformResult(
	result: ImageTransformDescriptorResult,
):
	| { source: MediaSourceDescriptor; intrinsicSize?: { width: number; height: number } }
	| undefined {
	if (isMediaSourceDescriptor(result)) return { source: result }
	if (!result || typeof result !== "object" || !("source" in result)) return undefined
	const source = (result as { source?: unknown }).source
	if (!isMediaSourceDescriptor(source)) return undefined
	const intrinsicSize = (result as { intrinsicSize?: unknown }).intrinsicSize
	if (
		intrinsicSize !== undefined &&
		(!intrinsicSize ||
			typeof intrinsicSize !== "object" ||
			!Number.isFinite((intrinsicSize as { width?: unknown }).width) ||
			!Number.isFinite((intrinsicSize as { height?: unknown }).height))
	) {
		return undefined
	}
	return {
		source,
		...(intrinsicSize === undefined
			? {}
			: { intrinsicSize: intrinsicSize as { width: number; height: number } }),
	}
}

function isMediaSourceDescriptor(value: unknown): value is MediaSourceDescriptor {
	if (!value || typeof value !== "object") return false
	const source = value as { kind?: unknown; key?: unknown; contentType?: unknown; extn?: unknown }
	return (
		(source.kind === "opfs" ||
			source.kind === "blob" ||
			source.kind === "url" ||
			source.kind === "bytes" ||
			source.kind === "path") &&
		typeof source.key === "string" &&
		typeof source.contentType === "string" &&
		typeof source.extn === "string"
	)
}

function createImagePreflightError(
	phase: "preflight" | "transform-media",
	code: "preflight-rejected" | "media-transform-failed",
	message: string,
	node: SerializablePPTNode & { type: "image" },
	decision: ImagePreflightDecision,
): PptxExportError {
	return new PptxExportError({
		phase,
		code,
		message,
		recoverable: false,
		cancelled: false,
		details: imageDecisionDetails(node.assetKey, decision),
	})
}

function imageDecisionDetails(
	assetKey: string | undefined,
	decision: ImagePreflightDecision,
): Record<string, unknown> {
	return {
		assetKey,
		action: decision.action,
		reason: decision.reason,
		contentType: decision.contentType,
		...(decision.encodedBytes === undefined ? {} : { encodedBytes: decision.encodedBytes }),
		...(decision.width === undefined ? {} : { width: decision.width }),
		...(decision.height === undefined ? {} : { height: decision.height }),
		...(decision.pixelCount === undefined ? {} : { pixelCount: decision.pixelCount }),
	}
}

async function normalizeNodeMediaSources(nodes: SerializablePPTNode[]): Promise<void> {
	for (const node of nodes) {
		if (node.type === "image") {
			if (!node.source) throw new TypeError("Image node must provide a source descriptor")
			node.source = withMediaSourceKey(node.source, node.assetKey)
			continue
		}
		if (node.type !== "media" || node.mediaType === "online") continue
		if (!node.source)
			throw new TypeError(`${node.mediaType} node must provide a source descriptor`)
		node.source = withMediaSourceKey(node.source, node.assetKey)
		if (node.coverSource)
			node.coverSource = withMediaSourceKey(node.coverSource, node.coverAssetKey)
	}
}

async function stageNodeMediaSources(
	nodes: SerializablePPTNode[],
	store: StreamingStagingStore,
	signal: AbortSignal,
	stagedMedia: Map<string, MediaSourceDescriptor>,
	mediaMode: MediaPolicy["mode"],
	allowsOpfsDescriptors: boolean,
	opfsOperation?: string,
): Promise<void> {
	for (const node of nodes) {
		if (node.type === "image" && node.source) {
			node.source = await stageDescriptor(
				node.source,
				store,
				signal,
				stagedMedia,
				mediaMode,
				allowsOpfsDescriptors,
				opfsOperation,
			)
		}
		if (node.type === "media") {
			if (node.source) {
				node.source = await stageDescriptor(
					node.source,
					store,
					signal,
					stagedMedia,
					mediaMode,
					allowsOpfsDescriptors,
					opfsOperation,
				)
			}
			if (node.coverSource) {
				node.coverSource = await stageDescriptor(
					node.coverSource,
					store,
					signal,
					stagedMedia,
					mediaMode,
					allowsOpfsDescriptors,
					opfsOperation,
				)
			}
		}
	}
}

async function stageDescriptor(
	source: MediaSourceDescriptor,
	store: StreamingStagingStore,
	signal: AbortSignal,
	stagedMedia: Map<string, MediaSourceDescriptor>,
	mediaMode: MediaPolicy["mode"],
	allowsOpfsDescriptors: boolean,
	opfsOperation?: string,
): Promise<MediaSourceDescriptor> {
	const existing = stagedMedia.get(source.key)
	if (existing) return existing
	if (source.kind === "opfs") {
		if (!allowsOpfsDescriptors) {
			throw createOpfsUnavailableError(
				new Error(`In-memory staging cannot read OPFS media source "${source.key}"`),
				{ reason: "runtime-operation-rejected", operation: "stage" },
			)
		}
		stagedMedia.set(source.key, source)
		return source
	}
	if (!shouldStageMediaSource(source, mediaMode)) {
		stagedMedia.set(source.key, source)
		return source
	}
	const staged = await runStagingOperation(
		signal,
		() => store.stage(source, { signal, directory: "media" }),
		opfsOperation ? { operation: opfsOperation } : undefined,
	)
	stagedMedia.set(source.key, staged)
	return staged
}

/**
 * Run a staging operation with cancellation at the runner boundary.
 *
 * OPFS implementations receive the signal and can cancel their own I/O. The
 * additional race here is intentional: custom/native stores may not observe
 * AbortSignal, so a cancelled export must not wait forever for their promise
 * to settle. The original promise remains handled by `withAbort`, preventing a
 * late rejection from becoming an unhandled rejection.
 */
function runStagingOperation<T>(
	signal: AbortSignal,
	operation: () => Promise<T>,
	opfsDetails?: { operation: string; classifyAll?: boolean },
): Promise<T> {
	throwIfSandboxAborted(signal)
	const task = Promise.resolve().then(() => {
		throwIfSandboxAborted(signal)
		return operation()
	})
	return withAbort({ task, signal }).catch((error) => {
		if (
			opfsDetails &&
			!signal.aborted &&
			!isPptxExportError(error) &&
			(opfsDetails.classifyAll || isLikelyOpfsUnavailableError(error))
		) {
			throw createOpfsUnavailableError(error, {
				reason: "runtime-operation-rejected",
				operation: opfsDetails.operation,
			})
		}
		throw error
	})
}

function isLikelyOpfsUnavailableError(error: unknown): boolean {
	if (isOpfsUnavailableError(error)) return true
	const name =
		error && typeof error === "object" && "name" in error
			? String((error as { name?: unknown }).name ?? "")
			: ""
	if (["NotSupportedError", "SecurityError", "InvalidStateError"].includes(name)) {
		return true
	}
	const message = error instanceof Error ? error.message : String(error ?? "")
	return /origin private file system|\bopfs\b|storage\.getDirectory|createWritable|opfs.*(?:unavailable|not writable|permission|quota)/i.test(
		message,
	)
}

/** Do not turn a quota exhaustion into an unbounded heap allocation. */
function isSafeInMemoryFallbackError(error: unknown): boolean {
	const sourceError = isPptxExportError(error) ? error.sourceError : error
	const name =
		sourceError && typeof sourceError === "object" && "name" in sourceError
			? String((sourceError as { name?: unknown }).name ?? "")
			: ""
	if (name === "QuotaExceededError") return false
	const message = sourceError instanceof Error ? sourceError.message : String(sourceError ?? "")
	if (/quota|storage\s+(?:full|limit)|disk\s+full/i.test(message)) return false
	if (isPptxExportError(error)) return isLikelyOpfsUnavailableError(sourceError)
	return isLikelyOpfsUnavailableError(error)
}

const STAGING_CLEANUP_ATTEMPTS = 2

/** Best-effort cleanup that never masks the export result/error. */
async function cleanupStagingSession(
	store: StreamingStagingStore,
	sessionId: string,
): Promise<void> {
	let lastError: unknown
	let failed = false
	for (let attempt = 1; attempt <= STAGING_CLEANUP_ATTEMPTS; attempt += 1) {
		try {
			await store.cleanupSession(sessionId)
			return
		} catch (error) {
			failed = true
			lastError = error
			// Give a rejected OPFS operation a microtask to release any transient
			// handle before the bounded retry. No unbounded backoff is used here.
			if (attempt < STAGING_CLEANUP_ATTEMPTS) await Promise.resolve()
		}
	}

	if (!failed) return
	try {
		log(LogLevel.L3, "Streaming staging cleanup failed", {
			sessionId,
			attempts: STAGING_CLEANUP_ATTEMPTS,
			error: lastError instanceof Error ? lastError.message : String(lastError),
		})
	} catch {
		// Logging must never replace the export's primary result/error.
	}
}

function shouldStageMediaSource(
	source: MediaSourceDescriptor,
	mediaMode: MediaPolicy["mode"],
): boolean {
	// Blob and ArrayBuffer fields are lost by the JSON SlideIR store, so they
	// always become repeatable OPFS descriptors before the record is written.
	if (source.kind === "blob" || source.kind === "bytes") return true
	// A staged export is a two-pass pipeline: pages are collected first and
	// replayed later. Signed/expiring URLs therefore must be fetched while the
	// page is still being collected. `auto` (including an omitted mode) uses
	// rolling staging for URL/blob URLs; `direct-stream` is an explicit opt-out
	// for callers that can guarantee a replayable URL or path.
	if (source.kind === "url") return mediaMode !== "direct-stream"
	// Stable path descriptors survive JSON replay and remain direct-streamed
	// unless the caller explicitly requests a media staging strategy.
	return mediaMode === "rolling-stage" || mediaMode === "full-stage"
}

async function createStagingStore(
	input: StreamingExportTaskInput,
	sessionId: string,
	canUseInMemoryStaging: boolean,
): Promise<CreatedStagingStore> {
	if (input.pipeline?.createStreamingStagingStore) {
		const store = await input.pipeline.createStreamingStagingStore({
			config: input.config,
			sessionId,
		})
		return {
			store,
			usesDefaultOpfs: false,
			allowsOpfsDescriptors: store.stagingKind !== "memory",
		}
	}
	if (canUseInMemoryStaging && !hasOpfsCapability()) {
		return {
			store: createInMemoryStreamingStagingStore(),
			usesDefaultOpfs: false,
			allowsOpfsDescriptors: false,
		}
	}
	const presentation = createPresentation(input.config) as unknown as StreamingPptxWithStaging
	if (typeof presentation.createOpfsStagingStore !== "function") {
		if (canUseInMemoryStaging) {
			return {
				store: createInMemoryStreamingStagingStore(),
				usesDefaultOpfs: false,
				allowsOpfsDescriptors: false,
			}
		}
		throw createOpfsUnavailableError(
			new Error("PptxGenJS v5 createOpfsStagingStore() is unavailable"),
			{ reason: "runtime-hook-missing" },
		)
	}
	try {
		return {
			store: await presentation.createOpfsStagingStore({ sessionId }),
			usesDefaultOpfs: true,
			allowsOpfsDescriptors: true,
		}
	} catch (error) {
		if (canUseInMemoryStaging && isSafeInMemoryFallbackError(error)) {
			return {
				store: createInMemoryStreamingStagingStore(),
				usesDefaultOpfs: false,
				allowsOpfsDescriptors: false,
			}
		}
		throw createOpfsUnavailableError(error, {
			reason: "runtime-operation-rejected",
		})
	}
}

function hasOpfsCapability(): boolean {
	try {
		const storage = typeof navigator === "undefined" ? undefined : navigator.storage
		return (
			typeof (storage as (StorageManager & { getDirectory?: unknown }) | undefined)
				?.getDirectory === "function"
		)
	} catch {
		return false
	}
}

async function resolveFonts(
	input: StreamingExportTaskInput,
	usedFonts: Map<string, Set<string>>,
): Promise<EmbedFontInput[]> {
	if (!input.fontResolver || usedFonts.size === 0) return []
	const fonts: UsedFont[] = Array.from(usedFonts, ([typeface, faceKeys]) => ({
		typeface,
		faceKeys: Array.from(faceKeys).sort(),
	}))
	return (
		(await input.fontResolver(fonts, {
			missPolicy: input.fontMissPolicy ?? "fallback-with-warning",
		})) ?? []
	)
}

function mergeUsedFonts(target: Map<string, Set<string>>, fonts: UsedFont[]): void {
	for (const font of fonts) {
		let faceKeys = target.get(font.typeface)
		if (!faceKeys) {
			faceKeys = new Set<string>()
			target.set(font.typeface, faceKeys)
		}
		for (const faceKey of font.faceKeys) faceKeys.add(faceKey)
	}
}

function createFrozenPlan(
	keys: readonly string[],
	media: ReadonlyMap<string, MediaSourceDescriptor>,
): StreamingPresentationPlan {
	const slides = keys.map((key, index) => {
		const ordinal = index + 1
		return {
			key,
			ordinal,
			slideId: ordinal + 255,
			presentationRelId: ordinal + 1,
			partName: `ppt/slides/slide${ordinal}.xml`,
		}
	})
	return {
		finalSlideCount: slides.length,
		slidePlan: { slides },
		capacityPlan: createCapacityPlan(slides.length, media, { mediaScanComplete: true }),
	}
}

function createCapacityOnlyPlan(pageCount?: number): StreamingPresentationPlan {
	return {
		// The direct path starts packaging before pages and media are observed. An
		// empty map here means "not scanned yet", rather than "this export has no
		// media". Unknown media stays on classic ZIP for PowerPoint compatibility;
		// the PptxGenJS writer aborts before a real ZIP32 overflow.
		capacityPlan: createCapacityPlan(pageCount ?? 0, new Map(), { mediaScanComplete: false }),
	}
}

interface CapacityPlanOptions {
	/** Whether the supplied media map represents the complete export. */
	readonly mediaScanComplete?: boolean
}

const ZIP32_SIZE_SENTINEL = BigInt("4294967295")
const ZIP32_ENTRY_COUNT_SENTINEL = BigInt("65535")

function createCapacityPlan(
	slideCount: number,
	media: ReadonlyMap<string, MediaSourceDescriptor>,
	options: CapacityPlanOptions = {},
) {
	let knownInputBytes = BigInt(0)
	let maxKnownEntryBytes: bigint | undefined
	let hasUnknownLengthSource = options.mediaScanComplete !== true
	for (const source of media.values()) {
		const size = descriptorSize(source)
		if (size === undefined) {
			hasUnknownLengthSource = true
			continue
		}
		const bytes = BigInt(size)
		knownInputBytes += bytes
		if (maxKnownEntryBytes === undefined || bytes > maxKnownEntryBytes) {
			maxKnownEntryBytes = bytes
		}
	}
	const estimatedEntryCount = BigInt(Math.max(24, slideCount * 6 + media.size + 24))
	// Browser HTML exports commonly discover media lengths only while the
	// Packaging Worker opens each resource. Selecting ZIP64 merely because a
	// length is unknown makes otherwise small presentations unreadable by some
	// PowerPoint versions. Opt unknown sources into classic ZIP; PptxGenJS still
	// enforces the ZIP32 byte/entry limits and aborts before emitting overflow.
	const unknownLengthSourceMayReachZip32Limit = false
	const maxEntryBytesMayReachZip32Limit =
		(maxKnownEntryBytes !== undefined && maxKnownEntryBytes >= ZIP32_SIZE_SENTINEL)
	const archiveBytesMayReachZip32Limit = knownInputBytes >= ZIP32_SIZE_SENTINEL
	const entryCountMayReachZip32Limit = estimatedEntryCount >= ZIP32_ENTRY_COUNT_SENTINEL
	return {
		confidence: hasUnknownLengthSource ? "streaming-unknown" : "upper-bound",
		zipMode:
			maxEntryBytesMayReachZip32Limit ||
			archiveBytesMayReachZip32Limit ||
			entryCountMayReachZip32Limit
				? "zip64"
				: "classic",
		hasUnknownLengthSource,
		unknownLengthSourceMayReachZip32Limit,
		maxEntryBytesMayReachZip32Limit,
		// Unknown lengths are represented by hasUnknownLengthSource. Keep this
		// field tied to the known aggregate/explicit archive estimate so the
		// snapshot matches PptxGenJS's CapacityPlan contract.
		archiveBytesMayReachZip32Limit,
		entryCountMayReachZip32Limit,
		knownInputBytes,
		maxKnownEntryBytes,
		estimatedEntryCount,
	}
}

/**
 * Sink-proxy destinations are the browser-owned buffered/download route. A
 * raw WritableStream remains a true file-stream target and must still require
 * OPFS for replay instead of silently growing the heap.
 */
function isSinkProxyDestination(destination?: PptxDestination): boolean {
	if (!destination || typeof destination !== "object") return false
	if ("kind" in destination && (destination as { kind?: unknown }).kind === "sink-proxy") {
		return (destination as { replayPolicy?: string }).replayPolicy === "buffered"
	}
	return false
}

function normalizeWorkerDestination(destination: PptxDestination): StreamingWorkerDestination {
	if (isWritableStream(destination)) return { kind: "writable-stream", writable: destination }
	const wrapped = destination as {
		kind?: string
		writable?: WritableStream<Uint8Array> | NodeJS.WritableStream
		sink?: {
			write(chunk: Uint8Array): void | Promise<void>
			close(): void | Promise<void>
			abort?(reason?: unknown): void | Promise<void>
		}
		ackWindow?: number
	}
	if (wrapped.kind) {
		if (wrapped.kind === "sink-proxy" && wrapped.sink) {
			return { kind: "sink-proxy", sink: wrapped.sink, ackWindow: wrapped.ackWindow }
		}
		if (
			(wrapped.kind === "writable-stream" || wrapped.kind === "transferable-stream") &&
			isWritableStream(wrapped.writable)
		) {
			return { kind: "writable-stream", writable: wrapped.writable }
		}
		if (wrapped.kind === "node-writable" && isNodeWritable(wrapped.writable)) {
			return nodeWritableDestination(wrapped.writable)
		}
	}
	if (isOutputSink(destination)) return { kind: "sink-proxy", sink: destination }
	if (isNodeWritable(destination)) return nodeWritableDestination(destination)
	throw new TypeError("Unsupported PPTX streaming destination")
}

function nodeWritableDestination(writable: NodeJS.WritableStream): StreamingWorkerDestination {
	return {
		kind: "sink-proxy",
		sink: {
			write: (chunk) => writeNodeChunk(writable, chunk),
			close: () => endNodeWritable(writable),
			abort: (reason) => {
				;(
					writable as NodeJS.WritableStream & { destroy?: (error?: Error) => void }
				).destroy?.(
					reason instanceof Error
						? reason
						: new Error(String(reason ?? "Export aborted")),
				)
			},
		},
	}
}

/** Release a caller-owned destination when no packager was created to take ownership. */
async function abortDestination(
	destination: PptxDestination | undefined,
	reason: unknown,
): Promise<void> {
	if (!destination) return
	try {
		if (isWritableStream(destination)) {
			await destination.abort(reason)
			return
		}
		const wrapped = destination as {
			kind?: string
			writable?: WritableStream<Uint8Array> | NodeJS.WritableStream
			sink?: { abort?(reason?: unknown): void | Promise<void> }
		}
		if (wrapped.kind === "sink-proxy") {
			await wrapped.sink?.abort?.(reason)
			return
		}
		if (
			(wrapped.kind === "writable-stream" || wrapped.kind === "transferable-stream") &&
			isWritableStream(wrapped.writable)
		) {
			await wrapped.writable.abort(reason)
			return
		}
		if (wrapped.kind === "node-writable" && isNodeWritable(wrapped.writable)) {
			destroyNodeWritable(wrapped.writable, reason)
			return
		}
		if (isOutputSink(destination)) {
			await destination.abort?.(reason)
			return
		}
		if (isNodeWritable(destination)) destroyNodeWritable(destination, reason)
	} catch {
		// Preserve the render/preflight error that caused the destination release.
	}
}

function destroyNodeWritable(writable: NodeJS.WritableStream, reason: unknown): void {
	;(writable as NodeJS.WritableStream & { destroy?: (error?: Error) => void }).destroy?.(
		reason instanceof Error ? reason : new Error(String(reason ?? "Export aborted")),
	)
}

function writeNodeChunk(writable: NodeJS.WritableStream, chunk: Uint8Array): Promise<void> {
	return new Promise((resolve, reject) => {
		let settled = false
		const done = (error?: Error | null) => {
			if (settled) return
			settled = true
			writable.removeListener?.("error", onError)
			error ? reject(error) : resolve()
		}
		const onError = (error: Error) => done(error)
		writable.once?.("error", onError)
		try {
			writable.write(chunk, (error?: Error | null) => done(error))
		} catch (error) {
			done(error instanceof Error ? error : new Error(String(error)))
		}
	})
}

function endNodeWritable(writable: NodeJS.WritableStream): Promise<void> {
	return new Promise((resolve, reject) => {
		const onError = (error: Error) => reject(error)
		writable.once?.("error", onError)
		writable.end(() => {
			writable.removeListener?.("error", onError)
			resolve()
		})
	})
}

function createPackagerOrThrow(
	createPackager: NonNullable<
		StreamingExportTaskInput["pipeline"]
	>["createStreamingPresentationPackager"],
	input: Parameters<NonNullable<typeof createPackager>>[0],
): StreamingPresentationPackager {
	if (!createPackager) throw new Error("Streaming presentation packager is unavailable")
	return createPackager(input)
}

function buildFinalAutoSizeConfig(config: SlideConfig, measuredMaxWidth: number): SlideConfig {
	const htmlWidth = Math.max(config.htmlWidth, measuredMaxWidth)
	return {
		...config,
		htmlWidth,
		slideWidth: htmlWidth / DEFAULT_DPI,
	}
}

function createSlideKey(sourceKey: string | undefined, index: number, pageOffset: number): string {
	const key = sourceKey?.trim() || `page-${index + 1}`
	return pageOffset === 0 ? key : `${key}-${pageOffset + 1}`
}

function descriptorSize(source: MediaSourceDescriptor): number | undefined {
	if (source.kind === "bytes") return source.data.byteLength
	return "size" in source ? source.size : undefined
}

function shouldCleanupStaging(policy: StagingPolicy["cleanup"], succeeded: boolean): boolean {
	switch (policy) {
		case "never":
			return false
		case "on-success":
			return succeeded
		case "on-error":
			return !succeeded
		default:
			return true
	}
}

function createSessionId(): string {
	const id =
		globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
	return `session-${id.replace(/[^A-Za-z0-9_-]/g, "-")}`
}

function isWritableStream(value: unknown): value is WritableStream<Uint8Array> {
	return Boolean(value) && typeof (value as { getWriter?: unknown }).getWriter === "function"
}

function isOutputSink(value: unknown): value is {
	write(chunk: Uint8Array): void | Promise<void>
	close(): void | Promise<void>
	abort?(reason?: unknown): void | Promise<void>
} {
	return (
		Boolean(value) &&
		typeof (value as { write?: unknown }).write === "function" &&
		typeof (value as { close?: unknown }).close === "function"
	)
}

function isNodeWritable(value: unknown): value is NodeJS.WritableStream {
	return (
		Boolean(value) &&
		typeof (value as { write?: unknown }).write === "function" &&
		typeof (value as { end?: unknown }).end === "function" &&
		typeof (value as { on?: unknown }).on === "function"
	)
}

function throwIfAborted(signal: AbortSignal): void {
	if (signal.aborted) throw createAbortError()
}

function now(): number {
	return typeof performance === "undefined" ? Date.now() : performance.now()
}

// Keep the imported node union visible to declaration emit when custom runtimes
// override prepareSlideNodes with a structurally compatible implementation.
void (undefined as unknown as PPTNode)
