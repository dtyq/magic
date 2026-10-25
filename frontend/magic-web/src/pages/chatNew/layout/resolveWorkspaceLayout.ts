import type { ChatWorkspaceDensity, ChatWorkspaceLayoutResult, ChatWorkspaceSpec } from "./types"

function resolveDensity(height: number): ChatWorkspaceDensity {
	if (height > 0 && height <= 720) return "short"
	if (height > 0 && height <= 800) return "compact"
	return "regular"
}

export function resolveChatWorkspaceLayout(input: {
	availableWidth: number
	availableHeight: number
	spec: ChatWorkspaceSpec
}): ChatWorkspaceLayoutResult {
	const { availableWidth, availableHeight, spec } = input
	const density = resolveDensity(availableHeight)
	const filesAndMainWidth = spec.files.minWidth + spec.main.minWidth
	const threeColumnWidth = filesAndMainWidth + spec.preview.minWidth

	if (availableWidth <= 0 || availableWidth >= threeColumnWidth) {
		return {
			mode: "three-column",
			density,
			visibleParts: ["files", "main", "preview"],
		}
	}

	if (availableWidth >= filesAndMainWidth) {
		return { mode: "preview-drawer", density, visibleParts: ["files", "main"] }
	}

	return { mode: "focus-main", density, visibleParts: ["main"] }
}
