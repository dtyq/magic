import { ElementTypeEnum } from "../../document/types"
import { topAction } from "./surfaceOptions"
import type {
	ElementToolContext,
	ElementToolCommandRoute,
	ElementToolDefinition,
	ElementToolResolution,
	ElementToolSurface,
	ElementToolSurfaceOptions,
	ElementToolType,
} from "../model/ElementToolTypes"

export function resolveTool(
	context: ElementToolContext,
	id: ElementToolType,
	surface: ElementToolSurface,
	presentation: ElementToolSurfaceOptions,
	options: {
		visibility?: ElementToolResolution["visibility"]
		loading?: boolean
		disabledReason?: string
		contentId?: string
		bindContent?: boolean
		execution?: ElementToolResolution["execution"]
		data?: ElementToolResolution["data"]
		presentation?: ElementToolSurfaceOptions
	} = {},
): ElementToolResolution {
	const contentId =
		options.bindContent === false
			? undefined
			: (options.contentId ?? context.content.activeContentId)
	const sessionMatches =
		context.selection.activeToolSession?.elementId === context.element.id &&
		context.selection.activeToolSession?.toolId === id &&
		context.selection.activeToolSession?.contentId === contentId
	const invocationContentRevision = sessionMatches
		? (context.selection.activeToolSession?.contentRevision ?? context.content.activeRevision)
		: context.content.activeRevision
	return {
		id,
		execution: options.execution ?? "command",
		surface,
		visibility: options.visibility ?? "visible",
		loading: options.loading,
		disabledReason: options.disabledReason,
		presentation: options.presentation ?? presentation,
		data: options.data,
		target: {
			elementId: context.element.id,
			contentId,
			contentRevision: invocationContentRevision,
			generationId: contentId
				? context.generation.attemptsByContentId.get(contentId)?.attemptId
				: undefined,
			operationId:
				context.selection.activeToolSession?.elementId === context.element.id &&
				context.selection.activeToolSession?.toolId === id &&
				context.selection.activeToolSession?.contentId === contentId
					? context.selection.activeToolSession.operationId
					: undefined,
		},
		execute:
			options.execution === "display-only"
				? undefined
				: (payload?: unknown) => {
						context.commandBus?.execute({
							toolId: id,
							elementId: context.element.id,
							contentId,
							contentRevision: invocationContentRevision,
							generationId: contentId
								? context.generation.attemptsByContentId.get(contentId)?.attemptId
								: undefined,
							operationId:
								context.selection.activeToolSession?.elementId ===
									context.element.id &&
								context.selection.activeToolSession?.toolId === id &&
								context.selection.activeToolSession?.contentId === contentId
									? context.selection.activeToolSession.operationId
									: undefined,
							payload,
						})
					},
	}
}

export function hasResource(context: ElementToolContext): boolean {
	return Boolean(context.content.active?.src)
}

export function isMedia(context: ElementToolContext): boolean {
	return (
		context.element.type === ElementTypeEnum.Image ||
		context.element.type === ElementTypeEnum.Video ||
		context.element.type === ElementTypeEnum.Audio
	)
}

export function mediaContentToolAllowed(context: ElementToolContext): boolean {
	return !context.generation.activeContentIsGenerating && hasResource(context)
}

export function generationToolAllowed(context: ElementToolContext): boolean {
	return (
		mediaContentToolAllowed(context) &&
		(context.generation.siblingGeneratingContentIds.length === 0 ||
			context.capabilities.canConcurrentGenerate)
	)
}

export function resolveRuntimeTool(
	context: ElementToolContext,
	id: ElementToolType,
	presentation: ElementToolSurfaceOptions,
): ElementToolResolution {
	const state = context.runtime.toolsById.get(id)
	return resolveTool(context, id, "bottom", presentation, {
		visibility:
			state?.available === false ? "hidden" : state?.disabled ? "disabled" : "visible",
		loading: state?.loading,
		disabledReason: state?.disabledReason,
		data: state?.data,
	})
}

export function mediaTool(
	id: ElementToolType,
	group: string,
	order: number,
	applicable: (context: ElementToolContext) => boolean,
	presentation = topAction(group, order),
	options: Pick<ElementToolDefinition, "effect" | "requiredCapability"> & {
		commandRoute?: ElementToolCommandRoute
		fallbackActionId?: string
	},
): ElementToolDefinition {
	return {
		id,
		scope: "active-content",
		execution: "command",
		effect: options.effect,
		requiredCapability: options.requiredCapability,
		commandRoute: options.commandRoute ?? "registered",
		fallbackActionId: options.fallbackActionId,
		surfaces: { top: presentation },
		isApplicable: (context) => context.selection.isSingleElement && applicable(context),
		resolve: (context) => resolveTool(context, id, "top", presentation),
	}
}

export function topTool(
	id: ElementToolType,
	scope: "element" | "active-content",
	group: string,
	order: number,
	isApplicable: (context: ElementToolContext) => boolean,
	options: Pick<ElementToolDefinition, "effect" | "requiredCapability"> & {
		commandRoute?: ElementToolCommandRoute
		fallbackActionId?: string
	},
): ElementToolDefinition {
	const presentation = topAction(group, order)
	return {
		id,
		scope,
		execution: "command",
		effect: options.effect,
		requiredCapability: options.requiredCapability,
		commandRoute: options.commandRoute ?? "registered",
		fallbackActionId: options.fallbackActionId,
		surfaces: { top: presentation },
		isApplicable,
		resolve: (context) =>
			resolveTool(context, id, "top", presentation, {
				bindContent: scope !== "element",
			}),
	}
}
