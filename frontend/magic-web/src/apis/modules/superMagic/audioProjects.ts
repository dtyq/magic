import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"
import type { QueryAudioProjectsParams, QueryAudioProjectsResponse } from "@/types/audioProject"
import type { CreatedProject } from "@/pages/superMagic/pages/Workspace/types"

export interface BatchMoveProjectsParams {
	project_ids: string[]
	target_workspace_id: string
}

export interface CreateAudioProjectParams {
	project_name: string
	workspace_id?: string
	source: "app" | "device" | "h5" | "pc"
	device_id?: string
	is_hidden?: boolean
	task_key: string
	auto_summary?: boolean
	/** Captures whether realtime transcription is enabled for this recording task */
	transcription_enabled?: boolean
	model_id?: string
	audio_source: "recorded" | "imported"
}

export interface ImportAudioProjectFilePayload {
	file_key: string
	file_name: string
	file_size: number
	/** Audio duration in seconds; when the browser cannot read metadata yet, send 0 and let backend backfill later. */
	duration: number
}

export interface ImportAudioProjectFilesParams {
	project_id: string
	parent_id: string
	files: ImportAudioProjectFilePayload[]
}

export interface ImportAudioProjectFilesResponse {
	file_ids: string[]
	total: number
}

/** Builds REST helpers for PC audio recording project list queries */
export const generateAudioProjectsApi = (fetch: ServiceHttpClient) => ({
	/**
	 * Query audio/summary projects for the recordings list page.
	 * Endpoint: POST /api/v1/super-agent/audio-projects/queries
	 */
	queryAudioProjects(params: QueryAudioProjectsParams) {
		return fetch.post<QueryAudioProjectsResponse>(
			"/api/v1/super-agent/audio-projects/queries",
			params,
			// TODO: remove this config after backend handle it
			{ parseJsonLargeIntAsString: true },
		)
	},

	/** Reads the number of audio projects without a workspace group */
	getUngroupedAudioProjectsCount() {
		return fetch.get<{ count: number }>("/api/v1/super-agent/audio-projects/ungrouped/count")
	},

	/** Moves audio projects to another workspace group in one backend request */
	batchMoveProjects(params: BatchMoveProjectsParams) {
		return fetch.post<void>("/api/v1/super-agent/projects/batch-move", params)
	},

	/**
	 * Creates a new audio recording and summary project.
	 * Endpoint: POST /api/v1/super-agent/audio-projects
	 */
	createAudioProject(params: CreateAudioProjectParams) {
		return fetch.post<CreatedProject>("/api/v1/super-agent/audio-projects", params)
	},

	/** Imports uploaded raw audio objects into an audio project so backend can hydrate audio_file_id. */
	importAudioProjectFiles(params: ImportAudioProjectFilesParams) {
		return fetch.post<ImportAudioProjectFilesResponse>(
			"/api/v1/super-agent/audio-projects/import-files",
			params,
		)
	},
})
