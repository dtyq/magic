import type { ToolCallSettledEvent } from "@/pages/superMagic/stores/events"

export const CREATE_CANVAS_TOOL_NAMES = new Set([
	"create_canvas",
	"create_design_project",
	"initialize_canvas",
])

export function normalizeCanvasProjectPath(projectPath?: string): string | undefined {
	const normalized = projectPath
		?.trim()
		.replace(/\\/g, "/")
		.replace(/^\.\/+/, "")
		.replace(/^\/+/, "")
		.replace(/\/+$/, "")
	if (!normalized) return undefined
	return normalized.endsWith("/magic.project.js")
		? normalized.slice(0, -"/magic.project.js".length)
		: normalized
}

export function isLiveFinishedToolSettlement(event: ToolCallSettledEvent) {
	return (
		event.payload.response.status === "finished" &&
		event.payload.strength === "strong" &&
		!event.payload.replaceable &&
		(event.meta.source === "im" || event.meta.source === "http")
	)
}

export function readToolResultProjectPath(event: ToolCallSettledEvent): string | undefined {
	const detail = event.payload.response.detail
	if (detail && typeof detail === "object") {
		const detailRecord = detail as Record<string, unknown>
		const data =
			detailRecord.data && typeof detailRecord.data === "object"
				? (detailRecord.data as Record<string, unknown>)
				: undefined
		const projectPath = data?.project_path
		if (typeof projectPath === "string" && projectPath.trim()) return projectPath.trim()
	}

	// initialize_canvas exposes its project path through the localized remark prefix:
	// "<workspace-relative project_path> · <localized result>".
	const remark = event.payload.response.remark?.trim()
	const separatorIndex = remark?.indexOf(" · ") ?? -1
	return separatorIndex > 0 ? remark?.slice(0, separatorIndex).trim() : undefined
}

export function isCreateCanvasToolResult(event: ToolCallSettledEvent) {
	const toolName = event.payload.toolCall.name
	return (
		isLiveFinishedToolSettlement(event) &&
		typeof toolName === "string" &&
		CREATE_CANVAS_TOOL_NAMES.has(toolName)
	)
}
