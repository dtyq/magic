import { ElementToolTypeEnum } from "../../../public/props"
import { ElementTypeEnum } from "../../document/types"
import type { ElementToolContext, ElementToolDefinition } from "../model/ElementToolTypes"
import { mediaContentToolAllowed, mediaTool, hasResource, isMedia, resolveTool } from "./common"
import { topAction, topCustom } from "./surfaceOptions"

function isLayoutScope(context: ElementToolContext): boolean {
	if (context.selection.isSingleElement) {
		return (
			(!context.element.locked &&
				!context.element.parentLocked &&
				context.element.type === ElementTypeEnum.Frame) ||
			(!context.element.locked &&
				!context.element.parentLocked &&
				context.element.type === ElementTypeEnum.Group)
		)
	}
	const parentIds = context.selection.elements.map((element) => element.parentId ?? null)
	const hasMixedParents =
		context.selection.hasMixedParents ??
		parentIds.some((parentId) => parentId !== (parentIds[0] ?? null))
	return (
		context.selection.elements.length > 1 &&
		!hasMixedParents &&
		!context.selection.elements.some((element) => element.parentLocked) &&
		context.selection.elements.some((element) => !element.locked) &&
		context.selection.elements.every(
			(element) =>
				element.type !== ElementTypeEnum.Frame && element.type !== ElementTypeEnum.Group,
		)
	)
}

const top = (group: string, order: number) => topAction(group, order)

export const COMMON_ELEMENT_TOOL_DEFINITIONS: ElementToolDefinition[] = [
	{
		id: ElementToolTypeEnum.ElementResize,
		scope: "element",
		execution: "command",
		effect: "document",
		requiredCapability: "document.write",
		commandRoute: "element",
		surfaces: { top: top("element", 10) },
		isApplicable: (context) =>
			context.selection.isSingleElement &&
			(context.element.type === ElementTypeEnum.Frame ||
				(context.element.type === ElementTypeEnum.Image &&
					!context.generation.activeContentIsGenerating &&
					hasResource(context))),
		resolve: (context) =>
			resolveTool(
				context,
				ElementToolTypeEnum.ElementResize,
				"top",
				context.element.type === ElementTypeEnum.Frame
					? top("frame-content", 20)
					: top("element", 10),
				{ bindContent: false },
			),
	},
	{
		id: ElementToolTypeEnum.ElementAlign,
		scope: "element",
		execution: "command",
		effect: "document",
		requiredCapability: "document.write",
		commandRoute: "action",
		fallbackActionId: "align.left",
		surfaces: { top: top("layout", 30) },
		isApplicable: (context) => isLayoutScope(context),
		resolve: (context) =>
			resolveTool(context, ElementToolTypeEnum.ElementAlign, "top", top("layout", 30), {
				bindContent: false,
			}),
	},
	{
		id: ElementToolTypeEnum.ElementDistribute,
		scope: "element",
		execution: "command",
		effect: "document",
		requiredCapability: "document.write",
		commandRoute: "action",
		fallbackActionId: "distribute.arrange",
		surfaces: { top: top("layout", 31) },
		isApplicable: (context) => isLayoutScope(context),
		resolve: (context) =>
			resolveTool(context, ElementToolTypeEnum.ElementDistribute, "top", top("layout", 31), {
				bindContent: false,
			}),
	},
	{
		id: ElementToolTypeEnum.FrameRemove,
		scope: "element",
		execution: "command",
		effect: "destructive",
		requiredCapability: "document.delete",
		commandRoute: "action",
		fallbackActionId: "frame.remove",
		surfaces: { top: top("frame-action", 10) },
		isApplicable: (context) =>
			context.selection.isSingleElement && context.element.type === ElementTypeEnum.Frame,
		resolve: (context) =>
			resolveTool(context, ElementToolTypeEnum.FrameRemove, "top", top("frame-action", 10), {
				bindContent: false,
			}),
	},
	{
		id: ElementToolTypeEnum.FrameDownload,
		scope: "element",
		execution: "command",
		effect: "external",
		requiredCapability: "sideEffect.download",
		commandRoute: "action",
		fallbackActionId: "download.frame",
		surfaces: { top: top("frame-content", 21) },
		isApplicable: (context) =>
			context.selection.isSingleElement && context.element.type === ElementTypeEnum.Frame,
		resolve: (context) =>
			resolveTool(
				context,
				ElementToolTypeEnum.FrameDownload,
				"top",
				top("frame-content", 21),
				{
					bindContent: false,
				},
			),
	},
	{
		id: ElementToolTypeEnum.FrameStoryboardVideoBatch,
		scope: "element",
		execution: "command",
		effect: "document",
		requiredCapability: "sideEffect.generate",
		commandRoute: "storyboard-batch",
		surfaces: { top: top("frame-content", 22) },
		isApplicable: (context) =>
			context.selection.isSingleElement &&
			context.element.type === ElementTypeEnum.Frame &&
			context.flags.isStoryboardOutputFrame,
		resolve: (context) =>
			resolveTool(
				context,
				ElementToolTypeEnum.FrameStoryboardVideoBatch,
				"top",
				top("frame-content", 22),
				{ bindContent: false },
			),
	},
	{
		id: ElementToolTypeEnum.FrameCreate,
		scope: "element",
		execution: "command",
		effect: "document",
		requiredCapability: "document.write",
		commandRoute: "action",
		fallbackActionId: "frame.create",
		surfaces: { top: top("frame-create", 10) },
		isApplicable: (context) =>
			context.selection.elements.length > 1 &&
			// A Frame can only be created around root-level ordinary nodes.  The
			// action guard rejects already-parented nodes as well; mirroring that
			// rule here prevents the tool from being advertised and then silently
			// rejected when the selected nodes already belong to a Frame/Group.
			context.selection.elements.every((element) => !element.parentId) &&
			!context.selection.elements.some(
				(element) =>
					element.type === ElementTypeEnum.Frame ||
					element.type === ElementTypeEnum.Group,
			),
		resolve: (context) =>
			resolveTool(context, ElementToolTypeEnum.FrameCreate, "top", top("frame-create", 10), {
				bindContent: false,
			}),
	},
	{
		id: ElementToolTypeEnum.ContentDownload,
		scope: "active-content",
		execution: "command",
		effect: "external",
		requiredCapability: "sideEffect.download",
		commandRoute: "action",
		fallbackActionId: "download.image",
		surfaces: { top: top("media", 90) },
		isApplicable: (context) =>
			context.selection.isSingleElement && isMedia(context) && hasResource(context),
		resolve: (context) =>
			resolveTool(context, ElementToolTypeEnum.ContentDownload, "top", top("media", 90)),
	},
	{
		id: ElementToolTypeEnum.ContentReplace,
		scope: "active-content",
		execution: "command",
		effect: "document",
		requiredCapability: "document.write",
		commandRoute: "media",
		surfaces: { top: top("media", 80) },
		isApplicable: (context) =>
			context.selection.isSingleElement &&
			isMedia(context) &&
			!context.generation.activeContentIsGenerating &&
			(hasResource(context) || context.element.type === ElementTypeEnum.Audio),
		resolve: (context) =>
			resolveTool(context, ElementToolTypeEnum.ContentReplace, "top", top("media", 80)),
	},
	mediaTool(
		ElementToolTypeEnum.ContentCrop,
		"image-edit",
		20,
		(context) =>
			context.element.type === ElementTypeEnum.Image && mediaContentToolAllowed(context),
		undefined,
		{
			effect: "document",
			requiredCapability: "document.write",
			commandRoute: "content-interaction",
		},
	),
	mediaTool(
		ElementToolTypeEnum.ContentExtend,
		"image-edit",
		21,
		(context) =>
			context.element.type === ElementTypeEnum.Image &&
			context.flags.expandSupported &&
			mediaContentToolAllowed(context),
		undefined,
		{
			effect: "document",
			requiredCapability: "sideEffect.generate",
			commandRoute: "content-interaction",
		},
	),
	mediaTool(
		ElementToolTypeEnum.ContentRemoveBackground,
		"image-edit",
		22,
		(context) =>
			context.element.type === ElementTypeEnum.Image &&
			context.flags.removeBackgroundSupported &&
			mediaContentToolAllowed(context),
		undefined,
		{
			effect: "document",
			requiredCapability: "sideEffect.generate",
			commandRoute: "registered",
		},
	),
	mediaTool(
		ElementToolTypeEnum.ContentEraser,
		"image-edit",
		23,
		(context) =>
			context.element.type === ElementTypeEnum.Image &&
			context.flags.eraserSupported &&
			mediaContentToolAllowed(context),
		undefined,
		{
			effect: "document",
			requiredCapability: "sideEffect.generate",
			commandRoute: "content-interaction",
		},
	),
	mediaTool(
		ElementToolTypeEnum.ContentEnhance,
		"image-edit",
		30,
		(context) =>
			context.element.type === ElementTypeEnum.Image &&
			context.flags.convertHightSupported &&
			mediaContentToolAllowed(context),
		topCustom("image-edit", 30),
		{
			effect: "document",
			requiredCapability: "sideEffect.generate",
			commandRoute: "registered",
		},
	),
	mediaTool(
		ElementToolTypeEnum.ContentPromptExtraction,
		"image-edit",
		40,
		(context) =>
			context.element.type === ElementTypeEnum.Image && mediaContentToolAllowed(context),
		undefined,
		{
			effect: "external",
			requiredCapability: "sideEffect.generate",
			commandRoute: "registered",
		},
	),
	mediaTool(
		ElementToolTypeEnum.ContentMediaOriginalSize,
		"element",
		11,
		(context) =>
			(context.element.type === ElementTypeEnum.Image ||
				context.element.type === ElementTypeEnum.Video) &&
			context.flags.showMediaOriginalSize &&
			mediaContentToolAllowed(context),
		topAction("element", 11),
		{
			effect: "document",
			requiredCapability: "document.write",
			commandRoute: "media-original-size",
		},
	),
]
