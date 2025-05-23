/**
 * 聊天事件类型
 */
import type { QuickInstruction, SystemInstruct } from "../bot"
import type { StreamStatus } from "../request"
import type { SeqMessageBase } from "./base"
import {
	RevokeMessage,
	GroupAddMemberMessage,
	GroupCreateMessage,
	GroupDisbandMessage,
	GroupUsersRemoveMessage,
	GroupUpdateMessage,
} from "./control_message"

export const enum ConversationMessageType {
	/** 文本消息 */
	Text = "text",

	/** 富文本消息 */
	RichText = "rich_text",

	/** markdown 消息 */
	Markdown = "markdown",

	/** AI 搜索 */
	AggregateAISearchCard = "aggregate_ai_search_card",

	/** AI 搜索 - 新版本 */
	AggregateAISearchCardV2 = "aggregate_ai_search_card_v2",

	/** 图片消息 */
	Image = "image",

	/** 视频消息 */
	Video = "video",

	/** 文件消息 */
	Files = "files",

	/** 语音消息 */
	Voice = "voice",

	/** 魔法搜索卡片消息 */
	MagicSearchCard = "magic_search_card",

	/** AI 文生图 */
	AiImage = "ai_image_card",

	/** 原图转高清 */
	HDImage = "image_convert_high_card",

	/** 录音纪要 */
	RecordingSummary = "recording_summary",

	/** 超级麦吉消息 */
	SuperMagic = "general_agent_card",
}

/**
 * 携带流式消息状态
 */
export interface WithStreamOptions<T extends object = object> {
	stream_options?: {
		/** 流式消息状态 */
		status: StreamStatus
		/** 流式消息 ID */
		stream: boolean
	} & T
}

/**
 * 携带推理内容和流式消息状态
 */
export interface WithReasoningContentAndStreamOptions {
	reasoning_content?: string
	stream_options?: {
		/** 流式消息状态 */
		status: StreamStatus
		/** 流式消息 ID */
		stream: boolean
	}
}

/**
 * 会话消息
 */
export interface ConversationMessageBase extends SeqMessageBase {
	/** 应用消息 ID */
	app_message_id: string
	/** 发送者 ID */
	sender_id: string
	/** 发送时间 */
	send_time: number
	/** 消息状态 */
	status: ConversationMessageStatus
	/** 未读消息数 */
	unread_count: number
	/** 话题 ID */
	topic_id?: string
	/** 是否撤回 */
	revoked?: boolean
	/** 本地临时数据存储 */
	temp_custom_data?: Record<string, unknown>
	/** 是否本地删除 */
	is_local_deleted?: boolean
}

export interface SuperMagicContent {
	type: ConversationMessageType.SuperMagic
	content: string
}


/**
 * 消息附件
 */
export type ConversationMessageAttachment = {
	file_id: string
	file_type?: number
	file_extension?: string
	file_size?: number
	file_name?: string
}

/**
 * 会话消息指令
 */
export type ConversationMessageInstruct = {
	value: string
	instruction: Exclude<QuickInstruction, SystemInstruct>
}

/**
 * 消息携带指令
 */
export type WithConversationMessageInstruct = {
	instructs?: ConversationMessageInstruct[] | undefined
}

/**
 * 外部文件
 */
export type ExternalFile = {
	url?: string
	file_extension?: string
}

/**
 * 聊天文件信息
 */
export interface ChatFileInfo {
	file_id: string
	user_id: string
	magic_message_id: string
	organization_code: string
	file_extension: string
	file_key: string
	file_size: number
	created_at: string
	updated_at: string
}

/**
 * 聊天文件 url 数据
 */
export interface ChatFileUrlData {
	path: string
	url: string
	expires: number
	download_name: string
}

/**
 * 富文本消息
 */
export interface RichTextConversationMessage extends ConversationMessageBase {
	type: ConversationMessageType.RichText
	/** 消息内容 */
	rich_text?: {
		content: string
		attachments?: ConversationMessageAttachment[]
	} & WithConversationMessageInstruct
}

/**
 * 文本消息
 */
export interface TextConversationMessage extends ConversationMessageBase {
	type: ConversationMessageType.Text
	/** 消息内容 */
	text?: {
		content: string
		attachments?: ConversationMessageAttachment[]
	} & WithReasoningContentAndStreamOptions &
		WithConversationMessageInstruct
}

export type RecordSummaryOriginContent = {
	duration: string
	speaker: string
	text: string
	start_time: string
	end_time: string
}[]

/**
 * 录音纪要消息
 */
export interface RecordSummaryConversationMessage extends ConversationMessageBase {
	type: ConversationMessageType.RecordingSummary
	/** 消息内容 */
	recording_summary?: {
		status?: RecordSummaryStatus
		text?: string // 单次翻译的结果
		recording_blob?: string // 翻译的数据源
		origin_content?: RecordSummaryOriginContent // 原文内容
		attachments?: ConversationMessageAttachment[] // 音频文件
		full_text?: string // 当前完整的翻译结果
		ai_result?: string // 智能总结后的结果
		duration?: string // 总时长
		title?: string // 智能总结标题
		audio_link?: string // 录音链接
		is_recognize?: boolean // 是否进行识别
	}
}

/**
 * markdown 消息
 */
export interface MarkdownConversationMessage extends ConversationMessageBase {
	type: ConversationMessageType.Markdown
	/** 消息内容 */
	markdown?: {
		content: string
		attachments?: ConversationMessageAttachment[]
	} & WithReasoningContentAndStreamOptions &
		WithConversationMessageInstruct
}

/**
 * AI 搜索 - 关联问题
 */
export interface AssociateQuestion {
	/** 问题 */
	title: string
	/** 大模型 - 回答 */
	llm_response: string | null
	/** 搜索关键词 */
	search_keywords: string[] | null
	/** 总字数 */
	total_words?: number | null
	/** 阅读的页面总数 */
	page_count?: number | null
	/** 检索到的页面总数 */
	match_count?: number | null
}

/**
 * AI 搜索 - 搜索部分
 */
export interface AggregateAISearchCardSearch {
	/** 搜索结果 ID */
	id: string
	/** 搜索结果名称 */
	name: string
	/** 搜索结果 url */
	url: string
	/** 搜索结果发布时间 */
	datePublished: string
	/** 搜索结果发布时间显示文本 */
	datePublishedDisplayText: string
	/** 搜索结果是否适合家庭 */
	isFamilyFriendly: boolean
	/** 搜索结果显示 url */
	displayUrl: string
	/** 搜索结果摘要 */
	snippet: string
	/** 搜索结果最后爬取时间 */
	dateLastCrawled: string
	/** 搜索结果缓存 url */
	cachedPageUrl: string
	/** 搜索结果语言 */
	language: string
	/** 搜索结果是否为导航 */
	isNavigational: boolean
	/** 搜索结果是否缓存 */
	noCache: boolean
	/** 来源索引 */
	index?: number
}

/**
 * AI 搜索 - 思维导图 - 子节点
 */
export interface AggregateAISearchCardMindMapChildren {
	data: {
		text: string
	}
	children?: AggregateAISearchCardMindMapChildren[]
}

export const enum AggregateAISearchCardDataType {
	/** 搜索结果 */
	Search = 0,
	/** 回答 */
	LLMResponse = 1,
	/** 思维导图 */
	MindMap = 2,
	/** 关联问题 */
	AssociateQuestion = 3,
	/** 事件 */
	Event = 4,
	/** 乒乓 */
	PingPong = 5,
	/** 异常结束 */
	Terminate = 6,
	/** PPT */
	PPT = 7,
	/** 搜索深度 */
	SearchDeepLevel = 8,
}

export const enum RecordSummaryStatus {
	/** 开始录音 */
	Start = 1,
	/** 录音中 */
	Doing = 2,
	/** 结束录音 */
	End = 3,
	/** 录音总结中 */
	Summarizing = 4,
	/** 录音总结完成 */
	Summarized = 5,
}

/**
 * AI 搜索 - 事件
 */
export interface AggregateAISearchCardEvent {
	name: string
	time: string
	description: string
}

export const enum AggregateAISearchCardDeepLevel {
	/** 简单搜索 */
	Simple = 1,
	/** 深度搜索 */
	Deep = 2,
}

/**
 * AI 搜索内容
 */
interface AggregateAISearchCardContentFromService extends WithReasoningContentAndStreamOptions {
	/** 父级 ID */
	parent_id: string
	/** 当前 ID */
	id: string
	/** 类型 */
	type: AggregateAISearchCardDataType
	/** 回答 */
	llm_response: string | undefined
	/** 关联问题 */
	/** FIXME: 后端代码 返回类型改为 AssociateQuestion, 后续可移除 string */
	associate_questions: Record<string, string | AssociateQuestion> | undefined
	/** 思维导图 */
	mind_map: AggregateAISearchCardMindMapChildren | string | undefined
	/** 搜索结果 */
	search: AggregateAISearchCardSearch[] | undefined
	/** 关键词 */
	search_keywords: string[] | undefined
	/** 事件 */
	event: AggregateAISearchCardEvent[] | undefined
	/** 搜索深度, 1 - 简单搜索 2 - 深度搜索 */
	search_deep_level: AggregateAISearchCardDeepLevel | undefined
	/** PPT */
	ppt: string | undefined
	/** 总字数 */
	total_words: number | undefined
	/** 检索到的页面总数 */
	match_count: number | undefined
	/** 阅读的页面总数 */
	page_count: number | undefined
}

export type AggregateAISearchCardContent = Pick<
	AggregateAISearchCardContentFromService,
	| "mind_map"
	| "llm_response"
	| "event"
	| "ppt"
	| "search_deep_level"
	| "reasoning_content"
	| "stream_options"
> & {
	search: Record<string, AggregateAISearchCardSearch[]>
	associate_questions: Record<string, AssociateQuestion>
	finish: boolean
	error: boolean
}

/**
 * AI 搜索消息
 */
export interface AggregateAISearchCardConversationMessage<FromService extends boolean = true>
	extends ConversationMessageBase {
	type: ConversationMessageType.AggregateAISearchCard
	aggregate_ai_search_card?: FromService extends true
		? AggregateAISearchCardContentFromService
		: AggregateAISearchCardContent
}

/**
 * AI 搜索 - 新版本 - 关联问题
 */
export interface AssociateQuestionV2 {
	parent_question_id: string
	question_id: string
	question: string
}

/**
 * AI 搜索 - 新版本 - 搜索结果
 */
export interface SearchWebPageItem {
	id: string
	name: string
	url: string
	datePublished: string
	datePublishedDisplayText: string
	isFamilyFriendly: boolean
	displayUrl: string
	snippet: string
	dateLastCrawled: string
	cachedPageUrl: string
	language: string
	isNavigational: boolean
	noCache: boolean
	detail: string
	index?: number
}

/**
 * AI 搜索 - 新版本 - 搜索结果
 */
export interface SearchWebPage {
	question_id: string
	search: SearchWebPageItem[]
	total_words: number
	match_count: number
	page_count: number
}

export interface NoRepeatSearchDetail {
	id: string
	name: string
	url: string
	date_published: string
	date_published_display_text: string
	is_family_friendly: boolean
	display_url: string
	snippet: string
	date_last_crawled: string
	cached_page_url: string
	language: string
	is_navigational: boolean
	no_cache: boolean
}

/**
 * 流式消息阶段结束原因
 */
export const enum StreamStepFinishedReason {
	/** 成功 */
	Success = 0,
	/** 失败 */
	Error = 1,
}

export interface StreamStepFinished {
	key: string
	finished_reason: StreamStepFinishedReason
}

/**
 * AI 搜索 - 新版本 - 流式消息选项
 */
export interface AggregateAISearchCardV2StreamOptions
	extends WithStreamOptions<{
		stream_app_message_id: string
		steps_finished: Record<string, any>
	}> {}

/**
 * AI 搜索 - 新版本 - 状态
 */
export const enum AggregateAISearchCardV2Status {
	/** 正在搜索 */
	isSearching = 1,
	/** 正在阅读 */
	isReading = 2,
	/** 正在思考 */
	isReasoning = 3,
	/** 正在总结 */
	isSummarizing = 4,
	/** 结束 */
	isEnd = 5,
}

/**
 * AI 搜索 - 新版本内容
 */
export interface AggregateAISearchCardContentV2 extends AggregateAISearchCardV2StreamOptions {
	search_deep_level?: AggregateAISearchCardDeepLevel
	associate_questions?: Record<string, AssociateQuestionV2[]>
	search_web_pages?: SearchWebPage[]
	no_repeat_search_details?: SearchWebPageItem[]
	summary?: {
		reasoning_content?: string
		content: string
	}
	events?: AggregateAISearchCardEvent[]
	mind_map?: string
	ppt?: string
	status?: AggregateAISearchCardV2Status
}

/**
 * AI 搜索 - 新版本
 */
export interface AggregateAISearchCardConversationMessageV2 extends ConversationMessageBase {
	type: ConversationMessageType.AggregateAISearchCardV2
	aggregate_ai_search_card_v2?: AggregateAISearchCardContentV2
}

/**
 * 文件消息
 */
export interface FileConversationMessage extends ConversationMessageBase {
	type: ConversationMessageType.Files
	/** 消息内容 */
	files?: {
		attachments: ConversationMessageAttachment[]
	} & WithConversationMessageInstruct
}

/**
 * 图片消息
 */
export interface ImageConversationMessage extends ConversationMessageBase {
	type: ConversationMessageType.Image
	/** 消息内容 */
	image?: {
		file_id: string
	} & WithConversationMessageInstruct
}

/**
 * 视频消息
 */
export interface VideoConversationMessage extends ConversationMessageBase {
	type: ConversationMessageType.Video
	/** 消息内容 */
	video?: {
		file_id: string
	} & WithConversationMessageInstruct
}

/**
 * 语音消息
 */
export interface VoiceConversationMessage extends ConversationMessageBase {
	type: ConversationMessageType.Voice
	/** 消息内容 */
	voice?: {
		file_id: string
	} & WithConversationMessageInstruct
}

/**
 * 魔法搜索卡片搜索结果
 */

export interface WikiSearchItem {
	/** 搜索结果 id */
	id: string
	/** 搜索结果名称 */
	name: string
	/** 搜索结果 url */
	url: string
	/** 搜索结果发布时间 */
	datePublished: number
	/** 搜索结果发布时间显示文本 */
	datePublishedDisplayText: string
	/** 搜索结果是否适合家庭 */
	isFamilyFriendly: boolean
	/** 搜索结果显示 url */
	displayUrl: string
	/** 搜索结果摘要 */
	snippet: string
	/** 搜索结果最后爬取时间 */
	dateLastCrawled: string
	/** 搜索结果缓存 url */
	cachedPageUrl: string
	/** 搜索结果语言 */
	language: string
	/** 搜索结果是否为导航 */
	isNavigational: boolean
	/** 搜索结果是否缓存 */
	noCache: boolean
}

export interface MagicSearchCardContent {
	/** 搜索结果 */
	search: WikiSearchItem[]
	/** 回答 */
	llm_response: string
	/** 相关问题 */
	related_questions: string[]
}

/**
 * 魔法搜索卡片消息
 */
export interface MagicSearchCardConversationMessage extends ConversationMessageBase {
	type: ConversationMessageType.MagicSearchCard
	magic_search_card?: MagicSearchCardContent
}

export const enum AIImagesDataType {
	/** 开始生成 */
	StartGenerate = 1,
	/** 生成完成 */
	GenerateComplete = 2,
	/** 引用图片 */
	ReferImage = 3,
	/** 异常终止 */
	Error = 4,
}

export interface AIImagesContentItem {
	file_id: string
	url: string
}
export interface AIImagesContent {
	// 生成状态
	type: AIImagesDataType
	// 图片列表
	items: AIImagesContentItem[]
	// 文本描述
	text: string
	// 引用文件
	refer_file_id: string
	// 文本描述
	refer_text: string
	// 错误信息
	error_message?: string
	// 比例
	radio?: string
}

/**
 * AI 文生图
 */
export interface AIImagesMessage extends ConversationMessageBase {
	type: ConversationMessageType.AiImage
	/** 消息内容 */
	ai_image_card?: AIImagesContent
}

export enum HDImageDataType {
	/** 开始生成 */
	StartGenerate = 1,
	/** 生成完成 */
	GenerateComplete = 2,
	/** 异常终止 */
	Error = 3,
}

export interface HDImageContent {
	// 生成状态
	type: HDImageDataType
	// 原图文件id
	origin_file_id: string
	// 高清图文件id
	new_file_id: string
	// 文本描述
	refer_text: string
	// 错误信息
	error_message?: string
	// 比例
	radio?: string
}

/**
 * 原图转高清
 */
export interface HDImageMessage extends ConversationMessageBase {
	type: ConversationMessageType.HDImage
	/** 消息内容 */
	image_convert_high_card?: HDImageContent
}

/**
 * 可引用消息
 */
export type MessageCanRefer = MessageCanRevoke

/**
 * 可转发消息
 */
export type MessageCanForward = MessageCanRevoke

export type MessageCanRenderToText = MessageCanRevoke

/**
 * 可撤回消息
 */
export type MessageCanRevoke =
	| TextConversationMessage
	| RichTextConversationMessage
	| MarkdownConversationMessage
	| MagicSearchCardConversationMessage
	| FileConversationMessage
	| ImageConversationMessage
	| VideoConversationMessage
	| VoiceConversationMessage
	| AggregateAISearchCardConversationMessage<false>
	| AIImagesMessage
	| RecordSummaryConversationMessage

/** 会话消息 */
export type ConversationMessage =
	| TextConversationMessage
	| RichTextConversationMessage
	| MarkdownConversationMessage
	| MagicSearchCardConversationMessage
	| FileConversationMessage
	| ImageConversationMessage
	| VideoConversationMessage
	| VoiceConversationMessage
	| RevokeMessage
	| GroupAddMemberMessage
	| GroupCreateMessage
	| GroupDisbandMessage
	| GroupUsersRemoveMessage
	| GroupUpdateMessage
	| AggregateAISearchCardConversationMessage<false>
	| AggregateAISearchCardConversationMessageV2
	| AIImagesMessage
	| RecordSummaryConversationMessage
	| HDImageMessage

/** 发送状态 */
export const enum SendStatus {
	/** 发送中 */
	Pending = 1,
	/** 发送成功 */
	Success = 2,
	/** 发送失败 */
	Failed = 3,
}

/** 消息发送体 */
export interface ConversationMessageSend {
	// FIXME: TextConversationMessage 需要改为 ConversationMessage
	message:
		| Pick<
				TextConversationMessage,
				| "type"
				| "text"
				| "app_message_id"
				| "topic_id"
				| "revoked"
				| "sender_id"
				| "send_time"
		  >
		| Pick<
				RichTextConversationMessage,
				| "type"
				| "rich_text"
				| "app_message_id"
				| "topic_id"
				| "revoked"
				| "sender_id"
				| "send_time"
		  >
		| Pick<
				MarkdownConversationMessage,
				| "type"
				| "markdown"
				| "app_message_id"
				| "topic_id"
				| "revoked"
				| "sender_id"
				| "send_time"
		  >
		| Pick<
				FileConversationMessage,
				| "type"
				| "files"
				| "app_message_id"
				| "topic_id"
				| "revoked"
				| "sender_id"
				| "send_time"
		  >
		| Pick<
				AIImagesMessage,
				| "type"
				| "ai_image_card"
				| "app_message_id"
				| "topic_id"
				| "revoked"
				| "sender_id"
				| "send_time"
		  >
		| Pick<
				RecordSummaryConversationMessage,
				| "type"
				| "recording_summary"
				| "app_message_id"
				| "topic_id"
				| "revoked"
				| "sender_id"
				| "send_time"
		  >
		| Pick<
				HDImageMessage,
				| "type"
				| "image_convert_high_card"
				| "app_message_id"
				| "topic_id"
				| "revoked"
				| "sender_id"
				| "send_time"
		  >
	conversation_id: string
	refer_message_id?: string
	status: SendStatus
	message_id: string
}

/**
 * 会话消息状态
 */
export const enum ConversationMessageStatus {
	/** 未读 */
	Unread = "unread",
	/** 已读 */
	Read = "read",
	/** 已看 */
	Seen = "seen",
	/** 已撤回 */
	Revoked = "revoked",
}

/**
 * 高清图转换成果
 */
export interface HDImageResult {
	/** 错误信息 */
	error: string
	/** 完成状态 */
	finish_status: boolean
	/** 进度 */
	progress: number
	/** 高清图链接 */
	urls: string[]
}
