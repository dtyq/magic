export type ChatWorkspaceMode = "three-column" | "preview-drawer" | "focus-main"
export type ChatWorkspaceDensity = "regular" | "compact" | "short"
export type ChatWorkspacePartId = "files" | "main" | "preview"

export interface ChatWorkspacePartSpec {
	minWidth: number
	priority: number
	fallback: "keep" | "rail" | "drawer"
}

export type ChatWorkspaceSpec = Record<ChatWorkspacePartId, ChatWorkspacePartSpec>

export interface ChatWorkspaceLayoutResult {
	mode: ChatWorkspaceMode
	density: ChatWorkspaceDensity
	visibleParts: ChatWorkspacePartId[]
}
