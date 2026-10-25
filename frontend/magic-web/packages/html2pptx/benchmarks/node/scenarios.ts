import type { SerializablePPTNode } from "../../src/ir/serialize"
import { createMediaSourceDescriptor } from "../../src/media/source-descriptor"
import { createNoisePngDataUrl } from "../shared/png"
import type { BenchmarkProfile, ScenarioName, ScenarioShape } from "../shared/types"

export interface NodeProfileConfig {
	shape: ScenarioShape
	warmup: number
	iterations: number
}

export const NODE_PROFILES: Record<BenchmarkProfile, NodeProfileConfig> = {
	quick: {
		shape: {
			slides: 8,
			textNodesPerSlide: 12,
			shapeNodesPerSlide: 8,
			imagesPerSlide: 2,
			imageWidthPx: 96,
			imageHeightPx: 54,
		},
		warmup: 1,
		iterations: 3,
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
		iterations: 30,
	},
}

export function createScenarioSlides(
	scenario: ScenarioName,
	shape: ScenarioShape,
): SerializablePPTNode[][] {
	const reusedImage =
		scenario === "image-reuse" || scenario === "mixed"
			? createNoisePngDataUrl(shape.imageWidthPx, shape.imageHeightPx, 0x13572468)
			: null

	return Array.from({ length: shape.slides }, (_, slideIndex) => {
		switch (scenario) {
			case "text":
				return createTextNodes(slideIndex, shape.textNodesPerSlide)
			case "image-reuse":
				return createImageNodes(slideIndex, shape, () => reusedImage!)
			case "image-unique":
				return createImageNodes(slideIndex, shape, (imageIndex) =>
					createNoisePngDataUrl(
						shape.imageWidthPx,
						shape.imageHeightPx,
						seedFor(slideIndex, imageIndex),
					),
				)
			case "mixed":
				return [
					...createShapeNodes(slideIndex, shape.shapeNodesPerSlide),
					...createTextNodes(slideIndex, shape.textNodesPerSlide),
					...createImageNodes(slideIndex, shape, (imageIndex) =>
						imageIndex === 0
							? reusedImage!
							: createNoisePngDataUrl(
									shape.imageWidthPx,
									shape.imageHeightPx,
									seedFor(slideIndex, imageIndex),
								),
					),
				]
		}
	})
}

function createTextNodes(slideIndex: number, count: number): SerializablePPTNode[] {
	return Array.from({ length: count }, (_, nodeIndex) => {
		const column = nodeIndex % 4
		const row = Math.floor(nodeIndex / 4)
		return {
			type: "text" as const,
			x: 0.45 + column * 4.75,
			y: 0.4 + row * 0.78,
			w: 4.25,
			h: 0.55,
			zOrder: nodeIndex + 1,
			text: `Slide ${slideIndex + 1} / deterministic text node ${nodeIndex + 1}`,
			fontSize: 16 + (nodeIndex % 3),
			fontFace: "Arial",
			fontWeight: nodeIndex % 5 === 0 ? 700 : 400,
			color: nodeIndex % 2 === 0 ? "172554" : "334155",
			bold: nodeIndex % 5 === 0,
			italic: false,
			underline: false,
			margin: [0, 0, 0, 0] as [number, number, number, number],
			wrap: false,
		}
	})
}

function createShapeNodes(slideIndex: number, count: number): SerializablePPTNode[] {
	return Array.from({ length: count }, (_, nodeIndex) => {
		const column = nodeIndex % 5
		const row = Math.floor(nodeIndex / 5)
		return {
			type: "shape" as const,
			shapeType: nodeIndex % 3 === 0 ? ("roundRect" as const) : ("rect" as const),
			x: 0.35 + column * 3.85,
			y: 5.25 + row * 1.15,
			w: 3.35,
			h: 0.8,
			zOrder: 100 + nodeIndex,
			fill: {
				type: "solid" as const,
				color: colorFor(slideIndex, nodeIndex),
				transparency: nodeIndex % 4 === 0 ? 12 : 0,
			},
			line: {
				color: "CBD5E1",
				width: 1 / 96,
				style: "solid" as const,
			},
			shadow: null,
			radius: nodeIndex % 3 === 0 ? 0.12 : undefined,
		}
	})
}

function createImageNodes(
	slideIndex: number,
	shape: ScenarioShape,
	resolveSource: (imageIndex: number) => string,
): SerializablePPTNode[] {
	return Array.from({ length: shape.imagesPerSlide }, (_, imageIndex) => ({
		type: "image" as const,
		x: 0.5 + imageIndex * 6.35,
		y: 7.9,
		w: 5.7,
		h: 3.05,
		zOrder: 300 + imageIndex,
		source: createMediaSourceDescriptor(resolveSource(imageIndex), {
			key: `benchmark:image:${slideIndex}:${imageIndex}`,
		}),
		sizing: "cover" as const,
		intrinsicSize: {
			width: shape.imageWidthPx,
			height: shape.imageHeightPx,
		},
	}))
}

function seedFor(slideIndex: number, imageIndex: number): number {
	return (((slideIndex + 1) * 0x9e3779b1) ^ ((imageIndex + 1) * 0x85ebca6b)) >>> 0
}

function colorFor(slideIndex: number, nodeIndex: number): string {
	const value = seedFor(slideIndex, nodeIndex) & 0xffffff
	return value.toString(16).padStart(6, "0").toUpperCase()
}
