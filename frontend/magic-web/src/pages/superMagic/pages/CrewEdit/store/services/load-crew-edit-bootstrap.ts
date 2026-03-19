import { SuperMagicApi } from "@/apis"
import type { AgentDetailResponse } from "@/apis/modules/crew"
import { crewService } from "@/services/crew/CrewService"
import type { ProjectListItem, Topic } from "../../../Workspace/types"

export interface CrewEditBootstrapData {
	agentDetail: AgentDetailResponse
	project: ProjectListItem | null
	topics: Topic[]
}

export async function loadCrewEditBootstrap(crewCode: string): Promise<CrewEditBootstrapData> {
	const agentDetail = await crewService.getAgentDetailRaw(crewCode)

	if (!agentDetail.project_id) {
		return {
			agentDetail,
			project: null,
			topics: [],
		}
	}

	const project = await SuperMagicApi.getProjectDetail({ id: agentDetail.project_id })
	if (!project) {
		return {
			agentDetail,
			project: null,
			topics: [],
		}
	}

	const response = await SuperMagicApi.getTopicsByProjectId({
		id: project.id,
		page: 1,
		page_size: 999,
	})

	return {
		agentDetail,
		project,
		topics: response.list,
	}
}
