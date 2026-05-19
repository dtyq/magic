import { platformKey } from "@/utils/storage"

// One-time MCP plugin tips: persist after user adds MCP at least once.
const STORAGE_KEY = platformKey("mcp-plugin-tips-ever-added")

export function readMcpPluginTipsEverAdded(): boolean {
	if (typeof window === "undefined") return false
	try {
		return window.localStorage.getItem(STORAGE_KEY) === "1"
	} catch {
		return false
	}
}

export function writeMcpPluginTipsEverAdded() {
	if (typeof window === "undefined") return
	try {
		window.localStorage.setItem(STORAGE_KEY, "1")
	} catch {
		// ignore quota / private mode
	}
}
