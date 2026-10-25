// @vitest-environment jsdom

import { describe, expect, it } from "vitest"
import type { ElementNode } from "../src/ir/dom"
import type { PPTNodeBase } from "../src/ir/node"
import {
	createMediaAssetKey,
	getOriginalMediaPath,
	normalizeMediaAssetPath,
} from "../src/media/asset-identity"
import { parseImage } from "../src/parsers/parseImage"
import { parseMedia } from "../src/parsers/parseMedia"
import type { SlideConfig } from "../src/api/options"

const config: SlideConfig = {
	htmlWidth: 1920,
	htmlHeight: 1080,
	slideWidth: 20,
	slideHeight: 11.25,
}

describe("stable media identity", () => {
	it("preserves version/query information instead of aliasing distinct resources", () => {
		expect(normalizeMediaAssetPath(" ./assets\\hero.png?version=1 ")).toBe(
			"assets/hero.png?version=1",
		)
		expect(createMediaAssetKey("image", "assets/hero.png?version=1")).toBe(
			"asset:image:assets/hero.png?version=1",
		)
		expect(createMediaAssetKey("image", "assets/hero.png?version=1")).not.toBe(
			createMediaAssetKey("image", "assets/hero.png?version=2"),
		)
	})

	it("reads the original-path marker before the temporary signed URL", () => {
		const image = document.createElement("img")
		image.src = "https://cdn.example.test/hero.png?token=rotated"
		image.setAttribute("data-original-path", "assets/hero.png")

		expect(getOriginalMediaPath(image)).toBe("assets/hero.png")
		const parsed = parseImage(createElementNode(image), createBaseNode(), config, window)

		expect(parsed?.source.kind).toBe("url")
		expect(parsed?.source.kind === "url" ? parsed.source.url : "").toContain("token=rotated")
		expect(parsed?.assetKey).toBe("asset:image:assets/hero.png")
	})

	it("carries stable identities for video and audio media nodes", () => {
		const video = document.createElement("video")
		video.src = "https://cdn.example.test/clip.mp4?token=two"
		video.setAttribute("data-original-path", "media/clip.mp4")
		video.setAttribute("data-original-poster-path", "media/clip-poster.png")
		const videoNode = parseMedia(
			createElementNode(video, "VIDEO"),
			createBaseNode(),
			config,
			window,
		)

		const audio = document.createElement("audio")
		audio.src = "https://cdn.example.test/track.mp3?token=two"
		audio.setAttribute("data-original-path", "media/track.mp3")
		const audioNode = parseMedia(
			createElementNode(audio, "AUDIO"),
			createBaseNode(),
			config,
			window,
		)

		expect(videoNode).toMatchObject({
			assetKey: "asset:video:media/clip.mp4",
			coverAssetKey: "asset:cover:media/clip-poster.png",
		})
		expect(audioNode).toMatchObject({ assetKey: "asset:audio:media/track.mp3" })
	})

	it("uses the source child marker when video/audio owns only a source element", () => {
		const video = document.createElement("video")
		const videoSource = document.createElement("source")
		videoSource.src = "https://cdn.example.test/clip.mp4?token=child"
		videoSource.setAttribute("data-original-path", "media/child-clip.mp4")
		video.append(videoSource)
		const videoNode = parseMedia(
			createElementNode(video, "VIDEO"),
			createBaseNode(),
			config,
			window,
		)

		const audio = document.createElement("audio")
		const audioSource = document.createElement("source")
		audioSource.src = "https://cdn.example.test/track.mp3?token=child"
		audioSource.setAttribute("data-original-path", "media/child-track.mp3")
		audio.append(audioSource)
		const audioNode = parseMedia(
			createElementNode(audio, "AUDIO"),
			createBaseNode(),
			config,
			window,
		)

		expect(videoNode?.assetKey).toBe("asset:video:media/child-clip.mp4")
		expect(audioNode?.assetKey).toBe("asset:audio:media/child-track.mp3")
	})

	it("never treats a poster marker as the video asset identity", () => {
		const video = document.createElement("video")
		video.src = "https://cdn.example.test/clip.mp4?token=video"
		video.setAttribute("data-original-poster-path", "media/poster.png")

		const parsed = parseMedia(
			createElementNode(video, "VIDEO"),
			createBaseNode(),
			config,
			window,
		)

		expect(parsed?.assetKey).toBeUndefined()
		expect(parsed?.coverAssetKey).toBe("asset:cover:media/poster.png")
	})

	it("produces one identity for 300 pages that rotate only signed URL tokens", () => {
		const keys = Array.from({ length: 300 }, (_, index) => {
			const image = document.createElement("img")
			image.src = `https://cdn.example.test/hero.png?token=${index}`
			image.setAttribute("data-original-path", "assets/hero.png")
			return parseImage(createElementNode(image), createBaseNode(), config, window)?.assetKey
		})

		expect(new Set(keys).size).toBe(1)
		expect(keys[0]).toBe("asset:image:assets/hero.png")
	})
})

function createBaseNode(): PPTNodeBase {
	return { type: "", x: 0, y: 0, w: 10, h: 5, zOrder: 1 }
}

function createElementNode(element: Element, tagName = element.tagName): ElementNode {
	return {
		id: "media-test",
		tagName,
		element,
		rect: { x: 0, y: 0, w: 1920, h: 1080 },
		layout: { offsetWidth: 1920, offsetHeight: 1080 },
		style: {
			opacity: "1",
			borderRadius: "0px",
			overflow: "visible",
			transform: "none",
			translate: "none",
			rotate: "none",
			scale: "none",
			objectFit: "fill",
			backgroundImage: "none",
		} as ElementNode["style"],
		textContent: null,
		children: [],
		parent: null,
		depth: 1,
		zIndex: 0,
		domOrder: 1,
	}
}
