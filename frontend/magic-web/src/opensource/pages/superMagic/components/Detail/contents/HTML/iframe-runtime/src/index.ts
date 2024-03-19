/**
 * Iframe Editor Runtime
 * Entry point for HTML editing runtime in iframe
 */

import { EditorRuntime } from "./runtime/EditorRuntime"
import { EditorLogger } from "./utils/EditorLogger"

// Initialize editor runtime
let editorRuntime: EditorRuntime | null = null

function initializeRuntime(): void {
	// Destroy existing runtime if present (prevents duplicate instances)
	if (editorRuntime) {
		EditorLogger.info("Destroying existing editor runtime before re-initialization")
		try {
			editorRuntime.destroy()
		} catch (error) {
			EditorLogger.warn("Failed to destroy existing runtime:", error)
		}
		editorRuntime = null
	}

	EditorLogger.info("Initializing iframe editor runtime")
	editorRuntime = new EditorRuntime()

	// Export to global (for debugging)
	if (typeof window !== "undefined") {
		window.__iframeEditorRuntime__ = editorRuntime
		// Set injection flag to indicate runtime is active
		window.__EDITING_FEATURES_V2_INJECTED__ = true
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializeRuntime)
} else {
	initializeRuntime()
}

// Type declarations for global scope
declare global {
	interface Window {
		__iframeEditorRuntime__?: EditorRuntime
	}
}

export { EditorRuntime }
