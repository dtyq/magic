import { ElementToolTypeEnum } from "../../../public/props"
import { ElementTypeEnum } from "../../document/types"
import type { ElementToolDefinition } from "../model/ElementToolTypes"
import { topTool } from "./common"

const textTools = [
	[ElementToolTypeEnum.TextFillColor, "text-fill", 10],
	[ElementToolTypeEnum.TextFontFamily, "text-font", 20],
	[ElementToolTypeEnum.TextFontSize, "text-font", 21],
	[ElementToolTypeEnum.TextFontStyle, "text-style", 30],
	[ElementToolTypeEnum.TextAlign, "text-align", 40],
	[ElementToolTypeEnum.TextAdvanced, "text-advanced", 50],
	[ElementToolTypeEnum.TextDownload, "text-export", 60],
	[ElementToolTypeEnum.TextContentOptimization, "text-export", 61],
] as const

export const TEXT_TOOL_DEFINITIONS: ElementToolDefinition[] = textTools.map(([id, group, order]) =>
	topTool(
		id,
		"active-content",
		group,
		order,
		(context) =>
			context.selection.isSingleElement && context.element.type === ElementTypeEnum.Text,
		id === ElementToolTypeEnum.TextDownload
			? {
					effect: "external",
					requiredCapability: "sideEffect.download",
					commandRoute: "action",
					fallbackActionId: "download.text",
				}
			: {
					effect: "document",
					requiredCapability: "document.write",
					commandRoute: "text",
				},
	),
)
