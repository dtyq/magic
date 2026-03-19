import { type ReactNode, useCallback, useMemo } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import {
	ArrowLeft,
	ChevronRight,
	CirclePlus,
	CirclePlay,
	Settings2,
	SquareLibrary,
	Plus,
	Ellipsis,
	Trash2,
} from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Badge } from "@/components/shadcn-ui/badge"
import { Separator } from "@/components/shadcn-ui/separator"
import MagicDropdown from "@/components/base/MagicDropdown"
import { cn } from "@/lib/tiptap-utils"
import type { AgentSkillItem } from "@/apis/modules/crew"
import type { ImportSkillResponse } from "@/apis/modules/skills"
import { CREW_EDIT_STEP, CREW_SKILLS_TAB, type CrewEditStep } from "../../store"
import { useCrewEditStore } from "../../context"
import { useInstallImportedSkill } from "../../hooks/useInstallImportedSkill"
import { useMemberDisplay } from "../../hooks/useMemberDisplay"
import SkillAddDropdown from "../SkillAddDropdown"
import { useBuiltinSkills } from "./BuiltinSkillsPanel"
import { RoleIcon } from "../common/RoleIcon"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { InlineEditField } from "../StepDetailPanel/IdentityPanel/components"
import SkillDefaultIcon from "../../../MySkillsPage/components/SkillDefaultIcon"

function resolveLocalizedText(
	textObj: Record<string, string> | undefined,
	language: string,
): string {
	if (!textObj) return ""
	if (language.startsWith("zh")) return textObj.zh_CN || textObj.en_US || textObj.default || ""
	return textObj.en_US || textObj.zh_CN || textObj.default || ""
}

interface ConfigStepsPanelProps {
	onBack: () => void
}

const STEP_ORDER: CrewEditStep[] = [
	CREW_EDIT_STEP.Identity,
	CREW_EDIT_STEP.KnowledgeBase,
	CREW_EDIT_STEP.Skills,
	CREW_EDIT_STEP.RunAndDebug,
	CREW_EDIT_STEP.Publishing,
]

const HIDDEN_STEPS = new Set<CrewEditStep>([
	CREW_EDIT_STEP.KnowledgeBase,
	CREW_EDIT_STEP.RunAndDebug,
])

function getVisibleStepNumber(step: CrewEditStep) {
	const visibleSteps = STEP_ORDER.filter((item) => !HIDDEN_STEPS.has(item))
	return visibleSteps.findIndex((item) => item === step) + 1
}

function StepPill({ number }: { number: number }) {
	const { t } = useTranslation("crew/create")
	return (
		<Badge variant="outline" className="h-5 rounded-md px-2 text-xs font-semibold">
			{t("steps.step", { number, defaultValue: `Step ${number}` })}
		</Badge>
	)
}

function StepRowInner({
	step,
	number,
	label,
	status,
	addButton,
	disabledIcon,
}: {
	step: CrewEditStep
	number: number
	label: string
	status?: ReactNode
	addButton?: ReactNode
	disabledIcon?: boolean
}) {
	const store = useCrewEditStore()
	const { layout } = store
	const isActive = layout.activeStep === step

	return (
		<button
			type="button"
			className={cn(
				"flex h-12 w-full shrink-0 items-center gap-1.5 overflow-hidden px-2.5 text-left transition-colors hover:bg-accent/40",
				isActive && "bg-accent/50",
			)}
			onClick={() => layout.toggleStep(step)}
			data-testid={`crew-step-${step}`}
		>
			<StepPill number={number} />
			<p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{label}</p>
			{status}
			{addButton && <div onClick={(event) => event.stopPropagation()}>{addButton}</div>}
			<div
				className={cn(
					"flex h-7 w-7 items-center justify-center",
					disabledIcon && "opacity-50",
				)}
			>
				{disabledIcon ? (
					<CirclePlay className="h-4 w-4" />
				) : (
					<ChevronRight className="h-4 w-4" />
				)}
			</div>
		</button>
	)
}

const StepRow = observer(StepRowInner)

function EmptySection({
	icon,
	title,
	description,
	primaryAction,
	secondaryAction,
}: {
	icon: ReactNode
	title: string
	description: string
	primaryAction: ReactNode
	secondaryAction?: ReactNode
}) {
	return (
		<div className="flex min-h-[224px] flex-1 flex-col items-center justify-center gap-2 overflow-hidden px-6 py-3">
			<div className="text-muted-foreground">{icon}</div>
			<p className="text-center text-sm text-foreground">{title}</p>
			<p className="max-w-[248px] text-center text-xs leading-4 text-muted-foreground">
				{description}
			</p>
			{primaryAction}
			{secondaryAction}
		</div>
	)
}

interface SkillCardProps {
	skill: AgentSkillItem
	language: string
	onRemove: (skillCode: string) => void
}

function SkillCard({ skill, language, onRemove }: SkillCardProps) {
	const { t } = useTranslation("crew/create")
	const name = resolveLocalizedText(skill.name_i18n as Record<string, string>, language)
	const description = resolveLocalizedText(
		skill.description_i18n as Record<string, string>,
		language,
	)

	const menuItems = useMemo(
		() => [
			{
				key: "remove",
				icon: <Trash2 className="size-4 text-destructive" />,
				label: <span className="text-destructive">{t("skills.remove")}</span>,
				onClick: () => onRemove(skill.skill_code),
				"data-testid": "config-skill-card-remove",
			},
		],
		[t, onRemove, skill.skill_code],
	)

	return (
		<div
			className="flex items-center gap-2 overflow-hidden px-2 py-1"
			data-testid="config-skill-card"
		>
			<div className="size-8 shrink-0 overflow-hidden rounded-md bg-muted">
				{skill.logo ? (
					<img src={skill.logo} alt={name} className="size-full object-cover" />
				) : (
					<SkillDefaultIcon size={32} />
				)}
			</div>

			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<p className="truncate text-sm text-foreground">{name}</p>
				<p className="line-clamp-1 text-xs leading-4 text-muted-foreground">
					{description}
				</p>
			</div>

			<MagicDropdown menu={{ items: menuItems }} placement="bottomRight">
				<span>
					<Button
						variant="ghost"
						size="icon"
						className="size-6 shrink-0"
						data-testid="config-skill-card-more"
					>
						<Ellipsis className="size-4" />
					</Button>
				</span>
			</MagicDropdown>
		</div>
	)
}

interface SkillListSectionProps {
	skills: AgentSkillItem[]
	language: string
	onRemove: (skillCode: string) => void
}

function SkillListSection({ skills, language, onRemove }: SkillListSectionProps) {
	return (
		<ScrollArea className="min-h-0 flex-1 flex-col py-1" data-testid="config-skills-list">
			{skills.map((skill, index) => (
				<div key={skill.skill_code}>
					{index > 0 && <Separator />}
					<SkillCard skill={skill} language={language} onRemove={onRemove} />
				</div>
			))}
		</ScrollArea>
	)
}

function ConfigStepsPanel({ onBack }: ConfigStepsPanelProps) {
	const store = useCrewEditStore()
	const { identity, skills, layout } = store
	const { t, i18n } = useTranslation("crew/create")
	const { name, role, description, avatarUrl } = useMemberDisplay({
		name_i18n: identity.name_i18n,
		role_i18n: identity.role_i18n,
		description_i18n: identity.description_i18n,
		icon: identity.icon,
		prompt: identity.prompt,
		skills: skills.skills,
	})
	const { skills: builtinSkills } = useBuiltinSkills()
	const installImportedSkill = useInstallImportedSkill()

	const isIdentityConfigured = !!(name || role || description)
	const customSkillCount = skills.skills.length

	const handleRemoveSkill = useCallback(
		async (skillCode: string) => {
			skills.removeSkill(skillCode)
			await skills.removeSkillFromAgent(skillCode)
		},
		[skills],
	)

	const handleImportSuccess = useCallback(
		async (result: ImportSkillResponse) => {
			await installImportedSkill(result, { openSkillsStep: true })
		},
		[installImportedSkill],
	)

	return (
		<div className="flex h-full flex-col gap-1" data-testid="crew-config-steps-panel">
			<div className="flex shrink-0 items-center gap-1">
				<Button
					variant="outline"
					size="icon"
					className="h-9 w-9 rounded-lg bg-background shadow-xs"
					onClick={onBack}
					data-testid="crew-edit-back-button"
				>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<div className="flex h-9 flex-1 items-center gap-1.5 overflow-hidden rounded-lg border border-border bg-background px-2 py-1.5 shadow-xs">
					<div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-sm">
						{avatarUrl ? (
							<img src={avatarUrl} alt="" className="h-full w-full object-cover" />
						) : (
							<RoleIcon className="h-3.5 w-3.5" />
						)}
					</div>
					<div className="min-w-0 flex-1">
						<InlineEditField
							value={name ?? ""}
							placeholder={t("untitledCrew")}
							textClassName="text-sm font-medium text-sidebar-foreground"
							onSave={identity.setName}
							align="left"
							testId="crew-name-input"
							maxLength={20}
						/>
					</div>
				</div>
			</div>

			<div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background">
				<StepRow
					step={CREW_EDIT_STEP.Identity}
					number={getVisibleStepNumber(CREW_EDIT_STEP.Identity)}
					label={t("steps.identity")}
					status={
						<Badge
							variant={isIdentityConfigured ? "default" : "secondary"}
							className="h-5 rounded-md px-2 text-xs font-semibold"
						>
							{isIdentityConfigured
								? t("status.configured")
								: t("status.notConfigured")}
						</Badge>
					}
				/>

				<Separator />

				{/* <StepRow
					step={CREW_EDIT_STEP.KnowledgeBase}
					number={2}
					label={t("steps.knowledgeBase")}
					addable
				/>

				<EmptySection
					icon={<BookOpenText className="h-6 w-6" />}
					title={t("knowledgeBase.emptyTitle")}
					description={t("knowledgeBase.emptyDescription")}
					primaryAction={
						<Button
							className="shadow-xs h-9 w-full"
							data-testid="crew-edit-knowledge-base-button"
						>
							<CirclePlus className="h-4 w-4" />
							{t("knowledgeBase.create")}
						</Button>
					}
				/>

				<Separator /> */}

				<StepRow
					step={CREW_EDIT_STEP.Skills}
					number={getVisibleStepNumber(CREW_EDIT_STEP.Skills)}
					label={t("steps.skills")}
					addButton={
						<SkillAddDropdown
							onAddFromLibrary={() => layout.openSkillsPanel(CREW_SKILLS_TAB.Library)}
							onImportSuccess={handleImportSuccess}
						>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 gap-1 rounded-md px-1.5 text-xs font-medium"
								data-testid="crew-step-skills-add"
							>
								<Plus className="h-3.5 w-3.5" />
							</Button>
						</SkillAddDropdown>
					}
					status={
						<Badge
							variant="secondary"
							className="h-5 cursor-pointer rounded-md px-2 text-xs font-semibold hover:bg-secondary/80"
							onClick={(e) => {
								e.stopPropagation()
								layout.openBuiltinSkills()
							}}
							data-testid="crew-builtin-skills-badge"
						>
							{t("status.builtIn", { count: builtinSkills.length })}
							<ChevronRight className="ml-1 h-3.5 w-3.5" />
						</Badge>
					}
				/>

				{customSkillCount > 0 ? (
					<SkillListSection
						skills={skills.skills}
						language={i18n.language}
						onRemove={handleRemoveSkill}
					/>
				) : (
					<EmptySection
						icon={<SquareLibrary className="h-6 w-6" />}
						title={t("skills.emptyTitle")}
						description={t("skills.emptyDescription")}
						primaryAction={
							<SkillAddDropdown
								onAddFromLibrary={() =>
									layout.openSkillsPanel(CREW_SKILLS_TAB.Library)
								}
								onImportSuccess={handleImportSuccess}
								placement="bottom"
								className="block w-full"
							>
								<Button
									className="h-9 w-full shadow-xs"
									data-testid="crew-edit-skill-button"
								>
									<CirclePlus className="h-4 w-4" />
									{t("skills.create")}
								</Button>
							</SkillAddDropdown>
						}
						secondaryAction={
							<Button
								variant="outline"
								className="h-9 w-full shadow-xs"
								onClick={() => layout.openSkillsPanel(CREW_SKILLS_TAB.Library)}
								data-testid="crew-skills-library-button"
							>
								<SquareLibrary className="h-4 w-4" />
								{t("skills.library")}
							</Button>
						}
					/>
				)}

				{/* <Separator />

				<StepRow
					step={CREW_EDIT_STEP.RunAndDebug}
					number={4}
					label={t("steps.runAndDebug")}
					disabledIcon
				/> */}

				{/* <Separator />

				<StepRow
					step={CREW_EDIT_STEP.Publishing}
					number={getVisibleStepNumber(CREW_EDIT_STEP.Publishing)}
					label={t("steps.publishing")}
					status={
						<Badge
							variant="secondary"
							className="h-5 rounded-md px-2 text-xs font-semibold"
						>
							{t("status.unpublished")}
						</Badge>
					}
				/> */}

				<div className="p-2">
					<Button
						variant="outline"
						className="h-9 w-full text-sm font-medium shadow-xs"
						onClick={() => layout.openPlaybook()}
						data-testid="crew-scenario-presets-button"
					>
						<Settings2 className="h-4 w-4" />
						{t("scenarioPresets")}
					</Button>
				</div>
			</div>
		</div>
	)
}

export default observer(ConfigStepsPanel)
