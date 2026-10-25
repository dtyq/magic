import type { BenchmarkProfile, ScenarioName, ScenarioShape } from "../shared/types"

export interface BrowserProfileConfig {
	shape: ScenarioShape
	warmup: number
	iterations: number
}

export const BROWSER_PROFILES: Record<BenchmarkProfile, BrowserProfileConfig> = {
	quick: {
		shape: {
			slides: 4,
			textNodesPerSlide: 12,
			shapeNodesPerSlide: 8,
			imagesPerSlide: 2,
			imageWidthPx: 96,
			imageHeightPx: 54,
		},
		warmup: 1,
		iterations: 2,
	},
	baseline: {
		shape: {
			slides: 200,
			textNodesPerSlide: 20,
			shapeNodesPerSlide: 20,
			imagesPerSlide: 3,
			imageWidthPx: 256,
			imageHeightPx: 144,
		},
		warmup: 1,
		iterations: 20,
	},
}

export function createBrowserScenarioSlides(
	scenario: ScenarioName,
	shape: ScenarioShape,
	origin: string,
): string[] {
	return Array.from({ length: shape.slides }, (_, slideIndex) =>
		createSlideHtml({ scenario, shape, slideIndex, origin }),
	)
}

function createSlideHtml({
	scenario,
	shape,
	slideIndex,
	origin,
}: {
	scenario: ScenarioName
	shape: ScenarioShape
	slideIndex: number
	origin: string
}): string {
	const text = createTextHtml(slideIndex, shape.textNodesPerSlide)
	const shapes = createShapeHtml(slideIndex, shape.shapeNodesPerSlide)
	const images = createImageHtml({ scenario, shape, slideIndex, origin })
	const content =
		scenario === "text" ? text : scenario === "mixed" ? `${shapes}${text}${images}` : images

	return `<!doctype html>
<html>
<head>
	<meta charset="utf-8">
	<style>
		html,body{width:1920px;height:1080px;margin:0;overflow:hidden;background:#f8fafc;font-family:Arial,sans-serif}
		*{box-sizing:border-box}
		.slide{position:relative;width:1920px;height:1080px;padding:44px}
		.title{position:absolute;left:48px;top:28px;font-size:30px;font-weight:700;color:#0f172a}
		.text-node{position:absolute;width:405px;height:52px;padding:8px 10px;color:#334155;font-size:18px;line-height:26px;white-space:nowrap}
		.shape-node{position:absolute;width:300px;height:72px;border:1px solid #cbd5e1;border-radius:12px}
		.image-node{position:absolute;width:520px;height:292px;object-fit:cover;border-radius:10px}
	</style>
</head>
<body><main class="slide"><div class="title">${escapeHtml(scenario)} / page ${slideIndex + 1}</div>${content}</main></body>
</html>`
}

function createTextHtml(slideIndex: number, count: number): string {
	return Array.from({ length: count }, (_, nodeIndex) => {
		const column = nodeIndex % 4
		const row = Math.floor(nodeIndex / 4)
		return `<div class="text-node" style="left:${48 + column * 455}px;top:${105 + row * 72}px;font-weight:${nodeIndex % 5 === 0 ? 700 : 400}">Deterministic text ${slideIndex + 1}.${nodeIndex + 1}</div>`
	}).join("")
}

function createShapeHtml(slideIndex: number, count: number): string {
	return Array.from({ length: count }, (_, nodeIndex) => {
		const column = nodeIndex % 5
		const row = Math.floor(nodeIndex / 5)
		return `<div class="shape-node" style="left:${48 + column * 365}px;top:${500 + row * 100}px;background:#${colorFor(slideIndex, nodeIndex)}"></div>`
	}).join("")
}

function createImageHtml({
	scenario,
	shape,
	slideIndex,
	origin,
}: {
	scenario: ScenarioName
	shape: ScenarioShape
	slideIndex: number
	origin: string
}): string {
	return Array.from({ length: shape.imagesPerSlide }, (_, imageIndex) => {
		const seed =
			scenario === "image-reuse"
				? 0x13572468
				: scenario === "mixed" && imageIndex === 0
					? 0x13572468
					: seedFor(slideIndex, imageIndex)
		const source = `${origin}/__html2pptx_benchmark_asset/${shape.imageWidthPx}x${shape.imageHeightPx}/${seed}.png`
		return `<img class="image-node" alt="fixture-${seed}" src="${source}" style="left:${70 + imageIndex * 600}px;top:${160 + (imageIndex % 2) * 340}px">`
	}).join("")
}

function seedFor(slideIndex: number, imageIndex: number): number {
	return (((slideIndex + 1) * 0x9e3779b1) ^ ((imageIndex + 1) * 0x85ebca6b)) >>> 0
}

function colorFor(slideIndex: number, nodeIndex: number): string {
	return (seedFor(slideIndex, nodeIndex) & 0xffffff).toString(16).padStart(6, "0").toUpperCase()
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => {
		const replacements: Record<string, string> = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#39;",
		}
		return replacements[character]
	})
}
