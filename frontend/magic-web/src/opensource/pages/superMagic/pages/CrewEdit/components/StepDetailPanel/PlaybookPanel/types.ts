import type {
	FieldPanelConfig,
	GuidePanelConfig,
	DemoPanelConfig,
	LocaleText,
} from "@/opensource/pages/superMagic/components/MainInputContainer/panels/types"

/** Actions available on a scene row via the context menu */
export type SceneAction = "edit" | "delete"

export interface SceneItem {
	id: string
	name: LocaleText
	description: LocaleText
	/** Lucide icon name (kebab-case or PascalCase), rendered via LucideLazyIcon */
	icon: string
	/** Hex color string, e.g. "#6366f1" */
	theme_color?: string
	enabled: boolean
	update_at: string
	/** Per-tab panel configurations for the scene editor */
	configs?: {
		presets?: FieldPanelConfig
		quick_start?: GuidePanelConfig
		inspiration?: DemoPanelConfig
	}
}
