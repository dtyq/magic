import { makeAutoObservable } from "mobx"
import {
	CREW_EDIT_STEP,
	CREW_SIDEBAR_TAB,
	CREW_SKILLS_TAB,
	isCrewSidebarTabEnabled,
	isCrewStepEnabled,
	type CrewEditStep,
	type CrewSidebarTab,
	type CrewSkillsTab,
	type StepDetailKey,
} from "./shared"

interface PanelSnapshot {
	activeDetailKey: StepDetailKey
	activeAccordionStep: CrewEditStep | null
	activeSkillsTab: CrewSkillsTab
	activePlaybookId: string | null
	isConversationPanelCollapsed: boolean
}

export class CrewLayoutStore {
	activeDetailKey: StepDetailKey = null
	activeAccordionStep: CrewEditStep | null = null
	activeSidebarTab: CrewSidebarTab = CREW_SIDEBAR_TAB.Advanced
	activeSkillsTab: CrewSkillsTab = CREW_SKILLS_TAB.MySkills
	activePlaybookId: string | null = null
	isConversationPanelCollapsed = false

	private _panelSnapshot: PanelSnapshot | null = null

	constructor() {
		makeAutoObservable<CrewLayoutStore, "_panelSnapshot">(
			this,
			{ _panelSnapshot: false },
			{ autoBind: true },
		)
	}

	get showDetailPanel(): boolean {
		return this.activeDetailKey !== null
	}

	get isMessagePanelHidden(): boolean {
		return this.activeDetailKey === CREW_EDIT_STEP.Publishing
	}

	toggleStep(step: CrewEditStep) {
		if (!isCrewStepEnabled(step)) return
		if (this.activeDetailKey === step) {
			this.activeDetailKey = null
			if (step === CREW_EDIT_STEP.Skills) this.activeAccordionStep = null
			if (step === CREW_EDIT_STEP.Playbook) this.activePlaybookId = null
			return
		}

		this.activeSidebarTab = CREW_SIDEBAR_TAB.Advanced
		this.activeDetailKey = step
		if (step === CREW_EDIT_STEP.Skills || step === CREW_EDIT_STEP.Playbook) {
			this.activeAccordionStep = step
		}
		this.ensureExpandedWhenDetailVisible(true)
	}

	setActiveStep(step: CrewEditStep | null) {
		if (step !== null && !isCrewStepEnabled(step)) return
		if (step !== null) this.activeSidebarTab = CREW_SIDEBAR_TAB.Advanced
		this.activeDetailKey = step
		if (step === CREW_EDIT_STEP.Skills || step === CREW_EDIT_STEP.Playbook) {
			this.activeAccordionStep = step
		}
		if (step !== CREW_EDIT_STEP.Playbook) this.activePlaybookId = null

		if (step !== null) this.ensureExpandedWhenDetailVisible(true)
	}

	setActiveSidebarTab(tab: CrewSidebarTab) {
		if (!isCrewSidebarTabEnabled(tab)) return
		this.activeSidebarTab = tab
	}

	openSkillsPanel(tab: CrewSkillsTab = CREW_SKILLS_TAB.MySkills) {
		if (!isCrewStepEnabled(CREW_EDIT_STEP.Skills)) return
		this.activeSidebarTab = CREW_SIDEBAR_TAB.Advanced
		this.activeAccordionStep = CREW_EDIT_STEP.Skills
		this.activeSkillsTab = tab
		this.activeDetailKey = CREW_EDIT_STEP.Skills
		this.activePlaybookId = null
		this.ensureExpandedWhenDetailVisible(true)
	}

	expandSkillsSection() {
		if (!isCrewStepEnabled(CREW_EDIT_STEP.Skills)) return
		this.activeSidebarTab = CREW_SIDEBAR_TAB.Advanced
		this.activeAccordionStep = CREW_EDIT_STEP.Skills
	}

	closeSkillsPanel() {
		this.activeAccordionStep = null
		if (
			this.activeDetailKey === CREW_EDIT_STEP.Skills ||
			this.activeDetailKey === CREW_EDIT_STEP.BuiltinSkills
		) {
			this.activeDetailKey = null
		}
	}

	collapseSkillsSection() {
		if (this.activeAccordionStep !== CREW_EDIT_STEP.Skills) return
		this.activeAccordionStep = null
	}

	setActiveSkillsTab(tab: CrewSkillsTab) {
		this.activeSkillsTab = tab
	}

	toggleConversationPanel() {
		if (this.isConversationPanelCollapsed) {
			this.expandConversationPanel()
			return
		}

		this.isConversationPanelCollapsed = true
	}

	expandConversationPanel() {
		this.isConversationPanelCollapsed = false
	}

	ensureExpandedWhenDetailVisible(showDetailPanel: boolean) {
		if (showDetailPanel && this.isConversationPanelCollapsed) this.expandConversationPanel()
	}

	openPlaybook(playbookId?: string | null) {
		if (!isCrewStepEnabled(CREW_EDIT_STEP.Playbook)) return
		this.activeSidebarTab = CREW_SIDEBAR_TAB.Advanced
		this.activeAccordionStep = CREW_EDIT_STEP.Playbook
		this.activePlaybookId = playbookId ?? null
		this.activeDetailKey = playbookId ? CREW_EDIT_STEP.Playbook : null
		if (playbookId) this.ensureExpandedWhenDetailVisible(true)
	}

	expandPlaybookSection() {
		if (!isCrewStepEnabled(CREW_EDIT_STEP.Playbook)) return
		this.activeSidebarTab = CREW_SIDEBAR_TAB.Advanced
		this.activeAccordionStep = CREW_EDIT_STEP.Playbook
	}

	closePlaybook() {
		this.activeAccordionStep = null
		this.activeDetailKey = null
		this.activePlaybookId = null
	}

	collapsePlaybookSection() {
		if (this.activeAccordionStep !== CREW_EDIT_STEP.Playbook) return
		this.activeAccordionStep = null
	}

	closePlaybookEditor() {
		this.activeDetailKey = null
		this.activePlaybookId = null
	}

	openBuiltinSkills() {
		if (!isCrewStepEnabled(CREW_EDIT_STEP.BuiltinSkills)) return
		this.capturePanelSnapshot()
		this.activeSidebarTab = CREW_SIDEBAR_TAB.Advanced
		this.activeAccordionStep = CREW_EDIT_STEP.Skills
		this.activeDetailKey = CREW_EDIT_STEP.BuiltinSkills
		this.activePlaybookId = null
		this.ensureExpandedWhenDetailVisible(true)
	}

	closeBuiltinSkills() {
		this.restorePanelSnapshot({
			fallbackDetailKey: CREW_EDIT_STEP.Skills,
		})
	}

	reset() {
		this.activeDetailKey = null
		this.activeAccordionStep = null
		this.activeSidebarTab = CREW_SIDEBAR_TAB.Advanced
		this.activeSkillsTab = CREW_SKILLS_TAB.MySkills
		this.activePlaybookId = null
		this.isConversationPanelCollapsed = false
		this._panelSnapshot = null
	}

	private capturePanelSnapshot() {
		this._panelSnapshot = {
			activeDetailKey: this.activeDetailKey,
			activeAccordionStep: this.activeAccordionStep,
			activeSkillsTab: this.activeSkillsTab,
			activePlaybookId: this.activePlaybookId,
			isConversationPanelCollapsed: this.isConversationPanelCollapsed,
		}
	}

	private restorePanelSnapshot({ fallbackDetailKey }: { fallbackDetailKey: StepDetailKey }) {
		if (this._panelSnapshot) {
			this.activeDetailKey = this._panelSnapshot.activeDetailKey
			this.activeAccordionStep = this._panelSnapshot.activeAccordionStep
			this.activeSkillsTab = this._panelSnapshot.activeSkillsTab
			this.activePlaybookId = this._panelSnapshot.activePlaybookId
			this.isConversationPanelCollapsed = this._panelSnapshot.isConversationPanelCollapsed
			this._panelSnapshot = null
			return
		}

		this.activeDetailKey = fallbackDetailKey
		this.activeAccordionStep =
			fallbackDetailKey === CREW_EDIT_STEP.Skills ||
			fallbackDetailKey === CREW_EDIT_STEP.Playbook
				? fallbackDetailKey
				: null
		this.activePlaybookId = null
	}
}
