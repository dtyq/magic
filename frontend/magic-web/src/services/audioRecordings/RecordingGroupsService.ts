import { SuperMagicApi } from "@/apis"
import { AUDIO_WORKSPACE_TYPE } from "./RecordingGroupsConstants"
import { analyticsService } from "@/services/analytics"

const WORKSPACE_PAGE_SIZE = 200

export interface RecordingWorkspaceApiItem {
	id: string
	name?: string
	workspace_name?: string
	workspace_type?: string
	project_count?: number
}

export interface AudioRecordingGroup {
	id: string
	name: string
	projectCount: number
	isVirtual: boolean
	workspaceType?: string
}

export interface AudioRecordingGroupsResult {
	groups: AudioRecordingGroup[]
	totalCount: number
	ungroupedCount: number
}

interface RecordingWorkspacesResponse {
	list?: RecordingWorkspaceApiItem[]
	total?: number
}

/** Resolves the display name returned by different workspace endpoints */
function resolveWorkspaceName(item: RecordingWorkspaceApiItem): string {
	return item.workspace_name || item.name || ""
}

/** Adapts an audio workspace row into the mobile recording group view model */
function normalizeWorkspaceGroup(item: RecordingWorkspaceApiItem): AudioRecordingGroup {
	return {
		id: item.id,
		name: resolveWorkspaceName(item),
		projectCount: item.project_count ?? 0,
		isVirtual: false,
		workspaceType: item.workspace_type,
	}
}

/** Encapsulates recording group APIs while keeping UI language separate from workspace APIs */
export class RecordingGroupsService {
	/** Loads every real audio workspace page so group counts and move targets never truncate */
	private async listAllAudioWorkspaces(): Promise<RecordingWorkspaceApiItem[]> {
		const workspaces: RecordingWorkspaceApiItem[] = []
		let page = 1
		let total: number | undefined
		let hasMorePages = true

		while (hasMorePages) {
			const response = (await SuperMagicApi.getWorkspaces({
				page,
				page_size: WORKSPACE_PAGE_SIZE,
				workspace_type: AUDIO_WORKSPACE_TYPE,
				auto_create: false,
			})) as RecordingWorkspacesResponse

			const currentPage = response.list ?? []
			workspaces.push(...currentPage)
			total = response.total ?? total

			const loadedAllByTotal = total != null && workspaces.length >= total
			const reachedLastPage = currentPage.length < WORKSPACE_PAGE_SIZE
			hasMorePages = !(loadedAllByTotal || reachedLastPage)

			page += 1
		}

		return workspaces
	}

	/** Loads real audio workspaces and the ungrouped count, then computes the virtual total */
	async listGroups(): Promise<AudioRecordingGroupsResult> {
		const [workspaces, ungroupedResponse] = await Promise.all([
			this.listAllAudioWorkspaces(),
			SuperMagicApi.getUngroupedAudioProjectsCount(),
		])

		const realGroups = workspaces.map(normalizeWorkspaceGroup)
		const ungroupedCount = ungroupedResponse?.count ?? 0
		const totalCount =
			ungroupedCount + realGroups.reduce((sum, group) => sum + group.projectCount, 0)

		return {
			groups: realGroups,
			totalCount,
			ungroupedCount,
		}
	}

	/** Creates a backend audio workspace for the user-visible recording group */
	async createGroup(name: string): Promise<AudioRecordingGroup> {
		analyticsService.report("workspace_create_attempted")
		const workspace = (await SuperMagicApi.createWorkspace({
			workspace_name: name.trim(),
			workspace_type: AUDIO_WORKSPACE_TYPE,
		})) as RecordingWorkspaceApiItem
		return normalizeWorkspaceGroup(workspace)
	}

	/** Renames a real audio workspace group */
	async renameGroup(id: string, name: string): Promise<void> {
		await SuperMagicApi.editWorkspace({
			id,
			workspace_name: name.trim(),
		})
	}

	/**
	 * Safely removes a recording group by detaching its projects first,
	 * so recordings become ungrouped instead of cascading into hard deletes.
	 */
	async deleteGroup(id: string): Promise<void> {
		await SuperMagicApi.detachWorkspace({ id })
	}
}

export const recordingGroupsService = new RecordingGroupsService()
