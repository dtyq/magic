import { snapdom } from "@zumer/snapdom"
import { isInlineSvgContent, processSvgContent } from "./svgProcessor"

interface MermaidExportOptions {
	backgroundColor?: string
	scale?: number
}

interface SvgSize {
	width: number
	height: number
}

const DEFAULT_SVG_SIZE: SvgSize = {
	width: 1200,
	height: 900,
}

export async function exportMermaidSvgToPngBlob(
	svgSource: string,
	options: MermaidExportOptions = {},
): Promise<Blob> {
	if (!isInlineSvgContent(svgSource)) {
		throw new Error("Mermaid SVG source must be inline markup or data URL")
	}

	const processedSvg = processSvgContent(svgSource)
	if (!processedSvg.isValid) {
		throw new Error(processedSvg.error || "Invalid Mermaid SVG")
	}

	const container = createOffscreenContainer()
	const wrapper = createSvgWrapper(processedSvg.content)
	container.appendChild(wrapper)
	document.body.appendChild(container)

	try {
		await waitForSvgReady(wrapper)

		const result = await snapdom(wrapper, {
			backgroundColor: options.backgroundColor || "#ffffff",
			scale: options.scale || 2,
			embedFonts: true,
		})

		return await result.toBlob({ type: "png" })
	} finally {
		container.remove()
	}
}

function createOffscreenContainer(): HTMLDivElement {
	const container = document.createElement("div")
	container.style.cssText = `
		position: fixed;
		left: -100000px;
		top: 0;
		pointer-events: none;
		opacity: 0;
		z-index: -1;
	`
	return container
}

function createSvgWrapper(svgContent: string): HTMLDivElement {
	const wrapper = document.createElement("div")
	const size = getSvgSize(svgContent)

	wrapper.style.cssText = `
		display: inline-block;
		width: ${size.width}px;
		height: ${size.height}px;
		background: #ffffff;
		overflow: hidden;
	`
	wrapper.innerHTML = svgContent

	const svgElement = wrapper.querySelector("svg")
	if (!svgElement) {
		throw new Error("Mermaid SVG root element not found")
	}

	svgElement.setAttribute("width", `${size.width}`)
	svgElement.setAttribute("height", `${size.height}`)
	svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet")
	svgElement.style.display = "block"

	return wrapper
}

function getSvgSize(svgContent: string): SvgSize {
	const parser = new DOMParser()
	const svgDoc = parser.parseFromString(svgContent, "image/svg+xml")
	const svgElement = svgDoc.documentElement

	const width = parseNumericValue(svgElement.getAttribute("width"))
	const height = parseNumericValue(svgElement.getAttribute("height"))

	if (width > 0 && height > 0) {
		return { width, height }
	}

	const viewBox = svgElement.getAttribute("viewBox")
	if (!viewBox) return DEFAULT_SVG_SIZE

	const values = viewBox.split(/[\s,]+/).map((value) => Number.parseFloat(value))
	if (values.length < 4 || Number.isNaN(values[2]) || Number.isNaN(values[3])) {
		return DEFAULT_SVG_SIZE
	}

	const viewBoxWidth = Math.max(1, Math.round(values[2]))
	const viewBoxHeight = Math.max(1, Math.round(values[3]))

	return {
		width: viewBoxWidth,
		height: viewBoxHeight,
	}
}

function parseNumericValue(value: string | null): number {
	if (!value) return 0

	const match = value.match(/[\d.]+/)
	if (!match) return 0

	return Number.parseFloat(match[0]) || 0
}

async function waitForSvgReady(wrapper: HTMLElement): Promise<void> {
	await waitForFonts()
	await waitForImages(wrapper)
	await waitForNextFrame()
	await waitForNextFrame()
}

async function waitForFonts(): Promise<void> {
	if (!document.fonts?.ready) return

	await document.fonts.ready
}

async function waitForImages(wrapper: HTMLElement): Promise<void> {
	const images = Array.from(wrapper.querySelectorAll("image"))
	if (images.length === 0) return

	await Promise.all(
		images.map(
			(image) =>
				new Promise<void>((resolve) => {
					const href =
						image.getAttribute("href") ||
						image.getAttributeNS("http://www.w3.org/1999/xlink", "href")
					if (!href) {
						resolve()
						return
					}

					const preloadImage = new Image()
					preloadImage.onload = () => resolve()
					preloadImage.onerror = () => resolve()
					preloadImage.src = href
				}),
		),
	)
}

function waitForNextFrame(): Promise<void> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => resolve())
	})
}
