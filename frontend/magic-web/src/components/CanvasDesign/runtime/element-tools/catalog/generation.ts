import { ElementToolTypeEnum } from "../../../public/props"
import { ElementTypeEnum } from "../../document/types"
import type { ElementToolDefinition } from "../model/ElementToolTypes"
import { bottomAction } from "./surfaceOptions"
import { generationToolAllowed, resolveRuntimeTool } from "./common"

const isGenerationMedia = (context: Parameters<ElementToolDefinition["isApplicable"]>[0]) =>
	(context.element.type === ElementTypeEnum.Image ||
		context.element.type === ElementTypeEnum.Video) &&
	context.selection.isSingleElement &&
	generationToolAllowed(context) &&
	!context.interaction.isEditing

function isDraftTaskVideoResult(
	context: Parameters<ElementToolDefinition["isApplicable"]>[0],
): boolean {
	if (context.element.type !== ElementTypeEnum.Video) return false
	const request = context.content.active?.generateVideoRequest
	return (
		typeof request === "object" &&
		request !== null &&
		(request as { input_mode?: unknown }).input_mode === "draft_task"
	)
}

export const GENERATION_TOOL_DEFINITIONS: ElementToolDefinition[] = [
	{
		id: ElementToolTypeEnum.GenerationQuickEdit,
		scope: "generation",
		execution: "command",
		effect: "document",
		requiredCapability: "sideEffect.generate",
		commandRoute: "generation",
		surfaces: {
			bottom: {
				...bottomAction("pencil", "imageEditor.quickEdit", "快捷编辑", "generation", 10),
				shortcut: "Tab",
			},
		},
		isApplicable: (context) =>
			isGenerationMedia(context) &&
			(context.runtime.toolsById.get(ElementToolTypeEnum.GenerationQuickEdit)?.available ??
				true),
		resolve: (context) =>
			resolveRuntimeTool(context, ElementToolTypeEnum.GenerationQuickEdit, {
				...bottomAction("pencil", "imageEditor.quickEdit", "快捷编辑", "generation", 10),
				shortcut: "Tab",
			}),
	},
	{
		id: ElementToolTypeEnum.GenerationReEdit,
		scope: "generation",
		execution: "command",
		effect: "document",
		requiredCapability: "sideEffect.generate",
		commandRoute: "generation",
		surfaces: {
			bottom: bottomAction(
				"square-pen",
				"imageEditor.reEditFromSaved",
				"重新编辑",
				"generation",
				20,
			),
		},
		isApplicable: (context) =>
			isGenerationMedia(context) &&
			context.capabilities.canGenerateContent &&
			!isDraftTaskVideoResult(context) &&
			(context.runtime.toolsById.get(ElementToolTypeEnum.GenerationReEdit)?.available ??
				true),
		resolve: (context) =>
			resolveRuntimeTool(
				context,
				ElementToolTypeEnum.GenerationReEdit,
				bottomAction(
					"square-pen",
					"imageEditor.reEditFromSaved",
					"重新编辑",
					"generation",
					20,
				),
			),
	},
	{
		id: ElementToolTypeEnum.GenerationGenerateAgain,
		scope: "generation",
		execution: "command",
		effect: "document",
		requiredCapability: "sideEffect.generate",
		commandRoute: "generation",
		surfaces: {
			bottom: bottomAction(
				"rotate-ccw",
				"imageEditor.generateAgain",
				"再次生成",
				"generation",
				30,
			),
		},
		isApplicable: (context) =>
			isGenerationMedia(context) &&
			context.capabilities.canGenerateContent &&
			(context.runtime.toolsById.get(ElementToolTypeEnum.GenerationGenerateAgain)
				?.available ??
				true),
		resolve: (context) =>
			resolveRuntimeTool(
				context,
				ElementToolTypeEnum.GenerationGenerateAgain,
				bottomAction(
					"rotate-ccw",
					"imageEditor.generateAgain",
					"再次生成",
					"generation",
					30,
				),
			),
	},
	{
		id: ElementToolTypeEnum.GenerationGenerateFinal,
		scope: "generation",
		execution: "command",
		effect: "document",
		requiredCapability: "sideEffect.generate",
		commandRoute: "generation",
		surfaces: {
			bottom: bottomAction(
				undefined,
				"videoEditor.generateFinal",
				"生成正片",
				"generation",
				40,
			),
		},
		// 该工具没有通用兜底能力；只有 VideoSecondEdit 完成样片和模型能力
		// 校验并注册运行时命令后才允许显示。
		isApplicable: (context) =>
			isGenerationMedia(context) &&
			context.element.type === ElementTypeEnum.Video &&
			context.runtime.toolsById.get(ElementToolTypeEnum.GenerationGenerateFinal)
				?.available === true,
		resolve: (context) =>
			resolveRuntimeTool(
				context,
				ElementToolTypeEnum.GenerationGenerateFinal,
				bottomAction(undefined, "videoEditor.generateFinal", "生成正片", "generation", 40),
			),
	},
]
