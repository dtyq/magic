const FLOATING_SELECTOR = [
	"[role='dialog']",
	"[role='tooltip']",
	"[data-radix-popper-content-wrapper]",
	".toast",
	".Toastify",
	".modal",
	".popover",
	".tooltip",
	".drawer",
	".ant-modal-root",
	".ant-drawer",
	".ant-tooltip",
	".ant-popover",
	".ant-message",
	".ant-notification",
].join(",")

export function preprocessDOM(iDocument: Document): void {
	const win = iDocument.defaultView
	if (!win) return

	// 冻结所有 CSS 动画/过渡，确保元素处于最终可见状态
	const freezeStyle = iDocument.createElement("style")
	freezeStyle.setAttribute("data-pdf-export", "freeze")
	freezeStyle.textContent = `
		*, *::before, *::after {
			animation-play-state: paused !important;
			animation-delay: -1s !important;
			animation-duration: 0s !important;
			transition-duration: 0s !important;
			transition-delay: 0s !important;
		}
	`
	iDocument.head?.appendChild(freezeStyle)

	iDocument.querySelectorAll<HTMLElement>("*").forEach((element) => {
		const style = win.getComputedStyle(element)
		const anyStyle = style as unknown as Record<string, string>

		// ---- content-visibility: auto → visible ----
		// foreignObject 不触发 IntersectionObserver，auto 区域不会被渲染
		if (style.contentVisibility === "auto") {
			element.style.contentVisibility = "visible"
		}

		// ---- backdrop-filter / -webkit-backdrop-filter ----
		// foreignObject 完全不支持，半透明背景没有 blur 补底会接近不可见
		const backdropFilter = style.backdropFilter || anyStyle.webkitBackdropFilter
		if (backdropFilter && backdropFilter !== "none") {
			element.style.backdropFilter = "none"
			element.style.setProperty("-webkit-backdrop-filter", "none")
			const bg = style.backgroundColor
			if (bg) {
				element.style.backgroundColor = opaqueifyRgba(bg)
			}
		}

		// ---- mix-blend-mode ----
		// foreignObject 中 blend mode 可能导致元素完全透明或渲染异常
		if (style.mixBlendMode && style.mixBlendMode !== "normal") {
			element.style.mixBlendMode = "normal"
		}

		// ---- background-blend-mode ----
		// 多背景混合在 foreignObject 中不可靠
		if (anyStyle.backgroundBlendMode && anyStyle.backgroundBlendMode !== "normal") {
			element.style.backgroundBlendMode = "normal"
		}

		// ---- mask / mask-image / -webkit-mask-image ----
		// foreignObject 不支持 CSS mask
		if (style.mask && style.mask !== "none") {
			element.style.mask = "none"
		}
		if (style.maskImage && style.maskImage !== "none") {
			element.style.maskImage = "none"
		}
		if (anyStyle.webkitMaskImage && anyStyle.webkitMaskImage !== "none") {
			element.style.setProperty("-webkit-mask-image", "none")
		}

		// ---- clip-path (复杂形状) ----
		// foreignObject 对 polygon/path 等复杂 clip-path 支持不稳定
		const clipPath = style.clipPath
		if (clipPath && clipPath !== "none" && !/^inset\(/.test(clipPath)) {
			element.style.clipPath = "none"
		}

		// ---- CSS filter (非 none) ----
		// blur / drop-shadow 等在 foreignObject 中渲染可能异常
		if (style.filter && style.filter !== "none") {
			element.style.filter = "none"
		}

		// ---- -webkit-text-stroke ----
		// foreignObject 不支持
		if (anyStyle.webkitTextStroke && anyStyle.webkitTextStroke !== "0px") {
			element.style.setProperty("-webkit-text-stroke", "0px")
			// 保持文字可见，如果文字颜色是透明的（常见的 text-stroke 技巧）
			if (style.color === "transparent" || style.color === "rgba(0, 0, 0, 0)") {
				element.style.color = "#000"
			}
		}

		// ---- opacity: 0 (动画残留) ----
		// 冻结动画后，某些元素可能停留在 opacity:0 的初始关键帧
		if (style.opacity === "0") {
			element.style.opacity = "1"
		}

		// ---- position: fixed / sticky ----
		const position = style.position
		if (position === "fixed" || position === "sticky") {
			neutralizeRepeatedElement(element, win, position)
		}
	})

	iDocument.querySelectorAll<HTMLElement>(FLOATING_SELECTOR).forEach((element) => {
		element.style.display = "none"
	})
}

/**
 * 将 rgba 颜色转为不透明版本（在白色背景上合成）。
 * 例: rgba(255, 255, 255, 0.8) → rgb(255, 255, 255)
 */
function opaqueifyRgba(color: string): string {
	const match = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/)
	if (!match) return color
	const r = Number(match[1])
	const g = Number(match[2])
	const b = Number(match[3])
	const a = match[4] !== undefined ? Number(match[4]) : 1
	if (a >= 1) return color
	// Alpha-composite over white (#fff)
	const blendR = Math.round(r * a + 255 * (1 - a))
	const blendG = Math.round(g * a + 255 * (1 - a))
	const blendB = Math.round(b * a + 255 * (1 - a))
	return `rgb(${blendR}, ${blendG}, ${blendB})`
}

/**
 * Convert fixed/sticky elements before canvas pagination.
 *
 * Strategy:
 * - fixed top-area elements (nav bars, headers) -> absolute, so they stay at
 *   document top and do not repeat on every PDF page.
 * - sticky elements -> static, preserving their normal-flow space.
 * - bottom/small floating elements -> hidden, as they are usually controls.
 */
function neutralizeRepeatedElement(
	element: HTMLElement,
	win: Window,
	position: "fixed" | "sticky",
): void {
	const rect = element.getBoundingClientRect()
	const viewportHeight = win.innerHeight || 900
	const viewportWidth = win.innerWidth || 800

	// Small floating elements (FAB, back-to-top, chat widgets) → hide
	const isSmall = rect.width < viewportWidth * 0.3 && rect.height < viewportHeight * 0.15
	if (isSmall) {
		element.style.display = "none"
		return
	}

	// Bottom-area elements (cookie banners, bottom bars) → hide
	if (rect.top > viewportHeight * 0.5) {
		element.style.display = "none"
		return
	}

	if (position === "sticky") {
		element.style.position = "static"
		element.style.top = "auto"
		element.style.bottom = "auto"
		return
	}

	element.style.position = "absolute"
	element.style.top = `${Math.max(rect.top + win.scrollY, 0)}px`
	element.style.left = `${Math.max(rect.left + win.scrollX, 0)}px`
	element.style.width = `${rect.width}px`
}

export interface CanvasSnapshot {
	dataUrl: string
	x: number
	y: number
	cssWidth: number
	cssHeight: number
}

/**
 * 收集 iframe 内所有 <canvas> 元素的像素快照和位置。
 * snapdom 无法通过 foreignObject 保留 canvas 像素数据，
 * 需要在截图后将这些快照合成到输出 canvas 上。
 */
export function collectCanvasSnapshots(iDocument: Document): CanvasSnapshot[] {
	const canvases = iDocument.querySelectorAll<HTMLCanvasElement>("canvas")
	if (!canvases.length) return []

	const bodyRect = iDocument.body.getBoundingClientRect()
	const snapshots: CanvasSnapshot[] = []

	canvases.forEach((canvas) => {
		try {
			if (canvas.width === 0 || canvas.height === 0) return
			const dataUrl = canvas.toDataURL("image/png")
			if (!dataUrl || dataUrl === "data:,") return
			const rect = canvas.getBoundingClientRect()
			snapshots.push({
				dataUrl,
				x: rect.left - bodyRect.left,
				y: rect.top - bodyRect.top,
				cssWidth: rect.width,
				cssHeight: rect.height,
			})
		} catch {
			// skip tainted canvas
		}
	})
	return snapshots
}

/**
 * 将收集到的 canvas 快照合成到 snapdom 输出的 canvas 上。
 */
export async function compositeCanvasSnapshots(
	outputCanvas: HTMLCanvasElement,
	snapshots: CanvasSnapshot[],
	pixelRatio: number,
): Promise<void> {
	if (!snapshots.length) return
	const ctx = outputCanvas.getContext("2d")
	if (!ctx) return

	for (const snapshot of snapshots) {
		try {
			const img = new Image()
			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve()
				img.onerror = () => reject(new Error("img load failed"))
				img.src = snapshot.dataUrl
			})
			ctx.drawImage(
				img,
				snapshot.x * pixelRatio,
				snapshot.y * pixelRatio,
				snapshot.cssWidth * pixelRatio,
				snapshot.cssHeight * pixelRatio,
			)
		} catch {
			// skip failed snapshot
		}
	}
}
