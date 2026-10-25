import { ElementTypeEnum } from "../../document/types"
import { authorizeCanvasTool } from "../../core/CanvasAccessPolicy"
import { getContentState } from "../../document/elementContent"
import { ElementToolTypeEnum } from "../../../public/props"
import type {
	ContentSnapshot,
	ElementToolContext,
	ElementToolDefinition,
	ElementToolResolution,
	ElementToolSurface,
	ElementToolType,
} from "../model/ElementToolTypes"
import {
	COMMON_ELEMENT_TOOL_DEFINITIONS,
	GENERATION_TOOL_DEFINITIONS,
	SHAPE_TOOL_DEFINITIONS,
	TEXT_TOOL_DEFINITIONS,
	VERSION_TOOL_DEFINITIONS,
} from "../catalog"

export const ELEMENT_TOOL_DEFINITIONS = [
	...COMMON_ELEMENT_TOOL_DEFINITIONS,
	...GENERATION_TOOL_DEFINITIONS,
	...TEXT_TOOL_DEFINITIONS,
	...SHAPE_TOOL_DEFINITIONS,
	...VERSION_TOOL_DEFINITIONS,
] as const

export function getElementToolDefinition(
	toolId: ElementToolType,
): ElementToolDefinition | undefined {
	return ELEMENT_TOOL_DEFINITIONS.find((definition) => definition.id === toolId)
}

export function resolveElementTools(
	context: ElementToolContext,
	surface: ElementToolSurface,
): ElementToolResolution[] {
	const activeSession = context.selection.activeToolSession
	const hasExclusiveToolSession =
		activeSession?.elementId === context.element.id &&
		activeSession.contentId === context.content.activeContentId
	if (surface === "top" && hasExclusiveToolSession && activeSession) {
		const definition = ELEMENT_TOOL_DEFINITIONS.find(
			(candidate) => candidate.id === activeSession.toolId,
		)
		if (definition?.surfaces.top && definition.isApplicable(context)) {
			const resolution = definition.resolve(context)
			if (!authorizeCanvasTool(context.access, definition).allowed) return []
			if (
				resolution.target.contentId === activeSession.contentId &&
				resolution.visibility !== "hidden"
			) {
				return [
					{
						...resolution,
						execution: definition.execution,
						execute:
							definition.execution === "display-only"
								? undefined
								: resolution.execute,
						target: {
							...resolution.target,
							operationId: activeSession.operationId,
						},
					},
				]
			}
		}
		return []
	}
	if (surface === "bottom" && (context.interaction.isEditing || hasExclusiveToolSession)) {
		if (hasExclusiveToolSession) return []
		if (
			context.element.type !== ElementTypeEnum.Image &&
			context.element.type !== ElementTypeEnum.Video
		) {
			return []
		}
	}
	const hasLockedSelection = context.selection.elements.some((element) => element.locked)
	const parentIds = context.selection.elements.map((element) => element.parentId ?? null)
	const hasMixedParents =
		context.selection.hasMixedParents ??
		parentIds.some((parentId) => parentId !== (parentIds[0] ?? null))
	const isLayoutSelection =
		(context.selection.isSingleElement &&
			!context.element.locked &&
			!context.element.parentLocked &&
			(context.element.type === ElementTypeEnum.Frame ||
				context.element.type === ElementTypeEnum.Group)) ||
		(context.selection.elements.length > 1 &&
			!hasMixedParents &&
			!context.selection.elements.some((element) => element.parentLocked) &&
			context.selection.elements.some((element) => !element.locked) &&
			context.selection.elements.every(
				(element) =>
					element.type !== ElementTypeEnum.Frame &&
					element.type !== ElementTypeEnum.Group,
			))
	if (
		(hasLockedSelection && !isLayoutSelection) ||
		context.interaction.isReplacing ||
		context.interaction.isCropping ||
		context.interaction.isExtending ||
		context.interaction.isErasing ||
		context.interaction.isFullscreenPreviewOpen ||
		context.selection.isSelecting ||
		(context.selection.isDragging &&
			(!context.selection.isSingleElement || context.element.type !== ElementTypeEnum.Text))
	) {
		return []
	}
	const seen = new Set<string>()
	const isMediaEditor =
		surface === "bottom" &&
		context.interaction.isEditing &&
		(context.element.type === ElementTypeEnum.Image ||
			context.element.type === ElementTypeEnum.Video)
	return (
		ELEMENT_TOOL_DEFINITIONS.filter((definition) => Boolean(definition.surfaces[surface]))
			// A locked multi-selection is allowed to expose geometry tools so the
			// unlocked peers can be arranged, but other element mutations must retain
			// the historical locked-selection guard.
			.filter(
				(definition) =>
					!hasLockedSelection ||
					!isLayoutSelection ||
					definition.id === ElementToolTypeEnum.ElementAlign ||
					definition.id === ElementToolTypeEnum.ElementDistribute,
			)
			.filter((definition) => !isMediaEditor || definition.scope === "version-set")
			.filter((definition) => definition.isApplicable(context))
			.map((definition) => {
				const resolved = definition.resolve(context)
				const authorization = authorizeCanvasTool(context.access, definition).allowed
				const resolution = {
					...resolved,
					visibility: authorization ? resolved.visibility : "hidden",
					execution: definition.execution,
					execute: definition.execution === "display-only" ? undefined : resolved.execute,
				}
				if (
					activeSession &&
					activeSession.elementId === context.element.id &&
					activeSession.toolId === definition.id &&
					activeSession.contentId === resolution.target.contentId
				) {
					return {
						...resolution,
						target: { ...resolution.target, operationId: activeSession.operationId },
					}
				}
				return resolution
			})
			.filter((resolution) => {
				if (resolution.visibility === "hidden" || seen.has(resolution.id)) return false
				seen.add(resolution.id)
				return true
			})
			.sort((left, right) => {
				const order = left.presentation.order - right.presentation.order
				return order || left.presentation.group.localeCompare(right.presentation.group)
			})
	)
}

export function createContentIndex(element: {
	contents?: readonly ContentSnapshot[]
	activeContentId?: string | null
	mainContentId?: string | null
	effectiveContentId?: string | null
}) {
	const contents = element.contents ?? []
	const byId = new Map(contents.map((content) => [content.contentId, content]))
	const states = new Map(contents.map((content) => [content.contentId, getContentState(content)]))
	const firstContentId = contents[0]?.contentId
	const activeContentId =
		element.effectiveContentId && byId.has(element.effectiveContentId)
			? element.effectiveContentId
			: element.activeContentId && byId.has(element.activeContentId)
				? element.activeContentId
				: firstContentId
	const mainContentId =
		element.mainContentId && byId.has(element.mainContentId)
			? element.mainContentId
			: firstContentId
	return {
		activeContentId,
		mainContentId,
		active: activeContentId ? byId.get(activeContentId) : undefined,
		byId,
		states,
	}
}
