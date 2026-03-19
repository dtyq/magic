import type { LocaleText } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { resolveLocaleText } from "@/pages/superMagic/components/MainInputContainer/panels/utils"
import type { PlaybookItem } from "@/apis/modules/crew"
import type { SceneItem } from "../../types"

/**
 * Resolve a LocaleText value to a plain string for the given locale.
 * Delegates to the shared resolveLocaleText with an empty-string fallback.
 */
export function resolveLocalText(text: LocaleText, lang: string): string {
	return resolveLocaleText(text, lang) ?? ""
}

/**
 * Map PlaybookItem (API response) to SceneItem for the edit panel.
 * Reuses the same shape as store.mapPlaybookToScene for consistency.
 */
export function playbookToSceneItem(playbook: PlaybookItem): SceneItem {
	const storedConfigs = playbook.config?.scenes_config as SceneItem["configs"] | undefined
	return {
		id: String(playbook.id),
		name: (playbook.name_i18n ?? { default: "" }) as LocaleText,
		description: (playbook.description_i18n ?? { default: "" }) as LocaleText,
		icon: playbook.icon ?? "sparkles",
		theme_color: playbook.theme_color ?? undefined,
		enabled: playbook.enabled,
		update_at: playbook.updated_at,
		configs: storedConfigs,
	}
}
