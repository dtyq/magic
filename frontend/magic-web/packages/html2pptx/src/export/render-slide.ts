import type { SlideConfig, Slide } from "../types/index"
import type { SandboxInstance } from "../renderer/createSandbox"
import { log, LogLevel } from "../logger"
import { collectElements } from "../collector"
import { filterRenderable, sortByZOrder } from "../filter"
import { transformElements } from "../transform"
import { drawAll } from "../drawer"
import { materializePseudoIcons, restoreIcons } from "../utils/icon"
import { ensureNotAborted } from "./abort-guard"

export interface RenderSlideInput {
	config: SlideConfig
	html: string
	sandbox: SandboxInstance
	slide: Slide
	signal: AbortSignal
}

/**
 * 单页完整渲染管道：
 * render HTML → materialize icons → collect → filter → sort → transform → draw
 */
export async function renderSlide({
	config,
	html,
	sandbox,
	slide,
	signal,
}: RenderSlideInput): Promise<void> {
	ensureNotAborted(signal)
	const { iWindow, iDocument } = await sandbox.render(html, { signal })
	ensureNotAborted(signal)

	const iconBackups = materializePseudoIcons(iDocument, iWindow)

	try {
		const elements = collectElements(iDocument, iWindow)
		log(LogLevel.L2, `收集到 ${elements.length} 个元素`)

		const renderableElements = filterRenderable(elements)
		log(LogLevel.L2, `过滤后 ${renderableElements.length} 个可绘制元素`)

		const sortedElements = sortByZOrder(renderableElements)

		const pptNodes = transformElements(sortedElements, config, iWindow)
		log(LogLevel.L2, `转换为 ${pptNodes.length} 个绘制节点`)

		ensureNotAborted(signal)
		await drawAll(slide, pptNodes, signal)
	} finally {
		restoreIcons(iconBackups)
	}
}
