import { memo, useCallback } from "react"
import { X, CirclePlus, ChevronDown, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Separator } from "@/opensource/components/shadcn-ui/separator"
import { ScrollArea } from "@/opensource/components/shadcn-ui/scroll-area"
import { SmoothTabs } from "@/opensource/components/shadcn-ui/smooth-tabs"
import { useCrewEditStore } from "../../../context"
import { CREW_EDIT_STEP, CREW_SKILLS_TAB } from "../../../store"
import SkillAddDropdown from "../../SkillAddDropdown"
import { useSkillsPanel } from "./useSkillsPanel"
import type { SkillPanelItem } from "./useSkillsPanel"
import SkillDefaultIcon from "../../../../MySkillsPage/components/SkillDefaultIcon"

interface SkillListItemProps {
	skill: SkillPanelItem
	isBusy: boolean
	onInstall: (skillCode: string) => void
	onUninstall: (skillCode: string) => void
}

function SkillListItem({ skill, isBusy, onInstall, onUninstall }: SkillListItemProps) {
	const { t } = useTranslation("crew/create")

	return (
		<div className="flex items-start gap-2.5 px-2.5 py-3" data-testid="skills-panel-item">
			{/* Thumbnail */}
			<div className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
				{skill.logo ? (
					<img src={skill.logo} alt={skill.name} className="size-full object-cover" />
				) : (
					<SkillDefaultIcon size={40} />
				)}
			</div>

			{/* Info */}
			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<div className="flex items-center gap-1.5">
					<span className="truncate text-sm font-medium text-foreground">
						{skill.name}
					</span>
				</div>
				<p className="line-clamp-3 text-xs leading-normal text-muted-foreground">
					{skill.description}
				</p>
			</div>

			{/* Action button */}
			<div className="shrink-0">
				{skill.status === "not-installed" && (
					<Button
						variant="secondary"
						size="sm"
						className="h-9 min-w-[80px]"
						onClick={() => onInstall(skill.skillCode)}
						disabled={isBusy}
						data-testid="skills-panel-install-btn"
					>
						{isBusy ? <Loader2 className="size-4 animate-spin" /> : t("skills.install")}
					</Button>
				)}
				{skill.status === "installed" && (
					<Button
						variant="ghost"
						size="sm"
						className="h-9 min-w-[80px] bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
						onClick={() => onUninstall(skill.skillCode)}
						disabled={isBusy}
						data-testid="skills-panel-uninstall-btn"
					>
						{isBusy ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							t("skills.uninstall")
						)}
					</Button>
				)}
			</div>
		</div>
	)
}

const SkillListItemMemo = memo(SkillListItem)

function SkillsPanelInner() {
	const { t, i18n } = useTranslation("crew/create")
	const store = useCrewEditStore()
	const { layout, skills } = store

	/**
	 * Build a fresh Set on every render so MobX-triggered re-renders (observer)
	 * always produce a new reference, allowing the hook's useMemo to recompute
	 * skill statuses correctly after install / uninstall.
	 */
	const agentSkillCodes = new Set(skills.skills.map((skill) => skill.skill_code))

	const {
		activeTab,
		setActiveTab,
		filteredItems,
		loading,
		busySkills,
		handleInstall,
		handleUninstall,
		handleImportSuccess,
	} = useSkillsPanel({
		activeTab: layout.activeSkillsTab,
		onTabChange: layout.setActiveSkillsTab,
		agentSkillCodes,
		onAddSkill: skills.addSkill,
		onRemoveSkill: skills.removeSkill,
		onAddSkillToAgent: skills.addSkillToAgent,
		onRemoveSkillFromAgent: skills.removeSkillFromAgent,
		language: i18n.language,
	})

	const handleAddFromLibrary = useCallback(() => {
		layout.openSkillsPanel(CREW_SKILLS_TAB.Library)
	}, [layout])

	return (
		<div
			className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background"
			data-testid="skills-panel"
		>
			{/* Header */}
			<div className="flex shrink-0 flex-col gap-3 px-3.5 pt-3.5">
				{/* Title + close */}
				<div className="flex items-center gap-2">
					<h2 className="flex-1 truncate text-2xl font-medium leading-8 text-foreground">
						{t("skills.title")}
					</h2>
					<Button
						variant="ghost"
						size="icon"
						className="size-9 shrink-0"
						onClick={() => layout.setActiveStep(CREW_EDIT_STEP.Identity)}
						data-testid="skills-panel-close"
					>
						<X className="size-5" />
					</Button>
				</div>

				<Separator />

				{/* Tabs + Create button */}
				<div className="flex items-center justify-between gap-3">
					<SmoothTabs
						tabs={[
							{ value: CREW_SKILLS_TAB.Library, label: t("skills.library") },
							{ value: CREW_SKILLS_TAB.MySkills, label: t("skills.mySkills") },
						]}
						value={activeTab}
						onChange={setActiveTab}
						variant="background"
						className="h-9 flex-1 bg-muted p-[3px]"
						buttonClassName="rounded-md text-sm py-0 h-[30px]"
						indicatorClassName="h-[30px] inset-y-[3px]"
					/>

					<SkillAddDropdown
						onAddFromLibrary={handleAddFromLibrary}
						onImportSuccess={handleImportSuccess}
					>
						<Button
							size="sm"
							className="h-9 shrink-0 gap-1.5"
							data-testid="skills-panel-create-btn"
						>
							<CirclePlus className="size-4" />
							{t("skills.create")}
							<ChevronDown className="size-4" />
						</Button>
					</SkillAddDropdown>
				</div>
			</div>

			{/* Search bar */}
			{activeTab === "library" &&
				// <div className="shrink-0 px-3.5 pt-3">
				// 	<SearchBar
				// 		value={searchQuery}
				// 		onChange={setSearchQuery}
				// 		onSearch={handleSearch}
				// 		placeholder={t("skills.aiSearchPlaceholder")}
				// 		data-testid="skills-panel-search-bar"
				// 	/>
				// </div>
				// )
				null}

			{/* Skills list */}
			<ScrollArea className="min-h-0 flex-1 px-1 pt-2">
				{loading ? (
					<div className="flex items-center justify-center py-12">
						<Loader2 className="size-6 animate-spin text-muted-foreground" />
					</div>
				) : (
					<div className="flex flex-col px-2.5">
						{filteredItems.map((skill, index) => (
							<div key={skill.id}>
								{index > 0 && <Separator />}
								<SkillListItemMemo
									skill={skill}
									isBusy={busySkills.has(skill.skillCode)}
									onInstall={handleInstall}
									onUninstall={handleUninstall}
								/>
							</div>
						))}
						{!loading && filteredItems.length === 0 && (
							<p className="py-12 text-center text-sm text-muted-foreground">
								{t("skills.emptyTitle")}
							</p>
						)}
					</div>
				)}
			</ScrollArea>
		</div>
	)
}

export default observer(SkillsPanelInner)
