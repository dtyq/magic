import {
	SkillPanelType,
	OptionViewType,
} from "@/pages/superMagic/components/MainInputContainer/panels/types"
import type { SceneItem } from "./types"

function generateSceneId(): string {
	return `scene-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatUpdatedAt(date: Date): string {
	return date.toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	})
}

export function createDefaultScene(): SceneItem {
	const now = new Date()
	return {
		id: generateSceneId(),
		name: {
			default: "",
		},
		description: {
			default: "",
		},
		icon: "sparkles",
		enabled: true,
		update_at: formatUpdatedAt(now),
		configs: {
			presets: {
				type: SkillPanelType.FIELD,
				field: {
					view_type: OptionViewType.DROPDOWN,
					items: [],
				},
			},
			quick_start: {
				type: SkillPanelType.GUIDE,
				guide: { items: [] },
			},
			inspiration: {
				type: SkillPanelType.DEMO,
				demo: {
					view_type: OptionViewType.TEXT_LIST,
					groups: [],
				},
			},
		},
	}
}
