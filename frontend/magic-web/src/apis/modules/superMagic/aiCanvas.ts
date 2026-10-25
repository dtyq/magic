import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"
import type { CreatedProject, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"

/** Workspace code of the system-managed AI canvas workspace (one per user and organization). */
export const AI_CANVAS_WORKSPACE_CODE = "ai-canvas"

export const generateAiCanvasApi = (fetch: ServiceHttpClient) => ({
	/**
	 * Gets the AI canvas workspace; the backend creates it on first access.
	 */
	getAiCanvasWorkspace() {
		return fetch.get<Workspace>(
			`/api/v1/super-agent/workspaces/app/${AI_CANVAS_WORKSPACE_CODE}`,
		)
	},

	/**
	 * Creates an AI canvas project through the generic project endpoint.
	 * project_mode only identifies the project for routing; agent_mode pre-selects the
	 * design digital employee that every AI canvas conversation uses.
	 */
	createAiCanvasProject({
		workspace_id,
		project_name = "",
		workdir,
	}: {
		workspace_id: string
		project_name?: string
		workdir?: string
	}) {
		return fetch.post<CreatedProject>(`/api/v1/super-agent/projects`, {
			workspace_id,
			project_name,
			project_description: "",
			project_mode: TopicMode.AiCanvas,
			workdir,
			dynamic_params: {
				agent_mode: TopicMode.Design,
				message_version: "v2",
			},
		})
	},
})
