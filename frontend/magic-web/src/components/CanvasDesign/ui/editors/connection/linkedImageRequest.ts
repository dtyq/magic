import type { GenerateImageRequest, ReferenceImageOptions } from "../../../public/magic-types"
import type { ResolveCanvasResourceReference } from "../../../public/resource-reference"
import { buildReferenceImageOptions } from "../../../runtime/resources/image/imageCropUtils"
import {
	getLinkedMediaReferenceIdentity,
	mergeLinkedMediaReferences,
	type LinkedEditorInputsResolution,
	type LinkedEditorMediaReference,
} from "./linkedEditorInputs"
import { composePromptWithLinkedText } from "./linkedTextPrompt"

function buildLinkedReferenceImageOptions(
	references: LinkedEditorMediaReference[],
): ReferenceImageOptions | undefined {
	const options = references.flatMap(
		(reference) =>
			buildReferenceImageOptions({
				filePath: reference.path,
				crop: reference.sourceCrop,
			}) ?? [],
	)
	return options.length > 0 ? options : undefined
}

function mergeReferenceImageOptions(
	resolveResourceReference: ResolveCanvasResourceReference | undefined,
	...groups: Array<ReferenceImageOptions | undefined>
): ReferenceImageOptions | undefined {
	const merged: ReferenceImageOptions = []
	const optionIndexByPath = new Map<string, number>()

	for (const group of groups) {
		for (const option of group ?? []) {
			const identity = getLinkedMediaReferenceIdentity(option.path, resolveResourceReference)
			if (!identity) continue
			const existingIndex = optionIndexByPath.get(identity)
			if (existingIndex !== undefined) {
				merged[existingIndex] = option
				continue
			}
			optionIndexByPath.set(identity, merged.length)
			merged.push(option)
		}
	}

	return merged.length > 0 ? merged : undefined
}

export function buildImageRequestWithLinkedEditorInputs(
	request: GenerateImageRequest,
	linkedInputs: Pick<LinkedEditorInputsResolution, "activeMediaReferences" | "textPrompt">,
	promptFallback = "",
	resolveResourceReference?: ResolveCanvasResourceReference,
): GenerateImageRequest {
	const mergedImageReferences = mergeLinkedMediaReferences(
		(request.reference_images ?? []).map((path) => ({
			kind: "image" as const,
			path,
		})),
		linkedInputs.activeMediaReferences,
		resolveResourceReference,
	).filter((reference) => reference.kind === "image")
	const mergedReferenceImages = mergedImageReferences.map((reference) => reference.path)
	const referenceImageOptions = mergeReferenceImageOptions(
		resolveResourceReference,
		request.reference_image_options,
		buildLinkedReferenceImageOptions(mergedImageReferences),
	)

	return {
		...request,
		prompt: composePromptWithLinkedText(
			linkedInputs.textPrompt,
			request.prompt || promptFallback,
		),
		reference_images: mergedReferenceImages.length > 0 ? mergedReferenceImages : undefined,
		reference_image_options: referenceImageOptions,
	}
}
