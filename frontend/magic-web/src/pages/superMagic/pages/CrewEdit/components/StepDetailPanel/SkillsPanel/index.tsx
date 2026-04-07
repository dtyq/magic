import { useCallback } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useCrewEditStore } from "../../../context"
import { CREW_SKILLS_TAB } from "../../../store"
import { useSkillsPanel } from "./useSkillsPanel"
import { SkillsPanelShell } from "./SkillsPanelShell"

function SkillsPanelInner() {
	const { i18n } = useTranslation("crew/create")
	const store = useCrewEditStore()
	const { layout, skills } = store
	const { closeSkillsPanel } = layout

	const agentSkillCodes = new Set(skills.skills.map((skill) => skill.skill_code))

	const {
		activeTab,
		setActiveTab,
		searchQuery,
		setSearchQuery,
		filteredItems,
		loading,
		loadingMore,
		hasMore,
		busySkills,
		handleInstall,
		handleUninstall,
		handleLoadMore,
		handleImportSuccess,
		handleSearch,
		onSearchCompositionStart,
		onSearchCompositionEnd,
	} = useSkillsPanel({
		activeTab: layout.activeSkillsTab,
		onTabChange: layout.setActiveSkillsTab,
		agentSkillCodes,
		onAddSkill: skills.addSkill,
		onRemoveSkill: skills.removeSkill,
		onAddSkillToAgent: skills.addSkillToAgent,
		onRemoveSkillFromAgent: skills.removeSkillFromAgent,
		onRefreshSkills: skills.refreshSkills,
		language: i18n.language,
	})

	const handleAddFromLibrary = useCallback(() => {
		layout.openSkillsPanel(CREW_SKILLS_TAB.Library)
	}, [layout])

	return (
		<SkillsPanelShell
			onClose={closeSkillsPanel}
			activeTab={activeTab}
			setActiveTab={setActiveTab}
			filteredItems={filteredItems}
			loading={loading}
			loadingMore={loadingMore}
			hasMore={hasMore}
			busySkills={busySkills}
			handleInstall={handleInstall}
			handleUninstall={handleUninstall}
			handleLoadMore={handleLoadMore}
			handleImportSuccess={handleImportSuccess}
			onAddFromLibrary={handleAddFromLibrary}
			searchQuery={searchQuery}
			setSearchQuery={setSearchQuery}
			onSearch={handleSearch}
			onSearchCompositionStart={onSearchCompositionStart}
			onSearchCompositionEnd={onSearchCompositionEnd}
			promptPublishAfterImport={false}
			importSourceType="CREW_IMPORT"
		/>
	)
}

export default observer(SkillsPanelInner)
