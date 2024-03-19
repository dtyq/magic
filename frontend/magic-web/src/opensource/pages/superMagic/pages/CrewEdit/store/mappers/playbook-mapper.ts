import {
	buildCrewI18nText,
	type CrewI18nText,
	type PlaybookConfig,
	type UpdatePlaybookParams,
} from "@/opensource/apis/modules/crew"
import type { LocaleText } from "@/opensource/pages/superMagic/components/MainInputContainer/panels/types"
import type { SceneItem } from "../../components/StepDetailPanel/PlaybookPanel/types"

export function mapPlaybookToScene({
	id,
	name,
	description,
	icon,
	enabled,
	updatedAt,
	config,
}: {
	id: string
	name: string
	description: string | null
	icon: string | null
	enabled: boolean
	updatedAt: string
	config: PlaybookConfig | null
}): SceneItem {
	const storedConfigs = config?.scenes_config as SceneItem["configs"] | undefined

	return {
		id,
		name,
		description: description ?? "",
		icon: icon ?? "sparkles",
		enabled,
		update_at: updatedAt,
		configs: storedConfigs,
	}
}

export function mapSceneToPlaybookParams(scene: SceneItem): UpdatePlaybookParams {
	function toI18n(text: LocaleText): CrewI18nText {
		if (typeof text === "string") return buildCrewI18nText(text)
		return text as CrewI18nText
	}

	return {
		name_i18n: toI18n(scene.name),
		description_i18n: toI18n(scene.description),
		icon: scene.icon,
		theme_color: scene.theme_color,
		enabled: scene.enabled,
		config: {
			scenes_config: scene.configs as Record<string, unknown>,
		},
	}
}
