import { useEffect, useMemo, useState } from "react"
import type { PlaybookItem } from "@/apis/modules/crew"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { sceneConfigStore } from "@/pages/superMagic/components/MainInputContainer/stores/SceneConfigStore"
import {
	deriveCurrentSceneConfig,
	type ConfigWithPanels,
} from "@/pages/superMagic/components/MainInputContainer/hooks/currentSceneConfigResolver"
import {
	SkillPanelType,
	type DemoPanelConfig,
	type LocaleText,
	type OptionItem,
} from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"

export interface AiCanvasInspirationGroup {
	/** Unique across playbooks: `${playbookId}:${group_key}`. */
	key: string
	name: LocaleText
	items: OptionItem[]
}

/** Extracts the inspiration (demo panel) groups that one design playbook config contains. */
export function collectInspirationGroups(
	playbookId: string,
	config: PlaybookItem | undefined,
): AiCanvasInspirationGroup[] {
	// Playbook configs may be null; the resolver expects an object, so normalize first.
	const panels = deriveCurrentSceneConfig(
		{ config: config?.config ?? undefined } as ConfigWithPanels,
		TopicMode.Design,
	).panels
	return panels
		.filter((panel): panel is DemoPanelConfig => panel.type === SkillPanelType.DEMO)
		.flatMap((panel) => panel.demo?.groups ?? [])
		.map((group) => ({
			key: `${playbookId}:${group.group_key}`,
			name: group.group_name,
			items: (group.children ?? []).filter((item) => item.prompt || item.value),
		}))
		.filter((group) => group.items.length > 0)
}

/**
 * Inspiration content of the AI canvas home.
 *
 * Source of truth is the design digital employee's playbooks (admin-configured "inspiration"
 * demo panels), the same data the home composer shows per scene. Every playbook config is
 * loaded through the shared sceneConfigStore cache, so opening a scene later costs nothing.
 *
 * | design playbooks          | Result                         |
 * | none configured           | `groups` is empty; hide section |
 * | some fail to load         | keep the ones that loaded       |
 */
export function useDesignInspirations() {
	// Observed by the caller (observer component): updates when the mode list loads.
	const playbookIds =
		superMagicModeService
			.getModeConfigWithLegacy(TopicMode.Design, undefined, false)
			?.mode.playbooks?.map((scene) => scene.id)
			.filter(Boolean) ?? []
	const playbookKey = playbookIds.join(",")
	const [configs, setConfigs] = useState<Array<{ id: string; config?: PlaybookItem }>>([])
	const [isLoading, setIsLoading] = useState(false)

	useEffect(() => {
		const ids = playbookKey ? playbookKey.split(",") : []
		if (ids.length === 0) {
			setConfigs([])
			return
		}
		let cancelled = false
		setIsLoading(true)
		void Promise.allSettled(ids.map((id) => sceneConfigStore.fetchSkillConfigs(id))).then(
			(results) => {
				if (cancelled) return
				setConfigs(
					ids.map((id, index) => {
						const result = results[index]
						return {
							id,
							config: result.status === "fulfilled" ? result.value : undefined,
						}
					}),
				)
				setIsLoading(false)
			},
		)
		return () => {
			cancelled = true
		}
	}, [playbookKey])

	const groups = useMemo(
		() => configs.flatMap(({ id, config }) => collectInspirationGroups(id, config)),
		[configs],
	)

	return { groups, isLoading }
}
