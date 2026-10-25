import type { SlideConfig } from "../api/options"
import type { ExportIssue, ResourceLoadError } from "../api/options"
import type { PPTNode } from "../ir/node"
import type { SandboxInstance } from "../sandbox/htmlRenderSandbox"
import { log, LogLevel } from "../logger"
import { collectElements, filterRenderable, sortByZOrder } from "../collector"
import { transformElements } from "../transform"
import {
	materializePptImageNodes,
	materializePseudoIcons,
	restoreIcons,
} from "../materialize"
import type { RenderSlideRuntime } from "../runtime"
import { ensureNotAborted } from "./abort-guard"
import { extractBodyBackground } from "./slide-background"
import { DEFAULT_TEXT_MERGE_MODE, type TextMergeMode } from "./text-merge-mode"

export interface PrepareSlideNodesInput {
	config: SlideConfig
	html: string
	sandbox: SandboxInstance
	signal: AbortSignal
	pageIndex?: number
	pageKey?: string
	pageName?: string
	pagePath?: string
	pageFileId?: string
	onResourceError?: (error: ResourceLoadError) => void
	onExportIssue?: (issue: ExportIssue) => void
	textMergeMode?: TextMergeMode
	runtime?: RenderSlideRuntime
}

export interface PrepareSlideNodesResult {
	pptNodes: PPTNode[]
	/** Measured content width in px */
	totalWidth: number
	/** Measured content height in px, used to determine whether pagination is needed */
	totalHeight: number
	/** body/html background color (hex without #), used as the PPT slide background */
	bodyBackground: string | null
}

/**
 * Single-page pre-render stage:
 * render HTML -> materialize icons -> collect -> filter -> sort -> transform -> prepare
 *
 * Returned `pptNodes` coordinates are already in inches, based on a 1:1 mapping at 96 DPI,
 * and can be further split into multiple PPT pages by sliceByPageHeight.
 */
export async function prepareSlideNodes({
	config,
	html,
	sandbox,
	signal,
	pageIndex,
	pageKey,
	pageName,
	pagePath,
	pageFileId,
	onResourceError,
	onExportIssue,
	textMergeMode = DEFAULT_TEXT_MERGE_MODE,
	runtime,
}: PrepareSlideNodesInput): Promise<PrepareSlideNodesResult> {
	ensureNotAborted(signal)
	const reportResourceError = (error: ResourceLoadError) => {
		onResourceError?.(error)
		onExportIssue?.({
			pageIndex,
			pageKey,
			pageName,
			pagePath,
			pageFileId,
			code: "resource-error",
			message: `${error.kind} ${error.reason}`,
			severity: "warning",
			details: { kind: error.kind, reason: error.reason },
		})
	}
	const { iWindow, iDocument, totalWidth, totalHeight } = await sandbox.render(html, {
		signal,
		onResourceError: reportResourceError,
		onExportIssue: (issue) =>
			onExportIssue?.({
				...issue,
				pageIndex: issue.pageIndex ?? pageIndex,
				pageKey: issue.pageKey ?? pageKey,
				pageName: issue.pageName ?? pageName,
				pagePath: issue.pagePath ?? pagePath,
				pageFileId: issue.pageFileId ?? pageFileId,
			}),
	})
	ensureNotAborted(signal)

	const bodyBackground = extractBodyBackground(iDocument, iWindow)
	const activeMaterializePseudoIcons = runtime?.materializePseudoIcons ?? materializePseudoIcons
	const activeRestoreIcons = runtime?.restoreIcons ?? restoreIcons
	const activeTransformElements = runtime?.transformElements ?? transformElements
	const activeMaterializePptImageNodes =
		runtime?.materializePptImageNodes ?? materializePptImageNodes
	const iconBackups = activeMaterializePseudoIcons(iDocument, iWindow)

	try {
		const elements = collectElements(iDocument, iWindow)
		log(LogLevel.L2, `收集到 ${elements.length} 个元素`)

		const renderableElements = filterRenderable(elements)
		log(LogLevel.L2, `过滤后 ${renderableElements.length} 个可绘制元素`)

		const sortedElements = sortByZOrder(renderableElements)

		const pptNodes = activeTransformElements(sortedElements, config, iWindow, {
			textMergeMode,
			elementNodeMap: new Map(elements.map((element) => [element.element, element])),
		})
		log(LogLevel.L2, `转换为 ${pptNodes.length} 个绘制节点`, {
			totalWidth,
			totalHeight,
		})

		ensureNotAborted(signal)
		if (runtime?.resolveCaptures) {
			await runtime.resolveCaptures(pptNodes, signal, reportResourceError)
		}
		if (runtime?.materializeVideoCoverNodes) {
			await runtime.materializeVideoCoverNodes(pptNodes, signal, reportResourceError)
		}
		await activeMaterializePptImageNodes(pptNodes, signal, reportResourceError)
		return { pptNodes, totalWidth, totalHeight, bodyBackground }
	} catch (error) {
		throw error
	} finally {
		activeRestoreIcons(iconBackups)
	}
}
