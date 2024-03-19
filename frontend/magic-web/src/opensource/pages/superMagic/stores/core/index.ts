import workspaceStore from "./workspace"
import projectStore from "./project"
import topicStore from "./topic"
import { isDev } from "@/opensource/utils/env"

export { workspaceStore, projectStore, topicStore }

declare global {
	interface Window {
		workspaceStore: typeof workspaceStore
		projectStore: typeof projectStore
		topicStore: typeof topicStore
	}
}

if (isDev) {
	window.workspaceStore = workspaceStore
	window.projectStore = projectStore
	window.topicStore = topicStore
}
