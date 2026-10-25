import { ElementToolTypeEnum } from "../../../public/props"
import { ElementTypeEnum } from "../../document/types"
import type { ElementToolDefinition } from "../model/ElementToolTypes"
import { topTool } from "./common"

const shapeTypes = new Set<string>([
	ElementTypeEnum.Rectangle,
	ElementTypeEnum.Ellipse,
	ElementTypeEnum.Triangle,
	ElementTypeEnum.Star,
])

const shapeTools = [
	[ElementToolTypeEnum.ShapeStrokeColor, 10],
	[ElementToolTypeEnum.ShapeStyle, 20],
] as const

export const SHAPE_TOOL_DEFINITIONS: ElementToolDefinition[] = shapeTools.map(([id, order]) =>
	topTool(
		id,
		"element",
		"shape",
		order,
		(context) => context.selection.isSingleElement && shapeTypes.has(context.element.type),
		{
			effect: "document",
			requiredCapability: "document.write",
			commandRoute: "shape",
		},
	),
)
