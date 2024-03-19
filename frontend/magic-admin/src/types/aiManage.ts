import type { AiModel } from "@/const/aiModel"
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
		ByTokens = "Tokens",
		ByTimes = "Times",
	}

	export type TranslateConfig = {
		name: Lang
		description: Lang
	}

	/* 模型信息 */
	export interface ModelInfo {
		id: string
		model_id: string
		name: string
		icon: string
		description: string
		category: AiModel.ServiceProviderCategory
		/* 模型部署名 */
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
