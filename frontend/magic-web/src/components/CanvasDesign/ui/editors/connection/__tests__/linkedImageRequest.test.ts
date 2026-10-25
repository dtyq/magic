import { describe, expect, it } from "vitest"
import { createTestResourceReferenceResolver } from "../../../../public/__tests__/testResourceReferenceResolver"
import { buildImageRequestWithLinkedEditorInputs } from "../linkedImageRequest"

const resolveDesignAResourceReference = createTestResourceReferenceResolver()

describe("buildImageRequestWithLinkedEditorInputs", () => {
	it("adds linked image crop options to the generated image request", () => {
		const request = buildImageRequestWithLinkedEditorInputs(
			{
				model_id: "image-model",
				prompt: "editable prompt",
				reference_images: ["/images/manual.png"],
			},
			{
				textPrompt: "linked prompt",
				activeMediaReferences: [
					{
						kind: "image",
						path: "/images/linked.png",
						sourceCrop: {
							x: 10,
							y: 20,
							width: 300,
							height: 200,
						},
					},
				],
			},
		)

		expect(request).toMatchObject({
			prompt: "linked prompt\neditable prompt",
			reference_images: ["/images/manual.png", "/images/linked.png"],
			reference_image_options: [
				{
					path: "/images/linked.png",
					crop: {
						x: 10,
						y: 20,
						width: 300,
						height: 200,
					},
				},
			],
		})
	})

	it("keeps manual reference image options before linked options", () => {
		const request = buildImageRequestWithLinkedEditorInputs(
			{
				model_id: "image-model",
				prompt: "editable prompt",
				reference_images: ["/images/manual.png"],
				reference_image_options: [
					{
						path: "/images/manual.png",
						crop: {
							x: 1,
							y: 2,
							width: 30,
							height: 40,
						},
					},
				],
			},
			{
				textPrompt: "",
				activeMediaReferences: [
					{
						kind: "image",
						path: "/images/linked.png",
						sourceCrop: {
							x: 10,
							y: 20,
							width: 300,
							height: 200,
						},
					},
				],
			},
		)

		expect(request.reference_image_options).toEqual([
			{
				path: "/images/manual.png",
				crop: {
					x: 1,
					y: 2,
					width: 30,
					height: 40,
				},
			},
			{
				path: "/images/linked.png",
				crop: {
					x: 10,
					y: 20,
					width: 300,
					height: 200,
				},
			},
		])
	})

	it("lets linked crop metadata override a manual option for the same resource", () => {
		const request = buildImageRequestWithLinkedEditorInputs(
			{
				reference_images: ["./images/shared.png"],
				reference_image_options: [
					{
						path: "./images/shared.png",
						crop: { x: 1, y: 2, width: 30, height: 40 },
					},
				],
			},
			{
				textPrompt: "",
				activeMediaReferences: [
					{
						kind: "image",
						path: "/画布A/images/shared.png",
						sourceCrop: { x: 10, y: 20, width: 300, height: 200 },
					},
				],
			},
			"",
			resolveDesignAResourceReference,
		)

		expect(request.reference_images).toEqual(["/画布A/images/shared.png"])
		expect(request.reference_image_options).toEqual([
			{
				path: "/画布A/images/shared.png",
				crop: { x: 10, y: 20, width: 300, height: 200 },
			},
		])
	})

	it("keeps workspace-root and current-canvas references separate with host identity", () => {
		const request = buildImageRequestWithLinkedEditorInputs(
			{
				reference_images: ["./images/shared.png"],
			},
			{
				textPrompt: "",
				activeMediaReferences: [
					{
						kind: "image",
						path: "/images/shared.png",
					},
				],
			},
			"",
			resolveDesignAResourceReference,
		)

		expect(request.reference_images).toEqual(["./images/shared.png", "/images/shared.png"])
	})
})
