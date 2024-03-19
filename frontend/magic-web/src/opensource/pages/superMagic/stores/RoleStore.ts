import { makeAutoObservable, computed, reaction } from "mobx"
import { TopicMode } from "../pages/Workspace/types"
import ProjectTopicService from "@/opensource/services/superMagic/ProjectTopicService"
import superMagicModeService from "@/opensource/services/superMagic/SuperMagicModeService"
import { interfaceStore } from "@/opensource/stores/interface"
import { userStore } from "@/opensource/models/user"

/**
 * Role Store
 * Manages the role (topic mode) state for super magic workspace
 */
class RoleStore {
	// Global topic mode state
	currentRole: TopicMode = TopicMode.General

	constructor() {
		makeAutoObservable(
			this,
			{
				isChatMode: computed,
			},
			{ autoBind: true },
		)

		// Initialize from storage
		this.loadFromStorage()

		// Reload role preference when organization/user context changes
		reaction(
			() => [userStore.user.organizationCode, userStore.user.userInfo?.user_id],
			([organizationCode, userId]) => {
				if (organizationCode && userId) {
					this.loadFromStorage()
				}
			},
		)

		// Auto-select first crew when mode list loads and current role is invalid
		reaction(
			() => superMagicModeService.modeList,
			(modeList) => {
				if (modeList.length > 0 && !superMagicModeService.isModeValid(this.currentRole)) {
					const firstMode = superMagicModeService.firstModeIdentifier
					if (firstMode) this.setCurrentRole(firstMode)
				}
			},
		)

		// @deprecated
		// React to mobile state changes
		// reaction(
		// 	() => interfaceStore.isMobile,
		// 	(isMobile) => {
		// 		if (isMobile && this.currentRole === TopicMode.Chat) {
		// 			this.setCurrentRole(TopicMode.General)
		// 		}
		// 	},
		// )
	}

	/**
	 * Load global topic mode from storage
	 */
	private loadFromStorage() {
		const mode = ProjectTopicService.getGlobalTopicMode()
		if (mode) {
			this.currentRole = mode
		} else {
			this.currentRole = superMagicModeService.firstModeIdentifier || TopicMode.General
		}
	}

	/**
	 * Set global topic mode with validation
	 * @param mode - Topic mode to set
	 */
	setCurrentRole(mode: TopicMode) {
		let validMode = mode

		// Validate mode
		if (!superMagicModeService.isModeValid(mode)) {
			validMode = superMagicModeService.firstModeIdentifier
		}

		// Check mobile compatibility
		if (interfaceStore.isMobile && validMode === TopicMode.Chat) {
			validMode = TopicMode.General
		}

		if (validMode) {
			this.currentRole = validMode
			ProjectTopicService.setGlobalTopicMode(validMode)
		}
	}

	/**
	 * Computed: Check if current mode is chat mode
	 * Chat mode is active when:
	 * - globalTopicMode is Chat
	 * - Not on mobile device
	 */
	get isChatMode(): boolean {
		return this.currentRole === TopicMode.Chat && !interfaceStore.isMobile
	}

	/**
	 * Check if current mode is record summary mode
	 */
	get isRecordSummaryMode(): boolean {
		return this.currentRole === TopicMode.RecordSummary
	}
}

export const roleStore = new RoleStore()
