import type { AiModel } from "../const/aiModel"
import type { AiManage } from "./aiManage"
import type { PageParams } from "./common"

/** 平台套餐 */
export namespace PlatformPackage {
	export interface GlobalConfig {
		is_maintenance: boolean
		maintenance_description: string
	}

	export interface NameI18N {
		en_US?: string
		zh_CN?: string
		default?: string
	}

	/** 商品类型 */
	export enum Category {
		/** 套餐 */
		Package = "1",
		/** 积分 */
		Point = "2",
	}

	/** 积分发放模式 */
	export enum DistributionMethod {
		/** 即刻发放 */
		Immediate = "immediate",
		/** 每日发放 */
		Daily = "daily",
		/** 按月发放 */
		Monthly = "monthly",
	}

	/** 积分有效期 */
	export enum PointExpiration {
		/** 永久有效 */
		Permanent = "permanent",
		/** 当日有效 */
		Daily = "daily",
		/** 当月有效 */
		Monthly = "monthly",
		/** 一年有效 */
		Yearly = "year",
		/** 两年有效 */
		TwoYears = "two_years",
		/** 不适用 */
		None = "none",
	}

	/** 支付方式 */
	export enum PaymentMethod {
		/** 线上支付 */
		Online = "online",
		/** 联系客服 */
		ContactCustomerService = "contact_customer_service",
	}

	/** 订阅属性 */
	export enum SubscriptionAttribute {
		/** 付费 */
		Paid = "paid",
		/** 免费 */
		Free = "free",
	}

	/** 数量限制 */
	export enum NumberLimit {
		/** 不限制 */
		Unlimited = "unlimited",
		/** 限制 */
		Limited = "limit",
	}

	/** 订阅类型 */
	export enum SubscriptionType {
		/** 月度订阅 */
		Monthly = "monthly",
		/** 年度订阅 */
		Yearly = "yearly",
		/** 永久订阅 */
		Permanent = "permanent",
	}

	/** 订阅套餐类型 */
	export const SubscriptionCategory = {
		/** 月度订阅 */
		[SubscriptionType.Monthly]: "10001",
		/** 年度订阅 */
		[SubscriptionType.Yearly]: "10002",
		/** 永久订阅 */
		[SubscriptionType.Permanent]: "10003",
	}

	/** 套餐类型 */
	export enum PackageType {
		/** 个人套餐 */
		Personal = "personal",
		/** 团队套餐 */
		Team = "team",
		/** 企业套餐 */
		Enterprise = "enterprise",
	}

	/** 套餐下可用的模型计费类型 */
	export enum PricingType {
		/** 正常计费 */
		Normal = "normal",
		/** 免费 */
		Free = "free",
		/** 折扣 */
		Discount = "discount",
		/** 不适用 */
		Unavailable = "unavailable",
	}

	/** 套餐下可用的模型 */
	export interface ModelBindings {
		[key: string]: {
			/** 永久订阅 */
			permanent_pricing_type: PricingType
			/** 月度订阅 */
			monthly_pricing_type: PricingType
			/** 年度订阅 */
			yearly_pricing_type: PricingType
			/** 订阅折扣率 */
			permanent_discount_rate?: number
		}
	}
	/** 套餐列表 */
	export interface Package {
		id: string
		name_i18n: NameI18N
		subtitle_i18n: NameI18N
		description_i18n: NameI18N
		enable: boolean
		sort: number
		category: Category
		created_at: string
		/** 额外数据 */
		extra: {
			level: number
			/** 套餐下可用的模型 */
			model_bindings: ModelBindings
			/** 所有模型可用 */
			all_model_available: boolean
		}
	}

	/** 对应套餐下可用的模型信息 */
	export interface PackageAvailableModels {
		available_models: {
			[key: string]: AiManage.ModelInfo[]
		}
		product_id: number
	}

	/** 订阅sku */
	export interface Skus {
		id: string
		product_id?: string
		category?: string
		attributes: Attributes
		created_at?: string
		name?: string
		/** 货币类型 */
		currency: string
		/** 是否启用 */
		enable: boolean
		/** 是否无限库存 */
		is_stock_managed?: boolean
		/** 套餐名称 */
		name_i18n: NameI18N
		/** 原价 */
		original_price: number
		/** 支付方式 */
		payment: PaymentMethod
		/** 出售价格 */
		price: number
		/** 库存 */
		stock: number
	}

	export interface Attributes {
		/** 套餐类型 */
		sku_type: "subscription"
		/** 超级麦吉能力 */
		feature_limits: FeatureLimits
		/** 当前sku订阅配置 */
		point_settings: PointSettings
		/** 团队设置 */
		team_settings: TeamSettings
		/** 套餐类型 */
		plan_type: PackageType
		/** 是否付费套餐 */
		is_paid_plan: boolean
		/** 订阅类型 */
		subscription_type: SubscriptionType
		/** 优先级 */
		peak_priority_level: number
		/** 云盘容量 */
		cloud_storage_capacity: string
		/** 描述 */
		description_i18n: NameI18N
	}

	export interface FeatureLimits {
		/** 并发任务限制 */
		concurrent_task_limit: number
		/** 高优先级执行次数 */
		high_priority_execution_times: string
		/** 单轮消耗限制 */
		single_round_consumption_limit: number
		/** 话题限制 */
		topic_limit: string
		/** 话题分享限制 */
		topic_share_limit: string
		/** 总任务消耗限制 */
		total_task_consumption_limit: number
		/** 网站生成限制 */
		website_generation_limit: string
		/** 工作区限制 */
		workspace_limit: string
	}

	/** 积分设置 */
	export interface PointSettings {
		/** 发放模式 */
		distribution_method: DistributionMethod
		/** 发放数量 */
		points_amount: number
		/** 有效期 */
		validity: PointExpiration
	}

	export interface TeamSettings {
		max_members: number
	}

	/** 套餐详情 */
	export interface PackageDetail {
		product: Package
		skus: Skus[]
	}

	/** 添加套餐 */
	export interface AddPackageParams {
		product: Pick<Package, "name_i18n" | "subtitle_i18n" | "description_i18n">
	}

	/** 套餐常量类型 */
	export interface OptionsType {
		label: string
		value: string
	}

	/** 套餐常量可选项 */
	export interface PackageConstantOptions {
		distribution_method: OptionsType[]
		feature_limit_types: OptionsType[]
		payment_method: OptionsType[]
		plan_types: OptionsType[]
		subscription_types: OptionsType[]
		validity: OptionsType[]
	}

	/** 模式列表筛选参数 */
	export interface ModeListParams extends Required<PageParams> {
		/** 状态 */
		status?: 1 | 0
		/** 模式名称关键词 */
		keyword?: string
		/** 模式标识 */
		identifier?: string
	}

	/** 模式分配方式 */
	export enum DistributionType {
		/** 独立 */
		Independent = 1,
		/** 跟随 */
		Follow = 2,
	}

	/* 图标类型 */
	export enum IconType {
		/* 图标 */
		Icon = 1,
		/* 图片 */
		Image = 2,
	}

	/* 模式 */
	export interface Mode {
		color: string
		created_at: string
		description: string
		/** 分配方式 */
		distribution_type: DistributionType
		/** 跟随模式ID */
		follow_mode_id: string
		/* 图标类型 1:图标 2:图片 */
		icon_type: IconType
		/* 图标 */
		icon: string
		/* 图标url */
		icon_url: string
		id: string
		identifier: string
		/** 是否默认 */
		is_default: 1 | 0
		/** 名称 */
		name_i18n: NameI18N
		/** 占位文本 */
		placeholder_i18n: NameI18N
		organization_code: string
		status: boolean
		updated_at: string
		sort: number | string
		organization_whitelist: string
	}

	/** 添加模式 */
	export type AddModeParams = Pick<
		Mode,
		| "name_i18n"
		| "description"
		| "icon"
		| "color"
		| "identifier"
		| "organization_code"
		| "icon_type"
		| "icon_url"
	>

	/** 模式分组 */
	export interface ModeGroup {
		created_at: string
		description: string
		icon: string
		id: string
		mode_id: string
		models: string[]
		name_i18n: NameI18N
		sort: number
		status: boolean
	}

	/** 添加模式分组 */
	export type AddModeGroupParams = Pick<ModeGroup, "icon" | "name_i18n" | "mode_id"> & {
		id?: string
	}

	/** 模式分组模型状态 */
	export enum ModeGroupModelStatus {
		/** 正常 */
		Normal = "normal",
		/** 删除 */
		Deleted = "deleted",
		/** 禁用 */
		Disabled = "disabled",
	}

	/** 模式分组中的基础模型 */
	export interface BaseModel {
		id: string
		/** 模式组ID */
		group_id: string
		/** 服务商模型ID */
		provider_model_id: string
		/** 模型图标 */
		model_icon: string
		/** 模型ID */
		model_id: string
		/** 模型名称 */
		model_name: string
		/** 排序 */
		sort: number
		/** 模型状态 */
		model_status: ModeGroupModelStatus
		/** 模型分类 */
		model_category: AiModel.ServiceProviderCategory
	}

	/* 模型类型 */
	export enum ModelType {
		Dynamic = "dynamic",
	}

	/* 策略类型 */
	export enum StrategyType {
		/** 权限降级策略 */
		PermissionFallback = "permission_fallback",
	}

	/* 子模型调用顺序方向 */
	export enum OrderDirection {
		Asc = "asc",
		Desc = "desc",
	}

	/* 动态模型 */
	export interface DynamicModel extends Omit<BaseModel, "model_status"> {
		/** 模型描述 */
		model_description?: string
		/** 模型类型, dynamic: 动态模型 */
		model_type: ModelType.Dynamic
		/** 聚合配置 */
		aggregate_config: {
			/** 子模型列表  */
			models: BaseModel[]
			/** 策略类型, 默认 permission_fallback 权限降级策略 */
			strategy?: StrategyType
			/** 策略配置 */
			strategy_config?: {
				/* 子模型调用顺序方向 */
				order?: OrderDirection
			}
		}
		/** 模型多语言 */
		model_translate: {
			name?: NameI18N
			description?: NameI18N
		}
	}

	export type ModelItem = BaseModel | DynamicModel

	/** 模式详情 */
	export interface ModeDetail {
		mode: Mode
		groups: {
			group: ModeGroup
			models: ModelItem[]
		}[]
	}

	/** 获取所有模型列表 */
	export interface GetAllModelListParams {
		category?: AiModel.ServiceProviderCategory
		is_model_id_filter: boolean
		/* 状态可用 */
		status: 0 | 1
	}

	/** 获取订单列表参数 */
	export interface GetOrderListParams extends Required<PageParams> {
		include_product_ids?: string[]
		include_sku_ids?: string[]
		/** 支付平台 */
		payment_platform?: string
		payment_platforms?: string[]
		/** 订单状态 */
		status?: string
		order_status?: string[]
		/** 创建时间 */
		start_date?: string
		end_date?: string
		/** 组织编码 */
		organization_code?: string
		/** 最小金额 */
		min_amount?: number
		/** 最大金额 */
		max_amount?: number
		/** 用户ID */
		user_name?: string
		/** 订单ID */
		order_id?: string
		/** 手机号 */
		mobile?: string
	}

	/** 订单状态 */
	export enum OrderStatus {
		/** 待支付 */
		Pending = "PENDING",
		/** 已支付 */
		Paid = "PAID",
		/** 已退款 */
		Refunded = "REFUNDED",
		/** 已过期 */
		Expired = "EXPIRED",
		/** 交易关闭 */
		Closed = "CLOSED",
		/** 交易完成 */
		Finished = "FINISHED",
	}

	/** 支付平台 */
	export enum PaymentPlatform {
		/** 支付宝 */
		Alipay = "ALIPAY",
		/** 微信 */
		Wechat = "WECHAT_PAY",
		/** Stripe */
		Stripe = "STRIPE",
		/** 系统 */
		System = "SYSTEM",
		/** Apple Pay */
		APPLE_PAY = "APPLE_PAY",
		/* Apple Pay 沙盒 */
		APPLE_PAY_SANDBOX = "APPLE_PAY_SANDBOX",
	}

	/** 获取订单列表 */
	export interface OrderList {
		amount: number
		cancelled_at: null
		created_at: string
		currency: string
		expired_at: null
		id: string
		magic_id: string
		paid_at: null | string
		payment_platform: PaymentPlatform
		payment_platform_order_id: null | string
		product_id: number
		product_name: string
		refunded_at: null
		sku_id: number
		status: OrderStatus
		user_id: string
		organization_code: string
		organization_name: string
		mobile: string
		nick_name: string
	}

	/** 获取订单商品筛选条件 */
	export interface OrderProduct {
		skus: {
			sku_id: string
			sku_name: string
		}[]
		spu_id: number
		spu_name: string
	}

	/** Skill 管理 - 查询参数 */
	export interface GetSkillVersionListParams extends Required<PageParams> {
		package_name?: string
		review_status?: string
		publish_status?: string
		publish_target_type?: string
		source_type?: string
		version?: string
		order_by?: "asc" | "desc"
		start_time?: string
		end_time?: string
	}

	/** Skill 管理 - 列表项 */
	export interface SkillVersion {
		id: string
		code: string
		organization_code?: string
		organization?: {
			code?: string
			name?: string
		}
		package_name: string
		name_i18n?: NameI18N
		description_i18n?: NameI18N
		version: string
		publish_status: string
		review_status: string
		publish_target_type: string
		source_type: string
		publisher?: {
			user_id?: string
			nickname?: string
		}
		created_at: string
		published_at?: string | null
	}

	export type ReviewSkillAction = "APPROVED" | "REJECTED"

	export type SkillPublisherType = "USER" | "OFFICIAL"

	export interface ReviewSkillVersionParams {
		action: ReviewSkillAction
		publisher_type?: SkillPublisherType
	}

	/** Skill 市场 - 查询参数 */
	export interface GetSkillMarketListParams extends Required<PageParams> {
		package_name?: string
		publish_status?: string
		organization_code?: string
		name_i18n?: string
		publisher_type?: SkillPublisherType
		skill_code?: string
		order_by?: "asc" | "desc"
		start_time?: string
		end_time?: string
	}

	/** Skill 市场 - 列表项 */
	export interface SkillMarketItem {
		id: string
		package_name?: string
		is_featured?: boolean
		organization_code: string
		organization?: {
			code?: string
			name?: string
		}
		skill_code: string
		skill_version_id: string
		name_i18n?: NameI18N
		description_i18n?: NameI18N
		logo?: string | null
		publisher_id?: string
		publisher_type?: SkillPublisherType
		category_id?: string | null
		publish_status: string
		install_count?: number
		sort_order?: number
		publisher?: {
			user_id?: string
			nickname?: string
		}
		created_at: string
		updated_at: string
	}

	/** Skill 市场 - 更新信息参数 */
	export interface UpdateSkillMarketInfoParams {
		is_featured?: boolean
		sort_order?: number
	}

	/** 员工市场 - 查询参数 */
	export interface GetAgentMarketListParams extends Required<PageParams> {
		publish_status?: string
		organization_code?: string
		name_i18n?: string
		publisher_type?: SkillPublisherType
		agent_code?: string
		order_by?: "asc" | "desc"
		start_time?: string
		end_time?: string
	}

	/** 员工市场 - 列表项 */
	export interface AgentMarketItem {
		id: string
		is_featured?: boolean
		organization_code: string
		organization?: {
			code?: string
			name?: string
		}
		agent_code: string
		agent_version_id: string
		name_i18n?: NameI18N
		role_i18n?: RoleI18N
		description_i18n?: NameI18N
		icon?: string | null
		icon_type?: number
		publisher_id?: string
		publisher_type?: SkillPublisherType
		category_id?: string | null
		publish_status: string
		install_count?: number
		sort_order?: number
		publisher?: {
			user_id?: string
			nickname?: string
		}
		created_at: string
		updated_at: string
	}

	/** 员工市场 - 更新信息参数 */
	export interface UpdateAgentMarketInfoParams {
		is_featured?: boolean
		sort_order?: number
	}

	/** 员工审核列表 - 查询参数 */
	export interface GetAgentVersionReviewListParams extends Required<PageParams> {
		review_status?: string
		publish_status?: string
		publish_target_type?: string
		version?: string
		organization_code?: string
		name_i18n?: string
		order_by?: "asc" | "desc"
		start_time?: string
		end_time?: string
	}

	export interface RoleI18N {
		en_US?: string[]
		zh_CN?: string[]
	}

	/** 员工审核列表 - 列表项 */
	export interface AgentVersionReview {
		id: string
		organization_code: string
		organization?: {
			code?: string
			name?: string
		}
		code: string
		name_i18n?: NameI18N
		role_i18n?: RoleI18N
		description_i18n?: NameI18N
		version: string
		publish_status: string
		review_status: string
		publish_target_type: string
		type: number
		is_current_version: boolean
		publisher?: {
			user_id?: string
			nickname?: string
		}
		created_at: string
		published_at?: string | null
	}

	/* ========== 组织管理相关类型 ========== */

	/** 组织类型 */
	export enum OrganizationType {
		/** 企业组织 */
		Enterprise = 0,
		/** 个人 */
		Person = 1,
	}

	/** 组织状态 */
	export enum OrganizationStatus {
		Enabled = 1,
		Disabled = 2,
	}

	/** 同步状态 */
	export enum SyncStatus {
		/** 未同步 */
		NotSynced = 0,
		/** 同步成功 */
		Synced = 1,
		/** 同步失败 */
		SyncFailed = 2,
		/** 同步中 */
		Syncing = 3,
	}

	/** 获取组织列表参数 */
	export interface GetOrgListParams extends PageParams {
		name?: string
		magic_organization_code?: string
		type?: OrganizationType
		created_at_start?: string
		created_at_end?: string
	}

	/** 组织列表 */
	export interface Organization {
		id: string
		magic_organization_code: string
		name: string
		sync_time: string
		sync_type: string
		/** 席位数 */
		seats: number
		status: OrganizationStatus
		sync_status: SyncStatus
		type: OrganizationType
		created_at: string
		creator: {
			magic_id: string
			user_id: string
			avatar: string
			email: string
			name: string
			phone: string
		}
	}

	/** Logo 对象 */
	export interface Logo {
		url: string
		uid: string
		name: string
		key: string
	}

	/** 创建组织参数 */
	export interface CreateOrganizationParams {
		/** 组织名称 */
		name: string
		/** 组织编码 */
		magic_organization_code: string
		/** 手机号区号 */
		status_code: string
		/** 创建者手机号 */
		phone: string
		/** 行业类型 */
		industry_type?: string
		/** Logo */
		logo?: Logo
		/** 企业规模 */
		number?: string
		/** 联系人 */
		contact_user?: string
		/** 联系人手机号 */
		contact_mobile?: string
		/** 组织简介 */
		introduction?: string
	}

	/** 组织信息 */
	export interface OrganizationInfo {
		magic_organization_code: string
		name: string
		industry_type: string
		number: string
		contact_user: string
		contact_mobile: string
		introduction: string
		is_temporary: number | null
		logo: Logo | null
		creator: {
			name: string
			phone: string
			status_code: string
		}
	}

	/** 获取组织积分列表参数 */
	export interface GetOrgPointsListParams extends PageParams {
		organization_name?: string
		magic_id?: string
		phone?: string
	}

	/** 获取组织积分明细参数 */
	export interface GetOrgPointsDetailParams extends PageParams {
		organization_code: string
	}

	/** 添加组织积分参数 */
	export interface AddOrgPointsParams {
		organization_code: string
		point_amount: number
		description: string
	}

	/** 获取组织积分列表 */
	export interface OrgPointsList {
		key: string
		organization_code: string
		organization_name: string
		balance: number
		total_balance: number
		created_time: string
		creator_name: string
		creator_phone: string
		creator_user_id: string
		current_plan: string
		used_points: number
		type: OrganizationType
		current_plan_product_name: {
			zh_CN: string
			en_US: string
		}
		invitation_code: string
	}

	/** 获取组织积分明细 */
	export interface OrgPointsDetail {
		id: number
		amount: number
		organization_code: string
		user_id: string | null
		topic_id: string | null
		i18n_description: {
			en_US: string
			zh_CN: string
		}
		business_param: string
		created_at: string
		updated_at: string
		deleted_at: string | null
	}

	/** 绑定套餐参数 */
	export interface BindPackageParams {
		organization_codes: string[]
		product_sku_id: string
		seat_count: number
	}

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
		/* 图片搜索 */
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
		/** 网页爬取  */
		WEB_SCRAPE = "web_scrape",
		/* 图片转换高清 */
		IMAGE_CONVERT_HIGH = "image_convert_high",
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

	/** AI能力详情 */
	export interface AiPowerDetail extends AiPower {
		icon: string
		config: AiPowerConfig
		sort_order: number
	}

	/** 服务商配置 */
	export interface ProviderConfig {
		provider: string
		name: string
		enable: boolean
		// WebSearch 字段
		request_url?: string
		api_key?: string
		cx?: string
		region?: string
		// OCR 字段
		access_key?: string
		secret_key?: string
		// 语音识别字段
		app_key?: string
		hot_words?: string
		replacement_words?: string
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

	/** 更改AI能力 */
	export interface UpdateAiPowerParams {
		code: PowerCode
		status?: number
		config?: AiPowerConfig
	}

	/* 获取代理列表参数 */
	export type GetProxyServerListParams = PageParams

	/* 代理服务器类型 */
	export enum ProxyServerType {
		/* 代理服务器 */
		ProxyServer = "PROXY_SERVER",
		/* 订阅源 */
		Subscription = "SUBSCRIPTION",
	}

	/* 代理效期 */
	export enum ProxyDuration {
		/* 短期代理 */
		ShortTerm = "SHORT_TERM",
		/* 长期代理 */
		LongTerm = "LONG_TERM",
	}

	/* 代理地区 */
	export enum ProxyRegion {
		/* 中国地区 */
		China = "CHINA",
		/* 全球地区 */
		Global = "GLOBAL",
	}

	/* 代理服务器 */
	export interface ProxyServer {
		id: string
		name: string
		type: ProxyServerType
		remark: string
		status: 0 | 1
		updatedAt: string
		createdAt: string
		/* 代理地址（格式：protocol://host:port） */
		proxyUrl: string
		/* 用户名 */
		username: string | null
		/* 密码 */
		password: string | null
		/* 平台/服务商名称 */
		platform: string
		/* 订阅接口地址 */
		subscriptionUrl: string
		/* 认证配置（脱敏） */
		authConfig: {
			authKey: string
			authPwd: string
		} | null
		/* 代理效期：SHORT_TERM 或 LONG_TERM */
		proxyDuration: ProxyDuration
		/* 代理地区：CHINA 或 GLOBAL */
		proxyRegion: ProxyRegion
	}

	/* 更新/创建代理通用配置 */
	export type CreateProxyCommonParams = Pick<ProxyServer, "type" | "name" | "remark" | "status">

	/* Proxy Server 创建/更新参数 */
	export interface ProxyServerParams extends CreateProxyCommonParams {
		proxyUrl: string
		username?: string
		password?: string
	}

	/* Subscription 创建/更新参数 */
	export interface SubscriptionParams extends CreateProxyCommonParams {
		platform: string
		subscription_url: string
		auth_config: {
			authKey: string
			authPwd: string
		}
		proxy_duration: ProxyDuration
		proxy_region: ProxyRegion
	}

	/* 创建/更新代理参数 */
	export type CreateOrUpdateProxyParams = SubscriptionParams | ProxyServerParams

	/* 测试代理连通性参数 */
	export interface TestProxyConnection {
		/* 是否成功 */
		success: boolean
		/* 响应时间 */
		responseTime: number
		/* 响应时间评级 */
		rating: string
		/* 目标URL */
		targetUrl: string
		/* 消息 */
		message: string
		/* 详情 */
		details: {
			statusCode?: number
			responseBody?: string
			error?: string
		}
	}
}
