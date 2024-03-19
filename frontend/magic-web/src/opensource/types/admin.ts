export namespace Admin {
	/** 分页数据 */
	export interface WithPage<ListType> {
		page: number
		page_size: number
		list: ListType
		total: number
	}

	export enum ProductCategory {
		/** 订阅套餐 */
		Packages = "1",
		/** 积分充值 */
		Points = "2",
	}

	export enum PaymentType {
		/** 网页跳转 */
		Web = "web",
		/** 网页二维码 */
		QR = "qr",
		/** 移动端应用 */
		APP = "app",
		/** 移动端网页 */
		WAP = "wap",
	}

	/** 获取商品列表的请求参数 */
	export interface GetProductsListParams {
		page?: number
		page_size?: number
		category: ProductCategory
	}

	/** 获取商品列表的返回数据 */
	export interface ProductItem {
		product: ProductItemInfo
		skus: ProductItemSku[]
	}

	/** 商品信息 */
	export interface ProductItemInfo {
		id: string
		name: string
		description: string
		subtitle: string
		enable: boolean
		category: string
		sort: number
		created_at: string
		extra: {
			level: number
		} | null
	}

	export enum SkuPayment {
		Online = "online",
		Contact = "contact_customer_service",
		None = "none",
	}

	/** SKU的订阅类型字段值 */
	export enum SubscriptionType {
		Month = "monthly",
		Year = "yearly",
		Permanent = "permanent",
	}

	/** SKU的积分发放方式字段值 */
	export enum DistributionMethod {
		Daily = "daily",
		Monthly = "monthly",
		Immediately = "immediate",
		None = "none",
	}

	/** SKU的积分有效期字段值 */
	export enum PointsValidity {
		Daily = "daily",
		Monthly = "monthly",
		Perpetual = "permanent",
	}

	/** SKU的类型 */
	export enum SkuType {
		Package = "subscription",
		Points = "points",
	}

	/** SKU套餐的类型 */
	export enum PlanType {
		/** 个人版 */
		Personal = "personal",
		/** 团队版 */
		Team = "team",
		/** 企业版 */
		Enterprise = "enterprise",
	}

	/** 商品SKU信息 */
	export interface ProductItemSku {
		id: string
		product_id: string
		name: string
		type: string
		enable: boolean
		price: number
		currency: string
		original_price: number
		payment: SkuPayment
		stock: number
		is_stock_managed: boolean
		attributes: PackageSkuAttributes & PointsSkuAttributes
		created_at: string
		platform_products: {
			app_store: {
				id: string
			}
		} | null
	}

	/** 套餐SKU属性 */
	export interface PackageSkuAttributes {
		sku_type: SkuType
		subscription_type: SubscriptionType
		plan_type: PlanType
		description?: string
		peak_priority_level: number
		is_paid_plan: boolean
		cloud_storage_capacity?: string
		point_settings: {
			distribution_method: DistributionMethod
			validity: PointsValidity
			points_amount: number
		}
		team_settings: {
			max_members: number
		}
		feature_limits: {
			topic_limit: string
			workspace_limit: string
			topic_share_limit: string
			concurrent_task_limit: number
			website_generation_limit: string
			total_task_consumption_limit: number
			high_priority_execution_times: number
			single_round_consumption_limit: number
		}
		/** 套餐用量 */
		package_usage: {
			/** AI 聊天 */
			ai_chat: number
			/** 数据看板 */
			data_dashboard: number
			/** 制作 PPT */
			slide_page: number
			/** 录音总结 */
			audio_summary: number
		}
		/** 大模型列表 */
		model_bindings: {
			/** 大模型名称 */
			name: string
			/** 计费方式: normal-正常计费, free-免费 */
			billing_method: "normal" | "free"
		}[]
	}

	/** 积分充值SKU属性 */
	export interface PointsSkuAttributes {
		sku_type: SkuType
		points_amount: number
		description?: string
		validity: string
	}

	/** 创建支付订单的请求参数 */
	export interface CreatePaymentOrderParams {
		product_id: string
		sku_id: string
		payment_method: string
		payment_type: PaymentType
		extras?: {
			seat_count?: number
			quit_url?: string
			return_url?: string
		}
	}

	/** 创建支付订单的响应 */
	export interface CreatePaymentOrderResponse {
		status: boolean
		payment_response_data: {
			order_id: string
			pay_response: string
			qr_code: string
			amount: number
		}
	}

	/** 查询订单状态的请求参数 */
	export interface GetPaymentOrderStatusParams {
		order_id: string
	}

	/** 订单状态 */
	export enum OrderStatus {
		/** 待支付状态：订单未创建，等待用户完成支付。 */
		Pending = "PENDING",
		/** 已支付状态：订单已成功支付。 */
		Paid = "PAID",
		/** 已退款状态：订单已完成退款。 */
		Refunded = "REFUNDED",
		/** 已过期状态：订单在规定时间内未完成支付，已自动过期作废。 */
		Expired = "EXPIRED",
		/** 交易关闭：订单交易被取消，例如用户主动取消支付。 */
		Closed = "CLOSED",
		/** 交易完成：订单已完成，通常表示服务已交付且不可再退款。 */
		Finished = "FINISHED",
	}

	/** 查询订单状态的响应 */
	export interface PaymentOrderStatus {
		order_status: OrderStatus
		product_id: string
		product_sku_id: string
		pay_product_name: string
	}

	/** 查询订单列表的请求参数 */
	export interface GetPaymentOrderListParams {
		page?: number
		page_size?: number
		date?: string
		status?: OrderStatus
	}

	/** 查询订单列表的响应 */
	export interface PaymentOrderListItem {
		id: string
		sku_id: string
		product_id: string
		amount: number
		currency: string
		status: string
		payment_platform: string
		payment_platform_order_id: string | null
		created_at: string
		paid_at: string
		cancelled_at: string
		refunded_at: string
		expired_at: string
		product_name: string
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
		plan_type: PlanType
		seat_count: number
		is_paid_plan: boolean
		is_recharge_points: boolean
	}

	/** 即将过期的积分配额 */
	export interface ExpiringQuotaDetail {
		quota_id: number
		expires_at: string
		remaining_points: number
	}

	/** 下一次自动发放积分的安排 */
	export interface NextCycleGrant {
		scheduled_at: string
		points: number
		rule_name: string
		rule_group_name: string
	}

	/** 获取组织当前积分总数的响应 */
	export interface OrganizationPoints {
		total_points: number
		expiring_quota_details: ExpiringQuotaDetail[]
		next_cycle_grant: NextCycleGrant
	}

	/** 获取组织积分的变更记录的请求参数 */
	export interface GetOrganizationPointsChangeParams {
		date: string
		filter_type: number // 1-> 全部，2-> 收入，3-> 支出
		filter_range: string // personal->仅自己，team->全团队
		page?: number
		page_size?: number
	}

	/** 获取组织积分的变更记录的响应 */
	export interface OrganizationPointsChangeListItem {
		id: string
		amount: string
		topic_id: string
		label: string
		description: string
		created_at: string
		updated_at: string
	}

	/** 免费积分每日领取的响应 */
	export interface ClaimFreePointsResponse {
		granted: boolean
		point_amount: number
		expire_type: number
		message: string
	}

	/** 追加套餐坐席的请求参数 */
	export interface AddSubscriptionSeatParams {
		payment_method: string
		payment_type: PaymentType
		additional_seats: number
		extras?: {
			return_url?: string
			quit_url?: string
		}
	}

	/** 查询大模型的积分消耗的请求参数 */
	export interface GetModelPointsConsumptionParams {
		model_ids: string[]
	}

	/** 计费类型 */
	export enum BillingType {
		/** 文本模型的 输入/输出百万Token 的积分消耗 */
		Tokens = "Tokens",
		/** 多模态模型的 单次调用 的积分消耗 */
		Times = "Times",
	}

	/** 查询大模型的积分消耗的响应 */
	export interface ModelPointsConsumption {
		model_id: string
		model_name: string
		billing_type: BillingType
		input_points: number | null
		output_points: number | null
		time_points: number | null
	}

	/** 同步组织架构的请求参数 */
	export interface SyncOrganizationsParams {
		organization_codes: string[]
	}

	/** 根据Teamshare组织code获取magic组织code的请求参数 */
	export interface GetOrganizationCodeByTeamshareCodeParams {
		teamshare_organization_code: string
		env_id: string
	}

	/** 根据Teamshare组织code获取magic组织code的响应 */
	export interface GetOrganizationCodeByTeamshareCodeResponse {
		magic_organization_code: string
	}

	export enum SubscriptionTier {
		Free = "free",
		Paid = "paid",
	}
}
