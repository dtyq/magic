import { makeAutoObservable, runInAction } from "mobx"
import type { AgentDetailResponse } from "@/opensource/apis/modules/crew"
import { crewService } from "@/opensource/services/crew/CrewService"
import { CREW_EDIT_ERROR } from "../constants/errors"
import { CrewConversationStore } from "./conversation-store"
import { CrewIdentityStore } from "./identity-store"
import { CrewLayoutStore } from "./layout-store"
import { CrewPlaybookStore } from "./playbook-store"
import { CrewSkillsStore } from "./skills-store"
import { loadCrewEditBootstrap } from "./services/load-crew-edit-bootstrap"
import {
	CREW_EDIT_STEP,
	mapAgentSkillItem,
	resolveCrewEditError,
	type CrewEditAsyncError,
} from "./shared"

export class CrewEditRootStore {
	topicName = ""
	crewCode: string | null = null
	initLoading = false
	initError: CrewEditAsyncError | null = null

	readonly layout: CrewLayoutStore
	readonly identity: CrewIdentityStore
	readonly skills: CrewSkillsStore
	readonly playbook: CrewPlaybookStore
	readonly conversation: CrewConversationStore

	constructor() {
		this.layout = new CrewLayoutStore()
		this.identity = new CrewIdentityStore({
			getCrewCode: () => this.crewCode,
			setCrewCode: (crewCode) => {
				this.crewCode = crewCode
			},
		})
		this.skills = new CrewSkillsStore({
			getCrewCode: () => this.crewCode,
			setCrewCode: () => undefined,
		})
		this.playbook = new CrewPlaybookStore({
			getCrewCode: () => this.crewCode,
			setCrewCode: () => undefined,
		})
		this.conversation = new CrewConversationStore()

		makeAutoObservable(
			this,
			{
				layout: false,
				identity: false,
				skills: false,
				playbook: false,
				conversation: false,
			},
			{ autoBind: true },
		)
	}

	private hydrateAgentDetail(agentDetail: AgentDetailResponse) {
		this.identity.hydrate({
			name_i18n: agentDetail.name_i18n,
			role_i18n: agentDetail.role_i18n,
			description_i18n: agentDetail.description_i18n,
			icon: agentDetail.icon,
			prompt: agentDetail.prompt,
		})
		this.skills.hydrate(agentDetail.skills.map((skill) => mapAgentSkillItem(skill)))
	}

	async initFromCrewCode(crewCode: string): Promise<void> {
		if (this.initLoading) return

		this.initLoading = true
		this.initError = null
		this.crewCode = crewCode

		try {
			const bootstrap = await loadCrewEditBootstrap(crewCode)

			runInAction(() => {
				this.hydrateAgentDetail(bootstrap.agentDetail)
				this.conversation.reset()
				this.conversation.hydrate({
					project: bootstrap.project,
					topics: bootstrap.topics,
					selectedTopicId: bootstrap.project?.current_topic_id,
				})
			})

			await this.playbook.fetchScenes(crewCode)
		} catch (error) {
			const { code, message } = resolveCrewEditError({
				error,
				fallbackKey: CREW_EDIT_ERROR.loadAgentFailed,
			})

			runInAction(() => {
				this.initError = { code, message }
			})
		} finally {
			runInAction(() => {
				this.initLoading = false
			})
		}
	}

	async refreshAgentDetail(): Promise<void> {
		if (!this.crewCode) return

		const agentDetail = await crewService.getAgentDetailRaw(this.crewCode)

		runInAction(() => {
			this.hydrateAgentDetail(agentDetail)
		})
	}

	setTopicName(name: string) {
		this.topicName = name
	}

	reset() {
		this.topicName = ""
		this.crewCode = null
		this.initLoading = false
		this.initError = null
		this.layout.reset()
		this.identity.reset()
		this.skills.reset()
		this.playbook.reset()
		this.conversation.reset()
	}

	dispose() {
		this.identity.dispose()
		this.reset()
	}
}

export { CREW_EDIT_STEP }
export type { CrewEditAsyncError }
