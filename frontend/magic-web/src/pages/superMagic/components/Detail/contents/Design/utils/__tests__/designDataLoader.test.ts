import { describe, expect, it } from "vitest"
import { ElementTypeEnum } from "@/components/CanvasDesign/runtime/document/types"
import { loadDesignDataToRuntime } from "../designDataLoader"
import { MAGIC_PROJECT_VERSION_V3 } from "../magicProjectCompression"

describe("loadDesignDataToRuntime", () => {
	it("rejects empty envelope content with a structured issue", async () => {
		await expect(loadDesignDataToRuntime({ content: "" })).rejects.toMatchObject({
			issue: {
				kind: "invalid-envelope",
				stage: "parse-envelope",
			},
		})
	})

	it("does not convert a missing canvas into an editable empty v3 document", async () => {
		const content = `window.magicProjectConfig = ${JSON.stringify({
			version: "2.0.0",
			type: "design",
			name: "missing-canvas",
		})};`

		await expect(loadDesignDataToRuntime({ content })).rejects.toMatchObject({
			issue: {
				kind: "invalid-envelope",
				stage: "parse-envelope",
				sourceVersion: "2.0.0",
			},
		})
	})

	it("parses envelope content, upgrades it to v3, and applies the runtime name", async () => {
		const content = `window.magicProjectConfig = ${JSON.stringify({
			version: "1.0.0",
			type: "design",
			name: "legacy-name",
			canvas: {
				elements: [
					{
						id: "image-1",
						type: ElementTypeEnum.Image,
						src: "./images/a.png",
					},
				],
			},
		})};`

		const loaded = await loadDesignDataToRuntime({
			content,
			nameOverride: "current-directory",
		})

		expect(loaded?.data).toMatchObject({
			version: MAGIC_PROJECT_VERSION_V3,
			name: "current-directory",
			canvas: {
				elements: [
					{
						id: "image-1",
						activeContentId: "image-1-content-1",
						mainContentId: "image-1-content-1",
						contents: [{ contentId: "image-1-content-1", src: "./images/a.png" }],
					},
				],
			},
		})
		expect(loaded).toMatchObject({
			sourceVersion: "1.0.0",
			didUpgrade: true,
			needsPersist: true,
		})
	})

	it("does not request persistence for an already-v3 envelope", async () => {
		const content = `window.magicProjectConfig = ${JSON.stringify({
			version: MAGIC_PROJECT_VERSION_V3,
			type: "design",
			name: "v3",
			canvas: { elements: [] },
		})};`

		const loaded = await loadDesignDataToRuntime({ content })

		expect(loaded).toMatchObject({
			sourceVersion: MAGIC_PROJECT_VERSION_V3,
			didUpgrade: false,
			needsPersist: false,
		})
	})

	it("accepts v3 storyboard data with deprecated duration fields during migration", async () => {
		const content = `window.magicProjectConfig = ${JSON.stringify({
			version: MAGIC_PROJECT_VERSION_V3,
			type: "design",
			name: "storyboard-with-duration",
			canvas: {
				elements: [
					{
						id: "storyboard-1",
						type: ElementTypeEnum.Storyboard,
						contents: [
							{
								contentId: "storyboard-1-content-1",
								shots: [
									{
										id: "shot-1",
										durationSeconds: 3,
										description: "抱在一起",
										outputImageElementId: "image-1",
									},
								],
							},
						],
						activeContentId: "storyboard-1-content-1",
						mainContentId: "storyboard-1-content-1",
					},
				],
				connections: [
					{
						id: "storyboard-output",
						sourceElementId: "storyboard-1",
						targetElementId: "image-1",
						locked: true,
					},
				],
			},
		})};`

		const loaded = await loadDesignDataToRuntime({ content })

		expect(loaded.data.canvas?.elements?.[0]?.contents[0]?.shots).toEqual([
			{ id: "shot-1", description: "抱在一起", outputImageElementId: "image-1" },
		])
		expect(loaded.data.canvas?.connections).toEqual([
			{
				id: "storyboard-output",
				sourceElementId: "storyboard-1",
				targetElementId: "image-1",
			},
		])
	})

	it("clones and validates in-memory Draft data before returning it to Runtime", async () => {
		const draft = {
			version: "2.0.0",
			type: "design",
			name: "draft",
			canvas: {
				elements: [
					{
						id: "text-1",
						type: ElementTypeEnum.Text,
						content: [{ children: [{ type: "text" as const, text: "hello" }] }],
					},
				],
			},
		}

		const loaded = await loadDesignDataToRuntime({ designData: draft })

		expect(loaded?.data).not.toBe(draft)
		expect(loaded?.data.version).toBe(MAGIC_PROJECT_VERSION_V3)
		expect(loaded?.data.canvas?.elements?.[0]).toMatchObject({
			contents: [{ contentId: "text-1-content-1" }],
		})
		expect(draft.version).toBe("2.0.0")
		expect(loaded).toMatchObject({
			sourceVersion: "2.0.0",
			didUpgrade: true,
			needsPersist: false,
		})
	})

	it("rejects an in-memory Draft without a valid canvas", async () => {
		await expect(
			loadDesignDataToRuntime({
				designData: {
					version: "2.0.0",
					type: "design",
					name: "broken-draft",
				} as never,
			}),
		).rejects.toMatchObject({
			issue: {
				kind: "validation-failed",
				stage: "validate-v3",
			},
		})
	})
})
