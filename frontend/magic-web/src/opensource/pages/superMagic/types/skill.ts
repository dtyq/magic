export enum SceneEditorKey {
	General = "general",
	// Slides = "slides",
	// Design = "design",
	RecordSummary = "record_summary",
	// AnalyzeData = "analyze_data",
	// SummarizeVideos = "summarize_videos",
}

export interface SceneItem {
	id: string
	name: string
	desc: string
	icon: string
	theme_color: string | null
}
