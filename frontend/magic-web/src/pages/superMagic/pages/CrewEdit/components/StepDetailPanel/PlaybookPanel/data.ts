import {
	SkillPanelType,
	OptionViewType,
	type SkillPanelConfig,
	type FieldPanelConfig,
	type GuidePanelConfig,
	type DemoPanelConfig,
} from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { defaultSlidesPanelConfig } from "@/pages/superMagic/components/MainInputContainer/scenes/Slides/config"
import { defaultDesignPanelConfig } from "@/pages/superMagic/components/MainInputContainer/scenes/Design/config"
import { defaultAnalyzeDataPanelConfig } from "@/pages/superMagic/components/MainInputContainer/scenes/AnalyzeData/config"
import { defaultSummarizeRecordingsConfig } from "@/pages/superMagic/components/MainInputContainer/scenes/SummarizeRecordings/config"
import { defaultSummarizeVideosPanelConfig } from "@/pages/superMagic/components/MainInputContainer/scenes/SummarizeVideos/config"
import type { SceneItem } from "./types"

/** Extract typed configs from a flat SkillPanelConfig array */
function toSceneConfigs(panels: SkillPanelConfig[]): SceneItem["configs"] {
	return {
		presets: panels.find((p): p is FieldPanelConfig => p.type === SkillPanelType.FIELD),
		quick_start: panels.find((p): p is GuidePanelConfig => p.type === SkillPanelType.GUIDE),
		inspiration: panels.find((p): p is DemoPanelConfig => p.type === SkillPanelType.DEMO),
	}
}

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

export const INITIAL_SCENES: SceneItem[] = [
	{
		id: "slides",
		name: "Slide Creation",
		description: "Transform outlines into structured business presentations.",
		icon: "presentation",
		enabled: true,
		update_at: "Feb 5, 2026 at 12:00",
		configs: toSceneConfigs(defaultSlidesPanelConfig),
	},
	{
		id: "design",
		name: "Design",
		description: "Generate and upscale images with precision style controls.",
		icon: "palette",
		enabled: true,
		update_at: "Feb 5, 2026 at 12:00",
		configs: toSceneConfigs(defaultDesignPanelConfig),
	},
	{
		id: "analyze-data",
		name: "Analyze Data",
		description: "Upload CSV or Excel files and visualize insights instantly.",
		icon: "bar-chart-2",
		enabled: true,
		update_at: "Feb 5, 2026 at 12:00",
		configs: toSceneConfigs(defaultAnalyzeDataPanelConfig),
	},
	{
		id: "summarize-recordings",
		name: "Summarize Recordings",
		description: "Transcribe and summarize audio recordings in real time.",
		icon: "mic",
		enabled: true,
		update_at: "Feb 5, 2026 at 12:00",
		configs: toSceneConfigs(defaultSummarizeRecordingsConfig),
	},
	{
		id: "summarize-videos",
		name: "Summarize Videos",
		description: "Paste a YouTube URL or upload a video for an instant summary.",
		icon: "video",
		enabled: true,
		update_at: "Feb 5, 2026 at 12:00",
		configs: toSceneConfigs(defaultSummarizeVideosPanelConfig),
	},
]
