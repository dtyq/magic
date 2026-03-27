import { makeAutoObservable, runInAction } from "mobx"
import type { AgentDetailResponse } from "@/apis/modules/crew"
import { createMentionPanelStore } from "@/components/business/MentionPanel/store"
import { ProjectFilesStore } from "@/stores/projectFiles"
import { crewService } from "@/services/crew/CrewService"
import { CREW_EDIT_ERROR } from "../constants/errors"
import { CrewConversationStore } from "./conversation-store"
import { CrewIdentityStore } from "./identity-store"
import { CrewLayoutStore } from "./layout-store"
import { CrewPlaybookStore } from "./playbook-store"
import { CrewSkillsStore } from "./skills-store"
import { loadCrewEditBootstrap } from "./services/load-crew-edit-bootstrap"
import { hasCrewUnpublishedChanges } from "../utils/publish-status"
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
	latestPublishedAt: AgentDetailResponse["latest_published_at"] = null
	lastUpdatedAt: AgentDetailResponse["updated_at"] | null = null

	readonly layout: CrewLayoutStore
	readonly identity: CrewIdentityStore
	readonly skills: CrewSkillsStore
	readonly playbook: CrewPlaybookStore
	readonly conversation: CrewConversationStore
	readonly projectFilesStore: ProjectFilesStore
	readonly mentionPanelStore: ReturnType<typeof createMentionPanelStore>

	constructor() {
		this.layout = new CrewLayoutStore()
		this.identity = new CrewIdentityStore({
			getCrewCode: () => this.crewCode,
			setCrewCode: (crewCode) => {
				this.crewCode = crewCode
			},
			markCrewUpdated: this.markCrewUpdated,
		})
		this.skills = new CrewSkillsStore({
			getCrewCode: () => this.crewCode,
			setCrewCode: () => undefined,
			markCrewUpdated: this.markCrewUpdated,
		})
		this.playbook = new CrewPlaybookStore({
			getCrewCode: () => this.crewCode,
			setCrewCode: () => undefined,
			markCrewUpdated: this.markCrewUpdated,
		})
		this.conversation = new CrewConversationStore()
		this.projectFilesStore = new ProjectFilesStore()
		this.mentionPanelStore = createMentionPanelStore(this.projectFilesStore)

		makeAutoObservable(
			this,
			{
				layout: false,
				identity: false,
				skills: false,
				playbook: false,
				conversation: false,
				projectFilesStore: false,
				mentionPanelStore: false,
			},
			{ autoBind: true },
		)
	}

	private hydrateAgentDetail(agentDetail: AgentDetailResponse) {
		this.latestPublishedAt = agentDetail.latest_published_at
		this.lastUpdatedAt = agentDetail.updated_at
		this.identity.hydrate({
			name_i18n: agentDetail.name_i18n,
			role_i18n: agentDetail.role_i18n,
			description_i18n: agentDetail.description_i18n,
			icon: agentDetail.icon,
			prompt: agentDetail.prompt,
		})
		this.skills.hydrate(agentDetail.skills.map((skill) => mapAgentSkillItem(skill)))
	}

	get hasUnpublishedChanges() {
		return hasCrewUnpublishedChanges({
			latestPublishedAt: this.latestPublishedAt,
			updatedAt: this.lastUpdatedAt,
		})
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

	markCrewUpdated(updatedAt: string = new Date().toISOString()) {
		this.lastUpdatedAt = updatedAt
	}

	markCrewPublished(publishedAt: string = new Date().toISOString()) {
		this.latestPublishedAt = publishedAt
		this.lastUpdatedAt = publishedAt
	}

	setTopicName(name: string) {
		this.topicName = name
	}

	reset() {
		this.topicName = ""
		this.crewCode = null
		this.initLoading = false
		this.initError = null
		this.latestPublishedAt = null
		this.lastUpdatedAt = null
		this.layout.reset()
		this.identity.reset()
		this.skills.reset()
		this.playbook.reset()
		this.conversation.reset()
		this.projectFilesStore.setSelectedProject(null)
	}

	dispose() {
		this.identity.dispose()
		this.reset()
	}
}

export { CREW_EDIT_STEP }
export type { CrewEditAsyncError }
