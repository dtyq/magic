import type { ChatWorkspaceSpec } from "./types"

export const chatWorkspaceSpec: ChatWorkspaceSpec = {
	files: { minWidth: 220, priority: 2, fallback: "rail" },
	main: { minWidth: 560, priority: 0, fallback: "keep" },
	preview: { minWidth: 360, priority: 1, fallback: "drawer" },
}
