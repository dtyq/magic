export type {
	ComputedStyleInfo,
	ElementNode,
} from "./dom"

export type {
	PPTXGenCore,
	Pptx,
	Slide,
	PPTNodeBase,
	CustGeomPoint,
	PPTShapeNode,
	PPTImageNode,
	PPTTextGradient,
	PPTTextNode,
	PPTTableNode,
	PPTBorderLineNode,
	PPTMediaNode,
	PPTNode,
	ParserContext,
} from "./node"

export type {
	PPTSolidFill,
	PPTLinearGradientFill,
	PPTRadialGradientFill,
	PPTFill,
	PPTGradientFill,
	PPTLine,
	PPTShadow,
	PPTTableRow,
	PPTTableCellBorder,
	PPTTableCell,
} from "./style"

export type {
	SerializablePPTImageNode,
	SerializablePPTShapeNode,
	SerializablePPTTextNode,
	SerializablePPTTableNode,
	SerializablePPTBorderLineNode,
	SerializablePPTMediaNode,
	SerializablePPTNode,
} from "./serialize"

export { serializePptNodes } from "./serialize"
