/** 获取AI能力列表参数 */
export interface GetAiPowerListParams {
	config?: AiPowerConfig
	/** 状态：1=启动，0=不启动 */
	status?: number
}

/** AI能力 */
export enum PowerCode {
	/** OCR 识别 */
	OCR = "ocr",
	/** 互联网搜索 */
	WEB_SEARCH = "web_search",
	/** AI 搜索模型 */
	AI_SEARCH_MODEL = "ai_search_model",
	/** 图片搜索 */
	IMAGE_SEARCH = "image_search",
	/** 实时语音识别 */
	REALTIME_SPEECH_RECOGNITION = "realtime_speech_recognition",
	/** 音频文件识别 */
	AUDIO_FILE_RECOGNITION = "audio_file_recognition",
	/** 自动补全 */
	AUTO_COMPLETION = "auto_completion",
	/** 内容总结 */
	CONTENT_SUMMARY = "content_summary",
	/** 视觉理解 */
	VISUAL_UNDERSTANDING = "visual_understanding",
	/** 智能重命名 */
	SMART_RENAME = "smart_rename",
	/** AI 优化 */
	AI_OPTIMIZATION = "ai_optimization",
	/** 网页爬取 */
	WEB_SCRAPE = "web_scrape",
	/** 图片转换高清 */
	IMAGE_CONVERT_HIGH = "image_convert_high",
	/** 火山方舟素材服务 */
	VOLCENGINE_ARK_ASSETS = "volcengine_ark_assets",
	/** 扩图 */
	IMAGE_EXPAND = "image_expand",
	/** 去背景 */
	IMAGE_REMOVE_BACKGROUND = "image_remove_background",
	/** 橡皮擦 */
	IMAGE_ERASER = "image_eraser",
	/** 天气查询 */
	WEATHER_FORECAST = "weather_forecast",
	/** 知识库嵌入模型 */
	KNOWLEDGE_BASE_EMBEDDING_MODEL = "knowledge_base_embedding_model",
	/** 知识库视觉理解能力 */
	KNOWLEDGE_BASE_VISUAL_UNDERSTANDING = "knowledge_base_visual_understanding",
	/** 追加提问 */
	FOLLOW_UP_QUESTIONS = "follow_up_questions",
	/** 视频理解 */
	VIDEO_UNDERSTANDING = "video_understanding",
	/** 深度写作 (超级麦吉) */
	SUPER_MAGIC_DEEP_WRITE = "super_magic_deep_write",
	/** 内容净化 (超级麦吉) */
	SUPER_MAGIC_PURIFY = "super_magic_purify",
	/** 智能文件名 (超级麦吉) */
	SUPER_MAGIC_SMART_FILENAME = "super_magic_smart_filename",
	/** 上下文压缩 (超级麦吉) */
	SUPER_MAGIC_COMPACT = "super_magic_compact",
	/** 音频分析 (超级麦吉) */
	SUPER_MAGIC_ANALYSIS_AUDIO = "super_magic_analysis_audio",
	/** 生图提示词补全 */
	IMAGE_PROMPT_COMPLETION = "image_prompt_completion",
}

/** 能力管理联通性测试 */
export interface TestAiPowerConnection {
	ai_ability: string
	duration_ms: number
	message: string
	provider: string
	success: boolean
}

/** AI能力 */
export interface AiPower {
	code: PowerCode
	description: string
	id: string
	name: string
	status: number
}

/** 服务商配置 */
export interface ProviderConfig {
	provider: string
	name: string
	enable: boolean
	// WebSearch 字段
	request_url?: string
	api_key?: string
	ak?: string
	sk?: string
	cx?: string
	region?: string
	version?: string
	service?: string
	endpoint?: string
	project_name?: string
	// OCR 字段
	access_key?: string
	secret_key?: string
	// 语音识别字段
	app_key?: string
	hot_words?: string
	replacement_words?: string
	// 图片编辑字段
	timeout?: number | string
	concurrent?: number | string
}

/** AI能力配置 */
export interface AiPowerConfig {
	access_point: string
	api_key: string
	model_id: string
	provider_code: string
	url: string | null
	/** WEB_SEARCH 专用：所有服务商配置列表 */
	providers?: ProviderConfig | ProviderConfig[]
}

/** AI能力详情 */
export interface AiPowerDetail extends AiPower {
	icon: string
	config: AiPowerConfig
	sort_order: number
}

/** 更改AI能力 */
export interface UpdateAiPowerParams {
	code: PowerCode
	status?: number
	config?: AiPowerConfig
}
