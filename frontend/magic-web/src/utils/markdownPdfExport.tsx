/**
 * Markdown → PDF 导出工具
 *
 * 流程：离屏渲染 EditorBody → 预处理 → snapdom 截图 → 分页 → 组装 → 下载
 */
import React from "react"
import { createRoot } from "react-dom/client"
import type { PdfPaginationMode, PdfProgressContext } from "../../packages/pdf-export/src"
import { configureLogger } from "../../packages/pdf-export/src/logger"
import { runElementExportPipeline } from "../../packages/pdf-export/src/pipeline/exportElement"
import { useImageUrlResolver } from "@/pages/superMagic/components/Detail/contents/Md/hooks/useImageUrlResolver"
import {
	processMarkdownImages,
	type AttachmentFile,
	type ImageUrlMap,
} from "@/pages/superMagic/utils/image-url-resolver"

// ─── 类型 ───────────────────────────────────────────────────

export interface ExportMarkdownToPdfOptions {
	/** Markdown 内容 */
	markdown: string
	/** 已由业务层处理过的 Markdown 内容 */
	processedContent?: string
	/** 导出的 PDF 文件名 */
	fileName?: string
	/** 分页模式：slice 按纸张切页；none 整个 Markdown 渲染结果作为一页 */
	pagination?: PdfPaginationMode
	/** 进度回调 */
	onProgress?: (ctx: PdfProgressContext) => void
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

	// 和业务层一样用 useImageUrlResolver 提供 urlResolver
	const { urlResolver } = useImageUrlResolver({
		attachments: props.attachments || [],
		relativeFilePath: props.currentDocumentPath,
		initialImageUrlMap: props.initialImageUrlMap,
	})

	// 动态加载 EditorBody
	React.useEffect(() => {
		import("@/pages/superMagic/components/Detail/contents/Md/components/EditorBody").then(
			(mod) => setEditorBody(() => mod.default),
		)
	}, [])

	// EditorBody 加载完成后，等 Mermaid 渲染再 onReady
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
			selectedProject={props.selectedProject}
			currentDocumentPath={props.currentDocumentPath}
			urlResolver={urlResolver}
			attachments={props.attachments}
		/>
	)
}

// ─── DOM 清理 & 预处理 ──────────────────────────────────────

/**
 * 将 Mermaid SVG 光栅化为 <img>，避免 snapdom 的 foreignObject 嵌套导致文字丢失
 * 使用原生 SVG 序列化 → Image → Canvas 方案，完全绕过 snapdom
 */
async function rasterizeMermaidSvgs(container: HTMLElement): Promise<void> {
	const mermaidContainers = container.querySelectorAll<HTMLElement>("[data-mermaid-id]")
	if (mermaidContainers.length === 0) return

	const tasks = Array.from(mermaidContainers).map(async (mermaidEl) => {
		const svg = mermaidEl.querySelector("svg")
		if (!svg) return

		const rect = svg.getBoundingClientRect()
		if (rect.width === 0 || rect.height === 0) return

		try {
			const dataUrl = await svgToDataUrl(svg, rect.width, rect.height)

			// 替换 SVG 为 <img>
			const img = document.createElement("img")
			img.src = dataUrl
			img.style.width = `${rect.width}px`
			img.style.height = `${rect.height}px`
			img.style.display = "block"
			svg.replaceWith(img)
		} catch {
			// 光栅化失败，保留原始 SVG（降级）
		}
	})

	await Promise.all(tasks)
}

/**
 * 将 SVG 元素光栅化为 PNG data URL
 * 核心：先将 foreignObject（Mermaid 文字）替换为原生 SVG <text>，
 * 因为 SVG 作为 <img> 加载时浏览器出于安全原因不渲染 foreignObject 内容
 */
async function svgToDataUrl(svg: SVGElement, width: number, height: number): Promise<string> {
	const scale = 2
	const clone = svg.cloneNode(true) as SVGElement

	// 确保 SVG 有 xmlns
	clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
	clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink")

	// 设置明确尺寸
	clone.setAttribute("width", String(width))
	clone.setAttribute("height", String(height))

	// 核心修复：将 foreignObject 替换为原生 SVG <text>
	replaceForeignObjectsWithSvgText(svg, clone)

	// 序列化为 data URL（比 blob URL 兼容性更好）
	const svgString = new XMLSerializer().serializeToString(clone)
	const encodedSvg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`

	const image = await loadImage(encodedSvg)
	const canvas = document.createElement("canvas")
	canvas.width = width * scale
	canvas.height = height * scale
	const ctx = canvas.getContext("2d")!
	ctx.scale(scale, scale)
	ctx.drawImage(image, 0, 0, width, height)

	return await new Promise<string>((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (!blob) return reject(new Error("toBlob null"))
			const reader = new FileReader()
			reader.onloadend = () => resolve(reader.result as string)
			reader.onerror = () => reject(reader.error)
			reader.readAsDataURL(blob)
		}, "image/png")
	})
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image()
		img.onload = () => resolve(img)
		img.onerror = reject
		img.src = src
	})
}

const SVG_NS = "http://www.w3.org/2000/svg"

/**
 * 将克隆 SVG 中的所有 <foreignObject> 替换为原生 SVG <text>
 * 从原始 SVG 对应的 foreignObject 读取 getComputedStyle，获取字体/颜色，
 * 然后在克隆体中替换为 <text>（居中对齐）
 */
function replaceForeignObjectsWithSvgText(originalSvg: SVGElement, cloneSvg: SVGElement): void {
	const origFOs = originalSvg.querySelectorAll("foreignObject")
	const cloneFOs = cloneSvg.querySelectorAll("foreignObject")

	// 从后往前遍历，因为 replaceChild 会改变索引
	for (let i = cloneFOs.length - 1; i >= 0; i--) {
		const cloneFO = cloneFOs[i]
		const origFO = origFOs[i]
		if (!origFO || !cloneFO.parentNode) continue

		// 读取 foreignObject 的位置和尺寸
		const x = parseFloat(cloneFO.getAttribute("x") || "0")
		const y = parseFloat(cloneFO.getAttribute("y") || "0")
		const foWidth = parseFloat(cloneFO.getAttribute("width") || "0")
		const foHeight = parseFloat(cloneFO.getAttribute("height") || "0")

		// 提取文字内容
		const textContent = (origFO.textContent || "").trim()
		if (!textContent) {
			cloneFO.parentNode.removeChild(cloneFO)
			continue
		}

		// 从原始 DOM 读取计算样式
		const textEl = origFO.querySelector("div, span, p") || origFO
		const computed = window.getComputedStyle(textEl)

		const fontSize = computed.fontSize || "14px"
		const fontFamily = computed.fontFamily || "sans-serif"
		const fontWeight = computed.fontWeight || "normal"
		const color = computed.color || "#000000"
		const textAlign = computed.textAlign || "center"

		// 创建 SVG <text> 元素
		const svgText = document.createElementNS(SVG_NS, "text")

		// 水平对齐
		let textAnchor = "middle"
		let textX = x + foWidth / 2
		if (textAlign === "left" || textAlign === "start") {
			textAnchor = "start"
			textX = x + 2
		} else if (textAlign === "right" || textAlign === "end") {
			textAnchor = "end"
			textX = x + foWidth - 2
		}

		// 垂直居中
		const textY = y + foHeight / 2

		svgText.setAttribute("x", String(textX))
		svgText.setAttribute("y", String(textY))
		svgText.setAttribute("text-anchor", textAnchor)
		svgText.setAttribute("dominant-baseline", "central")
		svgText.setAttribute("font-size", fontSize)
		svgText.setAttribute("font-family", fontFamily)
		svgText.setAttribute("font-weight", fontWeight)
		svgText.setAttribute("fill", color)

		// 处理多行文字：按换行分割，用 <tspan> 实现
		const lines = textContent.split(/\n/).filter(Boolean)
		if (lines.length <= 1) {
			svgText.textContent = textContent
		} else {
			const lineHeight = parseFloat(fontSize) * 1.2
			const startY = textY - ((lines.length - 1) * lineHeight) / 2

			lines.forEach((line, idx) => {
				const tspan = document.createElementNS(SVG_NS, "tspan")
				tspan.setAttribute("x", String(textX))
				tspan.setAttribute("y", String(startY + idx * lineHeight))
				tspan.textContent = line
				svgText.appendChild(tspan)
			})
		}

		// 替换 foreignObject 为 text
		cloneFO.parentNode.replaceChild(svgText, cloneFO)
	}
}

/**
 * 物化 checkbox 的 :checked 视觉状态
 * TipTap 的 checkbox 用隐藏 input + sibling span + ::before 伪元素实现勾选样式，
 * snapdom 无法序列化 :checked 伪类，需要将视觉状态写成内联样式和真实 DOM 元素
 */
function materializeCheckboxState(container: HTMLElement): void {
	// 选中的任务项: li[data-checked="true"]
	const checkedItems = container.querySelectorAll<HTMLLIElement>('li[data-checked="true"]')
	checkedItems.forEach((li) => {
		const label = li.querySelector("label")
		if (!label) return
		const span = label.querySelector("span")
		if (!span) return

		// 读取 :checked + span 的计算样式并内联
		const computedSpan = window.getComputedStyle(span)
		span.style.backgroundColor = computedSpan.backgroundColor
		span.style.borderColor = computedSpan.borderColor

		// 读取 ::before 伪元素的计算样式，创建真实元素替代
		const computedBefore = window.getComputedStyle(span, "::before")
		if (!span.querySelector(".pdf-checkmark")) {
			const checkmark = document.createElement("span")
			checkmark.className = "pdf-checkmark"
			checkmark.style.cssText = `
				position: absolute;
				left: 50%;
				top: 50%;
				transform: translate(-50%, -50%);
				width: 0.75em;
				height: 0.75em;
				display: block;
				opacity: 1;
				background-color: ${computedBefore.backgroundColor !== "rgba(0, 0, 0, 0)" ? computedBefore.backgroundColor : computedSpan.color || "#ffffff"};
				-webkit-mask: url("data:image/svg+xml,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M20%206L9%2017L4%2012%22%20stroke%3D%22currentColor%22%20stroke-width%3D%223%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat;
				mask: url("data:image/svg+xml,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M20%206L9%2017L4%2012%22%20stroke%3D%22currentColor%22%20stroke-width%3D%223%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat;
			`
			span.appendChild(checkmark)
		}
	})

	// 未选中的任务项：确保 span 内联了未选中样式（避免 snapdom 样式丢失）
	const uncheckedItems = container.querySelectorAll<HTMLLIElement>('li[data-checked="false"]')
	uncheckedItems.forEach((li) => {
		const label = li.querySelector("label")
		if (!label) return
		const span = label.querySelector("span")
		if (!span) return
		const computedSpan = window.getComputedStyle(span)
		span.style.backgroundColor = computedSpan.backgroundColor
		span.style.borderColor = computedSpan.borderColor
		span.style.borderWidth = computedSpan.borderWidth
		span.style.borderStyle = computedSpan.borderStyle
		span.style.borderRadius = computedSpan.borderRadius
		span.style.width = computedSpan.width
		span.style.height = computedSpan.height
		span.style.position = "relative"
		span.style.display = "block"
	})
}

/**
 * 清理离屏渲染的 DOM + 预处理（截图前）
 */
async function sanitizeDomForExport(container: HTMLElement): Promise<void> {
	// 移除 Mermaid 模式切换按钮
	container.querySelectorAll(".mode-switch").forEach((el) => el.remove())

	// 移除代码块复制按钮
	container.querySelectorAll(".magic-code-copy").forEach((el) => el.remove())

	// Mermaid 代码块：只保留图表，移除原始代码视图
	container.querySelectorAll("[data-node-view-wrapper]").forEach((wrapper) => {
		const hasChart = wrapper.querySelector("svg")
		if (!hasChart) return

		const mermaidContainer = wrapper.firstElementChild
		if (!mermaidContainer) return

		Array.from(mermaidContainer.children).forEach((child) => {
			if (!child.contains(hasChart)) {
				child.remove()
			} else {
				;(child as HTMLElement).style.display = "block"
			}
		})
	})

	// 光栅化 Mermaid SVG → <img>（解决 foreignObject 嵌套问题）
	await rasterizeMermaidSvgs(container)

	// 物化 checkbox :checked 视觉状态
	materializeCheckboxState(container)
}

// ─── 离屏容器 ──────────────────────────────────────────────

const OFFSCREEN_WIDTH = 794 // A4 宽度（像素）
const noop = (): void => undefined

function createOffscreenContainer(): HTMLDivElement {
	const host = document.createElement("div")
	host.style.cssText = `
		position: fixed;
		left: 0;
		top: 0;
		width: ${OFFSCREEN_WIDTH}px;
		overflow: visible;
		pointer-events: none;
		z-index: -9999;
		opacity: 0;
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

async function prepareMarkdownForExport(options: ExportMarkdownToPdfOptions): Promise<{
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
 * 离屏渲染 Markdown 内容并导出 PDF
 */
export function exportMarkdownToPdf(options: ExportMarkdownToPdfOptions): {
	promise: Promise<void>
	cancel: () => void
} {
	const abortController = new AbortController()
	let offscreenHost: HTMLDivElement | null = null
	let reactRoot: ReturnType<typeof createRoot> | null = null
	let restoreIntersectionObserver: (() => void) | null = null

	const promise = (async () => {
		const fileName = ensurePdfFileName(options.fileName || "export.pdf")
		const prepared = await prepareMarkdownForExport(options)
		restoreIntersectionObserver = installExportIntersectionObserverPatch()
		offscreenHost = createOffscreenContainer()

		// AppearanceProvider 提供 antd-style token + locale
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

		// 2. 清理交互 UI + 预处理（Mermaid SVG 光栅化、checkbox 物化）
		await sanitizeDomForExport(editorContainer)

		if (abortController.signal.aborted) throw new Error("Cancelled")

		// 3. snapdom 截图 → 分页 → 组装 → 下载
		configureLogger()
		await runElementExportPipeline(
			editorContainer,
			{
				fileName,
				output: "download",
				pagination: options.pagination,
				onProgress: options.onProgress,
			},
			abortController.signal,
		)
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

// ─── 按 fileId 导出 Markdown ───────────────────────────────

export interface ExportMarkdownFileToPdfOptions {
	/** 文件 ID */
	fileId: string
	/** 文件名（含扩展名，用于判断类型和命名 PDF） */
	fileName?: string
	/** 文件内容（已有则跳过请求） */
	content?: string
	/** 进度回调 */
	onProgress?: (ctx: PdfProgressContext) => void
	/** 分页模式：slice 按纸张切页；none 整个 Markdown 渲染结果作为一页 */
	pagination?: PdfPaginationMode
	/** EditorBody 需要的业务上下文 */
	selectedProject?: any
	relativeFilePath?: string
	attachments?: AttachmentFile[]
	processedContent?: string
	initialImageUrlMap?: ImageUrlMap
	/** 获取文件内容的函数（默认使用 getFileContentById） */
	fetchContent?: (fileId: string) => Promise<string>
}

/**
 * 纯前端导出 Markdown PDF：获取 Markdown 内容并走 Markdown 专属渲染路线。
 */
export function exportMarkdownFileToPdf(options: ExportMarkdownFileToPdfOptions): {
	promise: Promise<void>
	cancel: () => void
} {
	let currentHandle: { cancel: () => void } | null = null

	const promise = (async () => {
		const { fileId, fileName = "export.pdf", onProgress } = options

		// 获取文件内容
		let content = options.content
		if (!content) {
			const { getFileContentById } = await import("@/pages/superMagic/utils/api")
			const fetchFn =
				options.fetchContent ||
				((id: string) =>
					getFileContentById(id, { responseType: "text" }) as Promise<string>)
			content = await fetchFn(fileId)
		}

		if (!content || typeof content !== "string") {
			throw new Error("Failed to fetch file content")
		}

		const pdfFileName = fileName.replace(/\.[^.]+$/, ".pdf")
		const handle = exportMarkdownToPdf({
			markdown: content,
			processedContent: options.processedContent,
			fileName: pdfFileName,
			pagination: options.pagination,
			onProgress,
			selectedProject: options.selectedProject,
			relativeFilePath: options.relativeFilePath,
			attachments: options.attachments,
			initialImageUrlMap: options.initialImageUrlMap,
		})
		currentHandle = handle
		await handle.promise
	})()

	return {
		promise,
		cancel: () => currentHandle?.cancel(),
	}
}

function ensurePdfFileName(fileName: string): string {
	return fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`
}
