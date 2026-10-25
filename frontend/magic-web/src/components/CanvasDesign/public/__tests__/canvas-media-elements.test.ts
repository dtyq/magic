import { describe, expect, it } from "vitest"
import type { LayerElement } from "@/components/CanvasDesign/runtime/document/types"
import { findCanvasMediaElementIdsByFileId } from "../canvas-media-elements"

const elements = [
	{
		id: "frame-1",
		type: "frame",
		children: [
			{ id: "image-1", type: "image", contents: [{ src: "./images/a.png" }] },
			{ id: "audio-1", type: "audio", contents: [{ src: "./audios/a.mp3" }] },
		],
	},
	{
		id: "video-1",
		type: "video",
		contents: [{ src: "./videos/a.mp4" }],
	},
] as unknown as LayerElement[]

describe("findCanvasMediaElementIdsByFileId", () => {
	it("finds matching media elements recursively and ignores non-media elements", () => {
		expect(
			findCanvasMediaElementIdsByFileId(elements, "audio-file", (src) => ({
				file_id: src.includes("a.mp3") ? "audio-file" : "other-file",
			})),
		).toEqual(["audio-1"])
	})

	it("returns every media element associated with the same file", () => {
		expect(
			findCanvasMediaElementIdsByFileId(elements, "shared-file", () => ({
				file_id: "shared-file",
			})),
		).toEqual(["image-1", "audio-1", "video-1"])
	})

	it("returns an empty list when no element resolves to the file", () => {
		expect(findCanvasMediaElementIdsByFileId(elements, "missing-file", () => null)).toEqual([])
	})
})
