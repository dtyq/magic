import type { NameI18N, PackageType, SubscriptionType } from "./common"

/** 套餐列表 */
export interface Package {
	id: string
	name_i18n: NameI18N
	subtitle_i18n: NameI18N
	description_i18n: NameI18N
	enable: boolean
	sort: number
	category: string
	created_at: string
	extra: {
		level: number
		model_bindings?: Record<string, unknown>
		all_model_available?: boolean
	}
}

/** 订阅sku */
export interface Skus {
	id: string
	product_id?: string
	category?: string
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
	/** 出售价格 */
	price: number
	/** 库存 */
	stock: number
	attributes: {
		/** 订阅类型 */
		subscription_type: SubscriptionType
		/** 套餐类型 */
		plan_type?: PackageType
		[key: string]: unknown
	}
}
