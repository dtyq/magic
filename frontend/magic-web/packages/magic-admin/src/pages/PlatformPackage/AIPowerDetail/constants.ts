import { PlatformPackage } from "@admin/types/platformPackage"
// 互联网搜索 - 默认服务商列表
export const DefaultWebSearchProviderList = [
	{
		provider: "magic",
		name: "Magic API",
		request_url: "",
		api_key: "",
		enable: false,
	},
	{
		provider: "bing",
		name: "Bing",
		request_url: "",
		api_key: "",
		enable: false,
	},
	{
		provider: "cloudsway",
		name: "Cloudsway",
		request_url: "",
		api_key: "",
		enable: false,
	},
	{
		provider: "baidu",
		name: "Baidu",
		request_url: "",
		api_key: "",
		enable: false,
	},
	{
		provider: "doubao",
		name: "Doubao",
		request_url: "",
		api_key: "",
		enable: false,
	},
]

// 网页爬取 - 默认服务商列表
export const DefaultWebScrapeProviderList = [
	{
		provider: "magic",
		name: "Magic API",
		request_url: "",
		api_key: "",
		enable: false,
	},
	{
		provider: "bing",
		name: "Bing",
		request_url: "",
		api_key: "",
		enable: false,
	},
	{
		provider: "cloudsway",
		name: "Cloudsway",
		request_url: "",
		api_key: "",
		enable: false,
	},
]

// 图片搜索 - 默认服务商列表
export const DefaultImageProviderList = [
	{
		provider: "bing",
		name: "Bing",
		request_url: "",
		api_key: "",
		enable: false,
	},
	{
		provider: "cloudsway",
		name: "Cloudsway",
		request_url: "",
		api_key: "",
		enable: false,
	},
	{
		provider: "google",
		name: "Google",
		request_url: "",
		api_key: "",
		enable: false,
	},
	{
		provider: "doubao",
		name: "Doubao",
		request_url: "",
		api_key: "",
		enable: false,
	},
]

// OCR识别 - 默认服务商列表
export const DefaultOCRProviderList = [
	{
		provider: "Volcengine",
		name: "Volcengine",
		access_key: "",
		secret_key: "",
		enable: true,
	},
]

// 实时语音识别 - 默认服务商列表
export const DefaultRealtimeSpeechProviderList = [
	{
		provider: "Volcengine",
		name: "Volcengine",
		app_key: "",
		access_key: "",
		hot_words: "",
		replacement_words: "",
		enable: true,
	},
]

// 音频文件识别 - 默认服务商列表
export const DefaultAudioFileProviderList = [
	{
		provider: "Volcengine",
		name: "Volcengine",
		app_key: "",
		access_key: "",
		enable: true,
	},
]

// 去背景 - 默认服务商列表
export const DefaultRemoveBackgroundProviderList = [
	{
		provider: "official_proxy",
		name: "官方代理",
		request_url: "",
		api_key: "",
		enable: false,
	},
	{
		provider: "official_model_service",
		name: "官方服务",
		request_url: "",
		api_key: "",
		model_name: "",
		enable: true,
	},
]

// 擦图/扩图 - 默认服务商列表
export const DefaultImageEditProviderList = [
	{
		provider: "official_proxy",
		name: "官方代理服务",
		request_url: "",
		api_key: "",
		timeout: 300,
		enable: false,
	},
	{
		provider: "volcengine",
		name: "火山引擎",
		access_key: "",
		secret_key: "",
		timeout: 300,
		enable: false,
	},
]

// 天气查询 - 默认服务商列表
export const DefaultWeatherForecastProviderList = [
	{
		provider: "aidata",
		name: "AiData",
		request_url: "",
		api_key: "",
		enable: true,
	},
]

// 默认服务商列表映射
export const DefaultProviderListMap: Record<string, PlatformPackage.ProviderConfig[]> = {
	[PlatformPackage.PowerCode.WEB_SEARCH]: DefaultWebSearchProviderList,
	[PlatformPackage.PowerCode.WEB_SCRAPE]: DefaultWebScrapeProviderList,
	[PlatformPackage.PowerCode.IMAGE_SEARCH]: DefaultImageProviderList,
	[PlatformPackage.PowerCode.OCR]: DefaultOCRProviderList,
	[PlatformPackage.PowerCode.REALTIME_SPEECH_RECOGNITION]: DefaultRealtimeSpeechProviderList,
	[PlatformPackage.PowerCode.AUDIO_FILE_RECOGNITION]: DefaultAudioFileProviderList,
	[PlatformPackage.PowerCode.IMAGE_REMOVE_BACKGROUND]: DefaultRemoveBackgroundProviderList,
	[PlatformPackage.PowerCode.IMAGE_ERASER]: DefaultImageEditProviderList,
	[PlatformPackage.PowerCode.IMAGE_EXPAND]: DefaultImageEditProviderList,
	[PlatformPackage.PowerCode.WEATHER_FORECAST]: DefaultWeatherForecastProviderList,
}

// 服务配置列表
export const ServiceConfigList = [
	PlatformPackage.PowerCode.OCR,
	PlatformPackage.PowerCode.WEB_SEARCH,
	PlatformPackage.PowerCode.WEB_SCRAPE,
	PlatformPackage.PowerCode.REALTIME_SPEECH_RECOGNITION,
	PlatformPackage.PowerCode.AUDIO_FILE_RECOGNITION,
	PlatformPackage.PowerCode.IMAGE_SEARCH,
	PlatformPackage.PowerCode.IMAGE_REMOVE_BACKGROUND,
	PlatformPackage.PowerCode.IMAGE_ERASER,
	PlatformPackage.PowerCode.IMAGE_EXPAND,
	PlatformPackage.PowerCode.WEATHER_FORECAST,
]

// 支持联通性测试的工具类型
export const ConnectivityTestCodes = [
	PlatformPackage.PowerCode.WEB_SEARCH,
	PlatformPackage.PowerCode.WEB_SCRAPE,
	PlatformPackage.PowerCode.IMAGE_SEARCH,
]

// 图片工具
export const ImageToolCodes = [
	PlatformPackage.PowerCode.IMAGE_CONVERT_HIGH,
	PlatformPackage.PowerCode.IMAGE_EXPAND,
	PlatformPackage.PowerCode.IMAGE_ERASER,
]
