export type ToolRemarkPreviewParseResult =
	| { status: "pending" }
	| { status: "resolved"; value: string }
	| { status: "exhausted" }

export interface ToolRemarkPreviewParser {
	parse: (rawArguments: string) => ToolRemarkPreviewParseResult
}
