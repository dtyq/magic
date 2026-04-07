import { useCallback, useMemo, useRef, useState } from "react"
import type { JSONContent } from "@tiptap/react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import type { CrewI18nText } from "@/apis/modules/crew"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { CREW_SKILLS_TAB, type CrewSkillsTab } from "@/pages/superMagic/pages/CrewEdit/store"
import { SkillsPanelShell } from "@/pages/superMagic/pages/CrewEdit/components/StepDetailPanel/SkillsPanel/SkillsPanelShell"
import {
	useSkillsPanel,
	type SkillPanelItem,
} from "@/pages/superMagic/pages/CrewEdit/components/StepDetailPanel/SkillsPanel/useSkillsPanel"

function noopAddSkill(skill: {
	skill_code: string
	name_i18n: CrewI18nText
	description_i18n: CrewI18nText
	logo: string | null
}) {
	void skill
}

function noopRemoveSkill(skillCode: string) {
	void skillCode
}

async function noopAsync(skillCode: string) {
	void skillCode
}

export interface ClawSkillsPanelProps {
	onClose: () => void
	/** Hide shell top border when shown inside mobile drawer (avoids double edge). */
	hideShellTopBorder?: boolean
	/** Optional full install override (see useSkillsPanel.overrideInstall). */
	overrideInstall?: (skillCode: string) => Promise<void>
	/** Optional full uninstall override (see useSkillsPanel.overrideUninstall). */
	overrideUninstall?: (skillCode: string) => Promise<void>
	/** Show skill create button (default true). */
	showSkillCreateButton?: boolean
}

export function ClawSkillsPanel({
	onClose,
	hideShellTopBorder = false,
	overrideInstall: overrideInstallProp,
	overrideUninstall: overrideUninstallProp,
	showSkillCreateButton = true,
}: ClawSkillsPanelProps) {
	const { i18n } = useTranslation("crew/create")
	const { t } = useTranslation("sidebar")
	// Playground panel does not sync skills to the agent; list is browse + prompt.
	const agentSkillCodes = useMemo(() => new Set<string>(), [])
	const filteredItemsRef = useRef<SkillPanelItem[]>([])

	const [activeTab, setActiveTab] = useState<CrewSkillsTab>(CREW_SKILLS_TAB.Library)

	const handlePlaygroundInstall = useMemoizedFn(async (skillCode: string) => {
		if (overrideInstallProp) {
			await overrideInstallProp(skillCode)
			return
		}
		const skill = filteredItemsRef.current.find((item) => item.skillCode === skillCode)
		const prefix = t("superLobster.workspace.skillInstallPromptPrefix")
		const content = buildSkillInstallPromptDoc({ prefix, skillCode, skill })
		pubsub.publish(PubSubEvents.Add_Content_To_Chat, { content })
		pubsub.publish(PubSubEvents.Message_Scroll_To_Bottom, { time: 1000 })
		queueMicrotask(() => {
			pubsub.publish(PubSubEvents.Send_Message_by_Content, { jsonContent: content })
		})
	})

	const handlePlaygroundUninstall = useMemoizedFn(async (_skillCode: string) => {
		if (overrideUninstallProp) await overrideUninstallProp(_skillCode)
	})

	const {
		activeTab: hookActiveTab,
		setActiveTab: setHookActiveTab,
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
		activeTab,
		onTabChange: setActiveTab,
		agentSkillCodes,
		onAddSkill: noopAddSkill,
		onRemoveSkill: noopRemoveSkill,
		onAddSkillToAgent: noopAsync,
		onRemoveSkillFromAgent: noopAsync,
		language: i18n.language,
		overrideInstall: handlePlaygroundInstall,
		overrideUninstall: handlePlaygroundUninstall,
	})

	filteredItemsRef.current = filteredItems

	const handleAddFromLibrary = useCallback(() => {
		setActiveTab(CREW_SKILLS_TAB.Library)
	}, [])

	return (
		<SkillsPanelShell
			onClose={onClose}
			activeTab={hookActiveTab}
			setActiveTab={setHookActiveTab}
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
			promptPublishAfterImport
			showCreateButton={showSkillCreateButton}
			testIdPrefix="claw-skills-panel"
			hideTopBorder={hideShellTopBorder}
		/>
	)
}

interface BuildSkillInstallPromptDocParams {
	prefix: string
	skillCode: string
	skill: SkillPanelItem | undefined
}

function buildSkillInstallPromptDoc({
	prefix,
	skillCode,
	skill,
}: BuildSkillInstallPromptDocParams): JSONContent {
	if (!skill) {
		return {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: `${prefix}@${skillCode}` }],
				},
			],
		}
	}

	const skillId = skill.userSkillCode ?? skill.skillCode
	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: [
					{ type: "text", text: prefix },
					{
						type: "mention",
						attrs: {
							type: MentionItemType.SKILL,
							data: {
								id: skillId,
								name: skill.name,
								icon: skill.logo,
								description: skill.description,
							},
						},
					},
				],
			},
		],
	}
}
