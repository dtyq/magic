import { makeAutoObservable } from "mobx"
import {
	CREW_EDIT_STEP,
	CREW_SKILLS_TAB,
	type CrewEditStep,
	type CrewSkillsTab,
	type StepDetailKey,
} from "./shared"

interface PanelSnapshot {
	activeStep: CrewEditStep | null
	activeDetailKey: StepDetailKey
	activeSkillsTab: CrewSkillsTab
	isConversationPanelCollapsed: boolean
}

export class CrewLayoutStore {
	activeStep: CrewEditStep | null = CREW_EDIT_STEP.Identity
	activeDetailKey: StepDetailKey = null
	activeSkillsTab: CrewSkillsTab = CREW_SKILLS_TAB.MySkills
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
		return this.activeDetailKey === CREW_EDIT_STEP.Playbook
	}

	toggleStep(step: CrewEditStep) {
		if (this.activeStep === step && this.activeDetailKey === step) {
			this.activeStep = null
			this.activeDetailKey = null
			return
		}

		this.activeStep = step
		this.activeDetailKey = step
		this.ensureExpandedWhenDetailVisible(true)
	}

	setActiveStep(step: CrewEditStep | null) {
		this.activeStep = step
		this.activeDetailKey = step

		if (step !== null) this.ensureExpandedWhenDetailVisible(true)
	}

	openSkillsPanel(tab: CrewSkillsTab = CREW_SKILLS_TAB.MySkills) {
		this.activeSkillsTab = tab
		this.activeStep = CREW_EDIT_STEP.Skills
		this.activeDetailKey = CREW_EDIT_STEP.Skills
		this.ensureExpandedWhenDetailVisible(true)
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

	openPlaybook() {
		this.capturePanelSnapshot()
		this.activeStep = null
		this.activeDetailKey = CREW_EDIT_STEP.Playbook
	}

	closePlaybook() {
		this.restorePanelSnapshot({ fallbackStep: null, fallbackDetailKey: null })
	}

	openBuiltinSkills() {
		this.capturePanelSnapshot()
		this.activeStep = CREW_EDIT_STEP.Skills
		this.activeDetailKey = CREW_EDIT_STEP.BuiltinSkills
		this.ensureExpandedWhenDetailVisible(true)
	}

	closeBuiltinSkills() {
		this.restorePanelSnapshot({
			fallbackStep: CREW_EDIT_STEP.Skills,
			fallbackDetailKey: CREW_EDIT_STEP.Skills,
		})
	}

	reset() {
		this.activeStep = null
		this.activeDetailKey = null
		this.activeSkillsTab = CREW_SKILLS_TAB.MySkills
		this.isConversationPanelCollapsed = false
		this._panelSnapshot = null
	}

	private capturePanelSnapshot() {
		this._panelSnapshot = {
			activeStep: this.activeStep,
			activeDetailKey: this.activeDetailKey,
			activeSkillsTab: this.activeSkillsTab,
			isConversationPanelCollapsed: this.isConversationPanelCollapsed,
		}
	}

	private restorePanelSnapshot({
		fallbackStep,
		fallbackDetailKey,
	}: {
		fallbackStep: CrewEditStep | null
		fallbackDetailKey: StepDetailKey
	}) {
		if (this._panelSnapshot) {
			this.activeStep = this._panelSnapshot.activeStep
			this.activeDetailKey = this._panelSnapshot.activeDetailKey
			this.activeSkillsTab = this._panelSnapshot.activeSkillsTab
			this.isConversationPanelCollapsed = this._panelSnapshot.isConversationPanelCollapsed
			this._panelSnapshot = null
			return
		}

		this.activeStep = fallbackStep
		this.activeDetailKey = fallbackDetailKey
	}
}
