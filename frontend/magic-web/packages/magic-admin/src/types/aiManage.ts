import type { AiModel } from "@admin/const/aiModel"
import type { PageParams as CommonPageParams } from "./common"
import type { PlatformPackage } from "./platformPackage"

export interface BaseProps {
	/** 类名 */
	className?: string
	/** 样式 */
	style?: React.CSSProperties
}

/* AI 管理 */
export namespace AiManage {
	// 分页请求参数
	export interface PageParams {
		page_token?: string
		page_size: number
		type: "left" | "right" // 区分左右两个列表框
	}

	// 分页响应数据
	export interface PageResponse<T> {
		data: T[]
		next_page_token?: string
		total?: number
	}

	/* 多语言 */
	export interface Lang {
		zh_CN?: string
		en_US?: string
		vi_VN?: string
		th_TH?: string
		ms_MY?: string
	}

	/* 服务提供商 */
	export interface ServiceProvider {
		id: string
		name: string
		icon: string
		description: string
		remark: string
		provider_code: AiModel.ServiceProvider
		provider_type: AiModel.ProviderType
		category: AiModel.ServiceProviderCategory
		status: AiModel.Status
		created_at: string
		updated_at: string
		deleted_at: string
	}

	/* 添加服务商 */
	export interface AddServiceProviderParams {
		alias: string
		service_provider_id: string
		status: AiModel.Status
		/* 多语言配置 */
		translate?: {
			alias?: Lang
		}
	}

	/* 更新服务商信息 */
	export interface UpdateServiceProviderParams {
		id: string
		status: AiModel.Status
		config: ApiKeyConfig
		alias: string
		sort: number
		translate: {
			alias: Lang
		}
		provider_code: AiModel.ServiceProvider
	}

	export enum AuthType {
		API_KEY = "api_key",
		SERVICE_ACCOUNT = "service_account",
	}

	/* API key 配置信息 */
	export interface ApiKeyConfig {
		ak: string
		api_key: string
		sk: string
		url: string
		deployment_name?: string
		vector_size?: number
		/* 是否使用代理服务器 */
		use_proxy?: boolean
		/* 代理服务器 */
		proxy_server?: {
			id: string
			name: string
		}
		/* 谷歌服务账号配置 */
		auth_type: AuthType
		project_id?: string
		private_key_id?: string
		private_key?: string
		client_email?: string
		client_id?: string
		location?: string
		gcs_bucket?: string
	}

	/* 计费货币单位 */
	export enum BillingCurrency {
		CNY = "CNY",
		USD = "USD",
	}

	/* 计费类型 */
	export enum BillingType {
		/** 文本模型 token 计费 */
		TextTokens = "TextTokens",
		/** 图片按张计费 */
		ImageCount = "ImageCount",
		/** 图片 token 计费 */
		ImageTokens = "ImageTokens",
		/** 图片 Token 计费（含思考过程） */
		ImageTokensWithThought = "ImageTokensWithThought",
		/** 视频按时长计费 */
		VideoDuration = "VideoResolutionDuration",
		/** 视频 token 计费 */
		VideoTokens = "VideoTokens",
		/** 可灵视频按规格与输入条件时长计费 */
		KelingVideoResolutionMediaConditionDurationPricing = "KelingVideoResolutionMediaConditionDurationPricing",
		/** 火山视频按分辨率与参考视频 Token 矩阵计费 */
		VolcengineArkVideoResolutionReferenceVideoTokenMatrix = "VolcengineArkVideoResolutionReferenceVideoTokenMatrix",

		// ---- 旧值，仅用于读取兼容 ----
		/** @deprecated 使用 TextTokens 替代 */
		ByTokens = "Tokens",
		/** @deprecated 使用 ImageCount 替代 */
		ByTimes = "Times",
		/** @deprecated 使用 VideoDuration 替代 */
		ByPerSecond = "Per_Second",
	}

	/** 后端持久化 billing_type，允许返回细粒度模板类型 */
	export type PersistBillingType = BillingType | string

	/** 服务商模型价格模板项 */
	export interface ModelPricingTemplateItem {
		billing_object: string
		label: string
	}

	/** 服务商模型价格模板 */
	export interface ModelPricingTemplate {
		code: string
		label: string
		category: AiModel.ServiceProviderCategory | string
		billing_type: PersistBillingType
		items: ModelPricingTemplateItem[]
	}

	/** 旧版定价字段 */
	export enum LegacyPricingField {
		/** 输入定价 */
		InputPricing = "input_pricing",
		/** 输出定价 */
		OutputPricing = "output_pricing",
		/** 缓存写入定价 */
		CacheWritePricing = "cache_write_pricing",
		/** 缓存命中定价 */
		CacheHitPricing = "cache_hit_pricing",
	}

	/** 旧版成本字段 */
	export enum LegacyCostField {
		/** 输入成本 */
		InputCost = "input_cost",
		/** 输出成本 */
		OutputCost = "output_cost",
		/** 缓存写入成本 */
		CacheWriteCost = "cache_write_cost",
		/** 缓存命中成本 */
		CacheHitCost = "cache_hit_cost",
	}

	export enum BillingMode {
		/** 固定价格 */
		Fixed = "fixed",
		/** 阶梯价格 */
		Tiered = "tiered",
	}

	/** 定价方式 */
	export enum PricingMode {
		/** 固定价格 */
		Fixed = "fixed",
		/** 阶梯价格 */
		Ladder = "ladder",
		/** 跟随输入token */
		FollowInput = "input_token",
		/** 跟随输出token */
		FollowOutput = "output_token",
		/** 跟随缓存写入token */
		FollowCacheWrite = "cache_write_token",
		/** 跟随缓存命中token */
		FollowCacheHit = "cache_hit_token",
	}

	/** 计费对象 */
	export enum BillingObject {
		/** 缓存命中token */
		CacheHitToken = "cache_hit_token",
		/** 缓存写入token */
		CacheWriteToken = "cache_write_token",
		/** 输入token */
		InputToken = "input_token",
		/** 输出token */
		OutputToken = "output_token",

		/** 图片 1k 按张数 */
		Image1kOutputCount = "image_1k_output_count",
		/** 图片 2k 按张数 */
		Image2kOutputCount = "image_2k_output_count",
		/** 图片 4k 按张数 */
		Image4kOutputCount = "image_4k_output_count",
		/** 图片输入 Token */
		ImageInputToken = "image_input_token",
		/** 图片输出 Token */
		ImageOutputToken = "image_output_token",
		/** 思考 Token（图片/视频通用） */
		ThoughtToken = "thought_token",

		/** 480p 视频按时长 */
		Video480pOutputDuration = "video_480p_output_duration",
		/** 720p 视频按时长 */
		Video720pOutputDuration = "video_720p_output_duration",
		/** 1080p 视频按时长 */
		Video1080pOutputDuration = "video_1080p_output_duration",
		/** 2k 视频按时长 */
		Video2kOutputDuration = "video_2k_output_duration",
		/** 4k 视频按时长 */
		Video4kOutputDuration = "video_4k_output_duration",
		/** 输入包含视频的 token */
		VideoVisualInputOutputToken = "video_visual_input_output_token",
		/** 输入为文本（不含视频）的 token */
		VideoTextInputOutputToken = "video_text_input_output_token",
		/** 480p 输入包含视频画面的 token */
		Video480pVisualInputOutputToken = "video_480p_visual_input_output_token",
		/** 720p 输入包含视频画面的 token */
		Video720pVisualInputOutputToken = "video_720p_visual_input_output_token",
		/** 1080p 输入包含视频画面的 token */
		Video1080pVisualInputOutputToken = "video_1080p_visual_input_output_token",
		/** 2k 输入包含视频画面的 token */
		Video2kVisualInputOutputToken = "video_2k_visual_input_output_token",
		/** 4k 输入包含视频画面的 token */
		Video4kVisualInputOutputToken = "video_4k_visual_input_output_token",
		/** 480p 输入为文本（不含视频）的 token */
		Video480pTextInputOutputToken = "video_480p_text_input_output_token",
		/** 720p 输入为文本（不含视频）的 token */
		Video720pTextInputOutputToken = "video_720p_text_input_output_token",
		/** 1080p 输入为文本（不含视频）的 token */
		Video1080pTextInputOutputToken = "video_1080p_text_input_output_token",
		/** 2k 输入为文本（不含视频）的 token */
		Video2kTextInputOutputToken = "video_2k_text_input_output_token",
		/** 4k 输入为文本（不含视频）的 token */
		Video4kTextInputOutputToken = "video_4k_text_input_output_token",
	}

	/** 成本侧计费对象（billing_tiers 中与售价条目一一对应） */
	export enum BillingObjectCost {
		InputCost = "input_cost",
		OutputCost = "output_cost",
		CacheWriteCost = "cache_write_cost",
		CacheHitCost = "cache_hit_cost",

		Image1kOutputCountCost = "image_1k_output_count_cost",
		Image2kOutputCountCost = "image_2k_output_count_cost",
		Image4kOutputCountCost = "image_4k_output_count_cost",
		ImageInputTokenCost = "image_input_token_cost",
		ImageOutputTokenCost = "image_output_token_cost",
		ThoughtTokenCost = "thought_token_cost",

		Video480pOutputDurationCost = "video_480p_output_duration_cost",
		Video720pOutputDurationCost = "video_720p_output_duration_cost",
		Video1080pOutputDurationCost = "video_1080p_output_duration_cost",
		Video2kOutputDurationCost = "video_2k_output_duration_cost",
		Video4kOutputDurationCost = "video_4k_output_duration_cost",
		VideoVisualInputOutputTokenCost = "video_visual_input_output_token_cost",
		VideoTextInputOutputTokenCost = "video_text_input_output_token_cost",
		Video480pVisualInputOutputTokenCost = "video_480p_visual_input_output_token_cost",
		Video720pVisualInputOutputTokenCost = "video_720p_visual_input_output_token_cost",
		Video1080pVisualInputOutputTokenCost = "video_1080p_visual_input_output_token_cost",
		Video2kVisualInputOutputTokenCost = "video_2k_visual_input_output_token_cost",
		Video4kVisualInputOutputTokenCost = "video_4k_visual_input_output_token_cost",
		Video480pTextInputOutputTokenCost = "video_480p_text_input_output_token_cost",
		Video720pTextInputOutputTokenCost = "video_720p_text_input_output_token_cost",
		Video1080pTextInputOutputTokenCost = "video_1080p_text_input_output_token_cost",
		Video2kTextInputOutputTokenCost = "video_2k_text_input_output_token_cost",
		Video4kTextInputOutputTokenCost = "video_4k_text_input_output_token_cost",
	}

	/** 支持阶梯/跟随定价的文本 token 计费对象 */
	export type TextTokenBillingObject =
		| BillingObject.InputToken
		| BillingObject.OutputToken
		| BillingObject.CacheWriteToken
		| BillingObject.CacheHitToken

	/** 支持阶梯/跟随定价的文本 token 成本对象 */
	export type TextTokenBillingObjectCost =
		| BillingObjectCost.InputCost
		| BillingObjectCost.OutputCost
		| BillingObjectCost.CacheWriteCost
		| BillingObjectCost.CacheHitCost

	/** billing_tiers 单项的 billing_object / follow_object 取值 */
	export type BillingTierObject = BillingObject | BillingObjectCost | string

	/** 定价规则
	 * 当计费模式为fixed 时只能有一条，且必须为 {min:null,max:null,price:数字}；
	 * 当计费模式为tiered 时，第一档从 0 开始，区间连续，最后一档 max 可为 null
	 */
	export interface PricingRule {
		/** 最大值 */
		max: number | null
		/** 最小值 */
		min: number | null
		price: number
	}

	export interface BillingTier {
		/** 计费对象：售价维度为 *_token，成本维度为 *_cost */
		billing_object: BillingTierObject
		/** 区间跟随对象，与 billing_object 同属售价或成本命名空间 */
		follow_object: BillingTierObject
		pricing_mode: BillingMode
		pricing_rules: PricingRule[]
	}

	export interface PricingStep {
		start?: number | string | null
		end?: number | string | null
		price?: number | string | null
	}

	export type TranslateConfig = {
		name: Lang
		description: Lang
	}

	export type Config = {
		/** 最大token */
		max_tokens: number
		/** 最大输出token */
		max_output_tokens: number
		/** 创造性温度 */
		creativity: number
		/** 固定温度 */
		temperature: number
		/** 支持函数 */
		support_function: boolean
		/** 支持多模态 */
		support_multi_modal: boolean
		/** 支持深度思考 */
		support_deep_think: boolean
		/** 计费单位 */
		billing_currency: BillingCurrency
		/** 输入计价 */
		input_pricing: number
		/** 输出计价 */
		output_pricing: number
		/** 缓存写入计价 */
		cache_write_pricing: number
		/** 缓存命中计价 */
		cache_hit_pricing: number
		/** 计费类型 */
		billing_type: PersistBillingType
		/** 输入成本 */
		input_cost: number
		/** 输出成本 */
		output_cost: number
		/** 缓存写入成本 */
		cache_write_cost: number
		/** 缓存命中成本 */
		cache_hit_cost: number
		/** 每张数费用 */
		time_pricing: number
		/** 每张数成本 */
		time_cost?: number | string | null
		/** 按秒定价 */
		second_pricing?: number | string | null
		/** 按秒成本 */
		second_cost?: number | string | null
		// /** 分层计费配置
		//  * 为空时整体回退到 input_pricing/output_pricing/cache_write_pricing/cache_hit_pricing；
		//  * 不为空时按 billing_tiers 优先计费
		//  */
		billing_tiers?: BillingTier[] | null
		// ---- 以下为前端表单本地字段，不提交给后端 ----
		/** 输入售价定价方式 */
		input_token_mode?: PricingMode
		/** 输出售价定价方式 */
		output_token_mode?: PricingMode
		/** 缓存写入售价定价方式 */
		cache_write_token_mode?: PricingMode
		/** 缓存命中售价定价方式 */
		cache_hit_token_mode?: PricingMode
		/** 输入售价阶梯 */
		input_token_steps?: PricingStep[]
		/** 输入售价开关 */
		input_token_enabled?: boolean
		/** 输出售价阶梯 */
		output_token_steps?: PricingStep[]
		/** 输出售价开关 */
		output_token_enabled?: boolean
		/** 缓存写入售价阶梯 */
		cache_write_token_steps?: PricingStep[]
		/** 缓存写入售价开关 */
		cache_write_token_enabled?: boolean
		/** 缓存命中售价阶梯 */
		cache_hit_token_steps?: PricingStep[]
		/** 缓存命中售价开关 */
		cache_hit_token_enabled?: boolean
		/** 输入成本定价方式 */
		input_token_cost_mode?: PricingMode
		/** 输出成本定价方式 */
		output_token_cost_mode?: PricingMode
		/** 缓存写入成本定价方式 */
		cache_write_token_cost_mode?: PricingMode
		/** 缓存命中成本定价方式 */
		cache_hit_token_cost_mode?: PricingMode
		/** 输入成本阶梯 */
		input_token_cost_steps?: PricingStep[]
		/** 输入成本开关 */
		input_token_cost_enabled?: boolean
		/** 输出成本阶梯 */
		output_token_cost_steps?: PricingStep[]
		/** 输出成本开关 */
		output_token_cost_enabled?: boolean
		/** 缓存写入成本阶梯 */
		cache_write_token_cost_steps?: PricingStep[]
		/** 缓存写入成本开关 */
		cache_write_token_cost_enabled?: boolean
		/** 缓存命中成本阶梯 */
		cache_hit_token_cost_steps?: PricingStep[]
		/** 缓存命中成本开关 */
		cache_hit_token_cost_enabled?: boolean
	}

	export type ReviewStatus = "UNDER_REVIEW" | "APPROVED" | "REJECTED"
	export type PublishStatus = "UNPUBLISHED" | "PUBLISHED"
	export type PublishTargetType = "ORGANIZATION" | "MEMBER"
	export type ReviewAction = "APPROVED" | "REJECTED"

	export interface OrganizationReviewListParams extends Required<CommonPageParams> {
		review_status?: ReviewStatus
		publish_status?: PublishStatus
		publish_target_type?: PublishTargetType
		version?: string
		order_by?: "asc" | "desc"
		start_time?: string
		end_time?: string
	}

	export interface GetOrganizationAgentVersionReviewListParams extends OrganizationReviewListParams {
		name_i18n?: string
	}

	export interface GetOrganizationSkillVersionReviewListParams extends OrganizationReviewListParams {
		source_type?: string
		skill_name?: string
		package_name?: string
	}

	export interface ReviewOrganizationVersionParams {
		action: ReviewAction
		review_remark?: string | null
	}

	export interface OrganizationInfo {
		code?: string
		name?: string
	}

	export interface PublisherInfo {
		user_id?: string
		nickname?: string
	}

	export interface OrganizationAgentVersionReview {
		id: string
		organization?: OrganizationInfo
		code: string
		name_i18n?: PlatformPackage.NameI18N
		role_i18n?: PlatformPackage.RoleI18N
		description_i18n?: PlatformPackage.NameI18N
		version: string
		publish_status: PublishStatus
		review_status: ReviewStatus
		review_remark?: string | null
		publish_target_type: PublishTargetType
		type: number
		is_current_version: boolean
		publisher?: PublisherInfo
		created_at: string
		published_at?: string | null
	}

	export interface OrganizationSkillVersionReview {
		id: string
		organization?: OrganizationInfo
		code: string
		package_name?: string
		name_i18n?: PlatformPackage.NameI18N
		description_i18n?: PlatformPackage.NameI18N
		version: string
		publish_status: PublishStatus
		review_status: ReviewStatus
		review_remark?: string | null
		publish_target_type: PublishTargetType
		source_type?: string
		publisher?: PublisherInfo
		created_at: string
		published_at?: string | null
	}

	/* 模型信息 */
	export interface ModelInfo {
		id: string
		model_id: string
		name: string
		icon: string
		description: string
		category: AiModel.ServiceProviderCategory
		/** 服务商编码 */
		provider_code: AiModel.ServiceProvider
		/** 模型部署名 */
		model_version: string
		/* 模型类型 */
		model_type: AiModel.ModelTypeGroup
		/* 服务商id */
		service_provider_config_id: string
		/* 可见套餐 */
		visible_packages?: string[]
		/* 应用可用性 */
		visible_applications?: string[]
		/* 负载权重 */
		load_balancing_weight?: string
		/* 模型配置 */
		config: {
			/* 最大token */
			max_tokens: number
			/* 最大输出token */
			max_output_tokens: number
			/* 创造性温度 */
			creativity: number
			/* 固定温度 */
			temperature: number
			/* 支持函数 */
			support_function: boolean
			/* 支持多模态 */
			support_multi_modal: boolean
			/* 支持深度思考 */
			support_deep_think: boolean
			/* 计费单位 */
			billing_currency: BillingCurrency
			/* 输入计价 */
			input_pricing: number
			/* 输出计价 */
			output_pricing: number
			/* 缓存写入计价 */
			cache_write_pricing: number
			/* 缓存命中计价 */
			cache_hit_pricing: number
			/* 计费类型 */
			billing_type: BillingType
			/* 每张数费用 */
			time_pricing: number
			/* 输入成本 */
			input_cost: number
			/* 输出成本 */
			output_cost: number
			/* 缓存写入成本 */
			cache_write_cost: number
			/* 缓存命中成本 */
			cache_hit_cost: number
		}
		/* 排序 */
		sort: number
		/* 状态 */
		status: AiModel.Status
		/* 多语言配置 */
		translate: TranslateConfig
		/* 创建时间 */
		created_at: string
		extra?: {
			extra_header?: string
			extra_body?: string
		}
	}

	/* 服务商列表 */
	export interface ServiceProviderList {
		id: string
		name: string
		icon: string
		description: string
		alias: string
		/* 多语言配置 */
		translate: {
			alias: Lang
		}
		sort: number
		/* 服务商状态 */
		status: AiModel.Status
		/* 服务商id */
		service_provider_id: string
		/* 服务商编码 */
		provider_code: AiModel.ServiceProvider
		/* 服务商类型 */
		provider_type: AiModel.ProviderType
		/* 模型列表 */
		models: ModelInfo[]
		/* 配置信息 */
		config: ApiKeyConfig
		/* 是否开启获取模型列表开关 */
		is_models_enable: boolean
		/* 服务商种类 */
		category: AiModel.ServiceProviderCategory
		/* 创建时间 */
		created_at: string
	}

	/* 服务商详细信息 */
	export type ServiceProviderDetail = ServiceProviderList

	/* 更新模型状态 */
	export interface UpdateModelStatusParams {
		model_id: string
		status: AiModel.Status
	}

	/* 添加模型参数 */
	export type AddModelParams = Omit<ModelInfo, "id" | "sort" | "status"> & {
		translate?: {
			alias?: Lang
		}
	}

	/* 模型标识列表 */
	export interface ModelIdList {
		id: string
		model_id: string
		type: AiModel.ModelIdType
		created_at: string
		updated_at: string
	}

	/* 连通性测试 */
	export interface TestConnectionParams {
		/* 服务商id */
		service_provider_config_id: string
		/* 模型版本 */
		model_version: string
		/* 模型id */
		model_id?: string
	}

	/* 连通性测试结果 */
	export interface TestConnectionResult {
		status: boolean
		message: {
			error: {
				code: string
				message: string
				param: string
				type: string
			}
		}
	}

	/* 获取默认图标 */
	export interface Icon {
		key: string
		url: string
		type: AiModel.FileType
	}

	/* 上传文件到指定业务 */
	export interface FileToBusinessParams {
		file_key: string
		business_type: AiModel.BusinessType
	}

	/* 官方服务商积分统计 */
	export interface OfficialPointsStatistics {
		organization_code: string
		total_point_amount: number
		total_last_7_days: number
		total_today: number
		total_yesterday: number
		change_percentage: number
		change_direction: string
		department_id: string
		user_id: string
		statistics_date: string
	}

	/* 获取企业内部助理列表参数 */
	export interface GetAgentListParams {
		page: number
		page_size: number
		status?: AiModel.AgentStatus
		robot_name?: string
		created_uid?: string
	}

	/* 企业内部助理列表 */
	export interface Agent {
		id: string
		robot_name: string
		robot_avatar: string
		robot_description: string
		created_at: string
		created_nickname: string
		release_scope: AiModel.ReleaseScope
		enterprise_release_status: AiModel.EnterpriseStatus
		app_release_status: AiModel.PlatformStatus
		approval_status: AiModel.ApprovalStatus
	}

	/* 更新助理状态 */
	export interface UpdateAgentStatusParams {
		bot_id: string
		status: AiModel.AgentStatus
	}

	/* 保存助理 */
	export interface SaveAgentParams {
		id?: string
		robot_name: string
		robot_avatar: string
		robot_description?: string
	}

	/* 是否是官方组织 */
	export interface IsOfficialOrg {
		is_official: boolean
		official_organization: string
	}

	/* 获取已发布助理列表参数 */
	export interface GetPublishListParams {
		page_token: string
		page_size: number
		type: AiModel.FriendType
	}

	/* 已发布助理列表 */
	export interface PublishAgentList {
		agent_id: string
		name: string
		avatar: string
	}

	/* 默认好友列表 */
	export interface DefaultFriendList {
		selected_agent_ids: string[]
	}

	/* 已选用户列表 */
	export interface SelectedMember {
		/* 成员类型, 1: 用户, 2: 部门 */
		member_type: AiModel.AccountType
		member_id: string
		avatar?: string
		name?: string
	}

	/* 创建管理列表 */
	export interface CreateManageList {
		/* 权限范围 */
		permission_range?: AiModel.PermissionType
		/* 已选用户列表 */
		selected_members: SelectedMember[]
	}

	/* 第三方平台发布管控列表 */
	export interface ThirdPublishList {
		/* 权限范围 */
		permission_range?: AiModel.PermissionType
		/* 已选助理列表 */
		selected_agents: PublishAgentList[]
	}

	export enum AgentGlobalKey {
		DefaultFriend = "default_friend",
		CreateManage = "create_management",
		ThirdPublish = "third_platform_publish",
	}

	export type AgentGlobalSettingExtra = {
		[AiModel.AgentGlobalSettingType.DefaultFriend]: DefaultFriendList
		[AiModel.AgentGlobalSettingType.CreateManage]: CreateManageList
		[AiModel.AgentGlobalSettingType.ThirdPublish]: ThirdPublishList
	}

	export type AgentGlobalSettingItem<T extends AiModel.AgentGlobalSettingType> = {
		/* 类型 */
		type: T
		/* 状态 */
		status: AiModel.Status
		/* 额外配置 */
		extra: AgentGlobalSettingExtra[T]
	}

	/* AI助理全局设置 */
	export interface AgentGlobalSetting {
		[AgentGlobalKey.DefaultFriend]: AgentGlobalSettingItem<AiModel.AgentGlobalSettingType.DefaultFriend>
		[AgentGlobalKey.CreateManage]: AgentGlobalSettingItem<AiModel.AgentGlobalSettingType.CreateManage>
		[AgentGlobalKey.ThirdPublish]: AgentGlobalSettingItem<AiModel.AgentGlobalSettingType.ThirdPublish>
	}

	// 列表项数据类型
	export interface ListItem {
		id: string
		name: string
		description?: string
		// 可以根据需要添加更多字段
	}

	/* 管控规则 */
	export interface Rule {
		/* 目标id */
		target_id: string
		/* 目标名称 */
		target_name?: string
		/* 积分上限 */
		amount: number
		/* 已用积分 */
		used_amount?: number
		type?: string
	}

	/* 积分组织管控规则 */
	export interface ControlRule {
		/* 部门管控 */
		department_control: {
			type: string
			rules: Rule[]
		}
		/* 用户管控 */
		member_control: {
			type: string
			rules: Rule[]
		}
		/* 组织管控 */
		organization_control: {
			type: string
			rules: Rule[]
		}
	}

	/* 保存积分组织管控规则 */
	export interface SaveControlRuleParams {
		type: string
		rules: Rule[]
	}

	/* 查询管控目标已用积分 */
	export interface GetControlTargetUsedPointsParams {
		/* 目标id */
		target_ids: string[]
		/* 目标类型 department, user */
		target_type: "department" | "user"
		/* 开始时间 格式：2025-01 */
		month: string
	}

	/* 获取商品列表并携带sku 参数 */
	export interface GetProductListWithSkuParams extends CommonPageParams {
		category: number
	}

	export interface ProductListWithSkuItem {
		product: PlatformPackage.Package & {
			name: string
			subtitle: string
		}
		skus: PlatformPackage.Skus[]
	}

	/* 获取商品列表并携带sku */
	export interface ProductListWithSku {
		list: ProductListWithSkuItem[]
		total: number
	}

	/** 组织当前订阅的套餐 */
	export interface SubscriptionInfo extends SubscriptionInfoItem {
		pending_subscriptions: SubscriptionInfoItem[]
	}

	interface SubscriptionInfoItem {
		id: string
		product_id: string
		product_sku_id: string
		name: string
		start_date: string
		end_date: string
		renewal_type: string
		payment_cycle: string
		level: number
		plan_type: PlatformPackage.PackageType
		seat_count: number
		is_paid_plan: boolean
		is_recharge_points: boolean
	}
}
