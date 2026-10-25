/**
 * Markdown → Image 导出工具
 *
 * 流程：离屏渲染 EditorBody → 预处理 → snapdom 截图 → 下载
 */
import React from "react"
import { createRoot } from "react-dom/client"
import {
	captureElementToCanvas,
	type ImageExportProgress,
	type ImageExportFormat,
} from "@magic-web/html2image"
import { useImageUrlResolver } from "@/pages/superMagic/components/Detail/contents/Md/hooks/useImageUrlResolver"
import {
	processMarkdownImages,
	type AttachmentFile,
	type ImageUrlMap,
} from "@/pages/superMagic/utils/image-url-resolver"
import { sanitizeEditorDomForExport } from "./sanitizeEditorDom"

// ─── 类型 ───────────────────────────────────────────────────

export interface ExportMarkdownToImageOptions {
	/** Markdown 内容 */
	markdown: string
	/** 已由业务层处理过的 Markdown 内容 */
	processedContent?: string
	/** 图片格式 */
	format?: ImageExportFormat
	/** 导出文件名（不含扩展名） */
	fileName?: string
	/** 进度回调 */
	onProgress?: (ctx: ImageExportProgress) => void
	/** EditorBody 需要的 props */
	selectedProject?: any
	relativeFilePath?: string
	attachments?: AttachmentFile[]
	initialImageUrlMap?: ImageUrlMap
}

// ─── 离屏渲染组件 ──────────────────────────────────────────

function OffscreenEditor(props: {
	content: string
	processedContent?: string
	selectedProject?: any
	currentDocumentPath?: string
	attachments?: AttachmentFile[]
	initialImageUrlMap?: ImageUrlMap
	onReady: () => void
}) {
	const [EditorBody, setEditorBody] = React.useState<React.ComponentType<any> | null>(null)

	const { urlResolver } = useImageUrlResolver({
		attachments: props.attachments || [],
		relativeFilePath: props.currentDocumentPath,
		initialImageUrlMap: props.initialImageUrlMap,
	})

	React.useEffect(() => {
		import("@/pages/superMagic/components/Detail/contents/Md/components/EditorBody").then(
			(mod) => setEditorBody(() => mod.default),
		)
	}, [])

	React.useEffect(() => {
		if (!EditorBody) return
		const timer = setTimeout(() => props.onReady(), 3000)
		return () => clearTimeout(timer)
	}, [EditorBody, props.onReady])

	if (!EditorBody) return null

	return (
		<EditorBody
			isLoading={false}
			viewMode="desktop"
			content={props.content}
			processedContent={props.processedContent || props.content}
			isEditMode={false}
			enableSearch={false}
			selectedProject={props.selectedProject}
			currentDocumentPath={props.currentDocumentPath}
			urlResolver={urlResolver}
			attachments={props.attachments}
		/>
	)
}

// ─── 工具函数 ───────────────────────────────────────────────

const OFFSCREEN_WIDTH = 794
const noop = (): void => undefined

function createOffscreenContainer(): HTMLDivElement {
	const host = document.createElement("div")
	host.style.cssText = `
		position: fixed;
		left: -9999px;
		top: 0;
		width: ${OFFSCREEN_WIDTH}px;
		overflow: visible;
		pointer-events: none;
		z-index: -9999;
	`
	document.body.appendChild(host)
	return host
}

function installExportIntersectionObserverPatch(): () => void {
	if (typeof window === "undefined" || !window.IntersectionObserver) {
		return noop
	}

	const OriginalIntersectionObserver = window.IntersectionObserver

	const createEntry = (target: Element): IntersectionObserverEntry => {
		const rect = target.getBoundingClientRect()
		return {
			time: performance.now(),
			target,
			rootBounds: null,
			boundingClientRect: rect,
			intersectionRect: rect,
			isIntersecting: true,
			intersectionRatio: 1,
		}
	}

	const PatchedIntersectionObserver = function (
		callback: IntersectionObserverCallback,
		options?: IntersectionObserverInit,
	) {
		const observer = new OriginalIntersectionObserver(callback, options)
		const originalObserve = observer.observe.bind(observer)

		observer.observe = (target: Element) => {
			originalObserve(target)
			window.setTimeout(() => {
				callback([createEntry(target)], observer)
			}, 0)
		}

		return observer
	} as unknown as typeof IntersectionObserver

	PatchedIntersectionObserver.prototype = OriginalIntersectionObserver.prototype
	window.IntersectionObserver = PatchedIntersectionObserver

	return () => {
		window.IntersectionObserver = OriginalIntersectionObserver
	}
}

async function prepareMarkdownForExport(options: ExportMarkdownToImageOptions): Promise<{
	processedContent: string
	imageUrlMap: ImageUrlMap
}> {
	if (options.initialImageUrlMap) {
		return {
			processedContent: options.processedContent || options.markdown,
			imageUrlMap: options.initialImageUrlMap,
		}
	}

	if (!options.attachments?.length) {
		return {
			processedContent: options.markdown,
			imageUrlMap: new Map(),
		}
	}

	const prepared = await processMarkdownImages(
		options.markdown,
		options.attachments,
		options.relativeFilePath,
	)

	return {
		processedContent: options.processedContent || prepared.processedContent,
		imageUrlMap: prepared.imageUrlMap,
	}
}

async function waitForRenderedImages(container: HTMLElement, timeout = 5000): Promise<void> {
	const startedAt = Date.now()

	while (Date.now() - startedAt < timeout) {
		const images = Array.from(container.querySelectorAll("img"))
		if (
			images.length === 0 ||
			images.every((image) => image.complete && image.naturalWidth > 0)
		) {
			return
		}
		await new Promise((resolve) => window.setTimeout(resolve, 100))
	}
}

// ─── 公开 API ───────────────────────────────────────────────

/**
 * 离屏渲染 Markdown 内容并导出为图片
 */
export function exportMarkdownToImage(options: ExportMarkdownToImageOptions): {
	promise: Promise<void>
	cancel: () => void
} {
	const abortController = new AbortController()
	let offscreenHost: HTMLDivElement | null = null
	let reactRoot: ReturnType<typeof createRoot> | null = null
	let restoreIntersectionObserver: (() => void) | null = null

	const promise = (async () => {
		const prepared = await prepareMarkdownForExport(options)
		restoreIntersectionObserver = installExportIntersectionObserverPatch()
		offscreenHost = createOffscreenContainer()

		const { default: AppearanceProvider } = await import("@/providers/AppearanceProvider")

		// 1. 离屏渲染 EditorBody
		const editorContainer = document.createElement("div")
		editorContainer.className = "tiptap-editor-root"
		offscreenHost.appendChild(editorContainer)

		await new Promise<void>((resolve) => {
			reactRoot = createRoot(editorContainer)
			reactRoot.render(
				React.createElement(
					AppearanceProvider,
					null,
					React.createElement(OffscreenEditor, {
						content: options.markdown,
						processedContent: prepared.processedContent,
						selectedProject: options.selectedProject,
						currentDocumentPath: options.relativeFilePath,
						attachments: options.attachments,
						initialImageUrlMap: prepared.imageUrlMap,
						onReady: resolve,
					}),
				),
			)
		})

		if (abortController.signal.aborted) throw new Error("Cancelled")

		await waitForRenderedImages(editorContainer)

		// 2. 清理交互 UI + 预处理
		await sanitizeEditorDomForExport(editorContainer)

		if (abortController.signal.aborted) throw new Error("Cancelled")

		// 3. snapdom 截图 → 下载图片
		const format = options.format ?? "png"
		const ext = format === "png" ? "png" : "jpg"
		const mimeType = format === "png" ? "image/png" : "image/jpeg"
		const cleanFileName = (options.fileName || "export").replace(/\.[^.]+$/, "")

		options.onProgress?.({ phase: "capture", current: 0, total: 1 })
		const canvas = await captureElementToCanvas({
			element: editorContainer,
			signal: abortController.signal,
		})
		options.onProgress?.({ phase: "capture", current: 1, total: 1 })

		// 编码 + 下载
		const blob = await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))),
				mimeType,
				format === "jpeg" ? 0.92 : undefined,
			)
		})
		canvas.width = 0
		canvas.height = 0

		const url = URL.createObjectURL(blob)
		const anchor = document.createElement("a")
		anchor.href = url
		anchor.download = `${cleanFileName}.${ext}`
		anchor.click()
		setTimeout(() => URL.revokeObjectURL(url), 0)
	})()
		.finally(() => {
			restoreIntersectionObserver?.()
			if (reactRoot) reactRoot.unmount()
			if (offscreenHost) document.body.removeChild(offscreenHost)
		})
		.then(() => undefined)

	return {
		promise,
		cancel: () => abortController.abort(),
	}
}
