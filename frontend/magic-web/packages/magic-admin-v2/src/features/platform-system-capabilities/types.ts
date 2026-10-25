export const aiPowerStatus = {
	disabled: 0,
	enabled: 1,
} as const

export const aiPowerCode = {
	ocr: "ocr",
	webSearch: "web_search",
	imageSearch: "image_search",
	realtimeSpeechRecognition: "realtime_speech_recognition",
	audioFileRecognition: "audio_file_recognition",
	autoCompletion: "auto_completion",
	contentSummary: "content_summary",
	visualUnderstanding: "visual_understanding",
	smartRename: "smart_rename",
	aiOptimization: "ai_optimization",
	webScrape: "web_scrape",
	imageConvertHigh: "image_convert_high",
	imageExpand: "image_expand",
	imageRemoveBackground: "image_remove_background",
	imageEraser: "image_eraser",
	weatherForecast: "weather_forecast",
	knowledgeBaseEmbeddingModel: "knowledge_base_embedding_model",
	knowledgeBaseVisualUnderstanding: "knowledge_base_visual_understanding",
	followUpQuestions: "follow_up_questions",
	videoUnderstanding: "video_understanding",
	superMagicDeepWrite: "super_magic_deep_write",
	superMagicPurify: "super_magic_purify",
	superMagicSmartFilename: "super_magic_smart_filename",
	superMagicCompact: "super_magic_compact",
	superMagicAnalysisAudio: "super_magic_analysis_audio",
	imagePromptCompletion: "image_prompt_completion",
} as const

export type AiPowerCode = (typeof aiPowerCode)[keyof typeof aiPowerCode]

export type AiPower = {
	code: AiPowerCode | string
	description: string
	id: string
	name: string
	status: number
}

export type ProviderFieldConfig = {
	name: string
	type: "input" | "password" | "textarea" | "select"
	labelKey?: string
	label?: string
	descriptionKey?: string
	required?: boolean
	inputMode?: "text" | "numeric"
}

export type ProviderConfig = {
	provider: string
	provider_code?: string
	name?: string
	enable: boolean
	request_url?: string
	api_key?: string
	ak?: string
	sk?: string
	cx?: string
	region?: string
	access_key?: string
	secret_key?: string
	app_key?: string
	hot_words?: string
	replacement_words?: string
	timeout?: number | string
	concurrent?: number | string
	model_name?: string
	[key: string]: unknown
}

export type AiPowerConfig = {
	access_point?: string
	api_key?: string
	model_id?: string
	provider_code?: string
	url?: string | null
	prompt?: string
	providers?: unknown
	[key: string]: unknown
}

export type AiPowerDetail = AiPower & {
	config?: AiPowerConfig
	sort_order?: number
}

export type UpdateAiPowerParams = {
	code: string
	status?: number
	config?: AiPowerConfig
}

export type TestAiPowerConnectionParams = {
	ai_ability: string
	provider: string
}

export type TestAiPowerConnectionResult = {
	ai_ability: string
	duration_ms: number
	message: string
	provider: string
	success: boolean
}

export type CapabilityModel = {
	id: string
	model_id: string
	model_version?: string
	name?: string
	icon?: string
	description?: string
	category?: string
	provider_code?: string
	status?: number
}
