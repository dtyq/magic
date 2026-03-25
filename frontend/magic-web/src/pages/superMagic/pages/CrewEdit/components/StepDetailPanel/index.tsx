import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { CREW_EDIT_STEP, isCrewStepEnabled, type StepDetailKey } from "../../store"
import { useCrewEditStore } from "../../context"
import IdentityPanel from "./IdentityPanel"
import { CREW_PANEL_IDS } from "./IdentityPanel/constants"
import PublishingPanel from "./PublishingPanel"
import SkillsPanel from "./SkillsPanel"
import BuiltinSkillsPanel from "../ConfigStepsPanel/BuiltinSkillsPanel"
import identityPanelBg from "./IdentityPanel/identity-panel-bg.svg"
import { SceneEditPanel } from "./PlaybookPanel/components/SceneEditPanel"

function PlaceholderPanel({ stepKey }: { stepKey: StepDetailKey }) {
	return (
		<div className="flex h-full items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
			{stepKey}
		</div>
	)
}

function IdentityDetail() {
	const { t } = useTranslation("crew/create")
	const { conversation } = useCrewEditStore()

	return (
		<div className="relative flex h-full w-full min-w-0 flex-col items-center overflow-hidden rounded-lg border border-border bg-background">
			<img
				src={identityPanelBg}
				alt=""
				className="pointer-events-none absolute inset-0 size-full object-cover object-center opacity-60"
				aria-hidden
			/>

			<IdentityPanel />

			{conversation.isConversationLocked ? null : (
				<div className="absolute bottom-6 right-5 z-10 flex flex-col items-end gap-1 text-sm text-foreground">
					<p>{t("topic.helpText")}</p>
					<p>{t("topic.helpAction")}</p>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="80"
						height="35"
						viewBox="0 0 80 35"
						fill="none"
						className="text-sidebar-foreground"
					>
						<path
							d="M-7.21149e-05 7.63431e-06C1.98946 8.11435 19.0232 22.0517 32.3081 26.7651C46.6552 31.8917 55.5183 32.1326 74.6625 27.7837C74.179 28.8876 73.6879 29.748 73.3832 30.5886C72.9954 31.5321 72.5949 32.5332 72.4387 33.5272C72.3757 33.8158 72.7834 34.449 73.1181 34.5825C73.4529 34.7161 74.12 34.4383 74.2988 34.175C75.9455 31.6316 77.4765 29.063 79.0779 26.4492C79.569 25.5888 79.3728 24.8203 78.4516 24.3169C74.89 22.5721 71.3411 20.7696 67.7091 19.0699C66.8785 18.7072 65.7861 18.7107 64.6282 18.458C65.0128 21.1423 67.16 21.3085 68.5266 22.2719C69.9386 23.3058 71.5293 24.0762 73.4044 25.2111C67.8938 27.3951 62.5898 28.3542 57.1602 28.4997C37.254 29.1144 20.7426 21.3989 6.99885 7.39334C5.21703 5.55312 3.65928 3.51991 1.94794 1.6346C1.37409 1.207 0.858139 0.792033 -7.21149e-05 7.63431e-06Z"
							fill="currentColor"
						/>
					</svg>
				</div>
			)}

			<div id={CREW_PANEL_IDS.promptPanelContainer} />
		</div>
	)
}

function StepDetailPanel() {
	const {
		layout: { activeDetailKey, activePlaybookId, closePlaybookEditor },
	} = useCrewEditStore()

	if (activeDetailKey && !isCrewStepEnabled(activeDetailKey)) return null

	switch (activeDetailKey) {
		case CREW_EDIT_STEP.Identity:
			return <IdentityDetail />
		case CREW_EDIT_STEP.Playbook:
			if (!activePlaybookId) return null
			return (
				<SceneEditPanel
					key={activePlaybookId}
					playbookId={activePlaybookId}
					onBack={closePlaybookEditor}
					onClose={closePlaybookEditor}
				/>
			)
		case CREW_EDIT_STEP.Skills:
			return <SkillsPanel />
		case CREW_EDIT_STEP.BuiltinSkills:
			return <BuiltinSkillsPanel />
		case CREW_EDIT_STEP.KnowledgeBase:
			return null
		case CREW_EDIT_STEP.RunAndDebug:
			return <PlaceholderPanel stepKey={activeDetailKey} />
		case CREW_EDIT_STEP.Publishing:
			return <PublishingPanel />
		default:
			return null
	}
}

export default observer(StepDetailPanel)
